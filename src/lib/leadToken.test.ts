import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  issueLeadToken,
  verifyLeadToken,
  isLeadTokenEnabled,
} from "./leadToken";

describe("leadToken", () => {
  beforeEach(() => {
    import.meta.env.LEAD_UPDATE_SECRET = "test-secret";
  });

  afterEach(() => {
    delete import.meta.env.LEAD_UPDATE_SECRET;
    vi.useRealTimers();
  });

  describe("with LEAD_UPDATE_SECRET unset", () => {
    beforeEach(() => {
      delete import.meta.env.LEAD_UPDATE_SECRET;
    });

    it("reports the feature as disabled", () => {
      expect(isLeadTokenEnabled()).toBe(false);
    });

    it("issues no token", () => {
      expect(issueLeadToken("lead123")).toBeNull();
    });

    it("verifies nothing", () => {
      expect(verifyLeadToken("anything")).toBeNull();
    });
  });

  it("reports the feature as enabled when the secret is set", () => {
    expect(isLeadTokenEnabled()).toBe(true);
  });

  it("round-trips issue then verify to the original doc id", () => {
    const token = issueLeadToken("lead123");
    expect(token).not.toBeNull();
    expect(verifyLeadToken(token!)).toBe("lead123");
  });

  it("rejects a tampered payload", () => {
    const token = issueLeadToken("lead123")!;
    const decoded = Buffer.from(token, "base64url").toString();
    const tampered = Buffer.from(
      decoded.replace("lead123", "lead456"),
    ).toString("base64url");
    expect(verifyLeadToken(tampered)).toBeNull();
  });

  it("rejects garbage input", () => {
    expect(verifyLeadToken("not-a-token")).toBeNull();
    expect(verifyLeadToken("")).toBeNull();
  });

  it("rejects a token signed with a different secret", () => {
    const token = issueLeadToken("lead123")!;
    import.meta.env.LEAD_UPDATE_SECRET = "other-secret";
    expect(verifyLeadToken(token)).toBeNull();
  });

  it("rejects a token older than ten minutes", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00Z"));
    const token = issueLeadToken("lead123")!;

    vi.setSystemTime(new Date("2026-07-05T12:10:01Z"));
    expect(verifyLeadToken(token)).toBeNull();
  });

  it("accepts a token still within its ten minute TTL", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-07-05T12:00:00Z"));
    const token = issueLeadToken("lead123")!;

    vi.setSystemTime(new Date("2026-07-05T12:09:59Z"));
    expect(verifyLeadToken(token)).toBe("lead123");
  });
});
