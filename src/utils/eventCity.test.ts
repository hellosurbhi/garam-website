import { describe, expect, it } from "vitest";
import { formatEventLocation } from "./eventCity";

describe("formatEventLocation", () => {
  it("renders city with abbreviated state", () => {
    expect(
      formatEventLocation({
        city: "Manhattan",
        stateAbbr: "NY",
      }),
    ).toBe("Manhattan, NY");

    expect(
      formatEventLocation({
        city: "Jersey City",
        stateAbbr: "NJ",
      }),
    ).toBe("Jersey City, NJ");

    expect(
      formatEventLocation({
        city: "Philadelphia",
        stateAbbr: "PA",
      }),
    ).toBe("Philadelphia, PA");

    expect(
      formatEventLocation({
        city: "San Francisco",
        stateAbbr: "CA",
      }),
    ).toBe("San Francisco, CA");

    expect(
      formatEventLocation({
        city: "Los Angeles",
        stateAbbr: "CA",
      }),
    ).toBe("Los Angeles, CA");

    expect(
      formatEventLocation({
        city: "Washington",
        stateAbbr: "DC",
      }),
    ).toBe("Washington, DC");
  });
});
