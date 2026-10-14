import { fsListAll } from "@/lib/firestoreRest";
import { store, fingerprint, type Store } from "./store";
import { normalizeEmail, type Contact } from "./model";

export async function upsertContact(db: Store, input: Contact) {
  const key = `emailContacts/${fingerprint(input.email)}`;
  const previous = await db.get<Contact>(key);
  const value = {
    ...input,
    city: input.city || previous?.value.city || "",
    suppressed: input.suppressed || previous?.value.suppressed || false,
  };
  if (previous && JSON.stringify(previous.value) === JSON.stringify(value))
    return;
  if (!(await db.put(key, value, previous?.version ?? null)))
    throw new Error("Contact changed during refresh; refresh will retry");
}
export async function refreshContacts(now: number) {
  const previous = await store.get<{ refreshedAt: number }>(
    "emailSystem/contacts",
  );
  const morning = new Date(now);
  morning.setUTCHours(12, 0, 0, 0);
  if (now < morning.getTime()) morning.setUTCDate(morning.getUTCDate() - 1);
  if (previous && previous.value.refreshedAt >= morning.getTime()) return;
  const sources = await Promise.all(
    ["leads", "applications", "contestants"].map((collection) =>
      fsListAll(collection),
    ),
  );
  const leads = sources.flat();
  const unique = new Map<string, Contact>();
  for (const lead of leads) {
    if (lead.deletedAt) continue;
    const email = normalizeEmail(lead.email);
    if (!email) continue;
    unique.set(email, {
      email,
      city: typeof lead.city === "string" ? lead.city : "",
      suppressed:
        lead.unsubscribed === true ||
        lead.suppressed === true ||
        lead.emailable === false ||
        unique.get(email)?.suppressed === true,
    });
  }
  const contacts = [...unique.values()];
  for (let start = 0; start < contacts.length; start += 20) {
    await Promise.all(
      contacts
        .slice(start, start + 20)
        .map((contact) => upsertContact(store, contact)),
    );
  }
  const imported = contacts.length;
  if (
    !(await store.put(
      "emailSystem/contacts",
      { refreshedAt: now, imported },
      previous?.version ?? null,
    ))
  )
    throw new Error("Another contact refresh completed first");
}
