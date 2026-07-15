import { describe, it, expect } from "vitest";
// @ts-expect-error plain .mjs module shared with the operator script
import { unsafeEmails } from "../scripts/lib/allowlist-safety.mjs";

const EMAIL = "messagesurbhi@gmail.com";

describe("unsafeEmails (verify-admin-emails rules-deploy gate)", () => {
  it("flags an email with no account at all", () => {
    expect(unsafeEmails([{ email: EMAIL, users: [] }])).toEqual([EMAIL]);
  });

  it("flags an email whose only accounts are unverified", () => {
    expect(
      unsafeEmails([
        { email: EMAIL, users: [{ email: EMAIL, emailVerified: false }, {}] },
      ]),
    ).toEqual([EMAIL]);
  });

  it("passes an email with at least one verified exact-match account", () => {
    expect(
      unsafeEmails([
        {
          email: EMAIL,
          users: [
            { email: EMAIL, emailVerified: false },
            { email: EMAIL, emailVerified: true },
          ],
        },
      ]),
    ).toEqual([]);
  });

  it("flags a verified account stored under a case variant (verifyToken parity)", () => {
    expect(
      unsafeEmails([
        {
          email: EMAIL,
          users: [{ email: "MessageSurbhi@gmail.com", emailVerified: true }],
        },
      ]),
    ).toEqual([EMAIL]);
  });

  it("flags a verified account whose stored email is missing from the payload", () => {
    expect(
      unsafeEmails([{ email: EMAIL, users: [{ emailVerified: true }] }]),
    ).toEqual([EMAIL]);
  });

  it("only trusts the lookup payload, not truthy lookalikes", () => {
    expect(
      unsafeEmails([
        {
          email: EMAIL,
          users: [
            { email: EMAIL, emailVerified: "true" as unknown as boolean },
          ],
        },
      ]),
    ).toEqual([EMAIL]);
  });

  it("evaluates every allowlisted email independently", () => {
    const other = "contact@garammasaladating.com";
    expect(
      unsafeEmails([
        { email: EMAIL, users: [{ email: EMAIL, emailVerified: true }] },
        { email: other, users: [] },
      ]),
    ).toEqual([other]);
  });
});
