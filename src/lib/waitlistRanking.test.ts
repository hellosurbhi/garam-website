import { describe, expect, it } from "vitest";
import { events } from "@/data/events";
import { getUpcomingDated, getTicketPageUpcoming } from "@/utils/eventFilters";
import { rankWaitlistCities, selectWaitlistCards } from "./waitlistRanking";

const lead = (city: string, email = "person@real.test", extra = {}) => ({
  city,
  email,
  source: "tickets-notify",
  ...extra,
});

describe("waitlist ranking", () => {
  it("never assigns an unknown qualified place to a different city", () => {
    expect(
      rankWaitlistCities([
        lead("Paris, TX", "texas@real.test"),
        lead("Paris%2C%20TX", "encoded@real.test"),
        lead("Paris", "france@real.test"),
        lead("Houston, Texas", "houston@real.test"),
        lead("Chicago, IL", "chicago@real.test"),
        lead("Paris, TX", "explicit@real.test", { sourceCitySlug: "dallas" }),
      ]),
    ).toEqual([
      { citySlug: "chicago", count: 1 },
      { citySlug: "dallas", count: 1 },
      { citySlug: "houston", count: 1 },
      { citySlug: "paris", count: 1 },
    ]);
  });
  it("excludes withdrawn placeholders without hiding a newly announced Texas show", () => {
    const houston = events.find(
      (event) => event.slug === "houston-2026-11-20",
    )!;
    const newlyAnnounced = {
      ...houston,
      status: undefined,
      slug: "houston-2027-01-15",
      isoDate: "2027-01-15",
    };
    expect(
      getTicketPageUpcoming([houston, newlyAnnounced], "2026-11-05"),
    ).toEqual([newlyAnnounced]);
    expect(
      selectWaitlistCards(
        [{ citySlug: "houston", count: 16 }],
        [newlyAnnounced],
      ),
    ).toEqual([]);
  });

  it("counts unique emails per selected city, excluding smoke fixtures and unrelated sources", () => {
    expect(
      rankWaitlistCities([
        lead("Houston", " PERSON@real.test "),
        lead("Houston, Texas"),
        lead("Houston", "smoketest@example.com"),
        lead("Houston", "other@real.test", { source: "newsletter" }),
        lead("Dallas"),
        {
          email: "geo@real.test",
          source: "tickets-notify",
          geoCity: "Houston",
        },
      ]),
    ).toEqual([
      { citySlug: "dallas", count: 1 },
      { citySlug: "houston", count: 1 },
    ]);
  });
  it("resolves encoded city names, state suffixes and canonical slugs without merging metros", () => {
    expect(
      rankWaitlistCities([
        lead("New%20York%20City"),
        lead("Manhattan, NY"),
        lead("Madison"),
        lead("Madison WI", "second@real.test"),
        lead("wrong city", "person@real.test", { sourceCitySlug: "seattle" }),
        lead("Edison, NJ"),
        lead("Washington DC / NoVA"),
        lead("Chicago, IL", "one@real.test", {
          sourceCitySlug: "presale-2026-12-04",
        }),
        lead("%broken"),
        lead("unknown"),
        { source: "notify", city: "Houston" },
      ]),
    ).toEqual(
      expect.arrayContaining([
        { citySlug: "manhattan", count: 1 },
        { citySlug: "madison-wi", count: 2 },
        { citySlug: "seattle", count: 1 },
        { citySlug: "edison", count: 1 },
        { citySlug: "washington-dc", count: 1 },
        { citySlug: "chicago", count: 1 },
      ]),
    );
  });
  it("includes city requests and waitlists but does not count empty emails or unselected locations", () => {
    expect(
      rankWaitlistCities([
        lead("Austin", "a@real.test", { source: "tickets-city-request" }),
        lead("Austin", "b@real.test", { source: "city-page" }),
        lead("Austin", "c@real.test", { source: "request-city" }),
        lead("Austin", "d@real.test", { source: "city-waitlist" }),
        lead("Austin", ""),
        {},
        { email: "geo@real.test", source: "notify" },
      ]),
    ).toEqual([{ citySlug: "austin", count: 4 }]);
  });
  it("takes ten cities AFTER excluding scheduled shows, with no dates or purchase URLs", () => {
    const counts = [
      "manhattan",
      "chicago",
      "austin",
      "houston",
      "dallas",
      "edison",
      "seattle",
      "washington-dc",
      "atlanta",
      "boston",
      "edmonton",
      "madison-wi",
      "nashville",
    ].map((citySlug, i) => ({ citySlug, count: 50 - i }));
    const upcoming = getTicketPageUpcoming(events, "2026-11-05");
    const cards = selectWaitlistCards(
      [...counts, { citySlug: "unknown", count: 1000 }],
      upcoming,
    );
    expect(cards.map((e) => e.citySlug)).toEqual([
      "austin",
      "houston",
      "dallas",
      "edison",
      "seattle",
      "washington-dc",
      "atlanta",
      "boston",
      "edmonton",
      "madison-wi",
    ]);
    expect(
      cards.every(
        (e) =>
          e.date === "" &&
          !e.isoDate &&
          e.url === "" &&
          e.ticketSource === "none",
      ),
    ).toBe(true);
    expect(upcoming.find((e) => e.citySlug === "chicago")).toMatchObject({
      isoDate: "2026-12-04",
      url: "",
      ticketSource: "none",
    });
  });
  it("breaks tied counts alphabetically and makes a city eligible after its show", () => {
    expect(
      selectWaitlistCards(
        [
          { citySlug: "houston", count: 4 },
          { citySlug: "austin", count: 4 },
        ],
        [],
      ).map((e) => e.citySlug),
    ).toEqual(["austin", "houston"]);
    const past = getUpcomingDated(events, "2027-01-01");
    expect(
      selectWaitlistCards([{ citySlug: "chicago", count: 24 }], past)[0]
        .citySlug,
    ).toBe("chicago");
  });
});

it("keeps a dated city excluded between the build date and a later island request", () => {
  const chicago = events.find((event) => event.slug === "chicago-2026-12-04")!;
  const rendered = getTicketPageUpcoming([chicago], "2026-12-03");
  const laterRequest = getTicketPageUpcoming([chicago], "2026-12-05");
  const counts = [
    { citySlug: "chicago", count: 100 },
    { citySlug: "dallas", count: 20 },
  ];
  expect(
    selectWaitlistCards(counts, laterRequest).map((event) => event.citySlug),
  ).toContain("chicago");
  expect(
    selectWaitlistCards(counts, rendered).map((event) => event.citySlug),
  ).toEqual(["dallas"]);
});
