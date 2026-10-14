export const prerender = false;
import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyAdminToken } from "@/lib/verifyToken";
import { store } from "@/lib/outreach/store";
import { milestones, type Delivery } from "@/lib/outreach/model";
const target = z.object({
  showId: z.string().regex(/^[a-z0-9-]{1,101}$/),
  milestone: z.enum(milestones),
});
const resolution = target
  .extend({
    id: z.string().regex(/^[a-f0-9]{64}$/),
    version: z.string().min(1),
    outcome: z.enum(["sent", "not_sent"]),
  })
  .strict();
const reply = (data: unknown, status = 200) =>
  Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const GET: APIRoute = async ({ request, url }) => {
  if (
    !(await verifyAdminToken(request.headers.get("authorization") ?? undefined))
  )
    return reply({ error: "Unauthorized" }, 401);
  const input = target.safeParse(Object.fromEntries(url.searchParams));
  if (!input.success) return reply({ error: "Invalid campaign" }, 400);
  try {
    const rows = await store.list<Delivery>(
      `emailJobs/${input.data.showId}-${input.data.milestone}/deliveries`,
    );
    return reply(
      rows.filter((r) =>
        ["sending", "rejected", "uncertain"].includes(r.value.status),
      ),
    );
  } catch {
    return reply({ error: "Delivery details could not load" }, 503);
  }
};
export const POST: APIRoute = async ({ request }) => {
  const uid = await verifyAdminToken(
    request.headers.get("authorization") ?? undefined,
  );
  if (!uid) return reply({ error: "Unauthorized" }, 401);
  try {
    const input = resolution.parse(await request.json());
    const key = `emailJobs/${input.showId}-${input.milestone}/deliveries/${input.id}`;
    const row = await store.get<Delivery>(key);
    if (
      !row ||
      !["sending", "rejected", "uncertain"].includes(row.value.status)
    )
      return reply({ error: "This delivery no longer needs review" }, 409);
    if (
      row.value.status === "sending" &&
      Date.now() - row.value.attemptedAt < 300000
    )
      return reply(
        {
          error:
            "This email may still be sending. Check again in a few minutes.",
        },
        409,
      );
    const saved = await store.put(
      key,
      {
        ...row.value,
        status: input.outcome === "sent" ? "sent" : "deferred",
        retryAt: input.outcome === "not_sent" ? Date.now() : null,
        resolvedBy: uid,
        resolvedAt: Date.now(),
        resolution: input.outcome,
      },
      input.version,
    );
    return saved
      ? reply({ ok: true })
      : reply(
          {
            error:
              "The delivery changed. Refresh its status before continuing.",
          },
          409,
        );
  } catch {
    return reply({ error: "Delivery resolution could not be saved" }, 400);
  }
};
