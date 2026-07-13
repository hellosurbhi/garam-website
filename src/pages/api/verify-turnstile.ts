import type { APIRoute } from "astro";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { isAllowedOrigin } from "@/lib/allowedOrigin";

export const prerender = false;

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.verifyTurnstile);
  if (limited) return limited;

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
      { method: "POST", body: form, signal: AbortSignal.timeout(5000) },
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
