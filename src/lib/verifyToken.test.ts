import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockJwtVerify = vi.fn();
const mockImportX509 = vi.fn();

vi.mock("jose", () => ({
  jwtVerify: (...args: unknown[]) => mockJwtVerify(...args),
  importX509: (...args: unknown[]) => mockImportX509(...args),
}));

const TEST_PROJECT_ID = "test-project-123";
const ADMIN_EMAIL = "messagesurbhi@gmail.com";

function makeToken(kid: string, sub: string): string {
  const header = Buffer.from(JSON.stringify({ kid, alg: "RS256" })).toString(
    "base64url",
  );
  const payload = Buffer.from(JSON.stringify({ sub })).toString("base64url");
  return `${header}.${payload}.fake-sig`;
}

/** Shorthand for the verified-JWT payload jwtVerify resolves with. */
function adminPayload(overrides: Record<string, unknown> = {}) {
  return {
    sub: "user-123",
    email: ADMIN_EMAIL,
    email_verified: true,
    firebase: { sign_in_provider: "password" },
    ...overrides,
  };
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

  it("returns uid for an allowlisted verified email", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: adminPayload({
        firebase: { sign_in_provider: "google.com" },
      }),
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBe("user-123");
  });

  it("returns null for an allowlisted unverified email on the password provider", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: adminPayload({ email_verified: false }),
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null for an allowlisted unverified email on a non-password provider", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: adminPayload({
        email_verified: false,
        firebase: { sign_in_provider: "google.com" },
      }),
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null for an email not on the allowlist", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: adminPayload({ email: "someone-else@gmail.com" }),
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null for a case-mismatched allowlisted email (rules parity)", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: adminPayload({ email: "MessageSurbhi@gmail.com" }),
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null for an anonymous provider even with the admin claim", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: adminPayload({
        admin: true,
        firebase: { sign_in_provider: "anonymous" },
      }),
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns uid for the admin custom claim without any email", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "user-123",
        admin: true,
        firebase: { sign_in_provider: "google.com" },
      },
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBe("user-123");
  });

  it("returns null when the admin claim is truthy but not literal true", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "user-123",
        admin: "yes",
        firebase: { sign_in_provider: "google.com" },
      },
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null when the firebase claim is missing", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: { sub: "user-123", email: ADMIN_EMAIL, email_verified: true },
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null when the firebase claim is malformed", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: adminPayload({ firebase: "password" }),
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminToken(`Bearer ${token}`)).resolves.toBeNull();
  });
});

describe("verifyAdminIdentity", () => {
  let verifyAdminIdentity: (
    authHeader: string | undefined,
  ) => Promise<{ uid: string; email: string } | null>;

  beforeEach(async () => {
    vi.resetModules();
    vi.clearAllMocks();
    const mod = await import("@/lib/verifyToken");
    verifyAdminIdentity = mod.verifyAdminIdentity;
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = TEST_PROJECT_ID;
    mockImportX509.mockResolvedValue("mock-key");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          "key-1":
            "-----BEGIN CERTIFICATE-----\nfake\n-----END CERTIFICATE-----",
        }),
        { status: 200 },
      ),
    );
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  });

  it("returns uid and email for an allowlisted admin", async () => {
    mockJwtVerify.mockResolvedValue({ payload: adminPayload() });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminIdentity(`Bearer ${token}`)).resolves.toEqual({
      uid: "user-123",
      email: ADMIN_EMAIL,
    });
  });

  it("returns null for a claim-only admin without an email (attribution required)", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: {
        sub: "user-123",
        admin: true,
        firebase: { sign_in_provider: "google.com" },
      },
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminIdentity(`Bearer ${token}`)).resolves.toBeNull();
  });

  it("returns null for a non-admin email", async () => {
    mockJwtVerify.mockResolvedValue({
      payload: adminPayload({ email: "someone-else@gmail.com" }),
    });
    const token = makeToken("key-1", "user-123");

    await expect(verifyAdminIdentity(`Bearer ${token}`)).resolves.toBeNull();
  });
});

describe("ADMIN_EMAILS stays in sync with every allowlist copy", () => {
  async function readAllowlistFrom(
    file: string,
    pattern: RegExp,
  ): Promise<string[]> {
    const { readFileSync } = await import("node:fs");
    const source = readFileSync(file, "utf8");
    const match = pattern.exec(source);
    expect(match, `admin email allowlist not found in ${file}`).not.toBeNull();
    const emails = [...match![1].matchAll(/['"]([^'"]+)['"]/g)].map(
      (m) => m[1],
    );
    expect(
      emails.length,
      `empty allowlist parsed from ${file}`,
    ).toBeGreaterThan(0);
    return emails.sort();
  }

  it("matches isAdmin() in firestore.rules", async () => {
    const { ADMIN_EMAILS } = await import("@/lib/adminAllowlist");
    const emails = await readAllowlistFrom(
      "firestore.rules",
      /request\.auth\.token\.email in \[([^\]]*)\]/,
    );
    expect([...ADMIN_EMAILS].sort()).toEqual(emails);
  });

  it("matches isAdmin() in storage.rules", async () => {
    const { ADMIN_EMAILS } = await import("@/lib/adminAllowlist");
    const emails = await readAllowlistFrom(
      "storage.rules",
      /request\.auth\.token\.email in \[([^\]]*)\]/,
    );
    expect([...ADMIN_EMAILS].sort()).toEqual(emails);
  });

  it("both rules files AND the email allowlist verified conjunctively (predicate parity)", async () => {
    const { readFileSync } = await import("node:fs");
    for (const file of ["firestore.rules", "storage.rules"]) {
      const source = readFileSync(file, "utf8");
      const isAdminBody = /function isAdmin\(\) \{([\s\S]*?)\}/.exec(source);
      expect(isAdminBody, `isAdmin() not found in ${file}`).not.toBeNull();
      // email_verified must be ANDed directly onto the allowlist membership
      // check, not merely present somewhere in the function.
      const conjunctive =
        /request\.auth\.token\.email in \[[^\]]*\]\s*&&\s*request\.auth\.token\.email_verified == true/;
      expect(
        conjunctive.test(isAdminBody![1]),
        `${file} isAdmin() must AND email_verified onto the email allowlist membership, mirroring verifyToken.ts`,
      ).toBe(true);
    }
  });

  it("matches the copy in scripts/verify-admin-emails.mjs", async () => {
    const { ADMIN_EMAILS } = await import("@/lib/adminAllowlist");
    const emails = await readAllowlistFrom(
      "scripts/verify-admin-emails.mjs",
      /const ADMIN_EMAILS = \[([^\]]*)\]/,
    );
    expect([...ADMIN_EMAILS].sort()).toEqual(emails);
  });
});
