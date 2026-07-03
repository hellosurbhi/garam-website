import type { APIRoute } from "astro";

function isAllowedOrigin(origin: string | null): boolean {
  if (!origin) return false;
  if (origin === "https://garammasaladating.com") return true;
  if (/^https:\/\/[\w-]+-hellosurbhi\.vercel\.app$/.test(origin)) return true;
  if (/^http:\/\/localhost(:\d+)?$/.test(origin)) return true;
  return false;
}

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const origin = request.headers.get("origin");
  if (!isAllowedOrigin(origin)) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 403,
      headers: { "Content-Type": "application/json" },
    });
  }

  const secret = import.meta.env.TURNSTILE_SECRET_KEY?.trim();
  if (!secret) {
    // No secret configured — pass through (feature is opt-in via env)
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  let token: string | undefined;
  try {
    const body: unknown = await request.json();
    if (typeof body === "object" && body !== null && "token" in body) {
      token = (body as Record<string, unknown>).token as string;
    }
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "Bad request" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!token) {
    return new Response(
      JSON.stringify({ ok: false, error: "Token required" }),
      { status: 422, headers: { "Content-Type": "application/json" } },
    );
  }

  const form = new FormData();
  form.append("secret", secret);
  form.append("response", token);
  const ip = request.headers.get("cf-connecting-ip");
  if (ip) form.append("remoteip", ip);

  try {
    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form },
    );
    const data = (await resp.json()) as { success: boolean };
    if (!data.success) {
      return new Response(
        JSON.stringify({ ok: false, error: "Verification failed" }),
        { status: 422, headers: { "Content-Type": "application/json" } },
      );
    }
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return new Response(
      JSON.stringify({ ok: false, error: "Verification error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }
};
