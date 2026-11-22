import { SignJWT, importPKCS8 } from "jose";

/**
 * Exchange the Firebase service account for a short-lived Google access
 * token (JWT bearer grant). Shared by the Node scripts that write Firestore
 * outside Astro: the synthetic monitor and the show list seed. The app
 * itself uses src/lib/firestoreAdmin.ts, which reads Astro's import.meta.env.
 *
 * Throws a message naming `label`, never the key or the token.
 */
export async function getServiceAccountToken({
  email,
  privateKey,
  scopes,
  label,
  fetchImpl = fetch,
}) {
  const jwt = await new SignJWT({ scope: scopes.join(" ") })
    .setProtectedHeader({ alg: "RS256" })
    .setIssuer(email)
    .setSubject(email)
    .setAudience("https://oauth2.googleapis.com/token")
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(await importPKCS8(privateKey.replace(/\\n/g, "\n"), "RS256"));
  const response = await fetchImpl("https://oauth2.googleapis.com/token", {
    method: "POST",
    signal: AbortSignal.timeout(10_000),
    body: new URLSearchParams({
      grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer",
      assertion: jwt,
    }),
  });
  if (!response.ok)
    throw new Error(`${label} authentication failed (${response.status})`);
  const { access_token: token } = await response.json();
  if (typeof token !== "string" || !token)
    throw new Error(`${label} authentication returned no token`);
  return token;
}
