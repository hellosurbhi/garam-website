import { createHash } from "node:crypto";
import { Redis } from "@upstash/redis";
import { alertOps, type OpsAlertReport } from "@/lib/opsAlert";
import { readTrimmedEnv } from "@/lib/env";
import { withTimeout } from "@/utils/withTimeout";

// One failure incident = one email. SET NX EX is atomic: the first reporter
// wins the key and sends; everyone else inside the window is suppressed. Redis
// down or unconfigured = fail OPEN and send: an alert channel must never fail
// closed.
const ALERT_DEDUPE_SECONDS = 3600;

const CLAIM_SENDING = "sending";
const CLAIM_SENT = "sent";

export interface DedupeClaim {
  duplicate: boolean;
  /** Duplicate, but the first reporter has not confirmed delivery yet. */
  inFlight?: boolean;
  /** Marks the claim as delivered so later duplicates are safely suppressed. */
  confirm: () => Promise<void>;
  /** Frees the claim when delivery failed on every channel; no-op otherwise. */
  release: () => Promise<void>;
}

const NO_RELEASE = async () => {};
const NO_CONFIRM = async () => {};

export async function claimAlertKey(key: string): Promise<DedupeClaim> {
  try {
    const url = readTrimmedEnv(import.meta.env.UPSTASH_REDIS_REST_URL);
    const token = readTrimmedEnv(import.meta.env.UPSTASH_REDIS_REST_TOKEN);
    if (!url || !token)
      return { duplicate: false, confirm: NO_CONFIRM, release: NO_RELEASE };

    const redis = new Redis({ url, token });
    const result = await withTimeout(
      redis.set(key, CLAIM_SENDING, { nx: true, ex: ALERT_DEDUPE_SECONDS }),
      1500,
      "Upstash alert dedupe",
    );
    // Upstash returns "OK" when the key was set (first alert) and null when
    // it already existed (duplicate inside the window).
    if (result === null) {
      // WHY: the first reporter may still be sending, or may release the claim
      // when every channel fails. Counting its duplicate as "delivered" then
      // loses the only report of the incident.
      const state = await withTimeout(
        redis.get(key),
        1500,
        "Upstash alert dedupe read",
      );
      return {
        duplicate: true,
        inFlight: state === CLAIM_SENDING,
        confirm: NO_CONFIRM,
        release: NO_RELEASE,
      };
    }
    return {
      duplicate: false,
      confirm: async () => {
        try {
          await withTimeout(
            redis.set(key, CLAIM_SENT, { xx: true, ex: ALERT_DEDUPE_SECONDS }),
            1500,
            "Upstash alert confirm",
          );
        } catch (error) {
          console.error("[alert-dedupe] claim confirm failed:", error);
        }
      },
      release: async () => {
        // Every channel failed to deliver: give the claim back so the next
        // report of this incident pages instead of being suppressed for an
        // hour behind an alert that never went out.
        try {
          await withTimeout(redis.del(key), 1500, "Upstash alert release");
        } catch (error) {
          console.error("[alert-dedupe] claim release failed:", error);
        }
      },
    };
  } catch (error) {
    console.error("[alert-dedupe] dedupe check failed, sending:", error);
    return { duplicate: false, confirm: NO_CONFIRM, release: NO_RELEASE };
  }
}

/**
 * Cause class of an error message: ids, numbers and hashes are stripped so
 * "draft 8f3a... failed" and "draft 91bc... failed" are the same incident.
 */
function errorClass(message: string): string {
  const stripped = message
    .replace(/[0-9a-f]{8,}/gi, "#")
    // WHY: an HTTP status is the cause itself. Stripping it made a 403 outage
    // suppress a later 503 outage for the hour. Other numbers (ids, counts,
    // durations) still collapse.
    .replace(/\d+/g, (n, offset: number, whole: string) =>
      /^[45]\d\d$/.test(n) &&
      /(HTTP |: |\b(status|code) )$/i.test(
        whole.slice(Math.max(0, offset - 7), offset),
      )
        ? n
        : "#",
    )
    .slice(0, 120);
  return createHash("sha256").update(stripped).digest("hex").slice(0, 12);
}

/**
 * alertOps for server-side failure paths. WHY: save-application and the photo
 * endpoint alerted on EVERY failed request, so one Firestore blip during a
 * show night (hundreds of autosaves a minute) flooded the inbox and the mail
 * provider's rate limit, burying the one email that names the cause. Keyed by
 * flow, stage and error class, so a different cause still pages immediately.
 * Never throws; returns whether the report was delivered or intentionally
 * suppressed.
 */
export async function alertOpsOnce(report: OpsAlertReport): Promise<boolean> {
  const claim = await claimAlertKey(
    `alert:server:${report.flow}:${report.stage}:${errorClass(report.errorMessage)}`,
  );
  if (claim.duplicate && claim.inFlight) {
    // Not confirmed delivered: report false so the caller can retry later,
    // by which time the first attempt has either confirmed or released.
    console.log(
      `[alert-dedupe] ${report.flow}/${report.stage} is being sent by another request`,
    );
    return false;
  }
  if (claim.duplicate) {
    console.log(
      `[alert-dedupe] suppressed duplicate ${report.flow}/${report.stage}`,
    );
    return true;
  }
  const delivered = await alertOps(report);
  if (delivered) await claim.confirm();
  else await claim.release();
  return delivered;
}
