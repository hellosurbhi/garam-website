import { describe, it, expect, vi } from "vitest";
import { runWorker, reserveAccount } from "./worker";
import type { Store, Versioned } from "./store";
import { fingerprint } from "./store";
import type { Show, Contact, Settings, Delivery, AccountState } from "./model";
import { defaultTemplates } from "@/data/outreach";
import type { Mailbox } from "./gmail";
export function memoryStore(): Store {
  const records = new Map<string, Versioned<unknown>>();
  let version = 0;
  return {
    async get<T>(key: string) {
      return (records.get(key) as Versioned<T> | undefined) ?? null;
    },
    async put<T>(key: string, value: T, expected: string | null) {
      if ((records.get(key)?.version ?? null) !== expected) return false;
      records.set(key, {
        value: structuredClone(value),
        version: String(++version),
      });
      return true;
    },
    async list<T>(collection: string) {
      return [...records]
        .filter(
          ([key]) =>
            key.startsWith(`${collection}/`) &&
            !key.slice(collection.length + 1).includes("/"),
        )
        .map(([key, record]) => ({
          ...record,
          id: key.split("/").at(-1)!,
        })) as Array<Versioned<T> & { id: string }>;
    },
  };
}
const now = Date.parse("2026-10-15T15:00:00Z");
const show: Show = {
  id: "chicago-october",
  city: "Chicago",
  date: "2026-10-24",
  time: "18:00",
  timezone: "America/Chicago",
  venue: "The Lincoln Lodge",
  tickets: "https://example.org/tickets",
  audience: "all",
  enabled: true,
  published: true,
  templates: defaultTemplates,
  createdAt: now,
  updatedAt: now,
};
async function fixture() {
  const db = memoryStore();
  await db.put<Settings>(
    "emailSettings/default",
    { enabled: true, importedAt: now, templates: defaultTemplates },
    null,
  );
  await db.put("emailShows/chicago-october", show, null);
  for (const email of ["first@example.org", "second@example.org"])
    await db.put<Contact>(
      `emailContacts/${fingerprint(email)}`,
      { email, city: "Chicago", suppressed: false },
      null,
    );
  const send = vi
    .fn<Mailbox["send"]>()
    .mockResolvedValue({ status: "sent", messageId: "gmail-id" });
  const mailbox: Mailbox = { address: "show@gmail.com", send };
  return { db, mailbox, send };
}
const unsubscribe = () => "https://example.org/unsubscribe";
describe("hosted Gmail queue", () => {
  it("resumes after pacing without re-mailing the first recipient", async () => {
    const { db, mailbox, send } = await fixture();
    expect((await runWorker(db, [mailbox], now, unsubscribe)).sent).toBe(1);
    expect(
      (await runWorker(db, [mailbox], now + 60000, unsubscribe)).sent,
    ).toBe(0);
    expect(
      (await runWorker(db, [mailbox], now + 120000, unsubscribe)).sent,
    ).toBe(1);
    await runWorker(db, [mailbox], now + 240000, unsubscribe);
    expect(send.mock.calls.map(([mail]) => mail.to)).toEqual([
      "first@example.org",
      "second@example.org",
    ]);
  });
  it("concurrent ticks reserve only one account slot", async () => {
    const { db, mailbox, send } = await fixture();
    await Promise.all([
      runWorker(db, [mailbox], now, unsubscribe),
      runWorker(db, [mailbox], now, unsubscribe),
    ]);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("skips an unsubscribe after the audience snapshot", async () => {
    const { db, mailbox, send } = await fixture();
    await runWorker(db, [mailbox], now, unsubscribe);
    await db.put(
      `emailSuppression/${fingerprint("second@example.org")}`,
      { email: "second@example.org" },
      null,
    );
    await runWorker(db, [mailbox], now + 120000, unsubscribe);
    expect(send).toHaveBeenCalledTimes(1);
  });
  it("never retries an ambiguous send", async () => {
    const { db, mailbox, send } = await fixture();
    send.mockResolvedValue({ status: "uncertain" });
    await runWorker(db, [mailbox], now, unsubscribe);
    await runWorker(db, [mailbox], now + 120000, unsubscribe);
    await runWorker(db, [mailbox], now + 240000, unsubscribe);
    expect(send).toHaveBeenCalledTimes(2);
    const records = await db.list<Delivery>(
      "emailJobs/chicago-october-announcement/deliveries",
    );
    expect(records.every((r) => r.value.status === "uncertain")).toBe(true);
  });
  it("retries a confirmed rate rejection after its cooldown", async () => {
    const { db, mailbox, send } = await fixture();
    send.mockResolvedValueOnce({ status: "deferred", retryAt: now + 3600000 });
    await runWorker(db, [mailbox], now, unsubscribe);
    await runWorker(db, [mailbox], now + 120000, unsubscribe);
    expect(send).toHaveBeenCalledTimes(1);
    await runWorker(db, [mailbox], now + 3600000, unsubscribe);
    expect(send).toHaveBeenCalledTimes(2);
    expect(send.mock.calls[1][0].to).toBe("first@example.org");
  });
  it("continues on the second Gmail account when the first is capped", async () => {
    const { db, mailbox, send } = await fixture();
    await db.put<AccountState>(
      `emailAccounts/${fingerprint(mailbox.address)}`,
      { attempts: Array(450).fill(now - 1000), nextAt: 0 },
      null,
    );
    await runWorker(
      db,
      [mailbox, { ...mailbox, address: "other@gmail.com" }],
      now,
      unsubscribe,
    );
    expect(send).toHaveBeenCalledTimes(1);
    expect(await reserveAccount(db, mailbox.address, now)).toBe(false);
    expect(await reserveAccount(db, mailbox.address, now + 86400000)).toBe(
      true,
    );
  });
  it("will not send while the audience import is incomplete", async () => {
    const { db, mailbox, send } = await fixture();
    const settings = (await db.get<Settings>("emailSettings/default"))!;
    await db.put(
      "emailSettings/default",
      { ...settings.value, importedAt: null },
      settings.version,
    );
    expect((await runWorker(db, [mailbox], now, unsubscribe)).paused).toBe(
      true,
    );
    expect(send).not.toHaveBeenCalled();
  });
  it("respects pausing a show", async () => {
    const { db, mailbox, send } = await fixture();
    const current = (await db.get<Show>("emailShows/chicago-october"))!;
    await db.put(
      "emailShows/chicago-october",
      { ...current.value, enabled: false },
      current.version,
    );
    await runWorker(db, [mailbox], now, unsubscribe);
    expect(send).not.toHaveBeenCalled();
  });
  it("carries historical announcements forward without repeating them", async () => {
    const { db, mailbox, send } = await fixture();
    await db.put(
      `emailHistory/${fingerprint(`${show.id}:first@example.org`)}`,
      { email: "first@example.org" },
      null,
    );
    await runWorker(db, [mailbox], now, unsubscribe);
    expect(send).toHaveBeenCalledTimes(1);
    expect(send.mock.calls[0][0].to).toBe("second@example.org");
  });
  it("waits out the prior laptop sender's rolling window", async () => {
    const { db, mailbox, send } = await fixture();
    const settings = (await db.get<Settings>("emailSettings/default"))!;
    await db.put(
      "emailSettings/default",
      { ...settings.value, resumeAfter: now + 86400000 },
      settings.version,
    );
    await runWorker(db, [mailbox], now, unsubscribe);
    expect(send).not.toHaveBeenCalled();
  });
  it("paces from the actual completion time when storage and sending take time", async () => {
    const { db, mailbox } = await fixture();
    let clock = now + 600000;
    mailbox.send = async () => {
      clock += 20000;
      return { status: "sent", messageId: "accepted" };
    };
    await runWorker(db, [mailbox], now, unsubscribe, () => clock);
    const state = await db.get<AccountState>(
      `emailAccounts/${fingerprint(mailbox.address)}`,
    );
    expect(state!.value.nextAt).toBe(clock + 120000);
  });
});
