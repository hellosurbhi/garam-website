import { afterEach, it, expect, vi } from "vitest";
import { unsubscribeToken, readUnsubscribeToken } from "./unsubscribe";
afterEach(() => vi.unstubAllEnvs());
it("validates a signed opt-out and rejects a changed address", () => {
  vi.stubEnv(
    "OUTREACH_UNSUBSCRIBE_SECRET",
    "a-test-signing-key-with-at-least-32-characters",
  );
  const token = unsubscribeToken("reader@example.org");
  expect(readUnsubscribeToken(token)).toBe("reader@example.org");
  expect(readUnsubscribeToken(`eA.${token.split(".")[1]}`)).toBeNull();
});
it("fails before sending if unsubscribe signing is not configured", () => {
  vi.stubEnv("OUTREACH_UNSUBSCRIBE_SECRET", "");
  expect(() => unsubscribeToken("reader@example.org")).toThrow(
    "not configured",
  );
});
