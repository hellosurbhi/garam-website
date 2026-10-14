import { z } from "zod";
import { offsetForZone } from "@/utils/timezone";

export const milestones = ["announcement", "monday", "friday"] as const;
export type Milestone = (typeof milestones)[number];
export const emailAddress = z.email().transform((s) => s.trim().toLowerCase());
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine((s) => {
    const ms = Date.parse(`${s}T12:00:00Z`);
    return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === s;
  }, "Choose a real calendar date");
const safeText = z
  .string()
  .trim()
  .min(1)
  .max(200)
  .refine((s) => !/[\r\n]/.test(s));
export const templateSchema = z
  .object({
    subject: safeText,
    body: z.string().trim().min(1).max(12000),
  })
  .strict()
  .refine((t) => {
    const tokens = `${t.subject} ${t.body}`.match(/\{\{[^}]+\}\}/g) ?? [];
    return tokens.every((s) =>
      ["{{city}}", "{{date}}", "{{venue}}", "{{tickets}}"].includes(s),
    );
  }, "Use only city, date, venue and tickets placeholders");
export const templatesSchema = z
  .object({
    announcement: templateSchema,
    monday: templateSchema,
    friday: templateSchema,
  })
  .strict();
export const showSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9][a-z0-9-]{0,100}$/),
    city: safeText,
    date,
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    timezone: z.string().refine((s) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: s });
        return true;
      } catch {
        return false;
      }
    }, "Choose a valid timezone"),
    venue: safeText,
    tickets: z
      .url()
      .refine(
        (s) => new URL(s).protocol === "https:",
        "Use an https ticket link",
      ),
    audience: z.enum(["all", "city"]),
    enabled: z.boolean(),
    published: z.boolean(),
    templates: templatesSchema,
  })
  .strict();
export type ShowInput = z.infer<typeof showSchema>;
export type Show = ShowInput & { createdAt: number; updatedAt: number };
export type Templates = z.infer<typeof templatesSchema>;
export type Contact = { email: string; city: string; suppressed: boolean };
export type Delivery = {
  status:
    "sending" | "sent" | "rejected" | "uncertain" | "deferred" | "skipped";
  email: string;
  showId: string;
  milestone: Milestone;
  account: string;
  attemptedAt: number;
  subject: string;
  body: string;
  messageId?: string;
  retryAt?: number;
};
export type Job = {
  showId: string;
  milestone: Milestone;
  recipients: string[];
  createdAt: number;
};
export type Settings = {
  enabled: boolean;
  templates: Templates;
  importedAt: number | null;
  resumeAfter?: number;
};
export type AccountState = { attempts: number[]; nextAt: number };

export function showTime(show: ShowInput): number {
  return Date.parse(
    `${show.date}T${show.time}:00${offsetForZone(show.date, show.time, show.timezone)}`,
  );
}
export function schedule(show: Show): Record<Milestone, number | null> {
  const day = new Date(`${show.date}T12:00:00Z`);
  const monday = new Date(day);
  monday.setUTCDate(day.getUTCDate() - ((day.getUTCDay() + 6) % 7));
  const reminder = (offset: number) => {
    const d = new Date(monday);
    d.setUTCDate(d.getUTCDate() + offset);
    const iso = d.toISOString().slice(0, 10);
    const at = Date.parse(
      `${iso}T09:00:00${offsetForZone(iso, "09:00", show.timezone)}`,
    );
    // Late-added shows get one announcement, never a burst of old reminders.
    return at > show.createdAt && at < showTime(show) ? at : null;
  };
  return {
    announcement: show.createdAt,
    monday: reminder(0),
    friday: reminder(4),
  };
}
export function render(show: Show, milestone: Milestone) {
  const values: Record<string, string> = {
    city: show.city,
    venue: show.venue,
    tickets: show.tickets,
    date: new Date(`${show.date}T12:00:00Z`).toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      timeZone: "UTC",
    }),
  };
  const replace = (text: string) =>
    text.replace(
      /\{\{(city|date|venue|tickets)\}\}/g,
      (_, key: string) => values[key],
    );
  return {
    subject: replace(show.templates[milestone].subject),
    body: replace(show.templates[milestone].body),
  };
}
export function normalizeEmail(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const result = emailAddress.safeParse(value.trim().toLowerCase());
  if (!result.success) return null;
  const domain = result.data.split("@")[1];
  if (
    /\.(comm|con|cmo)$/.test(domain) ||
    ["gmial.com", "gmai.com", "gmail.co", "gamil.com", "example.com"].includes(
      domain,
    )
  )
    return null;
  return result.data;
}
export function matchesAudience(show: Show, contact: Contact): boolean {
  return (
    !contact.suppressed &&
    (show.audience === "all" ||
      contact.city.trim().toLowerCase() === show.city.trim().toLowerCase())
  );
}
