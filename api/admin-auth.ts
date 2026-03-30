import type { VercelRequest, VercelResponse } from "@vercel/node";

export default function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Method not allowed" });
  }

  const adminPassword = process.env.ADMIN_PASSWORD;
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

  return res.status(200).json({ ok: true });
}
