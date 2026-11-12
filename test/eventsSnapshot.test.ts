import { describe, it, expect } from "vitest";
import { cities } from "../src/data/cities";
import { publishedSnapshot } from "../src/data/events";
import publishedJson from "../src/data/events.published.json";
import {
  buildEventSlug,
  buildRollbackSnapshot,
  diffSnapshots,
  eventEntryShapeSchema,
  eventEntryWriteSchema,
  isValidTimeZone,
  parseEventsSnapshot,
  publishedEnvelopeSchema,
  shortDateFromIso,
  validateSnapshotAgainstLive,
  type EventEntry,
  type EventsSnapshot,
} from "../src/data/eventsSnapshot";

const KNOWN = new Set(Object.keys(cities));
const opts = { knownCitySlugs: KNOWN };

/** A fully valid new show: passes the write tier as is. */
function newShow(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "Jan 9",
    city: "Chicago",
    state: "Illinois",
    stateAbbr: "IL",
    citySlug: "chicago",
    slug: "chicago-2027-01-09",
    description: "Garam Masala Dating comes to Chicago.",
    lineup: ["surbhi", "wyatt"],
    ticketSource: "our-eventbrite",
    url: "https://www.eventbrite.com/e/garam-masala-dating-chicago-tickets-123",
    isoDate: "2027-01-09",
    startTime: "19:00",
    endTime: "21:00",
    venue: {
      name: "Lincoln Lodge",
      addressLocality: "Chicago",
      addressRegion: "IL",
      addressCountry: "US",
    },
    price: "25",
    eventbriteId: "123",
    timezone: "America/Chicago",
    updatedAt: "2026-11-11T20:00:00.000Z",
    ...overrides,
  };
}

function withEvents(
  base: EventsSnapshot,
  events: EventEntry[],
): EventsSnapshot {
  return { ...base, events };
}

function messages(result: ReturnType<typeof validateSnapshotAgainstLive>) {
  return result.ok ? [] : result.issues.map((i) => i.message);
}

const live = publishedSnapshot;
const liveLa = live.events.find((e) => e.slug === "los-angeles-2026-11-13");
if (!liveLa) throw new Error("fixture show los-angeles-2026-11-13 missing");

describe("helpers", () => {
  it("builds the date label and slug the site already uses", () => {
    expect(shortDateFromIso("2026-02-22")).toBe("Feb 22");
    expect(buildEventSlug("chicago", "2027-01-09")).toBe("chicago-2027-01-09");
    expect(buildEventSlug("chicago")).toBe("chicago-tba");
  });

  it("accepts only IANA zones", () => {
    expect(isValidTimeZone("America/Chicago")).toBe(true);
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });
});

describe("shape tier", () => {
  it("accepts the committed published envelope", () => {
    expect(() => publishedEnvelopeSchema.parse(publishedJson)).not.toThrow();
  });

  it("accepts every record in the published snapshot", () => {
    expect(() => parseEventsSnapshot(live)).not.toThrow();
  });

  it('keeps legacy "#" urls readable', () => {
    expect(eventEntryShapeSchema.safeParse(newShow({ url: "#" })).success).toBe(
      true,
    );
  });

  it("rejects malformed formats", () => {
    expect(
      eventEntryShapeSchema.safeParse(newShow({ startTime: "7pm" })).success,
    ).toBe(false);
    expect(
      eventEntryShapeSchema.safeParse(newShow({ url: "http://x.com" })).success,
    ).toBe(false);
  });
});

