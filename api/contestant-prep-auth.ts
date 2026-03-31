import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac, timingSafeEqual } from "crypto";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function computeSig(salt: string, date: string): string {
  return createHmac("sha256", salt).update(date).digest("hex");
}

function computeToken(salt: string, date: string): string {
  return createHmac("sha256", salt).update(`token-${date}`).digest("hex");
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, "hex");
  const bufB = Buffer.from(b, "hex");
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

function getShowExpiryMs(isoDate: string): number {
  const [y, m, d] = isoDate.split("-").map(Number);
  // EDT (UTC-4) Apr–Oct, EST (UTC-5) Nov–Mar
  const offsetHours = m >= 4 && m <= 10 ? 4 : 5;
  // Midnight ending the show day = 00:00 ET on the next calendar day
  return Date.UTC(y, m - 1, d + 1, offsetHours, 0, 0);
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const salt = process.env.CONTESTANT_PREP_SALT;
  if (!salt) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const { date, sig } = req.body as { date?: string; sig?: string };

  if (!date || !sig || typeof date !== "string" || typeof sig !== "string") {
    return res.status(400).json({ error: "date and sig are required" });
  }

  if (!ISO_DATE_RE.test(date)) {
    return res.status(400).json({ error: "Invalid date format" });
  }

  const expected = computeSig(salt, date);
  if (!timingSafeCompare(sig, expected)) {
    return res.status(401).json({ error: "Invalid link" });
  }

  const expiresAt = getShowExpiryMs(date);
  if (Date.now() >= expiresAt) {
    return res.status(401).json({ error: "Link expired" });
  }

  return res.status(200).json({ token: computeToken(salt, date), expiresAt });
}
