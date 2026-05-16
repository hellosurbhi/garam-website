import { describe, expect, it } from "vitest";
import { WAIVER_TEXT, WAIVER_VERSION } from "./waiver";

describe("contestant waiver copy", () => {
  it("uses the merged v3 contestant waiver", () => {
    expect(WAIVER_VERSION).toBe("2026-05-v3");
    expect(WAIVER_TEXT).toContain(
      "Garam Masala Dating: Contestant Waiver, Media Release, and Participation Agreement",
    );
    expect(WAIVER_TEXT).toContain(
      "This Agreement applies to my participation on the date specified below and to any and all future appearances",
    );
    expect(WAIVER_TEXT).toContain(
      "I am signing this Agreement while sober and of sound mind",
    );
    expect(WAIVER_TEXT).toContain("Electronic Signature Consent");
  });
});
