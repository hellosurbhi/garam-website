import { describe, expect, it } from "vitest";
import { allEvents } from "./events";
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

  it("renders known public event labels with full state names", () => {
    const labels = allEvents.map(formatEventLocation);

    expect(labels).toContain("Manhattan, New York");
    expect(labels).toContain("Jersey City, New Jersey");
    expect(labels).toContain("Philadelphia, Pennsylvania");
    expect(labels).toContain("San Francisco, California");
    expect(labels).toContain("San Diego, California");
    expect(labels).toContain("Los Angeles, California");
  });

  it("does not duplicate state names in formatted labels", () => {
    const labels = allEvents.map(formatEventLocation);

    expect(labels).not.toContain("Manhattan, New York, New York");
    expect(labels).not.toContain("Philadelphia, Pennsylvania, Pennsylvania");
    expect(labels).not.toContain("San Francisco, California, California");
  });
});
