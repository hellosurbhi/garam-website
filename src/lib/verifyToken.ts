import { jwtVerify, importX509 } from "jose";

const CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface CachedKeys {
  keys: Record<string, CryptoKey>;
  fetchedAt: number;
}

let cached: CachedKeys | null = null;

async function getPublicKeys(): Promise<Record<string, CryptoKey>> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.keys;
  }

  const res = await fetch(CERTS_URL);
  if (!res.ok) {
    throw new Error(`Failed to fetch Google certs: ${res.status}`);
  }

  const pems: Record<string, string> = await res.json();
  const keys: Record<string, CryptoKey> = {};

  for (const [kid, pem] of Object.entries(pems)) {
    keys[kid] = await importX509(pem, "RS256");
  }

  cached = { keys, fetchedAt: Date.now() };
  return keys;
}

/**
 * Verify a Firebase ID token from an `Authorization: Bearer <token>` header.
 * Fetches Google's public X.509 certs (cached for 1 hour) and verifies the JWT signature,
 * issuer, and audience against the configured Firebase project.
 *
 * @param authHeader The raw `Authorization` header value.
 * @returns The Firebase `uid` (`sub` claim) on success, or `null` if invalid or missing.
 */
export async function verifyIdToken(
  authHeader: string | undefined,
): Promise<string | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  try {
    // Decode header to get kid without verification
    const headerB64 = token.split(".")[0];
    const header = JSON.parse(
      Buffer.from(headerB64, "base64url").toString(),
    ) as { kid?: string };

    if (!header.kid) return null;

    const keys = await getPublicKeys();
    const key = keys[header.kid];
    if (!key) return null;

    const { payload } = await jwtVerify(token, key, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    if (typeof payload.sub !== "string" || payload.sub.length === 0) {
      return null;
    }

    return payload.sub;
  } catch {
    return null;
  }
}

export async function verifyAdminToken(
  authHeader: string | undefined,
): Promise<string | null> {
  const uid = await verifyIdToken(authHeader);
  if (!uid) return null;

  const allowedUids = String(import.meta.env.ADMIN_UIDS ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  if (allowedUids.length === 0) return null;
  return allowedUids.includes(uid) ? uid : null;
}

export interface AdminIdentity {
  uid: string;
  email: string;
}

/**
 * Verify a Firebase ID token AND return the admin's email.
 * Email is extracted from the verified JWT payload (the `email` claim).
 * Returns null if the token is invalid or the uid is not in ADMIN_UIDS.
 */
export async function verifyAdminIdentity(
  authHeader: string | undefined,
): Promise<AdminIdentity | null> {
  if (!authHeader || !authHeader.startsWith("Bearer ")) return null;

  const token = authHeader.slice(7);
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) return null;

  try {
    const headerB64 = token.split(".")[0];
    const header = JSON.parse(
      Buffer.from(headerB64, "base64url").toString(),
    ) as { kid?: string };
    if (!header.kid) return null;

    const keys = await getPublicKeys();
    const key = keys[header.kid];
    if (!key) return null;

    const { payload } = await jwtVerify(token, key, {
      issuer: `https://securetoken.google.com/${projectId}`,
      audience: projectId,
    });

    const uid = payload.sub;
    const email =
      typeof payload["email"] === "string" ? payload["email"] : null;

    if (typeof uid !== "string" || uid.length === 0 || !email) return null;

    const allowedUids = String(import.meta.env.ADMIN_UIDS ?? "")
      .split(",")
      .map((v) => v.trim())
      .filter(Boolean);

    if (allowedUids.length === 0 || !allowedUids.includes(uid)) return null;

    return { uid, email };
  } catch {
    return null;
  }
}
