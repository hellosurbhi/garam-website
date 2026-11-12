import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  isSyntheticSubmission,
  SYNTHETIC_EMAIL_PATTERN,
} from "./syntheticMonitor";
import { rankWaitlistCities } from "./waitlistRanking";
const email =
  "synthetic-monitor+01234567-89ab-4cde-8fab-0123456789ab@garammasaladating.com";
describe("reserved production monitoring identities", () => {
  it("recognizes unique attempts and the legacy identity, not lookalikes", () => {
    expect(isSyntheticSubmission(email)).toBe(true);
    expect(isSyntheticSubmission(email.toUpperCase())).toBe(true);
    expect(
      isSyntheticSubmission("synthetic-monitor@garammasaladating.com"),
    ).toBe(true);
    for (const value of [
      undefined,
      {},
      "customer@example.com",
      email + ".evil",
      email.replace("4cde", "0cde"),
      email.replace("8fab", "0fab"),
    ])
      expect(isSyntheticSubmission(value)).toBe(false);
  });
  it("keeps the rules pattern identical to the shared predicate", () => {
    expect(readFileSync("firestore.rules", "utf8")).toContain(
      `matches('${SYNTHETIC_EMAIL_PATTERN}')`,
    );
  });
  it("excludes test leads while retaining customers with a forged flag", () => {
    expect(
      rankWaitlistCities([
        { email, source: "notify-modal", city: "Chicago" },
        {
          email: "customer@example.com",
          isSynthetic: true,
          source: "notify-modal",
          city: "Chicago",
        },
      ]),
    ).toEqual([{ citySlug: "chicago", count: 1 }]);
  });
});
