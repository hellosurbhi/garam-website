import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockJwtVerify = vi.fn();
const mockImportX509 = vi.fn();

vi.mock("jose", () => ({
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
  importX509: (...args: unknown[]) => mockImportX509(...args),
}));

const TEST_PROJECT_ID = "test-project-123";

function makeToken(kid: string, sub: string): string {
  const header = Buffer.from(JSON.stringify({ kid, alg: "RS256" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64url");
  return `${header}.${payload}.fake-sig`;
}

describe("verifyIdToken", () => {
  let verifyIdToken: (authHeader: string | undefined) => Promise<string | null>;
  let verifyAdminToken: (
    authHeader: string | undefined,
  ) => Promise<string | null>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import("@/lib/verifyToken");
    verifyIdToken = mod.verifyIdToken;
    verifyAdminToken = mod.verifyAdminToken;
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = TEST_PROJECT_ID;
    mockImportX509.mockResolvedValue("mock-key");
    // Mock global fetch for Google certs
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          "key-1":
            "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----",
        }),
        { status: 200 },
      ),
    );
    mockJwtVerify.mockResolvedValue({ payload: { sub: "user-123" } });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    delete import.meta.env.VITE_FIREBASE_PROJECT_ID;
    delete import.meta.env.ADMIN_UIDS;
    delete import.meta.env.ADMIN_EMAILS;
    delete import.meta.env.ADMIN_EMAIL;
  });

  it("returns null when auth header is undefined", async () => {
    expect(await verifyIdToken(undefined)).toBeNull();
  });

  it("returns null when auth header is empty string", async () => {
    expect(await verifyIdToken("")).toBeNull();
  });

  it("returns null when auth header does not start with 'Bearer '", async () => {
    expect(await verifyIdToken("Basic abc123")).toBeNull();
  });

  it("returns null when PUBLIC_FIREBASE_PROJECT_ID is missing", async () => {
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    delete import.meta.env.VITE_FIREBASE_PROJECT_ID;
    const token = makeToken("key-1", "user-123");
    expect(await verifyIdToken(`Bearer ${token}`)).toBeNull();
  });

  it("returns null when JWT header has no kid", async () => {
    const header = Buffer.from(JSON.stringify({ alg: "RS256" })).toString(
      "base64url",
    );
    const payload = Buffer.from(JSON.stringify({ sub: "user-123" })).toString(
      "base64url",
    );
    const token = `${header}.${payload}.fake-sig`;
    expect(await verifyIdToken(`Bearer ${token}`)).toBeNull();
  });

  it("returns null when kid does not match any cached key", async () => {
    const token = makeToken("unknown-kid", "user-123");
    expect(await verifyIdToken(`Bearer ${token}`)).toBeNull();
  });

  it("returns uid string on successful verification", async () => {
    const token = makeToken("key-1", "user-123");
    const result = await verifyIdToken(`Bearer ${token}`);
    expect(result).toBe("user-123");
  });

  it("returns null when jwtVerify throws an error", async () => {
    mockJwtVerify.mockRejectedValue(new Error("Invalid token"));
    const token = makeToken("key-1", "user-123");
    expect(await verifyIdToken(`Bearer ${token}`)).toBeNull();
  });

  it("returns null when payload.sub is empty string", async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: "" } });
    const token = makeToken("key-1", "");
    expect(await verifyIdToken(`Bearer ${token}`)).toBeNull();
  });

  it("returns null when payload.sub is not a string", async () => {
    mockJwtVerify.mockResolvedValue({ payload: { sub: 123 } });
    const token = makeToken("key-1", "user-123");
    expect(await verifyIdToken(`Bearer ${token}`)).toBeNull();
  });

  it("caches public keys on second call (fetch called once)", async () => {
    const token = makeToken("key-1", "user-123");
    await verifyIdToken(`Bearer ${token}`);
    await verifyIdToken(`Bearer ${token}`);
    // fetch should have been called only once for the cert endpoint
    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
  });

  it("passes correct issuer and audience to jwtVerify", async () => {
    const token = makeToken("key-1", "user-123");
    await verifyIdToken(`Bearer ${token}`);
    expect(mockJwtVerify).toHaveBeenCalledWith(
      token,
      "mock-key",
      expect.objectContaining({
        issuer: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
        audience: TEST_PROJECT_ID,
      }),
    );
  });

  it("trims the configured Firebase project ID before verifying claims", async () => {
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = ` ${TEST_PROJECT_ID} `;
    const token = makeToken("key-1", "user-123");

    await verifyIdToken(`Bearer ${token}`);

    expect(mockJwtVerify).toHaveBeenCalledWith(
      token,
      "mock-key",
      expect.objectContaining({
        issuer: `https://securetoken.google.com/${TEST_PROJECT_ID}`,
        audience: TEST_PROJECT_ID,
      }),
    );
  });

  it("returns admin uid when token uid is allowlisted", async () => {
    import.meta.env.ADMIN_UIDS = "other-user,user-123";
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBe("user-123");
  });

  it("returns admin uid when token email is allowlisted", async () => {
    import.meta.env.ADMIN_EMAILS = "admin@example.com";
    mockJwtVerify.mockResolvedValue({
      payload: { sub: "user-123", email: "Admin@Example.com" },
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBe("user-123");
  });

  it("returns null for a verified email login when no allowlist is configured", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "user-123",
        email: "admin@example.com",
        firebase: { sign_in_provider: "password" },
      },
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("does not allow anonymous tokens when no allowlist is configured", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "anon-123",
        firebase: { sign_in_provider: "anonymous" },
      },
    });
    const token = makeToken("key-1", "anon-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null for valid non-admin token", async () => {
    import.meta.env.ADMIN_UIDS = "other-user";
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null when admin uid allowlist is missing", async () => {
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });
});
