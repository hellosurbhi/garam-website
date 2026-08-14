import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// vi.hoisted ensures these are evaluated before vi.mock hoisting
const mockSendMail = vi.hoisted(() => vi.fn());
const mockCreateTransport = vi.hoisted(() =>
  vi.fn(() => ({ sendMail: mockSendMail })),
);

// nodemailer is CJS; provide both default and named export shapes so the
// mock applies regardless of how Vite's interop resolves the import.
vi.mock("nodemailer", () => ({
  default: { createTransport: mockCreateTransport },
  createTransport: mockCreateTransport,
}));

const { sendMail } = await import("@/lib/zohoMailer");

const baseOpts = {
  to: "recipient@example.com",
  subject: "Test subject",
  text: "Test body",
  html: "<p>Test body</p>",
};

describe("zohoMailer sendMail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    import.meta.env.ZOHO_SMTP_USER = "bot@garammasaladating.com";
    import.meta.env.ZOHO_SMTP_PASS = "super-secret-pass";
    import.meta.env.ZOHO_FROM_NAME = "Test Sender";
    mockSendMail.mockResolvedValue({ messageId: "msg-1" });
  });

  afterEach(() => {
    delete import.meta.env.ZOHO_SMTP_USER;
    delete import.meta.env.ZOHO_SMTP_PASS;
    delete import.meta.env.ZOHO_FROM_NAME;
  });

  it("throws when ZOHO_SMTP_USER is missing", async () => {
    delete import.meta.env.ZOHO_SMTP_USER;
    await expect(sendMail(baseOpts)).rejects.toThrow(
      "ZOHO_SMTP_USER and ZOHO_SMTP_PASS are required",
    );
  });

  it("throws when ZOHO_SMTP_PASS is missing", async () => {
    delete import.meta.env.ZOHO_SMTP_PASS;
    await expect(sendMail(baseOpts)).rejects.toThrow(
      "ZOHO_SMTP_USER and ZOHO_SMTP_PASS are required",
    );
  });

  it("does not attempt to create a transport when credentials are missing", async () => {
    delete import.meta.env.ZOHO_SMTP_USER;
    await expect(sendMail(baseOpts)).rejects.toThrow();
    expect(mockCreateTransport).not.toHaveBeenCalled();
  });

  it("creates a transport against Zoho SMTP with the configured credentials", async () => {
    await sendMail(baseOpts);
    expect(mockCreateTransport).toHaveBeenCalledWith({
      host: "smtp.zoho.com",
      port: 465,
      secure: true,
      auth: { user: "bot@garammasaladating.com", pass: "super-secret-pass" },
    });
  });

  it("sends mail with the configured from name and address", async () => {
    await sendMail(baseOpts);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Test Sender" <bot@garammasaladating.com>',
        to: baseOpts.to,
        subject: baseOpts.subject,
        text: baseOpts.text,
        html: baseOpts.html,
      }),
    );
  });

  it("falls back to the default from name when ZOHO_FROM_NAME is unset", async () => {
    delete import.meta.env.ZOHO_FROM_NAME;
    await sendMail(baseOpts);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({
        from: '"Surbhi from Garam Masala Dating" <bot@garammasaladating.com>',
      }),
    );
  });

  it("defaults replyTo to the SMTP user when not provided", async () => {
    await sendMail(baseOpts);
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "bot@garammasaladating.com" }),
    );
  });

  it("uses the caller-provided replyTo when given", async () => {
    await sendMail({ ...baseOpts, replyTo: "reply@example.com" });
    expect(mockSendMail).toHaveBeenCalledWith(
      expect.objectContaining({ replyTo: "reply@example.com" }),
    );
  });

  it("propagates errors thrown by the underlying transport", async () => {
    mockSendMail.mockRejectedValue(new Error("SMTP connection refused"));
    await expect(sendMail(baseOpts)).rejects.toThrow("SMTP connection refused");
  });
});
