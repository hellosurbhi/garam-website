import { z } from "zod";
export type Mail = {
  to: string;
  subject: string;
  body: string;
  unsubscribe: string;
  id: string;
};
export type MailResult =
  | { status: "sent"; messageId: string }
  | { status: "rejected" | "uncertain" }
  | { status: "deferred"; retryAt: number };
export type Mailbox = {
  address: string;
  send: (mail: Mail) => Promise<MailResult>;
};
const accountSchema = z.object({
  address: z.email().refine((s) => s.endsWith("@gmail.com")),
  clientId: z.string().min(1),
  clientSecret: z.string().min(1),
  refreshToken: z.string().min(1),
});
export function configuredAccounts() {
  const raw = import.meta.env.OUTREACH_GMAIL_ACCOUNTS;
  if (!raw) return [];
  return z.array(accountSchema).min(1).max(2).parse(JSON.parse(raw));
}
export async function connectMailbox(
  config: z.infer<typeof accountSchema>,
): Promise<Mailbox> {
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: config.clientId,
      client_secret: config.clientSecret,
      refresh_token: config.refreshToken,
      grant_type: "refresh_token",
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok)
    throw new Error(`Gmail connection needs attention (${res.status})`);
  const token = z
    .object({ access_token: z.string().min(1) })
    .parse(await res.json()).access_token;
  const identity = await fetch(
    "https://www.googleapis.com/oauth2/v2/userinfo",
    {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15000),
    },
  );
  if (!identity.ok) throw new Error("Gmail identity could not be verified");
  const user = z.object({ email: z.email() }).parse(await identity.json());
  if (user.email.toLowerCase() !== config.address.toLowerCase())
    throw new Error("Gmail connection does not match the sending account");
  return {
    address: user.email.toLowerCase(),
    async send(mail) {
      const encodedSubject = `=?UTF-8?B?${Buffer.from(mail.subject).toString("base64")}?=`;
      const body = `${mail.body}\n\nUnsubscribe: ${mail.unsubscribe}`;
      const raw = [
        `From: Garam Masala Dating <${user.email}>`,
        `To: ${mail.to}`,
        `Subject: ${encodedSubject}`,
        `Message-ID: <${mail.id}@garammasaladating.com>`,
        "MIME-Version: 1.0",
        "Content-Type: text/plain; charset=UTF-8",
        "Content-Transfer-Encoding: base64",
        `List-Unsubscribe: <${mail.unsubscribe}>`,
        "List-Unsubscribe-Post: List-Unsubscribe=One-Click",
        "",
        Buffer.from(body)
          .toString("base64")
          .match(/.{1,76}/g)
          ?.join("\r\n") ?? "",
      ].join("\r\n");
      try {
        const sent = await fetch(
          "https://gmail.googleapis.com/gmail/v1/users/me/messages/send",
          {
            method: "POST",
            headers: {
              Authorization: `Bearer ${token}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              raw: Buffer.from(raw).toString("base64url"),
            }),
            signal: AbortSignal.timeout(20000),
          },
        );
        if (!sent.ok) {
          if (sent.status === 429 || sent.status === 401)
            return { status: "deferred", retryAt: Date.now() + 3600000 };
          if (sent.status === 403) {
            const detail: unknown = await sent.json();
            const rateError = z
              .object({
                error: z.object({
                  errors: z.array(z.object({ reason: z.string() })),
                }),
              })
              .safeParse(detail);
            if (
              rateError.success &&
              rateError.data.error.errors.some((e) =>
                [
                  "userRateLimitExceeded",
                  "rateLimitExceeded",
                  "dailyLimitExceeded",
                ].includes(e.reason),
              )
            )
              return { status: "deferred", retryAt: Date.now() + 86400000 };
          }
          return {
            status:
              sent.status >= 500 || sent.status === 408
                ? "uncertain"
                : "rejected",
          };
        }
        const message = z
          .object({ id: z.string().min(1) })
          .safeParse(await sent.json());
        return message.success
          ? { status: "sent", messageId: message.data.id }
          : { status: "uncertain" };
      } catch {
        // A lost response may follow acceptance. Never send the same intent again.
        return { status: "uncertain" };
      }
    },
  };
}
