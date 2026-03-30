import crypto from "node:crypto";

/** Characters excluding ambiguous ones (0/O, 1/l/I) */
const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

/**
 * Returns YYYY-MM-DD of Monday in America/New_York timezone.
 * The "week" runs Monday 00:00 ET → Sunday 23:59 ET.
 */
export function getCurrentWeekMonday(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
  }).formatToParts(now);

  const year = parts.find((p) => p.type === "year")!.value;
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const weekday = parts.find((p) => p.type === "weekday")!.value;

  const offsets: Record<string, number> = {
    Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6,
  };
  const offset = offsets[weekday] ?? 0;

  const monday = new Date(parseInt(year, 10), month - 1, day - offset);
  const yy = monday.getFullYear();
  const mm = String(monday.getMonth() + 1).padStart(2, "0");
  const dd = String(monday.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

/** Generate 6-char alphanumeric password from current week + salt. */
export function generatePassword(salt: string): string {
  const weekId = getCurrentWeekMonday();
  const hash = crypto.createHmac("sha256", salt).update(weekId).digest("hex");
  let password = "";
  for (let i = 0; i < 6; i++) {
    const byte = parseInt(hash.substring(i * 2, i * 2 + 2), 16);
    password += CHARS[byte % CHARS.length];
  }
  return password;
}

/** Generate a session token for the current week. */
export function generateToken(salt: string): string {
  const weekId = getCurrentWeekMonday();
  return crypto.createHmac("sha256", salt).update(`token-${weekId}`).digest("hex");
}

/** Returns Unix ms for next Sunday 23:59:00 ET. */
export function getSundayExpirationMs(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(now);

  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const weekday = parts.find((p) => p.type === "weekday")!.value;

  const daysMap: Record<string, number> = {
    Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
  };
  const daysUntilSunday = (7 - (daysMap[weekday] ?? 0)) % 7;

  // Build Sunday 23:59 in ET by using the offset between UTC and ET
  const etNow = new Date(year, month, day);
  const utcOffsetMs = now.getTime() - etNow.getTime();

  // Sunday 23:59:00 ET (as a "local" Date object)
  const sundayET = new Date(year, month, day + daysUntilSunday, 23, 59, 0, 0);

  // Convert to real UTC timestamp
  return sundayET.getTime() + utcOffsetMs;
}
