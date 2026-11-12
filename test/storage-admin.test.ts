import { describe, it, expect, beforeEach } from "vitest";
import { createHash, createVerify, generateKeyPairSync } from "crypto";
import {
  isPhotoPathForDraft,
  photoPrefix,
  safeContentType,
  safeExtension,
  signUploadUrl,
} from "@/lib/storageAdmin";

const DRAFT = "a".repeat(32);

describe("photo path safety", () => {
  it("accepts only paths inside the draft's own folder", () => {
    expect(isPhotoPathForDraft(`${photoPrefix(DRAFT)}1-abcd.heic`, DRAFT)).toBe(
      true,
    );
    expect(isPhotoPathForDraft(`photos/${"b".repeat(32)}/1.jpg`, DRAFT)).toBe(
      false,
    );
  });

  it("rejects traversal, nesting, odd characters and non-strings", () => {
    for (const bad of [
      `photos/${DRAFT}/../x.jpg`,
      `photos/${DRAFT}/a/b.jpg`,
      `photos/${DRAFT}/`,
      `photos/${DRAFT}/a b.jpg`,
      `photos/${DRAFT}/${"x".repeat(81)}`,
      `other/${DRAFT}/1.jpg`,
      null,
      undefined,
      42,
    ]) {
      expect(isPhotoPathForDraft(bad, DRAFT)).toBe(false);
    }
  });
});

describe("safeExtension and safeContentType never reject, they normalize", () => {
  it("keeps real extensions lowercase, falls back to bin", () => {
    expect(safeExtension("IMG_0001.HEIC")).toBe("heic");
    expect(safeExtension("photo.jpeg")).toBe("jpeg");
    expect(safeExtension("noextension")).toBe("bin");
    expect(safeExtension("evil.p/hp")).toBe("bin");
    expect(safeExtension("x.waytoolongextension")).toBe("bin");
    expect(safeExtension(undefined)).toBe("bin");
  });

  it("passes real content types and neutralizes junk", () => {
    expect(safeContentType("image/heic")).toBe("image/heic");
    expect(safeContentType("image/jpeg")).toBe("image/jpeg");
    expect(safeContentType("")).toBe("application/octet-stream");
    expect(safeContentType("text/html; charset=x\r\nX-Evil: 1")).toBe(
      "application/octet-stream",
    );
    expect(safeContentType(null)).toBe("application/octet-stream");
  });
});

describe("signUploadUrl", () => {
  const { privateKey, publicKey } = generateKeyPairSync("rsa", {
    modulusLength: 2048,
  });
  const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();

  beforeEach(() => {
    import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL = "svc@test.iam.example.com";
    // Vercel stores the key with literal backslash-n; the reader must undo it.
    import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY = pem.replace(/\n/g, "\\n");
    import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET = "bucket.example.app";
  });

  it("builds a V4 URL for the exact object with a 15 minute expiry", () => {
    const signed = signUploadUrl(
      `photos/${DRAFT}/1-abcd.jpg`,
      "image/jpeg",
      new Date("2026-11-10T12:00:00Z"),
    );
    expect(signed.expiresInSeconds).toBe(900);
    const url = new URL(signed.url);
    expect(url.host).toBe("storage.googleapis.com");
    expect(url.pathname).toBe(`/bucket.example.app/photos/${DRAFT}/1-abcd.jpg`);
    expect(url.searchParams.get("X-Goog-Algorithm")).toBe("GOOG4-RSA-SHA256");
    expect(url.searchParams.get("X-Goog-Date")).toBe("20261110T120000Z");
    expect(url.searchParams.get("X-Goog-Expires")).toBe("900");
    expect(url.searchParams.get("X-Goog-SignedHeaders")).toBe(
      "content-type;host",
    );
  });

  it("the signature verifies against the service account's public key", () => {
    const now = new Date("2026-11-10T12:00:00Z");
    const name = `photos/${DRAFT}/1-abcd.jpg`;
    const signed = signUploadUrl(name, "image/jpeg", now);
    const url = new URL(signed.url);
    const signature = url.searchParams.get("X-Goog-Signature")!;
    url.searchParams.delete("X-Goog-Signature");

    const canonicalQuery = [...url.searchParams.entries()]
      .sort(([a], [b]) => (a < b ? -1 : 1))
      .map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`)
      .join("&");
    const canonicalRequest = [
      "PUT",
      url.pathname,
      canonicalQuery,
      "content-type:image/jpeg\nhost:storage.googleapis.com\n",
      "content-type;host",
      "UNSIGNED-PAYLOAD",
    ].join("\n");
    const stringToSign = [
      "GOOG4-RSA-SHA256",
      "20261110T120000Z",
      "20261110/auto/storage/goog4_request",
      createHash("sha256").update(canonicalRequest).digest("hex"),
    ].join("\n");
    const ok = createVerify("RSA-SHA256")
      .update(stringToSign)
      .verify(publicKey, signature, "hex");
    expect(ok).toBe(true);
  });

  it("binds the signature to the content type: a different type does not verify", () => {
    const a = new URL(
      signUploadUrl(`photos/${DRAFT}/1.jpg`, "image/jpeg").url,
    ).searchParams.get("X-Goog-Signature");
    const b = new URL(
      signUploadUrl(`photos/${DRAFT}/1.jpg`, "image/png").url,
    ).searchParams.get("X-Goog-Signature");
    expect(a).not.toBe(b);
  });

  it("strips a literal trailing backslash-n from the bucket name (the /n/ 404 bug)", () => {
    import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET = "bucket.example.app\\n";
    const url = new URL(
      signUploadUrl(`photos/${DRAFT}/1.jpg`, "image/jpeg").url,
    );
    expect(url.pathname.startsWith("/bucket.example.app/photos/")).toBe(true);
  });

  it("fails with a message naming the missing credential, not a bare error", () => {
    delete import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY;
    expect(() => signUploadUrl("x", "image/jpeg")).toThrow(
      /FIREBASE_ADMIN_CLIENT_EMAIL or FIREBASE_ADMIN_PRIVATE_KEY not configured/,
    );
  });

  it("fails with a message naming the missing bucket", () => {
    delete import.meta.env.PUBLIC_FIREBASE_STORAGE_BUCKET;
    expect(() => signUploadUrl("x", "image/jpeg")).toThrow(
      /PUBLIC_FIREBASE_STORAGE_BUCKET is required/,
    );
  });
});
