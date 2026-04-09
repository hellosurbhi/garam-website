import { describe, it, expect } from "vitest";
import { events } from "../src/data/events";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const SHORT_DATE_RE = /^[A-Z][a-z]{2} \d{1,2}$/;

describe("events data", () => {
  it("exports a non-empty array", () => {
    expect(Array.isArray(events)).toBe(true);
    expect(events.length).toBeGreaterThan(0);
  });

  it("every event has required fields: date, city, url", () => {
    for (const event of events) {
      expect(typeof event.date).toBe("string");
      expect(event.date.trim()).not.toBe("");
      expect(typeof event.city).toBe("string");
      expect(event.city.trim()).not.toBe("");
      expect(typeof event.url).toBe("string");
      expect(event.url.trim()).not.toBe("");
    }
  });

  it("every event.url is a valid URL or '#'", () => {
    for (const event of events) {
      if (event.url === "#") continue;
      expect(() => new URL(event.url)).not.toThrow();
    }
  });

  it("isoDate, when present, matches YYYY-MM-DD format", () => {
    for (const event of events) {
      if (event.isoDate !== undefined) {
        expect(event.isoDate).toMatch(ISO_DATE_RE);
      }
    }
  });

  it("date field is either 'TBA', 'MMM YYYY', or 'MMM D[D]' format", () => {
    const monthYearRe = /^[A-Z][a-z]{2} \d{4}$/;
    for (const event of events) {
      const isValid =
        event.date === "TBA" ||
        SHORT_DATE_RE.test(event.date) ||
        monthYearRe.test(event.date);
      expect(isValid, `Unexpected date format: "${event.date}"`).toBe(true);
    }
  });

  it("events with a short date (e.g. 'Feb 22') have an isoDate", () => {
    for (const event of events) {
      if (SHORT_DATE_RE.test(event.date)) {
        expect(
          event.isoDate,
          `Event "${event.city} on ${event.date}" should have isoDate`,
        ).toBeDefined();
      }
    }
  });

  it("hidden flag, when present, is a boolean", () => {
    for (const event of events) {
      if ("hidden" in event) {
        expect(typeof event.hidden).toBe("boolean");
      }
    }
  });

  it("isoDate months are consistent with the short date month", () => {
    const MONTH_MAP: Record<string, string> = {
      Jan: "01",
      Feb: "02",
      Mar: "03",
      Apr: "04",
      May: "05",
      Jun: "06",
      Jul: "07",
      Aug: "08",
      Sep: "09",
      Oct: "10",
      Nov: "11",
      Dec: "12",
    };

    for (const event of events) {
      if (SHORT_DATE_RE.test(event.date) && event.isoDate) {
        const [monthAbbr] = event.date.split(" ");
        const dayStr = event.date.split(" ")[1].padStart(2, "0");
        const expectedMonth = MONTH_MAP[monthAbbr];
        const [, isoMonth, isoDay] = event.isoDate.split("-");
        expect(isoMonth).toBe(expectedMonth);
        expect(isoDay).toBe(dayStr);
      }
    }
  });

  it("no two events in the same city share the same isoDate", () => {
    const seen = new Set<string>();
    for (const event of events) {
      if (event.isoDate && event.city) {
        const key = `${event.city}::${event.isoDate}`;
        expect(seen.has(key), `Duplicate event: ${key}`).toBe(false);
        seen.add(key);
      }
    }
  });

  it("eventbrite URLs use https", () => {
    for (const event of events) {
      if (event.url !== "#") {
        expect(event.url.startsWith("https://")).toBe(true);
      }
    }
  });
});
