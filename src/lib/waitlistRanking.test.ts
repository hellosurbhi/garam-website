import { describe, expect, it } from "vitest";
import { events, type EventEntry } from "@/data/events";
import { getTicketPageUpcoming } from "@/utils/eventFilters";
import { rankWaitlistCities, selectWaitlistCards } from "./waitlistRanking";

const today = "2026-11-11";
const now = new Date(`${today}T12:00:00Z`);
const lead = (city: string, email = "person@real.test", extra = {}) => ({
  city,
  email,
  ...extra,
});
const show = (
  citySlug: string,
  extra: Partial<EventEntry> = {},
): EventEntry => ({
  ...events.find((event) => event.citySlug === citySlug)!,
  slug: `${citySlug}-fixture`,
  citySlug,
  hidden: false,
  status: undefined,
  soldOut: false,
  isoDate: "2026-12-20",
  date: "Dec 20",
  onSaleAt: undefined,
  url: "",
  ticketSource: "none",
  ...extra,
});

describe("market demand ranking", () => {
  it("counts explicit locations across signup sources and applications, deduplicating emails", () => {
    expect(
      rankWaitlistCities([
        lead("Houston", " PERSON@real.test ", { source: "newsletter" }),
        lead("Houston, Texas"),
        lead("Houston", "", { emailNormalized: "person@real.test" }),
        lead("Houston", "second@real.test", { source: "apply_form_partial" }),
        lead("Dallas"),
        { email: "geo@real.test", geoCity: "Houston" },
      ]),
    ).toEqual([
      { citySlug: "houston", count: 2 },
      { citySlug: "dallas", count: 1 },
    ]);
  });

  it("merges Edison with New York before deduplicating", () => {
    expect(
      rankWaitlistCities([
        lead("Edison, NJ"),
        lead("New%20York%20City"),
        lead("Manhattan, NY", "second@real.test"),
        lead("wrong city", "second@real.test", { sourceCitySlug: "edison" }),
      ]),
    ).toEqual([{ citySlug: "manhattan", count: 2 }]);
  });

  it("resolves metro aliases while keeping ambiguous and inferred locations out", () => {
    expect(
      rankWaitlistCities([
        lead("DC"),
        lead("Washington DC / NoVA"),
        lead("Herndon", "two@real.test"),
        lead("Arlington, VA", "three@real.test"),
        lead("Maryland", "four@real.test"),
        lead("Arlington", "five@real.test"),
        lead("Chicago", "chicago@real.test"),
        lead("Naperville", "chicago@real.test"),
        lead("Schiller Park", "park@real.test"),
        lead("Paris, TX", "texas@real.test"),
        lead("%broken"),
      ]),
    ).toEqual([
      { citySlug: "washington-dc", count: 3 },
      { citySlug: "chicago", count: 2 },
    ]);
  });

  it("prefers valid selected city interest and falls back for presale pseudo-slugs", () => {
    expect(
      rankWaitlistCities([
        lead("Chicago", "first@real.test", { sourceCitySlug: "seattle" }),
        lead("Chicago, IL", "second@real.test", {
          sourceCitySlug: "presale-2026-12-04",
        }),
      ]),
    ).toEqual([
      { citySlug: "chicago", count: 1 },
      { citySlug: "seattle", count: 1 },
    ]);
  });

  it("excludes deleted and test records, missing emails and invalid emails", () => {
    expect(
      rankWaitlistCities([
        lead("Houston", "smoketest@example.com"),
        lead("Houston", "synthetic-monitor@garammasaladating.com"),
        lead(
          "Houston",
          "synthetic-monitor+01234567-89ab-4cde-8fab-0123456789ab@garammasaladating.com",
          { isSynthetic: true },
        ),
        lead("Houston", "deleted@real.test", { deletedAt: "2026-11-10" }),
        lead("Houston", "check@real.test", {
          source: "codex-production-check",
        }),
        lead("Houston", "verify@real.test", {
          source: "claude-verification-test",
        }),
        lead("Houston", ""),
        lead("Houston", "not-an-email"),
        {},
        lead("Houston", "valid@real.test", { deletedAt: null }),
      ]),
    ).toEqual([{ citySlug: "houston", count: 1 }]);
  });
});

