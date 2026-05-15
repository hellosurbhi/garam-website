import { describe, expect, it } from "vitest";
import { formatEventLocation } from "./eventCity";

describe("formatEventLocation", () => {
  it("renders full city and state labels", () => {
    expect(
      formatEventLocation({
        city: "Manhattan",
        state: "New York",
      }),
    ).toBe("Manhattan, New York");

    expect(
      formatEventLocation({
        city: "Jersey City",
        state: "New Jersey",
      }),
    ).toBe("Jersey City, New Jersey");

    expect(
      formatEventLocation({
        city: "Philadelphia",
        state: "Pennsylvania",
      }),
    ).toBe("Philadelphia, Pennsylvania");

    expect(
      formatEventLocation({
        city: "San Francisco",
        state: "California",
      }),
    ).toBe("San Francisco, California");

    expect(
      formatEventLocation({
        city: "Los Angeles",
        state: "California",
      }),
    ).toBe("Los Angeles, California");
  });
});
