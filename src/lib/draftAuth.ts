import { timingSafeEqual } from "crypto";
import { getSecret, verifyDraftToken } from "@/lib/draftToken";
import {
  CANARY_SIGNATURE_WINDOW_SECONDS,
  canaryDraftId,
  canarySignature,
  isCanaryKey,
  type CanaryKey,
} from "@/lib/draftSecret";

/**
 * Who is allowed to touch which draft, shared by the save and photo endpoints.
 *
 * Two kinds of caller:
 *  - an applicant, holding the capability token issued when the draft was
 *    created (can touch that one draft in `applications`);
 *  - the production canary, proving it knows the server secret with an HMAC
 *    header (can touch one fixed draft per browser in `_canary`, never a real
 *    application). The canary drives the real page in a real browser and a
 *    Playwright route adds the headers, so the whole real code path runs.
 */
export interface DraftAuth {
  draftId: string;
  collection: "applications" | "_canary";
  canaryKey: CanaryKey | null;
}

export type DraftAuthResult =
  | { ok: true; auth: DraftAuth }
  | {
      ok: false;
      reason: "no_token" | "malformed" | "bad_signature" | "expired";
    };

/** null: not a canary request. "invalid": claims to be one but cannot prove it. */
function canaryFromHeaders(request: Request): CanaryKey | "invalid" | null {
  const key = request.headers.get("x-canary-key");
  const sig = request.headers.get("x-canary-sig");
  const ts = request.headers.get("x-canary-ts");
  if (!key && !sig && !ts) return null;
  if (!key || !sig || !ts || !isCanaryKey(key)) return "invalid";
  if (!/^\d{1,12}$/.test(ts)) return "invalid";
  const timestamp = Number(ts);
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - timestamp) > CANARY_SIGNATURE_WINDOW_SECONDS) {
    return "invalid";
  }
  try {
    const expected = Buffer.from(
      canarySignature(getSecret(), key, timestamp),
      "hex",
    );
    const given = Buffer.from(sig, "hex");
    if (expected.length !== given.length) return "invalid";
    return timingSafeEqual(expected, given) ? key : "invalid";
  } catch {
    return "invalid";
  }
}

/**
 * Resolve the draft a request is entitled to. `token` is absent on a brand
 * new draft; callers decide whether that is allowed (save creates one, the
 * photo endpoint needs an existing one).
 */
export function resolveDraftAuth(
  request: Request,
  token: unknown,
): DraftAuthResult {
  const canaryKey = canaryFromHeaders(request);
  // WHY a hard refusal: treating a bad canary signature as "no token" filed
  // the canary's fake applicant as a real one (plus a welcome email) every
  // run whenever the GitHub and Vercel secrets differed by a byte.
  if (canaryKey === "invalid") return { ok: false, reason: "bad_signature" };
  if (canaryKey) {
    return {
      ok: true,
      auth: {
        draftId: canaryDraftId(canaryKey),
        collection: "_canary",
        canaryKey,
      },
    };
  }
  if (token === undefined || token === null || token === "") {
    return { ok: false, reason: "no_token" };
  }
  const verified = verifyDraftToken(token);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  return {
    ok: true,
    auth: {
      draftId: verified.draftId,
      collection: "applications",
      canaryKey: null,
    },
  };
}
