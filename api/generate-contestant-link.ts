import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "crypto";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function generateSessionToken(secret: string): string {
  const dayTimestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return createHmac("sha256", secret).update(String(dayTimestamp)).digest("hex");
}

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
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

  const { showDate } = req.body as { showDate?: string };
  if (!showDate || typeof showDate !== "string" || !ISO_DATE_RE.test(showDate)) {
    return res.status(400).json({ error: "showDate (YYYY-MM-DD) is required" });
  }

  const sig = createHmac("sha256", salt).update(showDate).digest("hex");
  const host = req.headers.host ?? "garammasaladating.com";
  const protocol = host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https";
  const url = `${protocol}://${host}/contestant-prep?date=${showDate}&sig=${sig}`;

  return res.status(200).json({ url });
}