describe("write tier", () => {
  const issuesFor = (entry: unknown) => {
    const r = eventEntryWriteSchema.safeParse(entry);
    return r.success ? [] : r.error.issues.map((i) => i.path.join("."));
  };

  it("accepts a complete new show", () => {
    expect(issuesFor(newShow())).toEqual([]);
  });

  it.each([
    ["http link", { url: "http://www.eventbrite.com/e/1" }],
    ["javascript link", { url: "javascript:alert(1)" }],
    ["hash link", { url: "#" }],
    [
      "non Eventbrite host for an Eventbrite source",
      { url: "https://evil.com/e/1" },
    ],
    [
      "our own site",
      {
        ticketSource: "other-platform" as const,
        eventbriteId: undefined,
        url: "https://garammasaladating.com/go/x",
      },
    ],
    [
      "a subdomain of our own site",
      {
        ticketSource: "other-platform" as const,
        eventbriteId: undefined,
        url: "https://tickets.garammasaladating.com/x",
      },
    ],
    [
      "a link when nobody sells tickets",
      { ticketSource: "none" as const, eventbriteId: undefined },
    ],
  ])("rejects %s", (_label, overrides) => {
    expect(issuesFor(newShow(overrides))).toContain("url");
  });

  it("rejects script markup in venue text", () => {
    const venue = {
      name: "</script><script>alert(1)</script>",
      addressLocality: "Chicago",
      addressRegion: "IL",
      addressCountry: "US",
    };
    expect(issuesFor(newShow({ venue }))).toContain("venue.name");
  });

  it("rejects unknown keys", () => {
    expect(issuesFor({ ...newShow(), extra: 1 })).not.toEqual([]);
  });

  it("requires a matching date label, time zone and schema fields", () => {
    expect(issuesFor(newShow({ date: "Jan 10" }))).toContain("date");
    expect(issuesFor(newShow({ timezone: undefined }))).toContain("timezone");
    expect(issuesFor(newShow({ price: undefined }))).toContain("price");
    expect(issuesFor(newShow({ timezone: "Mars/Olympus" }))).toContain(
      "timezone",
    );
  });

  it("applies the eventbrite id rules per ticket source", () => {
    expect(issuesFor(newShow({ eventbriteId: undefined }))).toContain(
      "eventbriteId",
    );
    expect(issuesFor(newShow({ ticketSource: "their-eventbrite" }))).toEqual(
      [],
    );
    expect(
      issuesFor(
        newShow({
          ticketSource: "other-platform",
          url: "https://tickets.citywinery.com/event/1",
        }),
      ),
    ).toContain("eventbriteId");
  });

  it("requires tickets to go on sale before the show starts", () => {
    // 19:00 Chicago on Jan 9 is 01:00Z on Jan 10.
    expect(issuesFor(newShow({ onSaleAt: "2027-01-10T00:59:00Z" }))).toEqual(
      [],
    );
    expect(issuesFor(newShow({ onSaleAt: "2027-01-10T01:00:00Z" }))).toContain(
      "onSaleAt",
    );
  });

  it("requires a show to end after it starts on its date", () => {
    // One isoDate holds both times, so the schema's endDate shares that day.
    expect(
      issuesFor(newShow({ startTime: "19:00", endTime: "18:00" })),
    ).toContain("endTime");
    expect(
      issuesFor(newShow({ startTime: "19:00", endTime: "19:00" })),
    ).toContain("endTime");
    expect(
      issuesFor(newShow({ startTime: "19:00", endTime: "19:01" })),
    ).toEqual([]);
  });

  it("requires a note on a canceled show", () => {
    expect(issuesFor(newShow({ status: "canceled" }))).toContain("note");
  });
});

describe("validateSnapshotAgainstLive", () => {
  it("accepts the live snapshot unchanged, legacy records included", () => {
    expect(validateSnapshotAgainstLive(live, live, opts)).toEqual({
      ok: true,
      snapshot: live,
    });
  });

  it("accepts a valid new show", () => {
    const next = withEvents(live, [...live.events, newShow()]);
    expect(validateSnapshotAgainstLive(next, live, opts).ok).toBe(true);
  });

  it("applies the write tier to new shows", () => {
    const next = withEvents(live, [...live.events, newShow({ url: "#" })]);
    expect(validateSnapshotAgainstLive(next, live, opts).ok).toBe(false);
  });

  it("never lets a show be deleted", () => {
    const next = withEvents(live, live.events.slice(1));
    expect(messages(validateSnapshotAgainstLive(next, live, opts))).toEqual([
      `Show ${live.events[0].slug} cannot be removed. Cancel or hide it instead`,
    ]);
  });

  it("rejects duplicate slugs", () => {
    const next = withEvents(live, [...live.events, newShow(), newShow()]);
    expect(validateSnapshotAgainstLive(next, live, opts).ok).toBe(false);
  });

  it("rejects an unknown city and a slug not built from city and date", () => {
    const next = withEvents(live, [
      ...live.events,
      newShow({ citySlug: "atlantis", slug: "atlantis-party" }),
    ]);
    const result = validateSnapshotAgainstLive(next, live, opts);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.issues.map((i) => i.path.at(-1))).toEqual(
        expect.arrayContaining(["citySlug", "slug"]),
      );
    }
  });

  it("keeps every former date link of an edited show", () => {
    const edited = { ...liveLa, previousDate: undefined };
    const next = withEvents(
      live,
      live.events.map((e) => (e.slug === liveLa.slug ? edited : e)),
    );
    expect(messages(validateSnapshotAgainstLive(next, live, opts))).toContain(
      "Keep the former date link los-angeles-2026-11-13",
    );
  });

  it("needs a new note when the date changes", () => {
    const moved = {
      ...liveLa,
      isoDate: "2026-12-28",
      date: "Dec 28",
      previousDates: ["2026-12-27"],
    };
    const next = withEvents(
      live,
      live.events.map((e) => (e.slug === liveLa.slug ? moved : e)),
    );
    expect(messages(validateSnapshotAgainstLive(next, live, opts))).toContain(
      "Say why the date changed",
    );
    const noted = { ...moved, note: "Moved from Dec 27" };
    const fixed = withEvents(
      live,
      live.events.map((e) => (e.slug === liveLa.slug ? noted : e)),
    );
    expect(validateSnapshotAgainstLive(fixed, live, opts).ok).toBe(true);
  });

  it("never lets an existing show change city", () => {
    const next = withEvents(
      live,
      live.events.map((e) =>
        e.slug === liveLa.slug ? { ...e, citySlug: "san-diego" } : e,
      ),
    );
    expect(messages(validateSnapshotAgainstLive(next, live, opts))).toContain(
      "The city of an existing show cannot change",
    );
  });

  it("checks new coming soon cities", () => {
    const next = {
      ...live,
      tbaCities: [
        ...live.tbaCities,
        { city: "<b>", state: "X", stateAbbr: "X", citySlug: "atlantis" },
      ],
    };
    expect(validateSnapshotAgainstLive(next, live, opts).ok).toBe(false);
  });
});

