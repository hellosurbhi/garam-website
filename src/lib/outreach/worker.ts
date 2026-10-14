import type { Store } from "./store";
import { fingerprint } from "./store";
import {
  matchesAudience,
  milestones,
  render,
  schedule,
  showTime,
  type Show,
  type Job,
  type Contact,
  type Settings,
  type AccountState,
  type Delivery,
} from "./model";
import type { Mailbox } from "./gmail";

const DAY = 86400000;
export async function reserveAccount(db: Store, address: string, now: number) {
  const key = `emailAccounts/${fingerprint(address)}`;
  const current = await db.get<AccountState>(key);
  const value = current?.value ?? { attempts: [], nextAt: 0 };
  if (
    !Array.isArray(value.attempts) ||
    value.attempts.some((t) => !Number.isFinite(t)) ||
    !Number.isFinite(value.nextAt)
  )
    throw new Error("Invalid Gmail pacing record");
  const attempts = value.attempts.filter((t) => t > now - DAY);
  if (value.nextAt > now || attempts.length >= 450) return false;
  return db.put(
    key,
    { attempts: [...attempts, now], nextAt: now + 120000 },
    current?.version ?? null,
  );
}

export async function runWorker(
  db: Store,
  mailboxes: Mailbox[],
  now: number,
  unsubscribe: (email: string) => string,
  clock: () => number = () => now,
) {
  const settings = await db.get<Settings>("emailSettings/default");
  if (
    !settings?.value.enabled ||
    !settings.value.importedAt ||
    (settings.value.resumeAfter ?? 0) > now
  )
    return { sent: 0, attention: 0, paused: true };
  const shows = (await db.list<Show>("emailShows"))
    .map((r) => r.value)
    .filter((s) => s.enabled && showTime(s) > now);
  const contacts = (await db.list<Contact>("emailContacts")).map(
    (r) => r.value,
  );
  let sent = 0,
    attention = 0;
  const available = [...mailboxes];
  for (const show of shows.sort((a, b) => showTime(a) - showTime(b))) {
    const dates = schedule(show);
    // Only the current milestone can send. Outages cannot cause a burst of stale reminders.
    const milestone = [...milestones]
      .reverse()
      .find((m) => dates[m] !== null && dates[m]! <= now);
    if (!milestone) continue;
    const key = `${show.id}-${milestone}`;
    let job = await db.get<Job>(`emailJobs/${key}`);
    if (!job) {
      const value: Job = {
        showId: show.id,
        milestone,
        createdAt: now,
        recipients: contacts
          .filter((c) => matchesAudience(show, c))
          .map((c) => c.email),
      };
      await db.put(`emailJobs/${key}`, value, null);
      job = await db.get<Job>(`emailJobs/${key}`);
      if (!job) throw new Error("Could not read the scheduled email queue");
    }
    const deliveries = await db.list<Delivery>(`emailJobs/${key}/deliveries`);
    const attempted = new Map(deliveries.map((d) => [d.value.email, d]));
    attention += deliveries.filter((d) =>
      ["sending", "uncertain", "rejected"].includes(d.value.status),
    ).length;
    for (const email of job.value.recipients) {
      const prior = attempted.get(email);
      if (
        prior &&
        !(
          prior.value.status === "deferred" &&
          Number.isFinite(prior.value.retryAt) &&
          prior.value.retryAt! <= now
        )
      )
        continue;
      const historical =
        milestone === "announcement" &&
        (await db.get(`emailHistory/${fingerprint(`${show.id}:${email}`)}`));

      // Re-read suppression immediately before claiming, rather than trusting the daily snapshot.
      const contact = await db.get<Contact>(
        `emailContacts/${fingerprint(email)}`,
      );
      const suppressed = await db.get<{ email: string }>(
        `emailSuppression/${fingerprint(email)}`,
      );
      if (
        !contact ||
        suppressed ||
        historical ||
        !matchesAudience(show, contact.value)
      ) {
        await db.put(
          `emailJobs/${key}/deliveries/${fingerprint(email)}`,
          {
            status: "skipped",
            email,
            showId: show.id,
            milestone,
            account: "",
            attemptedAt: now,
            subject: "",
            body: "",
          },
          prior?.version ?? null,
        );
        continue;
      }
      if (!available.length) break;
      const currentShow = await db.get<Show>(`emailShows/${show.id}`);
      const currentSettings = await db.get<Settings>("emailSettings/default");
      if (
        !currentShow?.value.enabled ||
        !currentSettings?.value.enabled ||
        currentShow.value.updatedAt !== show.updatedAt
      )
        break;
      let mailbox: Mailbox | undefined;
      while (available.length) {
        const candidate = available.shift()!;
        if (await reserveAccount(db, candidate.address, clock())) {
          mailbox = candidate;
          break;
        }
      }
      if (!mailbox) break;
      const deliveryKey = `emailJobs/${key}/deliveries/${fingerprint(email)}`;
      const copy = render(show, milestone);
      const url = unsubscribe(email); // Validate signing configuration before recording an intent.
      const delivery: Delivery = {
        status: "sending",
        email,
        showId: show.id,
        milestone,
        account: mailbox.address,
        attemptedAt: clock(),
        ...copy,
      };
      if (!(await db.put(deliveryKey, delivery, prior?.version ?? null)))
        continue;
      const claimed = await db.get<Delivery>(deliveryKey);
      if (!claimed) throw new Error("Delivery intent could not be read");
      const result = await mailbox.send({
        to: email,
        ...copy,
        unsubscribe: url,
        id: fingerprint(`${key}:${email}`),
      });
      const updated = { ...delivery, ...result };
      const accountKey = `emailAccounts/${fingerprint(mailbox.address)}`;
      const account = await db.get<AccountState>(accountKey);
      if (
        !account ||
        !(await db.put(
          accountKey,
          {
            ...account.value,
            nextAt: Math.max(
              account.value.nextAt,
              clock() + 120000,
              result.status === "deferred" ? result.retryAt : 0,
            ),
          },
          account.version,
        ))
      )
        throw new Error("Gmail pacing could not be saved");
      if (!(await db.put(deliveryKey, updated, claimed.version)))
        throw new Error(
          "Gmail responded but delivery bookkeeping needs attention",
        );
      if (result.status === "sent") sent++;
      else attention++;
    }
  }
  return { sent, attention, paused: false };
}
