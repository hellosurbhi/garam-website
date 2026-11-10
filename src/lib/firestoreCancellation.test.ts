import { afterEach, beforeEach, expect, it, vi } from "vitest";
const fetchMock = vi.fn();
vi.mock("jose", () => ({
  importPKCS8: vi.fn().mockResolvedValue({}),
  SignJWT: class {
    setProtectedHeader() {
      return this;
    }
    setIssuer() {
      return this;
    }
    setSubject() {
      return this;
    }
    setAudience() {
      return this;
    }
    setIssuedAt() {
      return this;
    }
    setExpirationTime() {
      return this;
    }
    async sign() {
      return "fixture-jwt";
    }
  },
}));
beforeEach(() => {
  vi.resetModules();
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  vi.stubEnv("FIREBASE_ADMIN_CLIENT_EMAIL", "fixture@example.test");
  vi.stubEnv("FIREBASE_ADMIN_PRIVATE_KEY", "fixture-key");
  vi.stubEnv("PUBLIC_FIREBASE_PROJECT_ID", "demo-test");
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
it("forwards cancellation through token exchange, document read and write", async () => {
  fetchMock
    .mockResolvedValueOnce(
      Response.json({ access_token: "fixture-token", expires_in: 3600 }),
    )
    .mockResolvedValueOnce(Response.json({ fields: {} }))
    .mockResolvedValueOnce(new Response(null, { status: 200 }));
  const { fsGet, fsPatch } = await import("./firestoreRest");
  const signal = new AbortController().signal;
  await fsGet("systemConfig/test", signal);
  await fsPatch("systemConfig/test", { counts: [] }, signal);
  expect(fetchMock).toHaveBeenCalledTimes(3);
  for (const [, options] of fetchMock.mock.calls)
    expect(options.signal).toBe(signal);
});
it("does not start token, read or write requests after cancellation", async () => {
  const { getFirestoreAccessToken } = await import("./firestoreAdmin");
  const { fsGet, fsPatch } = await import("./firestoreRest");
  const controller = new AbortController();
  controller.abort(new Error("ranking expired"));
  await expect(getFirestoreAccessToken(controller.signal)).rejects.toThrow(
    "ranking expired",
  );
  await expect(fsGet("systemConfig/test", controller.signal)).rejects.toThrow(
    "ranking expired",
  );
  await expect(
    fsPatch("systemConfig/test", {}, controller.signal),
  ).rejects.toThrow("ranking expired");
  expect(fetchMock).not.toHaveBeenCalled();
});
