export const prerender = false;
import type { APIRoute } from "astro";
import { readUnsubscribeToken } from "@/lib/outreach/unsubscribe";
import { normalizeEmail } from "@/lib/outreach/model";
import { store, fingerprint } from "@/lib/outreach/store";
export const POST: APIRoute = async ({ url }) => {
  try {
    const email = normalizeEmail(
      readUnsubscribeToken(url.searchParams.get("token") ?? ""),
    );
    if (!email)
      return new Response("This unsubscribe link is invalid.", { status: 400 });
    const key = `emailSuppression/${fingerprint(email)}`;
    const previous = await store.get(key);
    if (
      !previous &&
      !(await store.put(key, { email, suppressedAt: Date.now() }, null)) &&
      !(await store.get(key))
    )
      throw new Error("Unsubscribe could not be saved");
    return new Response(
      "You are unsubscribed from Garam Masala Dating show emails.",
      {
        headers: {
          "Content-Type": "text/plain; charset=utf-8",
          "Cache-Control": "no-store",
        },
      },
    );
  } catch {
    return new Response(
      "We could not save your unsubscribe. Please try again.",
      { status: 503 },
    );
  }
};
export const GET: APIRoute = async ({ url }) => {
  const token = url.searchParams.get("token") ?? "";
  if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token) || token.length > 600)
    return new Response("Invalid link", { status: 400 });
  return new Response(
    `<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Unsubscribe</title><body><main><h1>Stop show emails?</h1><p>Unsubscribe from Garam Masala Dating show announcements and reminders.</p><form method="post"><button type="submit">Unsubscribe</button></form></main></body></html>`,
    {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store",
        "Referrer-Policy": "no-referrer",
      },
    },
  );
};
