/**
 * auth-gmail-v1.mjs
 * Run once. Prints a refresh token to paste into .env.waitlist.local as GMAIL_REFRESH_TOKEN.
 *
 * Usage: npm run waitlist:auth
 * Env needed first (.env.waitlist.local): GMAIL_CLIENT_ID, GMAIL_CLIENT_SECRET
 *
 * In Google Cloud Console, the OAuth client must list
 * http://localhost:3000/oauth2callback as an authorized redirect URI.
 */

import http from "node:http";
import { google } from "googleapis";

const REDIRECT = "http://localhost:3000/oauth2callback";

const missing = ["GMAIL_CLIENT_ID", "GMAIL_CLIENT_SECRET"].filter(
  (k) => !process.env[k],
);
if (missing.length) {
  console.error(
    `Missing env vars: ${missing.join(", ")}\n` +
      "Add them to .env.waitlist.local (block to paste is in scripts/waitlist/README.md), then rerun.",
  );
  process.exit(1);
}

const oauth2 = new google.auth.OAuth2(
  process.env.GMAIL_CLIENT_ID,
  process.env.GMAIL_CLIENT_SECRET,
  REDIRECT,
);

const url = oauth2.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: ["https://www.googleapis.com/auth/gmail.send"],
});

console.log(
  "\nOpen this URL in your browser (signed in as the sending account):\n",
);
console.log(url);
console.log("\nWaiting for the callback on port 3000...\n");

const server = http.createServer(async (req, res) => {
  if (!req.url.startsWith("/oauth2callback")) {
    res.writeHead(404).end();
    return;
  }
  const code = new URL(req.url, REDIRECT).searchParams.get("code");
  res.writeHead(200, { "Content-Type": "text/plain" });
  res.end("Done. Close this tab and check your terminal.");
  try {
    const { tokens } = await oauth2.getToken(code);
    console.log("\nGMAIL_REFRESH_TOKEN=" + tokens.refresh_token + "\n");
    console.log(
      "Paste that line into .env.waitlist.local, then run: npm run waitlist:dry\n",
    );
  } catch (err) {
    console.error("Token exchange failed:", err.message);
  }
  server.close();
});

server.listen(3000);
