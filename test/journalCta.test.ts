import { describe, it, expect } from "vitest";
import { journalPostsPublished } from "../src/data/journal";

const PRIORITY_SLUGS = [
  "how-to-prepare-for-a-live-matchmaking-show",
  "indian-tech-bro-guide-dating-silicon-valley",
  "best-indian-dating-apps-ranked",
  "why-hinge-doesnt-work-for-indians",
  "dating-apps-for-brown-people",
];

describe("journal ctaConfig", () => {
  it("all 5 priority slugs have ctaConfig defined", () => {
    for (const slug of PRIORITY_SLUGS) {
      const post = journalPostsPublished.find((p) => p.slug === slug);
      expect(post, `${slug} not found in published posts`).toBeDefined();
      expect(post!.ctaConfig, `${slug} is missing ctaConfig`).toBeDefined();
      expect(post!.ctaConfig!.intent).toMatch(/^(show|advice)$/);
    }
  });

  it("show-intent articles have at least one CTA linking to /tickets", () => {
    const post = journalPostsPublished.find(
      (p) => p.slug === "how-to-prepare-for-a-live-matchmaking-show",
    );
    expect(post?.ctaConfig?.intent).toBe("show");
    const hrefs = [
      post?.ctaConfig?.topCta?.href,
      post?.ctaConfig?.midCta?.href,
      post?.ctaConfig?.bottomCta?.href,
    ];
    expect(hrefs).toContain("/tickets");
  });

  it("advice-intent articles bridge to a conversion destination", () => {
    const adviceSlugs = PRIORITY_SLUGS.filter((s) => {
      const post = journalPostsPublished.find((p) => p.slug === s);
      return post?.ctaConfig?.intent === "advice";
    });
    expect(adviceSlugs.length).toBeGreaterThan(0);
    for (const slug of adviceSlugs) {
      const post = journalPostsPublished.find((p) => p.slug === slug)!;
      const cfg = post.ctaConfig!;
      const allHrefs = [
        cfg.topCta?.href,
        cfg.midCta?.href,
        cfg.bottomCta?.href,
      ].filter(Boolean);
      const allModals = [
        cfg.topCta?.modal,
        cfg.midCta?.modal,
        cfg.bottomCta?.modal,
      ].filter(Boolean);
      expect(
        allHrefs.length + allModals.length,
        `${slug} has no conversion destinations`,
      ).toBeGreaterThan(0);
    }
  });

  it("every ctaSpec that has an href also has a ctaId", () => {
    for (const post of journalPostsPublished) {
      if (!post.ctaConfig) continue;
      const specs = [
        post.ctaConfig.topCta,
        post.ctaConfig.midCta,
        post.ctaConfig.bottomCta,
      ].filter(Boolean);
      for (const spec of specs) {
        expect(
          spec!.ctaId,
          `${post.slug} has a ctaSpec without ctaId`,
        ).toBeTruthy();
      }
    }
  });
});
