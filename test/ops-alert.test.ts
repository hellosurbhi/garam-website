import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const mockSend = vi.hoisted(() => vi.fn());

vi.mock("@/lib/zohoMailer", () => ({ sendMail: mockSend }));

const { alertOps } = await import("@/lib/opsAlert");

const WEBHOOK = "https://ntfy.sh/gmd-alerts";

// The real shape of a cron page: applicant addresses are interpolated into the
// failure summary (src/pages/api/cron/post-show.ts, followups.ts).
const CRON_SUMMARY =
  "2 failures in this run:\npost-show email to priya@example.com: SMTP 535\n" +
  "host briefing email to host@garammasaladating.com: SMTP 535";

const pushes: { url: string; init: RequestInit }[] = [];

function lastPushBody(): string {
  expect(pushes).toHaveLength(1);
  return String(pushes[0].init.body);
}

describe("alertOps push webhook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    pushes.length = 0;
    mockSend.mockResolvedValue(undefined);
    import.meta.env.NOTIFICATION_EMAIL = "admin@example.com";
    import.meta.env.ALERT_WEBHOOK_URL = WEBHOOK;
    vi.spyOn(globalThis, "fetch").mockImplementation((async (
      url: RequestInfo | URL,
      init?: RequestInit,
    ) => {
      pushes.push({ url: String(url), init: init ?? {} });
      return new Response("ok");
    }) as typeof fetch);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    delete import.meta.env.NOTIFICATION_EMAIL;
    delete import.meta.env.ALERT_WEBHOOK_URL;
  });

  it("strips email addresses from the body (ntfy topics are effectively public)", async () => {
    await alertOps({
      flow: "ops",
      stage: "cron_post_show",
      errorMessage: CRON_SUMMARY,
    });
    const body = lastPushBody();
    expect(body).not.toContain("priya@example.com");
    expect(body).not.toContain("host@garammasaladating.com");
    expect(body).toContain("[email redacted]");
    // The diagnosis itself survives; only the identity is removed.
    expect(body).toContain("SMTP 535");
    expect(body).toContain("Failure in ops/cron_post_show");
  });

  it("keeps the unredacted message on the private email channel", async () => {
    await alertOps({
      flow: "ops",
      stage: "cron_post_show",
      errorMessage: CRON_SUMMARY,
    });
    expect(mockSend).toHaveBeenCalledTimes(1);
    const mail = mockSend.mock.calls[0][0] as { text: string };
    expect(mail.text).toContain("priya@example.com");
  });

  it("redacts before the 2000-char bound, so a cut cannot leave half an address", async () => {
    await alertOps({
      flow: "ops",
      stage: "cron_followups",
      errorMessage: `${"x".repeat(1990)}priya@example.com`,
    });
    expect(lastPushBody()).not.toContain("@");
  });

  // The redactor has to cover every address the app ACCEPTS, not every address
  // that is conventionally formed: validateEmail.ts allows any non-space,
  // non-@ character in the local part, so these all reach a cron summary.
  it.each([
    "priya!@example.com",
    "priya's.test@example.co.uk",
    "priya#tag@mail.example.com",
    "priya(x)@example.com",
  ])("redacts %s, which the apply form accepts", async (address) => {
    await alertOps({
      flow: "ops",
      stage: "cron_followups",
      errorMessage: `post-show email to ${address}: SMTP 535`,
    });
    const body = lastPushBody();
    expect(body).not.toContain(address);
    // Nothing address-shaped survives at all, domain included.
    expect(body).not.toContain("@");
    expect(body).toContain("[email redacted]");
    expect(body).toContain("SMTP 535");
  });

  // `errorMessage` is whatever a caught exception carried, so the redactor
  // caps its input before scanning it. That cap must not become the same
  // half-address trap the truncation ordering avoids.
  it("drops the token its input ceiling cuts through, rather than publishing half an address", async () => {
    // 73 chars each, so the 8000-char ceiling lands 5 chars past an `@`. Sized
    // so redaction shrinks the 108 whole addresses before it to roughly 1900
    // chars: the fragment would sit inside the 2000-char body if it survived.
    const address = `${"a".repeat(60)}@example.com `;
    await alertOps({
      flow: "ops",
      stage: "cron_followups",
      errorMessage: `${"s".repeat(50)} ${address.repeat(110)}`,
    });
    const body = lastPushBody();
    expect(body).toContain("[email redacted]");
    expect(body).not.toContain("@");
  });

  it("leaves error text with no address untouched", async () => {
    await alertOps({
      flow: "apply",
      stage: "submit",
      errorMessage: "storage/unauthorized on photos/x.jpeg",
    });
    const body = lastPushBody();
    expect(body).toContain("storage/unauthorized on photos/x.jpeg");
    expect(body).not.toContain("redacted");
  });

  it("never sends context entries over the webhook", async () => {
    await alertOps({
      flow: "apply",
      stage: "submit",
      errorMessage: "firestore write failed",
      context: { name: "Priya Sharma", phone: "+1 555 0100" },
    });
    const body = lastPushBody();
    expect(body).not.toContain("Priya Sharma");
    expect(body).not.toContain("555 0100");
  });
});
