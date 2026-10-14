export const prerender = false;
import type { APIRoute } from "astro";
import { z } from "zod";
import { verifyAdminToken } from "@/lib/verifyToken";
import { store, fingerprint } from "@/lib/outreach/store";
import { normalizeEmail, type Settings } from "@/lib/outreach/model";
import { upsertContact } from "@/lib/outreach/contacts";
import { defaultTemplates } from "@/data/outreach";
const schema = z
  .object({
    contacts: z
      .array(
        z
          .object({
            email: z.string(),
            city: z.string().max(200),
            suppressed: z.boolean(),
          })
          .strict(),
      )
      .max(200),
    suppressed: z.array(z.string()).max(200),
    history: z
      .array(
        z
          .object({
            email: z.string(),
            showId: z.string().regex(/^[a-z0-9-]{1,101}$/),
          })
          .strict(),
      )
      .max(200)
      .default([]),
    lastGmailSendAt: z.number().nonnegative().optional(),
    complete: z.boolean(),
  })
  .strict();
export const POST: APIRoute = async ({ request }) => {
  if (
    !(await verifyAdminToken(request.headers.get("authorization") ?? undefined))
  )
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const text = await request.text();
    if (text.length > 100000)
      return Response.json(
        { error: "Import batch is too large" },
        { status: 413 },
      );
    const input = schema.parse(JSON.parse(text));
    // The importer sends suppression batches first. Replaying a batch is safe.
    for (const raw of input.suppressed) {
      const email = raw.trim().toLowerCase();
      if (!email) throw new Error("Empty suppression address");
      const key = `emailSuppression/${fingerprint(email)}`;
      if (!(await store.get(key)))
        await store.put(key, { email, suppressedAt: Date.now() }, null);
    }
    for (const contact of input.contacts) {
      const email = normalizeEmail(contact.email);
      if (!email) continue;
      await upsertContact(store, { ...contact, email });
    }
    for (const sent of input.history) {
      const email = normalizeEmail(sent.email);
      if (!email) continue;
      const key = `emailHistory/${fingerprint(`${sent.showId}:${email}`)}`;
      if (!(await store.get(key)))
        await store.put(key, { email, showId: sent.showId }, null);
    }
    if (input.complete) {
      const current = await store.get<Settings>("emailSettings/default");
      if (
        !(await store.put(
          "emailSettings/default",
          {
            ...(current?.value ?? {
              enabled: false,
              templates: defaultTemplates,
            }),
            importedAt: Date.now(),
            resumeAfter: (input.lastGmailSendAt ?? 0) + 86400000,
          },
          current?.version ?? null,
        ))
      )
        throw new Error("Settings changed during import");
    }
    return Response.json({ ok: true });
  } catch {
    return Response.json(
      {
        error:
          "Import was not completed. Correct the file and retry; existing contacts are preserved.",
      },
      { status: 400 },
    );
  }
};
