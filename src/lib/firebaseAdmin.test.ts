import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  cert: vi.fn((credential: unknown) => ({ credential })),
  getApps: vi.fn(() => []),
  getFirestore: vi.fn((app: unknown) => ({ app })),
  initializeApp: vi.fn((config: unknown) => ({ config })),
}));

vi.mock("firebase-admin/app", () => ({
  cert: mocks.cert,
  getApps: mocks.getApps,
  initializeApp: mocks.initializeApp,
}));

vi.mock("firebase-admin/firestore", () => ({
  getFirestore: mocks.getFirestore,
}));

describe("getAdminFirestore", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    mocks.getApps.mockReturnValue([]);
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    delete import.meta.env.VITE_FIREBASE_PROJECT_ID;
    delete import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    delete import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY;
  });

  afterEach(() => {
    delete import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    delete import.meta.env.VITE_FIREBASE_PROJECT_ID;
    delete import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL;
    delete import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY;
  });

  it("trims Firebase Admin env vars before initializing the SDK", async () => {
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = "garam-masala-9f15b ";
    import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL =
      " service-account@example.iam.gserviceaccount.com ";
    import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY =
      " -----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY-----\\n ";

    const { getAdminFirestore } = await import("@/lib/firebaseAdmin");

    getAdminFirestore();

    expect(mocks.cert).toHaveBeenCalledWith({
      projectId: "garam-masala-9f15b",
      clientEmail: "service-account@example.iam.gserviceaccount.com",
      privateKey: "-----BEGIN PRIVATE KEY-----\nabc\n-----END PRIVATE KEY-----",
    });
    expect(mocks.initializeApp).toHaveBeenCalledTimes(1);
    expect(mocks.getFirestore).toHaveBeenCalledTimes(1);
  });

  it("throws when required env vars are blank after trimming", async () => {
    import.meta.env.PUBLIC_FIREBASE_PROJECT_ID = " ";
    import.meta.env.FIREBASE_ADMIN_CLIENT_EMAIL =
      " service-account@example.iam.gserviceaccount.com ";
    import.meta.env.FIREBASE_ADMIN_PRIVATE_KEY =
      " -----BEGIN PRIVATE KEY-----\\nabc\\n-----END PRIVATE KEY----- ";

    const { getAdminFirestore } = await import("@/lib/firebaseAdmin");

    expect(() => getAdminFirestore()).toThrow(
      "Firebase Admin env vars missing",
    );
    expect(mocks.initializeApp).not.toHaveBeenCalled();
  });
});
