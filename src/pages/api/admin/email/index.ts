export const prerender = false;
import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyAdminToken } from "@/lib/verifyToken";
import { store } from "@/lib/outreach/store";
import {
  showSchema,
  showTime,
  templatesSchema,
  type Show,
  type Settings,
  type Contact,
  type Job,
  type Delivery,
} from "@/lib/outreach/model";
import { defaultTemplates } from "@/data/outreach";
import { configuredAccounts } from "@/lib/outreach/gmail";
import { events } from "@/data/events";
const settingsSchema = z
  .object({ enabled: z.boolean(), templates: templatesSchema })
  .strict();
const requestSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("show"),
      show: showSchema,
      version: z.string().nullable(),
    })
    .strict(),
  z
    .object({
      action: z.literal("settings"),
      settings: settingsSchema,
      version: z.string().nullable(),
    })
    .strict(),
]);
const reply = (body: unknown, status = 200) =>
  Response.json(body, { status, headers: { "Cache-Control": "no-store" } });
async function authorized(request: Request) {
  return verifyAdminToken(request.headers.get("authorization") ?? undefined);
}
export const GET: APIRoute = async ({ request }) => {
  if (!(await authorized(request)))
    return reply({ error: "Please sign in as an admin" }, 401);
  try {
    const [shows, settings, contacts, sync, health, jobs] = await Promise.all([
      store.list<Show>("emailShows"),
      store.get<Settings>("emailSettings/default"),
      store.list<Contact>("emailContacts"),
      store.get("emailSystem/contacts"),
      store.get("emailSystem/worker"),
      store.list<Job>("emailJobs"),
    ]);
    const progress = await Promise.all(
      jobs.map(async (job) => {
        const deliveries = await store.list<Delivery>(
          `emailJobs/${job.id}/deliveries`,
        );
        return {
          id: job.id,
          showId: job.value.showId,
          milestone: job.value.milestone,
          total: job.value.recipients.length,
          sent: deliveries.filter((d) => d.value.status === "sent").length,
          excluded: deliveries.filter((d) => d.value.status === "skipped")
            .length,
          attention: deliveries.filter((d) =>
            ["sending", "uncertain", "rejected"].includes(d.value.status),
          ).length,
        };
      }),
    );
    return reply({
      shows,
      settings: settings ?? {
        value: {
          enabled: false,
          templates: defaultTemplates,
          importedAt: null,
        },
        version: null,
      },
      contactCount: contacts.filter((c) => !c.value.suppressed).length,
      sync: sync?.value ?? null,
      health: health?.value ?? null,
      progress,
      accounts: configuredAccounts().map((a) => a.address),
      catalog: events
        .filter(
          (e) =>
            e.isoDate &&
            e.venue &&
            e.url &&
            !e.hidden &&
            e.status !== "canceled",
        )
        .map((e) => ({
          id: e.slug,
          city: e.city,
          date: e.isoDate,
          time: e.startTime ?? "20:00",
          timezone: e.timezone ?? "America/New_York",
          venue: e.venue!.name,
          tickets: e.url,
        })),
    });
  } catch {
    return reply(
      { error: "Email dashboard could not load. Please try again." },
      503,
    );
  }
};
export const POST: APIRoute = async ({ request }) => {
  if (!(await authorized(request)))
    return reply({ error: "Please sign in as an admin" }, 401);
  if (Number(request.headers.get("content-length")) > 50000)
    return reply({ error: "Email copy is too large" }, 413);
  try {
    const text = await request.text();
    if (text.length > 50000)
      return reply({ error: "Email copy is too large" }, 413);
    const parsed = requestSchema.safeParse(JSON.parse(text));
    if (!parsed.success)
      return reply(
        { error: parsed.error.issues[0]?.message ?? "Check the show details" },
        400,
      );
    const input = parsed.data;
    if (input.action === "settings") {
      const current = await store.get<Settings>("emailSettings/default");
      if (
        input.settings.enabled &&
        (!current?.value.importedAt ||
          !configuredAccounts().length ||
          !import.meta.env.OUTREACH_UNSUBSCRIBE_SECRET ||
          import.meta.env.OUTREACH_UNSUBSCRIBE_SECRET.length < 32)
      )
        return reply(
          {
            error:
              "Finish the Gmail connection and audience import before enabling automatic sending",
          },
          409,
        );
      const saved = await store.put(
        "emailSettings/default",
        { ...input.settings, importedAt: current?.value.importedAt ?? null },
        input.version,
      );
      return saved
        ? reply({ ok: true })
        : reply(
            {
              error:
                "Settings changed in another window. Refresh and try again.",
            },
            409,
          );
    }
    if (input.show.enabled && showTime(input.show) <= Date.now())
      return reply({ error: "Choose a future show date" }, 400);
    const current = await store.get<Show>(`emailShows/${input.show.id}`);
    // Existing delivery keys remain stable across date and copy edits.
    const value: Show = {
      ...input.show,
      createdAt: current?.value.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    };
    const saved = await store.put(
      `emailShows/${value.id}`,
      value,
      input.version,
    );
    return saved
      ? reply({ ok: true })
      : reply(
          {
            error:
              "This show changed in another window. Refresh and try again.",
          },
          409,
        );
  } catch (error) {
    return reply(
      {
        error:
          error instanceof SyntaxError
            ? "Invalid request"
            : "Your changes could not be saved. Please try again.",
      },
      error instanceof SyntaxError ? 400 : 503,
    );
  }
};
