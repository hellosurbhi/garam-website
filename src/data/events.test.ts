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

  it("renders known public event labels with abbreviated state names", () => {
    const labels = allEvents.map(formatEventLocation);

    expect(labels).toContain("Manhattan, NY");
    expect(labels).toContain("Jersey City, NJ");
    expect(labels).toContain("San Francisco, CA");
    expect(labels).toContain("San Diego, CA");
    expect(labels).toContain("Los Angeles, CA");
    expect(labels).toContain("Washington, DC");
    expect(labels).toContain("Philadelphia, PA");
  });

  it("does not duplicate state abbreviations in formatted labels", () => {
    const labels = allEvents.map(formatEventLocation);

    expect(labels).not.toContain("Manhattan, NY, NY");
    expect(labels).not.toContain("San Francisco, CA, CA");
    expect(labels).not.toContain("Philadelphia, PA, PA");
  });
});
