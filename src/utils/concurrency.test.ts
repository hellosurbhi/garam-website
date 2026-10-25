import { describe, it, expect } from "vitest";
import { mapWithConcurrency } from "@/utils/concurrency";

describe("mapWithConcurrency", () => {
  it("processes every item", async () => {
    const seen: number[] = [];
    await mapWithConcurrency([1, 2, 3, 4, 5], 2, async (n) => {
      seen.push(n);
    });
    expect(seen.sort()).toEqual([1, 2, 3, 4, 5]);
  });

  it("never exceeds the concurrency limit", async () => {
    let inFlight = 0;
    let peak = 0;
    await mapWithConcurrency([...Array(12).keys()], 3, async () => {
      inFlight += 1;
      peak = Math.max(peak, inFlight);
      await new Promise((r) => setTimeout(r, 2));
      inFlight -= 1;
    });
    expect(peak).toBe(3);
  });

  it("resolves for an empty list", async () => {
    await expect(
      mapWithConcurrency([], 4, async () => undefined),
    ).resolves.toBeUndefined();
  });

  it("rejects with the error when fn throws", async () => {
    await expect(
      mapWithConcurrency([1, 2, 3], 2, async (n) => {
        if (n === 2) throw new Error("boom");
      }),
    ).rejects.toThrow("boom");
  });
});
