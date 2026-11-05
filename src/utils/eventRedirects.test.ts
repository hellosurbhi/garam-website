import { describe, expect, it } from "vitest";
import { allEvents, type EventEntry } from "../data/events";
import { buildEventRedirects } from "./eventRedirects";

const show: EventEntry = {
  city: "Philadelphia",
  citySlug: "philadelphia",
  state: "Pennsylvania",
  stateAbbr: "PA",
  date: "Oct 4",
  isoDate: "2026-10-04",
  previousDate: "2026-09-27",
  slug: "philadelphia-2026-10-04",
  description: "Test show",
  lineup: [],
  ticketSource: "none",
  url: "",
};

describe("automatic event redirects", () => {
  it("repairs historical links for both pages and ticket routes", () => {
    const redirects = buildEventRedirects(allEvents);
    for (const prefix of ["/events/", "/api/go/"]) {
      expect(redirects[`${prefix}philadelphia-2026-09-27`]).toEqual({
        destination: `${prefix}philadelphia-2026-10-04`,
        status: 308,
      });
      for (const [alias, canonical] of [
        ["manhattan-2026-11-13", "manhattan-2026-12-12"],
        ["san-francisco-2026-12-26", "san-francisco-2026-11-14"],
        ["san-diego-2026-12-24", "san-diego-2026-11-15"],
        ["los-angeles-2026-12-27", "los-angeles-2026-11-13"],
      ]) {
        expect(redirects[`${prefix}${alias}`]?.destination).toBe(
          `${prefix}${canonical}`,
        );
      }
    }
    for (const [source, redirect] of Object.entries(redirects)) {
      expect(source).not.toBe(redirect.destination);
      expect(redirects[redirect.destination]).toBeUndefined();
    }
  });

  it("retains every recorded date across repeated moves without chains", () => {
    const redirects = buildEventRedirects([
      { ...show, previousDates: ["2026-09-13", "2026-09-20", "2026-09-27"] },
    ]);
    expect(Object.keys(redirects)).toHaveLength(6);
    for (const redirect of Object.values(redirects)) {
      expect(redirect.destination).toMatch(/philadelphia-2026-10-04$/);
    }
  });

  it("rejects aliases belonging to a different show's canonical or former date", () => {
    const other = {
      ...show,
      slug: "philadelphia-2026-11-01",
      isoDate: "2026-11-01",
    };
    expect(() => buildEventRedirects([show, other])).toThrow("conflicts");
    expect(() =>
      buildEventRedirects([show, { ...other, previousDate: show.isoDate }]),
    ).toThrow("conflicts");
    expect(() => buildEventRedirects([show, show])).toThrow(
      "Duplicate event slug",
    );
  });

  it("does not invent aliases for undated shows or shows without a city slug", () => {
    expect(buildEventRedirects([{ ...show, citySlug: undefined }])).toEqual({});
    expect(
      buildEventRedirects([
        {
          ...show,
          slug: "philadelphia-tba",
          isoDate: undefined,
          previousDate: undefined,
        },
      ]),
    ).toEqual({});
  });

  it("keeps past, canceled and placeholder aliases on their own canonical routes", () => {
    for (const status of [undefined, "canceled"] as const) {
      expect(
        buildEventRedirects([{ ...show, status }])[
          "/api/go/philadelphia-2026-09-27"
        ],
      ).toEqual({
        destination: "/api/go/philadelphia-2026-10-04",
        status: 308,
      });
    }
  });
});
