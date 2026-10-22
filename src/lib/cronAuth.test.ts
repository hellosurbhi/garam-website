import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { verifyCronSecret } from "@/lib/cronAuth";

const SECRET = "test-cron-secret-xyz";

function req(auth?: string): Request {
  const headers: Record<string, string> = {};
  if (auth !== undefined) headers.authorization = auth;
  return new Request("https://garammasaladating.com/api/cron/x", { headers });
}

describe("verifyCronSecret", () => {
  beforeEach(() => {
    import.meta.env.CRON_SECRET = SECRET;
  });
  afterEach(() => {
    delete import.meta.env.CRON_SECRET;
  });

  it("accepts the exact bearer secret", () => {
    expect(verifyCronSecret(req(`Bearer ${SECRET}`))).toBe(true);
  });

  it("rejects a wrong secret of the same length", () => {
    expect(verifyCronSecret(req(`Bearer ${SECRET.replace("t", "x")}`))).toBe(
      false,
    );
  });

  it("rejects a wrong secret of a different length without throwing", () => {
    expect(verifyCronSecret(req(`Bearer ${SECRET}X`))).toBe(false);
  });

  it("rejects a missing header", () => {
    expect(verifyCronSecret(req())).toBe(false);
  });

  it("fails closed when CRON_SECRET is unset", () => {
    delete import.meta.env.CRON_SECRET;
    expect(verifyCronSecret(req("Bearer undefined"))).toBe(false);
    expect(verifyCronSecret(req("Bearer "))).toBe(false);
  });
});