describe("five-market presentation", () => {
  const counts = [
    ["manhattan", 100],
    ["chicago", 37],
    ["austin", 18],
    ["houston", 16],
    ["dallas", 15],
    ["san-diego", 12],
    ["seattle", 12],
    ["washington-dc", 10],
  ].map(([citySlug, count]) => ({
    citySlug: String(citySlug),
    count: Number(count),
  }));

  it("shows five eligible cities including Chicago and San Diego after removing their dates", () => {
    const active = getTicketPageUpcoming(events, today, now);
    expect(active.map((event) => event.citySlug)).not.toContain("chicago");
    expect(active.map((event) => event.citySlug)).not.toContain("san-diego");
    const cards = selectWaitlistCards(counts, events, today, now);
    expect(cards.map((event) => event.citySlug)).toEqual([
      "chicago",
      "austin",
      "houston",
      "dallas",
      "san-diego",
    ]);
    expect(cards.every((event) => !event.isoDate && !event.url)).toBe(true);
    expect(
      events.find((event) => event.slug === "chicago-2026-12-04")?.status,
    ).toBe("canceled");
    expect(
      events.find((event) => event.slug === "san-diego-2026-11-15")?.status,
    ).toBe("canceled");
  });

  it("puts later ticketed shows before earlier waitlists and caps dated plus undated markets together", () => {
    const inventory = [
      show("manhattan", {
        url: "https://tickets.example.test/nyc",
        isoDate: "2026-12-30",
      }),
      show("austin", { isoDate: "2026-11-19" }),
      show("houston", { isoDate: "2026-11-20" }),
    ];
    const active = getTicketPageUpcoming(inventory, today, now);
    const waitlists = selectWaitlistCards(counts, inventory, today, now);
    expect([...active, ...waitlists].map((event) => event.citySlug)).toEqual([
      "manhattan",
      "austin",
      "houston",
      "chicago",
      "dallas",
      "san-diego",
    ]);
    expect(waitlists).toHaveLength(5);
  });

  it("does not call presale, sold-out, hidden, canceled or placeholder URLs purchasable", () => {
    const inventory = [
      show("chicago", {
        url: "https://tickets.example.test/chicago",
        onSaleAt: "2026-12-01T00:00:00Z",
      }),
      show("austin", { url: "#" }),
      show("houston", {
        url: "https://tickets.example.test/houston",
        soldOut: true,
      }),
      show("dallas", {
        url: "https://tickets.example.test/dallas",
        hidden: true,
      }),
      show("san-diego", {
        url: "https://tickets.example.test/sd",
        status: "canceled",
      }),
    ];
    expect(getTicketPageUpcoming(inventory, today, now)).toEqual([]);
    const selected = selectWaitlistCards(
      counts.slice(1),
      inventory,
      today,
      now,
    );
    expect(selected).toHaveLength(5);
    expect(selected[0].onSaleAt).toBe("2026-12-01T00:00:00Z");
    expect(
      selected.find((event) => event.citySlug === "houston")?.isoDate,
    ).toBeUndefined();
  });

  it("suppresses the whole market for a live checkout, including Edison under New York", () => {
    const inventory = [
      show("edison", { url: "https://tickets.example.test/nyc" }),
    ];
    expect(
      selectWaitlistCards(
        [{ citySlug: "manhattan", count: 100 }],
        inventory,
        today,
        now,
      ),
    ).toEqual([]);
  });

  it("makes a market eligible again after its ticketed show and rejects unknown or zero demand", () => {
    const inventory = [
      show("chicago", {
        url: "https://tickets.example.test/chicago",
        isoDate: "2026-11-10",
      }),
    ];
    expect(
      selectWaitlistCards(
        [
          { citySlug: "unknown", count: 1000 },
          { citySlug: "edison", count: 100 },
          { citySlug: "chicago", count: 3 },
          { citySlug: "dallas", count: 0 },
        ],
        inventory,
        today,
        now,
      ).map((event) => event.citySlug),
    ).toEqual(["chicago"]);
  });
});
