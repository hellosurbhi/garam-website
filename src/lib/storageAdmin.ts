import { createHash, createSign } from "crypto";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";
import { readPrivateKeyEnv, readTrimmedEnv } from "@/lib/env";

/**
 * Server-side Cloud Storage access for applicant photos, authorised by the
 * Firebase service account. Applicants never touch Storage rules or Firebase
 * Auth: the server mints a short-lived signed upload URL and the browser PUTs
 * the raw file straight to the bucket (so Vercel's 4.5MB request limit never
 * applies), or, as a fallback, relays a small file through the endpoint.
 */

const HOST = "storage.googleapis.com";
const SIGNED_URL_TTL_SECONDS = 15 * 60;

// WHY strip a literal trailing "\n": a Vercel env value pasted with a typed
// backslash-n survives .trim() and corrupts any URL built from it (the
// recurring /n/ 404 class, see readTrimmedEnv callers).
function bucketName(): string {
  const raw = readTrimmedEnv(import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET);
  const bucket = raw?.replace(/\\n$/, "").trim();
  if (!bucket) throw new Error("PUBLIC_FIREBASE_STORAGE_BUCKET is required");
  return bucket;
}

/** Folder every photo of one draft lives under; the only prefix confirmed. */
export function photoPrefix(draftId: string): string {
  return `photos/${draftId}/`;
}

export function isPhotoPathForDraft(path: unknown, draftId: string): boolean {
  return (
    typeof path === "string" &&
    path.startsWith(photoPrefix(draftId)) &&
    /^photos\/[a-f0-9]{32}\/[A-Za-z0-9._-]{1,80}$/.test(path)
  );
}

export function safeExtension(filename: unknown): string {
  const raw =
    typeof filename === "string" ? (filename.split(".").pop() ?? "") : "";
  return /^[A-Za-z0-9]{1,10}$/.test(raw) ? raw.toLowerCase() : "bin";
}

export function safeContentType(contentType: unknown): string {
  return typeof contentType === "string" &&
    /^[\w.+-]{1,60}\/[\w.+-]{1,100}$/.test(contentType)
    ? contentType
    : "application/octet-stream";
}

function rfc3986(value: string): string {
  return encodeURIComponent(value).replace(
    /[!'()*]/g,
    (c) => `%${c.charCodeAt(0).toString(16).toUpperCase()}`,
  );
}

export interface SignedUpload {
  url: string;
  contentType: string;
  expiresInSeconds: number;
}

/** V4 signed PUT URL for one object. `now` is injectable for tests. */
export function signUploadUrl(
  objectName: string,
  contentType: string,
  now = new Date(),
): SignedUpload {
  const clientEmail = readTrimmedEnv(
    import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL,
  );
  const privateKey = readPrivateKeyEnv(
    import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY,
  );
  if (!clientEmail || !privateKey) {
    throw new Error(
      "FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY not configured",
    );
  }

  const iso = now
    .toISOString()
    .replace(/[-:]/g, "")
    .replace(/\.\d{3}/, "");
  const date = iso.slice(0, 8);
  const scope = `${date}/auto/storage/goog4_request`;
  const query: Record<string, string> = {
    "X-Goog-Algorithm": "GOOG4-RSA-SHA256",
    "X-Goog-Credential": `${clientEmail}/${scope}`,
    "X-Goog-Date": iso,
    "X-Goog-Expires": String(SIGNED_URL_TTL_SECONDS),
    "X-Goog-SignedHeaders": "content-type;host",
  };
  const canonicalQuery = Object.keys(query)
    .sort()
    .map((k) => `${rfc3986(k)}=${rfc3986(query[k])}`)
    .join("&");
  const path = `/${bucketName()}/${objectName.split("/").map(rfc3986).join("/")}`;
  const canonicalRequest = [
    "PUT",
    path,
    canonicalQuery,
    `content-type:${contentType}\nhost:${HOST}\n`,
    "content-type;host",
    "UNSIGNED-PAYLOAD",
  ].join("\n");
  const stringToSign = [
    "GOOG4-RSA-SHA256",
    iso,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createSign("RSA-SHA256")
    .update(stringToSign)
    .sign(privateKey, "hex");

  return {
    url: `https://${HOST}${path}?${canonicalQuery}&X-Goog-Signature=${signature}`,
    contentType,
    expiresInSeconds: SIGNED_URL_TTL_SECONDS,
  };
}

export interface StoredObject {
  size: number;
  contentType: string;
}

/** Metadata for an object, or null when it does not exist. */
export async function headObject(
  objectName: string,
): Promise<StoredObject | null> {
  const token = await getFirestoreAccessToken();
  const res = await fetch(
    `https://${HOST}/storage/v1/b/${bucketName()}/o/${encodeURIComponent(objectName)}`,
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (res.status === 404) return null;
  if (!res.ok) {
    throw new Error(
      `Storage head ${objectName}: ${res.status} ${await res.text()}`,
    );
  }
  const meta = (await res.json()) as { size?: string; contentType?: string };
  return {
    size: Number(meta.size ?? 0),
    contentType: meta.contentType ?? "application/octet-stream",
  };
}

/** Delete an object. Already gone counts as deleted. */
export async function deleteObject(objectName: string): Promise<void> {
  const token = await getFirestoreAccessToken();
  const res = await fetch(
    `https://${HOST}/storage/v1/b/${bucketName()}/o/${encodeURIComponent(objectName)}`,
    {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok && res.status !== 404) {
    throw new Error(
      `Storage delete ${objectName}: ${res.status} ${await res.text()}`,
    );
  }
}

/** Write an object from server memory (the small-file relay fallback). */
export async function putObject(
  objectName: string,
  body: ArrayBuffer,
  contentType: string,
): Promise<void> {
  const token = await getFirestoreAccessToken();
  const res = await fetch(
    `https://${HOST}/upload/storage/v1/b/${bucketName()}/o?uploadType=media&name=${encodeURIComponent(objectName)}`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": contentType,
      },
      body,
      signal: AbortSignal.timeout(30_000),
    },
  );
  if (!res.ok) {
    throw new Error(
      `Storage upload ${objectName}: ${res.status} ${await res.text()}`,
    );
  }
}
