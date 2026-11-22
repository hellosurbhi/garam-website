// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { generateKeyPairSync } from "node:crypto";
import { decodeJwt } from "jose";

import { getServiceAccountToken } from "./google-access-token.mjs";

const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
// Stored env keys carry literal "\n" escapes; the helper must undo them.
const ESCAPED_KEY = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .toString()
  .replace(/\n/g, "\\n");
const OPTIONS = {
  email: "svc@demo.iam.gserviceaccount.com",
  privateKey: ESCAPED_KEY,
  scopes: ["scope-a", "scope-b"],
  label: "Fixture",
};

describe("getServiceAccountToken", () => {
  it("exchanges a signed grant for the access token", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(Response.json({ access_token: "fixture-token" }));
    await expect(
      getServiceAccountToken({ ...OPTIONS, fetchImpl }),
    ).resolves.toBe("fixture-token");
    const [url, init] = fetchImpl.mock.calls[0];
    expect(url).toBe("https://oauth2.googleapis.com/token");
    expect(init.body.get("grant_type")).toBe(
      "urn:ietf:params:oauth:grant-type:jwt-bearer",
    );
    expect(decodeJwt(init.body.get("assertion"))).toMatchObject({
      iss: OPTIONS.email,
      sub: OPTIONS.email,
      aud: "https://oauth2.googleapis.com/token",
      scope: "scope-a scope-b",
    });
  });

  it("names the caller and the status on a refused grant", async () => {
    const fetchImpl = vi
      .fn()
      .mockResolvedValue(new Response("denied", { status: 401 }));
    await expect(
      getServiceAccountToken({ ...OPTIONS, fetchImpl }),
    ).rejects.toThrow("Fixture authentication failed (401)");
  });

  it("refuses an answer without a token", async () => {
    const fetchImpl = vi.fn().mockResolvedValue(Response.json({}));
    await expect(
      getServiceAccountToken({ ...OPTIONS, fetchImpl }),
    ).rejects.toThrow("Fixture authentication returned no token");
  });
});
