import { describe, it, expect } from "vitest";
import { formatLocation } from "../src/utils/locationDisplay";
import type { Application } from "../src/types/application";

function makeApp(overrides: Partial<Application>): Application {
  return {
    id: "test-id",
    name: "Test User",
    age: 25,
    gender: "Male",
    orientation: "Straight",
    city: "New York",
    height: "5'10\"",
    instagram: "testuser",
    community: "Hindu",
    income: "$50k–$100k",
    applicationType: "Self",
    photoUrl: "https://example.com/photo.jpg",
    status: "New",
    submittedAt: null as unknown as Application["submittedAt"],
    ...overrides,
  };
}

describe("formatLocation", () => {
  it("returns 'City, State' when state is present", () => {
    const app = makeApp({ city: "New York", state: "NY" });
    expect(formatLocation(app)).toBe("New York, NY");
  });

  it("returns just the city when state is absent", () => {
    const app = makeApp({ city: "London", state: undefined });
    expect(formatLocation(app)).toBe("London");
  });

  it("returns just the city when state is empty string", () => {
    const app = makeApp({ city: "Paris", state: "" });
    expect(formatLocation(app)).toBe("Paris");
  });

  it("handles city with comma in the name", () => {
    const app = makeApp({ city: "Manhattan, New York", state: "NY" });
    expect(formatLocation(app)).toBe("Manhattan, New York, NY");
  });

  it("handles state without city (returns 'City, State' format)", () => {
    const app = makeApp({ city: "Chicago", state: "IL" });
    expect(formatLocation(app)).toBe("Chicago, IL");
  });

  it("handles non-US locations with country code as state equivalent", () => {
    const app = makeApp({ city: "Toronto", state: "ON" });
    expect(formatLocation(app)).toBe("Toronto, ON");
  });

  it("returns city when state is null-ish via undefined", () => {
    const app = makeApp({ city: "Mumbai" });
    delete (app as Partial<Application>).state;
    expect(formatLocation(app)).toBe("Mumbai");
  });
});