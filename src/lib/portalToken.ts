import { SignJWT, jwtVerify } from "jose";
import { DEFAULT_TIMEZONE } from "@/data/waiver";

function getSecret(): Uint8Array {
  const raw =
    import.meta.env.CONTESTANT_PORTAL_SECRET ??
    import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY ??
    import.meta.env.CRON_SECRET;
  if (!raw) {
    throw new Error(
      "CONTESTANT_PORTAL_SECRET, FIREBASE_ADMIN_PRIVATE_KEY, or CRON_SECRET is required",
    );
  }
  return new TextEncoder().encode(raw.replace(/\\n/g, "\n"));
}

function midnightLocalUnix(isoDate: string, timezone: string): number {
  const tz = timezone || DEFAULT_TIMEZONE;
  const dayAfter = new Date(`${isoDate}T12:00:00Z`);
  dayAfter.setUTCDate(dayAfter.getUTCDate() + 1);
  const nextDayStr = dayAfter.toISOString().slice(0, 10);
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(new Date(`${nextDayStr}T00:00:00Z`));
  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "0";

  const localYear = parseInt(get("year"), 10);
  const localMonth = parseInt(get("month"), 10);
  const localDay = parseInt(get("day"), 10);
  const [ndYear, ndMonth, ndDay] = nextDayStr.split("-").map(Number);

  const localMidnightMs = Date.UTC(localYear, localMonth - 1, localDay);
  const nextDayUtcMs = Date.UTC(ndYear, ndMonth - 1, ndDay);
  const offsetMs = localMidnightMs - nextDayUtcMs;
  const utcMidnight = nextDayUtcMs - offsetMs;
  return Math.floor(utcMidnight / 1000);
}

export async function signPortalToken(
  contestantId: string,
  showId: string,
  showDateIso: string,
  showTimezone: string,
): Promise<string> {
  const exp = midnightLocalUnix(showDateIso, showTimezone);
  return new SignJWT({ sub: contestantId, sid: showId })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(exp)
    .sign(getSecret());
}

export async function verifyPortalToken(
  token: string,
): Promise<{ contestantId: string; showId: string }> {
  const { payload } = await jwtVerify(token, getSecret());
  const contestantId = payload.sub;
  const showId = payload.sid;
  if (typeof contestantId !== "string" || typeof showId !== "string") {
    throw new Error("Invalid portal token: missing sub or sid");
  }
  return { contestantId, showId };
}

export { midnightLocalUnix as _midnightLocalUnix };
