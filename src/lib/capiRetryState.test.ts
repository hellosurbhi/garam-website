import { describe, expect, it } from "vitest";
import { MAX_CAPI_ATTEMPTS, nextCapiFailureState } from "@/lib/capiRetryState";

describe("nextCapiFailureState", () => {
  it("counts a transient failure and keeps the order retryable", () => {
    expect(nextCapiFailureState(0, false)).toEqual({
      attempts: 1,
      unrecoverable: false,
    });
  });

  it("gives up on the failure that reaches the cap", () => {
    expect(
      nextCapiFailureState(MAX_CAPI_ATTEMPTS - 2, false).unrecoverable,
    ).toBe(false);
    expect(nextCapiFailureState(MAX_CAPI_ATTEMPTS - 1, false)).toEqual({
      attempts: MAX_CAPI_ATTEMPTS,
      unrecoverable: true,
    });
  });

  it("gives up immediately on a terminal failure", () => {
    expect(nextCapiFailureState(0, true)).toEqual({
      attempts: 1,
      unrecoverable: true,
    });
  });
});
