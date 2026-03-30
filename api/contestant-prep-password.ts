import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "crypto";

const CHARS = "abcdefghjkmnpqrstuvwxyz23456789";

function getCurrentWeekMonday(): string {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")!.value;
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10);
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const offsets: Record<string, number> = { Mon: 0, Tue: 1, Wed: 2, Thu: 3, Fri: 4, Sat: 5, Sun: 6 };
  const monday = new Date(parseInt(year, 10), month - 1, day - (offsets[weekday] ?? 0));
  return `${monday.getFullYear()}-${String(monday.getMonth() + 1).padStart(2, "0")}-${String(monday.getDate()).padStart(2, "0")}`;
}

function generatePassword(salt: string): string {
  const hash = createHmac("sha256", salt).update(getCurrentWeekMonday()).digest("hex");
  let password = "";
  for (let i = 0; i < 6; i++) password += CHARS[parseInt(hash.substring(i * 2, i * 2 + 2), 16) % CHARS.length];
  return password;
}

function generateSessionToken(secret: string): string {
  const dayTimestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return createHmac("sha256", secret).update(String(dayTimestamp)).digest("hex");
}

function getSundayExpirationMs(): number {
  const now = new Date();
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/New_York",
    year: "numeric", month: "2-digit", day: "2-digit", weekday: "short",
    hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false,
  }).formatToParts(now);
  const year = parseInt(parts.find((p) => p.type === "year")!.value, 10);
  const month = parseInt(parts.find((p) => p.type === "month")!.value, 10) - 1;
  const day = parseInt(parts.find((p) => p.type === "day")!.value, 10);
  const weekday = parts.find((p) => p.type === "weekday")!.value;
  const daysMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  const daysUntilSunday = (7 - (daysMap[weekday] ?? 0)) % 7;
  const etNow = new Date(year, month, day);
  const utcOffsetMs = now.getTime() - etNow.getTime();
  return new Date(year, month, day + daysUntilSunday, 23, 59, 0, 0).getTime() + utcOffsetMs;
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  if (!adminPassword) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Authorization required" });
  }

  if (auth.slice(7) !== generateSessionToken(adminPassword)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const salt = process.env.CONTESTANT_PREP_SALT;
  if (!salt) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  return res.status(200).json({ password: generatePassword(salt), expiresAt: getSundayExpirationMs() });
}
