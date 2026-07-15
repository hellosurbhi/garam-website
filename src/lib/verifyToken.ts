import { jwtVerify, importX509, type JWTPayload } from "jose";
import { ADMIN_EMAILS } from "./adminAllowlist";

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
 * Verify a Firebase ID token from an `Authorization: Bearer <token>` header
 * and return its full payload. Fetches Google's public X.509 certs (cached
 * for 1 hour) and verifies the JWT signature, issuer, and audience against
 * the configured Firebase project. Guarantees a non-empty `sub` claim.
 */
async function verifyTokenPayload(
  authHeader: string | undefined,
): Promise<JWTPayload | null> {
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

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify a Firebase ID token from an `Authorization: Bearer <token>` header.
 *
 * @param authHeader The raw `Authorization` header value.
 * @returns The Firebase `uid` (`sub` claim) on success, or `null` if invalid or missing.
 */
export async function verifyIdToken(
  authHeader: string | undefined,
): Promise<string | null> {
  const payload = await verifyTokenPayload(authHeader);
  return payload ? (payload.sub as string) : null;
}

// WHY: This predicate mirrors isAdmin() in firestore.rules and storage.rules
// exactly (a drift test in verifyToken.test.ts holds all copies together).
// It replaced a uid check against an ADMIN_UIDS env var that fails closed
// identically whether the var is unset or stale (see adminAllowlist.ts). The
// `email_verified === true` requirement is load-bearing: anyone can register
// a Firebase password account claiming a not-yet-registered email, but they
// can never verify an inbox they do not own. If the operator's own account
// is unverified she runs `npm run admin:verify-emails` once (see
// scripts/verify-admin-emails.mjs). Do not accept unverified emails on any
// provider, and do not loosen `admin === true` to truthy: both stop a
// spoofed-email token from reaching the service-account-backed admin
// endpoints.
function isAdminPayload(payload: JWTPayload): boolean {
  const firebase = payload.firebase;
  const provider =
    firebase && typeof firebase === "object" && "sign_in_provider" in firebase
      ? (firebase as { sign_in_provider?: unknown }).sign_in_provider
      : undefined;
  if (typeof provider !== "string" || provider === "anonymous") return false;

  if (payload.admin === true) return true;

  const email = payload.email;
  if (typeof email !== "string" || !ADMIN_EMAILS.includes(email)) return false;
  return payload.email_verified === true;
}

/**
 * Verify a Firebase ID token AND that it belongs to an admin (email
 * allowlist or `admin` custom claim, mirroring firestore.rules isAdmin()).
 *
 * @returns The admin's Firebase `uid` on success, or `null`.
 */
export async function verifyAdminToken(
  authHeader: string | undefined,
): Promise<string | null> {
  const payload = await verifyTokenPayload(authHeader);
  if (!payload || !isAdminPayload(payload)) return null;
  return payload.sub as string;
}

export interface AdminIdentity {
  uid: string;
  email: string;
}

/**
 * Verify a Firebase ID token AND return the admin's email for action
 * attribution. Same authorization as verifyAdminToken, plus the token must
 * carry a non-empty `email` claim (a claim-only admin without an email
 * passes verifyAdminToken but not this).
 */
export async function verifyAdminIdentity(
  authHeader: string | undefined,
): Promise<AdminIdentity | null> {
  const payload = await verifyTokenPayload(authHeader);
  if (!payload || !isAdminPayload(payload)) return null;

  const email = payload.email;
  if (typeof email !== "string" || email.length === 0) return null;

  return { uid: payload.sub as string, email };
}
