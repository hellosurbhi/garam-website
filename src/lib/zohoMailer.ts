import nodemailer from "nodemailer";

export interface MailOptions {
  to: string;
  subject: string;
  text: string;
  html: string;
  replyTo?: string;
}

function getSmtpConfig() {
  const user = import.meta.env.ZOHO_SMTP_USER;
  const pass = import.meta.env.ZOHO_SMTP_PASS;
  const fromName =
    import.meta.env.ZOHO_FROM_NAME ?? "Surbhi from Garam Masala Dating";

  if (!user || !pass) {
    throw new Error("ZOHO_SMTP_USER and ZOHO_SMTP_PASS are required");
  }

  return { user, pass, fromName };
}

export async function sendMail(opts: MailOptions): Promise<void> {
  const { user, pass, fromName } = getSmtpConfig();

  const transport = nodemailer.createTransport({
    host: "smtp.zoho.com",
    port: 465,
    secure: true,
    auth: { user, pass },
  });

  await transport.sendMail({
    from: `"${fromName}" <${user}>`,
    to: opts.to,
    subject: opts.subject,
    text: opts.text,
    html: opts.html,
    replyTo: opts.replyTo ?? user,
  });
}
