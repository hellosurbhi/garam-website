import { describe, it, expect } from "vitest";
import {
  SITE,
  CITY_FOLLOW,
  JOURNAL_CTA_SOCIAL,
  JOURNAL_CTA_WAITLIST,
  JOURNAL_CTA_TICKETS,
  VERDICT_BOX,
  MARQUEE_ITEMS,
} from "./copy";

describe("SITE brand line", () => {
  it("uses the unified tagline everywhere", () => {
    expect(SITE.tagline).toBe("America's #1 Live Desi Comedy Dating Show");
    expect(SITE.heroEyebrow).toBe("America's #1 Live Desi Comedy Dating Show");
  });

  it("keeps the desi qualifier and comedy keyword in the descriptions", () => {
    for (const s of [
      SITE.description,
      SITE.shortDescription,
      SITE.footerTagline,
      SITE.ogImageAlt,
    ]) {
      expect(s.toLowerCase()).toContain("desi comedy dating show");
    }
  });

  it("leads the marquee with the full brand line", () => {
    expect(MARQUEE_ITEMS[0]).toBe("America's #1 Live Desi Comedy Dating Show");
  });
});

describe("CITY_FOLLOW copy", () => {
  it("intro and waitlistIntro carry the {city} placeholder for render-time replacement", () => {
    expect(CITY_FOLLOW.intro).toContain("{city}");
    expect(CITY_FOLLOW.waitlistIntro).toContain("{city}");
  });

  it("names both platforms in the button labels", () => {
    expect(CITY_FOLLOW.youtubeLabel).toContain("YouTube");
    expect(CITY_FOLLOW.instagramLabel).toContain("Instagram");
  });

  it("has a nearby CTA label for the See All Upcoming Shows link", () => {
    expect(CITY_FOLLOW.nearbyCtaLabel.length).toBeGreaterThan(0);
  });

  it("resolves the placeholder to a concrete city", () => {
    expect(CITY_FOLLOW.intro.replace("{city}", "Toronto")).toContain("Toronto");
    expect(CITY_FOLLOW.intro.replace("{city}", "Toronto")).not.toContain(
      "{city}",
    );
  });
});

describe("JOURNAL_CTA_SOCIAL copy", () => {
  it("has an intro plus both platform button labels", () => {
    expect(JOURNAL_CTA_SOCIAL.intro.length).toBeGreaterThan(0);
    expect(JOURNAL_CTA_SOCIAL.youtubeLabel).toContain("YouTube");
    expect(JOURNAL_CTA_SOCIAL.instagramLabel).toContain("Instagram");
  });
});

describe("JOURNAL_CTA_WAITLIST copy", () => {
  it("has an intro and a CTA label", () => {
    expect(JOURNAL_CTA_WAITLIST.intro.length).toBeGreaterThan(0);
    expect(JOURNAL_CTA_WAITLIST.ctaLabel.length).toBeGreaterThan(0);
  });
});

describe("JOURNAL_CTA_TICKETS copy", () => {
  it("has labels for both tickets and apply buttons", () => {
    expect(JOURNAL_CTA_TICKETS.ticketsLabel.length).toBeGreaterThan(0);
    expect(JOURNAL_CTA_TICKETS.applyLabel.length).toBeGreaterThan(0);
  });
});

describe("VERDICT_BOX copy", () => {
  it("labels the rating out of 5 with pros and cons headers", () => {
    expect(VERDICT_BOX.outOfLabel).toBe("out of 5");
    expect(VERDICT_BOX.prosLabel.length).toBeGreaterThan(0);
    expect(VERDICT_BOX.consLabel.length).toBeGreaterThan(0);
  });
});
