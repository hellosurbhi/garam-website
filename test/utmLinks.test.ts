import { describe, expect, it } from "vitest";
import {
  CANONICAL_UTM_LINKS,
  CANONICAL_UTM_URLS,
  withCanonicalUtms,
  type UtmChannel,
} from "@/data/utmLinks";

const requiredChannels: UtmChannel[] = [
  "instagram_bio",
  "instagram_story",
  "instagram_reel",
  "manychat",
  "email",
  "partner",
  "venue",
  "press",
];

describe("canonical UTM links", () => {
  it("defines every requested channel", () => {
    expect(Object.keys(CANONICAL_UTM_LINKS).sort()).toEqual(
      [...requiredChannels].sort(),
    );
  });

  it("builds canonical URLs with source, medium, campaign, and content", () => {
    const bioTickets = CANONICAL_UTM_LINKS.instagram_bio[0]!;
    expect(withCanonicalUtms(bioTickets)).toBe(
      "/tickets?utm_source=ig&utm_medium=social&utm_campaign=ticket_sales&utm_content=bio",
    );
  });

  it("keeps campaign intent distinct across ticket sales and casting", () => {
    const bioUrls = CANONICAL_UTM_URLS.instagram_bio;
    expect(bioUrls).toContain(
      "/tickets?utm_source=ig&utm_medium=social&utm_campaign=ticket_sales&utm_content=bio",
    );
    expect(bioUrls).toContain(
      "/apply?utm_source=ig&utm_medium=social&utm_campaign=casting&utm_content=bio",
    );
  });

  it("does not emit incomplete UTM definitions", () => {
    for (const links of Object.values(CANONICAL_UTM_LINKS)) {
      for (const link of links) {
        expect(link.path).toMatch(/^\//);
        expect(link.utm_source).toBeTruthy();
        expect(link.utm_medium).toBeTruthy();
        expect(link.utm_campaign).toBeTruthy();
        expect(link.utm_content).toBeTruthy();
      }
    }
  });
});
