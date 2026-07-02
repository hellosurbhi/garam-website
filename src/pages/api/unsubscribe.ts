import type { APIRoute } from "astro";
import { createHmac, timingSafeEqual } from "crypto";
import { Resend } from "resend";

export const prerender = false;

export const GET: APIRoute = async ({ request }) => {
  const url = new URL(request.url);
  const email = url.searchParams.get("email");
  const sig = url.searchParams.get("sig");

  if (!email || !sig) {
    return new Response(
      page(
        "Invalid link",
        "This unsubscribe link is missing required parameters.",
      ),
      {
        status: 400,
        headers: { "Content-Type": "text/html" },
      },
    );
  }

  const secret = import.meta.env.UNSUBSCRIBE_SECRET;
  if (!secret) {
    return new Response(page("Error", "Server configuration error."), {
      status: 500,
      headers: { "Content-Type": "text/html" },
    });
  }

  // Validate sig is proper SHA-256 hex (64 lowercase hex chars) before buffer ops
  if (!/^[0-9a-fA-F]{64}$/.test(sig)) {
    return new Response(
      page("Invalid link", "This unsubscribe link has expired or is invalid."),
      {
        status: 403,
        headers: { "Content-Type": "text/html" },
      },
    );
  }

  const expectedSig = createHmac("sha256", secret).update(email).digest("hex");
  const sigBuffer = Buffer.from(sig, "hex");
  const expectedBuffer = Buffer.from(expectedSig, "hex");

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    return new Response(
      page("Invalid link", "This unsubscribe link has expired or is invalid."),
      {
        status: 403,
        headers: { "Content-Type": "text/html" },
      },
    );
  }

  const apiKey = import.meta.env.RESEND_API_KEY;
  const audienceId = import.meta.env.RESEND_CONTESTANT_AUDIENCE_ID;
  if (apiKey && audienceId) {
    try {
      const resend = new Resend(apiKey);
      await resend.contacts.update({
        audienceId,
        id: email,
        unsubscribed: true,
      });
    } catch {
      // Contact may not exist in audience — that's fine
    }
  }

  return new Response(
    page(
      "Unsubscribed",
      "You've been removed from our mailing list. You won't receive any more emails from us.",
    ),
    { status: 200, headers: { "Content-Type": "text/html" } },
  );
};

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function page(title: string, message: string): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)} | Garam Masala Dating</title>
  <style>
    body { font-family: 'Nunito', Arial, sans-serif; background: #FFF8F0; margin: 0; padding: 80px 16px; text-align: center; color: #1A1A1A; }
    h1 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; margin-bottom: 12px; }
    p { font-size: 16px; color: #666; line-height: 1.6; max-width: 400px; margin: 0 auto; }
    a { color: #DC2626; }
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <p>${escapeHtml(message)}</p>
  <p style="margin-top: 24px"><a href="https://garammasaladating.com">Back to Garam Masala Dating</a></p>
</body>
</html>`;
}
