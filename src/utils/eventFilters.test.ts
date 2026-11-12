import { describe, expect, it } from "vitest";
import { events } from "@/data/events";
import { getListingInventory } from "./eventFilters";

describe("shared listing inventory", () => {
  it("preserves the homepage exclusions without excluding them from the tickets inventory", () => {
    const inventory = ["Chicago", "Denver", "Salt Lake City"].map((city) => ({
      ...events[0],
      city,
    }));
    expect(
      getListingInventory(inventory, "home").map((event) => event.city),
    ).toEqual(["Chicago"]);
    expect(getListingInventory(inventory, "tickets")).toEqual(inventory);
  });
});
