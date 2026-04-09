import { describe, it, expect } from "vitest";
import { formatLocation } from "./locationDisplay";
import type { Application } from "@/types/application";

function makeApp(overrides: Partial<Application>): Application {
  return {
    id: "test-id",
    name: "Test User",
    age: 25,
    gender: "Male",
    orientation: "Straight",
    city: "New York",
    height: "5'10",
    instagram: "@test",
    community: "Hindu",
    income: "$100k–$150k",
    applicationType: "contestant",
    photoUrl: "https://example.com/photo.jpg",
    status: "New",
    submittedAt: {
      seconds: 0,
      nanoseconds: 0,
      toDate: () => new Date(),
      toMillis: () => 0,
      isEqual: () => true,
      valueOf: () => "",
      toJSON: () => ({ seconds: 0, nanoseconds: 0 }),
    } as Application["submittedAt"],
    ...overrides,
  };
}

describe("formatLocation", () => {
  it("returns city and state when state is present", () => {
    const app = makeApp({ city: "New York", state: "NY" });
    expect(formatLocation(app)).toBe("New York, NY");
  });

  it("returns only city when state is undefined", () => {
    const app = makeApp({ city: "Mumbai", state: undefined });
    expect(formatLocation(app)).toBe("Mumbai");
  });

  it("returns only city when state is empty string", () => {
    const app = makeApp({ city: "London", state: "" });
    expect(formatLocation(app)).toBe("London");
  });
});
