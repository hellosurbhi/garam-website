import { describe, it, expect, vi, beforeEach } from "vitest";

// nodemailer is CJS; provide both default and named export shapes so the
// mock applies regardless of how Vite's interop resolves the import.
const mockSendMail = vi.hoisted(() => vi.fn());
const mockCreateTransport = vi.hoisted(() =>
  vi.fn(() => ({ sendMail: mockSendMail })),
);
vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

const { sendPagerEmail } = await import("./send-pager-email.mjs");

const env = {
  GMAIL_PAGER_USER: "garammasaladating@gmail.com",
  GMAIL_PAGER_APP_PASSWORD: "abcd efgh ijkl mnop",
  RUN_URL: "https://github.com/o/r/actions/runs/1",
};

describe("sendPagerEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSendMail.mockResolvedValue({ messageId: "msg-1" });
  });

  it("rejects an unknown mode", async () => {
    await expect(sendPagerEmail("oops", env)).rejects.toThrow("usage:");
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it("fails loudly without creating a transport when secrets are missing", async () => {
    for (const missing of ["GMAIL_PAGER_USER", "GMAIL_PAGER_APP_PASSWORD"]) {
      const partial = { ...env, [missing]: undefined };
      await expect(sendPagerEmail("page", partial)).rejects.toThrow(
        "secrets are not set",
      );
    }
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it("never puts the password in a validation error message", async () => {
    const err = await sendPagerEmail("page", {
      ...env,
      GMAIL_PAGER_USER: undefined,
    }).catch((e) => e);
    expect(String(err)).not.toContain(env.GMAIL_PAGER_APP_PASSWORD);
  });

  it("sends to the Gmail user itself when PAGER_EMAIL_TO is unset", async () => {
    const { to } = await sendPagerEmail("page", env);
    expect(to).toBe(env.GMAIL_PAGER_USER);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ to: env.GMAIL_PAGER_USER }),
    );
  });

  it("sends to PAGER_EMAIL_TO when set", async () => {
    const { to } = await sendPagerEmail("page", {
      ...env,
      PAGER_EMAIL_TO: "messagesurbhi@gmail.com",
    });
    expect(to).toBe("messagesurbhi@gmail.com");
  });

  it("page mode names the outage and links the run", async () => {
    await sendPagerEmail("page", env);
    const msg = mockSendMail.mock.calls[0][0];
    expect(msg.subject).toContain("APPLY MONITOR FAILED");
    expect(msg.text).toContain(env.RUN_URL);
  });

  it("test mode is unmistakably a drill", async () => {
    await sendPagerEmail("test", env);
    const msg = mockSendMail.mock.calls[0][0];
    expect(msg.subject).toContain("pager test");
    expect(msg.subject).toContain("No action needed");
    expect(msg.subject).not.toContain("FAILED");
  });

  it("uses Gmail SMTP with short timeouts so a stalled session fails fast", async () => {
    await sendPagerEmail("page", env);
    expect(mockCreateTransport).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
        connectionTimeout: 10_000,
        socketTimeout: 10_000,
      }),
    );
  });
});
