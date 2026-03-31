import type { VercelRequest, VercelResponse } from "@vercel/node";
import { createHmac } from "crypto";
import { verifyIdToken } from "./_verify-token";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const uid = await verifyIdToken(req.headers.authorization);
  if (!uid) {
    return res.status(401).json({ error: "Authentication required" });
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
