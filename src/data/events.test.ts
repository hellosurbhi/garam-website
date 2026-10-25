import { describe, expect, it } from "vitest";
import {
  allEvents,
  comingSoonEvents,
  computeAllEvents,
  events,
  isDisplayable,
} from "./events";
import { formatEventLocation } from "@/utils/eventCity";

describe("event location data", () => {
  it("keeps city, full state, and state abbreviation split explicitly", () => {
    for (const event of allEvents) {
      expect(event.city).not.toContain(",");
      expect(event.state).toMatch(/^[A-Za-z ]+$/);
      expect(event.state.length).toBeGreaterThan(2);
      expect(event.stateAbbr).toMatch(/^[A-Z]{2}$/);
    }
  });

  it("renders known public event labels with abbreviated state names", () => {
    const labels = allEvents.map(formatEventLocation);

    expect(labels).toContain("Manhattan, NY");
    expect(labels).toContain("Jersey City, NJ");
    expect(labels).toContain("San Francisco, CA");
    expect(labels).toContain("San Diego, CA");
    expect(labels).toContain("Los Angeles, CA");
    expect(labels).toContain("Washington, DC");
  });

  it("does not duplicate state abbreviations in formatted labels", () => {
    const labels = allEvents.map(formatEventLocation);

    expect(labels).not.toContain("Manhattan, NY, NY");
    expect(labels).not.toContain("San Francisco, CA, CA");
  });
});

describe("dated email-capture placeholders", () => {
  const placeholders = [
    "2026-11-13",
    "2026-11-19",
    "2026-11-20",
    "2026-11-21",
    "2026-11-22",
    "2026-12-24",
    "2026-12-27",
  ];

  it("shows each placeholder with its date and no ticket link", () => {
    for (const isoDate of placeholders) {
      const event = events.find((e) => e.isoDate === isoDate);
      expect(event, isoDate).toBeDefined();
      expect(isDisplayable(event!)).toBe(true);
      expect(event!.url).toBe("");
      expect(event!.ticketSource).toBe("none");
    }
  });

  it("suppresses the generic TBA card for a city with a dated placeholder", () => {
    const merged = computeAllEvents(events, comingSoonEvents, "2026-10-22");
    for (const slug of ["los-angeles", "san-francisco", "manhattan"]) {
      expect(
        merged.some((e) => e.citySlug === slug && e.date === "TBA"),
        slug,
      ).toBe(false);
    }
  });

  it("lists the San Francisco Dec 26 show as a live 5 PM Eventbrite sale", () => {
    const sf = events.find((e) => e.isoDate === "2026-12-26");
    expect(sf?.url).toContain("eventbrite.com");
    expect(sf?.startTime).toBe("17:00");
    expect(sf?.endTime).toBe("19:00");
  });
});
