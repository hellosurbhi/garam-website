import { describe, it, expect } from "vitest";
import {
  schedule,
  showSchema,
  normalizeEmail,
  render,
  type Show,
} from "./model";
import { defaultTemplates } from "@/data/outreach";
const show: Show = {
  id: "chicago",
  city: "Chicago",
  date: "2026-10-24",
  time: "18:00",
  timezone: "America/Chicago",
  venue: "The Lincoln Lodge",
  tickets: "https://example.org",
  audience: "all",
  enabled: true,
  published: true,
  templates: defaultTemplates,
  createdAt: Date.parse("2026-10-14T12:00:00Z"),
  updatedAt: 0,
};
describe("email schedule", () => {
  it("uses Monday and Friday mornings in the show's timezone", () => {
    const dates = schedule(show);
    expect(new Date(dates.monday!).toISOString()).toBe(
      "2026-10-19T14:00:00.000Z",
    );
    expect(new Date(dates.friday!).toISOString()).toBe(
      "2026-10-23T14:00:00.000Z",
    );
  });
  it("uses the correct offset after daylight saving ends", () => {
    const dates = schedule({ ...show, date: "2026-11-07" });
    expect(new Date(dates.monday!).toISOString()).toBe(
      "2026-11-02T15:00:00.000Z",
    );
  });
  it("skips reminders in the past when a show is added late", () => {
    const dates = schedule({
      ...show,
      createdAt: Date.parse("2026-10-23T16:00:00Z"),
    });
    expect(dates.monday).toBeNull();
    expect(dates.friday).toBeNull();
  });
  it("does not send a Friday reminder for a Wednesday show", () => {
    expect(schedule({ ...show, date: "2026-10-21" }).friday).toBeNull();
  });
  it("puts a Sunday show in the week beginning the preceding Monday", () => {
    expect(
      new Date(schedule({ ...show, date: "2026-10-25" }).monday!).toISOString(),
    ).toBe("2026-10-19T14:00:00.000Z");
  });
  it("rejects impossible dates and unknown placeholders", () => {
    const { createdAt, updatedAt, ...input } = show;
    void createdAt;
    void updatedAt;
    expect(showSchema.safeParse({ ...input, date: "2026-02-30" }).success).toBe(
      false,
    );
    expect(
      showSchema.safeParse({
        ...input,
        templates: {
          ...defaultTemplates,
          monday: { subject: "Hi", body: "{{unknown}}" },
        },
      }).success,
    ).toBe(false);
  });
  it("preserves relay addresses while excluding common typos", () => {
    expect(normalizeEmail(" person@privaterelay.appleid.com ")).toBe(
      "person@privaterelay.appleid.com",
    );
    expect(normalizeEmail("person@gmail.comm")).toBeNull();
  });
  it("fills saved copy without changing unrelated words", () => {
    expect(render(show, "announcement").body).toContain(
      "The Lincoln Lodge in Chicago on Saturday, October 24",
    );
  });
});
