import { SignJWT, importPKCS8 } from "jose";
import { readPrivateKeyEnv, readTrimmedEnv } from "@/lib/env";

// Module-level token cache
let cachedToken: string | null = null;
let tokenExpiresAt = 0;

/**
 * Get a Google OAuth2 access token for the Firebase service account.
 * Uses the JWT bearer grant flow to exchange a signed service-account JWT
 * for a short-lived access token scoped to Firestore.
 *
 * Token is cached in memory for its full lifetime (minus a 60s buffer)
 * to avoid redundant network round-trips on every request, matching the
 * same caching strategy used in verifyToken.ts.
 */
export async function getFirestoreAccessToken(): Promise<string> {
  // Return cached token if still valid (with 60s buffer before expiry)
  if (cachedToken && Date.now() < tokenExpiresAt - 60_000) {
    return cachedToken;
  }

  const email = readTrimmedEnv(import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const privateKey = readPrivateKeyEnv(
    import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );

  if (!email || !privateKey) {
    throw new Error(
      "FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY not configured",
    );
  }

  const now = Math.floor(Date.now() / 1000);
  const privateKeyObj = await importPKCS8(privateKey, "RS256");

  // Create a signed JWT for the service account
  const jwt = await new SignJWT({
    scope: "https://www.googleapis.com/auth/datastore",
  })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt(now)
    .setExpirationTime(now + 3600) // 1 hour
    .sign(privateKeyObj);

  // Exchange JWT for access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(
      `Failed to get Firestore access token: ${res.status} ${body}`,
    );
  }

  const data = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedToken = data.access_token;
  tokenExpiresAt = Date.now() + data.expires_in * 1000;

  return cachedToken;
}
