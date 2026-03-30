import type { VercelRequest, VercelResponse } from "@vercel/node";
import { generatePassword, getSundayExpirationMs } from "./lib/weekly-password.js";
import { generateSessionToken } from "./admin-auth.js";

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

  const token = auth.slice(7);
  if (token !== generateSessionToken(adminPassword)) {
    return res.status(401).json({ error: "Invalid credentials" });
  }

  const salt = process.env.CONTESTANT_PREP_SALT;
  if (!salt) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const password = generatePassword(salt);
  const expiresAt = getSundayExpirationMs();

  return res.status(200).json({ password, expiresAt });
}
