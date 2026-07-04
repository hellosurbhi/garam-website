import type { APIRoute } from "astro";
import { z } from "zod";
import { sendMail } from "@/lib/zohoMailer";
import { applicationReceived } from "@/data/emails";

export const prerender = false;

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "https://garammasaladating.com") return true;
  if (/^https:\/\/[\w-]+-hellosurbhi\.vercel\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

const ApplicationSchema = z.object({
  name: z.string().min(1).max(200),
  age: z.number().int().min(18).max(120),
  gender: z.string().min(1).max(100),
  orientation: z.string().min(1).max(100),
  city: z.string().min(1).max(200),
  state: z.string().max(100).default(""),
  country: z.string().max(100).default(""),
  email: z.string().email().max(320),
  instagram: z.string().min(1).max(100),
  community: z.string().max(100).default(""),
  income: z.string().max(100).default(""),
  applicationType: z.enum(["Self", "Nomination"]),
  referrerName: z.string().max(200).default(""),
  nominationConsent: z.boolean().optional(),
  pitch: z.string().max(5000).default(""),
  phone: z.string().max(30).optional(),
  height: z.string().max(50).optional(),
  type: z.string().max(200).optional(),
  seenShowBefore: z.boolean().optional(),
  photoUrls: z.array(z.string().url().startsWith("https://")).min(1).max(10),
});

type ApplicationNotification = z.infer<typeof ApplicationSchema>;

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function buildAdminEmailHtml(data: ApplicationNotification): string {
  const isNomination = data.applicationType === "Nomination";
  const location = [data.city, data.state, data.country]
    .filter(Boolean)
    .map(escapeHtml)
    .join(", ");

  const rows: [string, string][] = [
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

  if (data.phone) {
    rows.push(["Phone", escapeHtml(data.phone)]);
  }

  if (isNomination && data.referrerName) {
    rows.push(["Nominated by", escapeHtml(data.referrerName)]);
  }

  if (isNomination) {
    rows.push([
      "Nominator consent",
      data.nominationConsent ? "Confirmed" : "Not confirmed",
    ]);
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

  const validPhotos = data.photoUrls.filter((url) => {
    try {
      return new URL(url).protocol === "https:";
    } catch {
      return false;
    }
  });

  const photoSection =
    validPhotos.length > 0
      ? `<div style="margin-top:12px;">
          ${validPhotos
            .map(
              (url, i) =>
                `<a href="${escapeHtml(url)}" style="color:#DC2626;margin-right:12px;">View Photo ${i + 1}</a>`,
            )
            .join("")}
        </div>`
      : "";

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

function buildAdminEmailText(data: ApplicationNotification): string {
  const isNomination = data.applicationType === "Nomination";
  const location = [data.city, data.state, data.country]
    .filter(Boolean)
    .join(", ");
  const lines = [
    `New ${isNomination ? "Nomination" : "Self-Application"}: ${data.name}`,
    "",
    `Age: ${data.age}`,
    `Gender: ${data.gender}`,
    `Orientation: ${data.orientation}`,
    `Location: ${location}`,
    `Email: ${data.email}`,
    `Instagram: @${data.instagram}`,
    `Community: ${data.community}`,
    `Income: ${data.income}`,
  ];
  if (data.phone) lines.push(`Phone: ${data.phone}`);
  if (isNomination && data.referrerName)
    lines.push(`Nominated by: ${data.referrerName}`);
  if (data.pitch) lines.push("", `Pitch: ${data.pitch}`);
  lines.push("", "https://garammasaladating.com/admin");
  return lines.join("\n");
}

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ error: "Forbidden" }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const notificationEmail = import.meta.env.NOTIFICATION_EMAIL;
  if (!notificationEmail) {
    return new Response(JSON.stringify({ error: "Server misconfigured" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body: ApplicationNotification;
  try {
    const raw: unknown = await request.json();
    const result = ApplicationSchema.safeParse(raw);
    if (!result.success) {
      return new Response(JSON.stringify({ error: "Invalid request body" }), {
        status: 400,
        headers: { "Content-Type": "application/json" },
      });
    }
    body = result.data;
  } catch {
    return new Response(JSON.stringify({ error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  const isNomination = body.applicationType === "Nomination";

  try {
    // Notify Surbhi
    await sendMail({
      to: notificationEmail,
      subject: `New Application: ${body.name} (${isNomination ? "Nomination" : "Self"})`,
      text: buildAdminEmailText(body),
      html: buildAdminEmailHtml(body),
    });

    // Welcome email to applicant — non-fatal if it fails, but awaited so the
    // serverless function doesn't exit before the send attempt completes.
    const welcome = applicationReceived(body.name, body.city);
    await Promise.allSettled([sendMail({ to: body.email, ...welcome })]);

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
