import type { VercelRequest, VercelResponse } from "@vercel/node";
import crypto from "crypto";

function generateSessionToken(secret: string): string {
  // Rotates every 24 hours
  const dayTimestamp = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  return crypto.createHmac("sha256", secret).update(String(dayTimestamp)).digest("hex");
}

export { generateSessionToken };

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
  console.log("[admin-auth] ADMIN_PASSWORD present:", !!adminPassword, "keys:", Object.keys(process.env).filter(k => k.includes("ADMIN")));
  if (!adminPassword) {
    return res.status(500).json({ error: "Server misconfigured" });
  }

  const { password } = req.body as { password?: string };
  if (!password || typeof password !== "string") {
    return res.status(400).json({ error: "Password required" });
  }

  if (password !== adminPassword) {
    return res.status(401).json({ error: "Incorrect password" });
  }

  const sessionToken = generateSessionToken(adminPassword);
  return res.status(200).json({ ok: true, sessionToken });
}