describe("diffSnapshots", () => {
  it("reports added, changed, canceled and coming soon changes", () => {
    const next: EventsSnapshot = {
      events: [
        ...live.events.map((e) =>
          e.slug === liveLa.slug
            ? { ...e, status: "canceled" as const, note: "Venue closed" }
            : e.slug === live.events[0].slug
              ? { ...e, tagline: "Selling fast" }
              : e,
        ),
        newShow(),
      ],
      tbaCities: live.tbaCities.slice(1),
    };
    expect(diffSnapshots(live, next)).toEqual({
      added: ["chicago-2027-01-09"],
      changed: [live.events[0].slug],
      canceled: [liveLa.slug],
      tbaCitiesAdded: [],
      tbaCitiesRemoved: [live.tbaCities[0].citySlug],
    });
  });

  it("ignores key order", () => {
    const reordered = withEvents(
      live,
      live.events.map(
        (e) => Object.fromEntries(Object.entries(e).reverse()) as EventEntry,
      ),
    );
    expect(diffSnapshots(live, reordered).changed).toEqual([]);
  });
});

describe("buildRollbackSnapshot", () => {
  // v1: the show is on Dec 20. v2 (live): moved to Dec 27, plus a new show.
  const v1Show = newShow({
    slug: "chicago-2026-12-20",
    isoDate: "2026-12-20",
    date: "Dec 20",
  });
  const v2Show = {
    ...v1Show,
    isoDate: "2026-12-27",
    date: "Dec 27",
    previousDate: "2026-12-20",
    note: "Moved from Dec 20",
  };
  const added = newShow();
  const v1: EventsSnapshot = { events: [v1Show], tbaCities: [] };
  const v2: EventsSnapshot = { events: [v2Show, added], tbaCities: [] };
  const rolled = buildRollbackSnapshot(v2, v1, 1, "Wrong date");
  const restored = rolled.events.find((e) => e.slug === v1Show.slug);
  const carried = rolled.events.find((e) => e.slug === added.slug);

  it("restores the target date and keeps the live date link (R6)", () => {
    expect(restored?.isoDate).toBe("2026-12-20");
    expect(restored?.previousDates).toEqual(["2026-12-27"]);
  });

  it("explains the date change in the note (R14)", () => {
    expect(restored?.note).toBe(
      "Restored to 2026-12-20 by rollback to v1: Wrong date",
    );
  });

  it("keeps shows the target lacks, hidden and canceled", () => {
    expect(carried).toMatchObject({
      hidden: true,
      status: "canceled",
      note: "Removed by rollback to v1: Wrong date",
    });
  });

  it("passes validation against live without re-checking restored history (R19)", () => {
    // A restored legacy record would fail the write tier ("#" url); it is
    // trusted because it equals the target apart from rollback fields.
    const legacy = newShow({
      slug: "chicago-2026-12-05",
      isoDate: "2026-12-05",
      date: "Dec 5",
      url: "#",
    });
    const target: EventsSnapshot = { events: [v1Show, legacy], tbaCities: [] };
    const liveNow: EventsSnapshot = {
      events: [v2Show, added, { ...legacy, tagline: "x" }],
      tbaCities: [],
    };
    const next = buildRollbackSnapshot(liveNow, target, 1, "Wrong date");
    const result = validateSnapshotAgainstLive(next, liveNow, {
      ...opts,
      rollbackTarget: target,
    });
    expect(messages(result)).toEqual([]);
    expect(validateSnapshotAgainstLive(next, liveNow, opts).ok).toBe(false);
  });
});
