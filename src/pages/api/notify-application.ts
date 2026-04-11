import type { APIRoute } from "astro";
import { Resend } from "resend";

export const prerender = false;

interface ApplicationNotification {
  name: string;
  age: number;
  gender: string;
  orientation: string;
  city: string;
  state: string;
  country: string;
  email: string;
  instagram: string;
  community: string;
  income: string;
  applicationType: string;
  referrerName: string;
  pitch: string;
  photoUrl: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildEmailHtml(data: ApplicationNotification): string {
  const isNomination = data.applicationType === "Nomination";
  const location = [data.city, data.state, data.country]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");

  const rows = [
    ["Name", escapeHtml(data.name)],
    ["Age", String(data.age)],
    ["Gender", escapeHtml(data.gender)],
    ["Orientation", escapeHtml(data.orientation)],
    ["Location", location],
    [
      "Email",
      data.email
        ? `<a href="mailto:${escapeHtml(data.email)}" style="color:#DC2626;">${escapeHtml(data.email)}</a>`
        : "",
    ],
    [
      "Instagram",
      `<a href="https://instagram.com/${escapeHtml(data.instagram)}" style="color:#DC2626;">@${escapeHtml(data.instagram)}</a>`,
    ],
    ["Community", escapeHtml(data.community)],
    ["Income", escapeHtml(data.income)],
  ];

  if (isNomination && data.referrerName) {
    rows.push(["Nominated by", escapeHtml(data.referrerName)]);
  }

  const tableRows = rows
    .map(
      ([label, value]) =>
        `<tr>
          <td style="padding:8px 12px;font-weight:600;color:#1A1A1A;border-bottom:1px solid #eee;white-space:nowrap;">${label}</td>
          <td style="padding:8px 12px;color:#333;border-bottom:1px solid #eee;">${value}</td>
        </tr>`,
    )
    .join("");

  const pitchSection = data.pitch
    ? `<div style="margin-top:16px;">
        <h3 style="margin:0 0 8px;font-size:16px;color:#1A1A1A;">Pitch</h3>
        <p style="margin:0;padding:12px;background:#f9f5f0;border-radius:8px;color:#333;line-height:1.5;">${escapeHtml(data.pitch)}</p>
      </div>`
    : "";

  let photoSection = "";
  if (data.photoUrl) {
    try {
      const parsed = new URL(data.photoUrl);
      if (parsed.protocol === "https:") {
        photoSection = `<p style="margin-top:12px;"><a href="${escapeHtml(data.photoUrl)}" style="color:#DC2626;">View Photo</a></p>`;
      }
    } catch {
      /* invalid URL — skip photo link */
    }
  }

  return `<div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:600px;margin:0 auto;padding:20px;">
    <h2 style="color:#DC2626;margin:0 0 16px;">New ${isNomination ? "Nomination" : "Self-Application"}</h2>
    <table style="width:100%;border-collapse:collapse;">${tableRows}</table>
    ${pitchSection}
    ${photoSection}
    <hr style="border:none;border-top:1px solid #eee;margin:24px 0 12px;" />
    <p style="color:#999;font-size:12px;margin:0;">
      View all applications in the <a href="https://garammasaladating.com/admin" style="color:#DC2626;">admin dashboard</a>.
    </p>
  </div>`;
}

export const POST: APIRoute = async ({ request }) => {
  const apiKey = import.meta.env.RESEND_API_KEY;
  const notificationEmail = import.meta.env.NOTIFICATION_EMAIL;
  if (!apiKey || !notificationEmail) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  const body = (await request.json()) as ApplicationNotification;
  if (!body.name || !body.instagram) {
    return new Response(JSON.stringify({ error: "Missing required fields" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const resend = new Resend(apiKey);
  try {
    await resend.emails.send({
      from: "Garam Masala Dating <casting@garammasaladating.com>",
      to: notificationEmail,
      subject: `New Application: ${body.name} (${body.applicationType === "Nomination" ? "Nomination" : "Self"})`,
      html: buildEmailHtml(body),
    });
    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ error: "Failed to send notification" }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
