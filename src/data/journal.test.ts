import { describe, it, expect } from "vitest";
import {
  journalPosts,
  journalPostsSorted,
  getPostBySlug,
} from "./journal/index";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("journalPosts", () => {
  it("is a non-empty array", () => {
    expect(journalPosts.length).toBeGreaterThan(0);
  });

  it("every post has a non-empty slug", () => {
    for (const post of journalPosts) {
      expect(post.slug.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty title", () => {
    for (const post of journalPosts) {
      expect(post.title.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty metaDescription", () => {
    for (const post of journalPosts) {
      expect(post.metaDescription.trim()).not.toBe("");
    }
  });

  it("every post has a datePublished in YYYY-MM-DD format", () => {
    for (const post of journalPosts) {
      expect(post.datePublished).toMatch(ISO_DATE_RE);
    }
  });

  it("every post has a dateModified in YYYY-MM-DD format", () => {
    for (const post of journalPosts) {
      expect(post.dateModified).toMatch(ISO_DATE_RE);
    }
  });

  it("every post has a non-empty author", () => {
    for (const post of journalPosts) {
      expect(post.author.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty excerpt", () => {
    for (const post of journalPosts) {
      expect(post.excerpt.trim()).not.toBe("");
    }
  });

  it("every post has a relatedSlugs array", () => {
    const allSlugs = new Set(journalPosts.map((p) => p.slug));
    for (const post of journalPosts) {
      expect(Array.isArray(post.relatedSlugs)).toBe(true);
      expect(post.relatedSlugs.length).toBeGreaterThanOrEqual(2);
      expect(post.relatedSlugs.length).toBeLessThanOrEqual(3);
      for (const s of post.relatedSlugs) {
        expect(
          allSlugs.has(s),
          `"${s}" not found in catalog (referenced from "${post.slug}")`,
        ).toBe(true);
      }
      expect(new Set(post.relatedSlugs).size).toBe(post.relatedSlugs.length);
      expect(post.relatedSlugs).not.toContain(post.slug);
    }
  });

  it("every post body is a non-empty array", () => {
    for (const post of journalPosts) {
      expect(post.body.length).toBeGreaterThan(0);
    }
  });

  it("every body block has type 'p', 'h2', or 'h3' and non-empty text", () => {
    for (const post of journalPosts) {
      for (const block of post.body) {
        expect(["p", "h2", "h3"]).toContain(block.type);
        expect(block.text.trim()).not.toBe("");
      }
    }
  });

  it("slugs are unique across all posts", () => {
    const slugs = journalPosts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("keyTakeaway, when present, is a concise answer-first lead (35-75 words)", () => {
    for (const post of journalPosts) {
      if (!post.keyTakeaway) continue;
      expect(post.keyTakeaway.trim(), `${post.slug} keyTakeaway`).not.toBe("");
      const words = post.keyTakeaway.trim().split(/\s+/).length;
      expect(
        words,
        `${post.slug} keyTakeaway should be a 35-75 word answer, got ${words}`,
      ).toBeGreaterThanOrEqual(35);
      expect(words).toBeLessThanOrEqual(75);
    }
  });

  it("has answer-first keyTakeaway leads on the top AEO-target posts", () => {
    const aeoTargets = [
      "live-dating-shows-nyc-2026",
      "what-is-a-comedy-dating-show",
      "live-dating-show-vs-dating-apps",
      "blind-date-show-what-to-expect",
      "best-indian-dating-apps-ranked",
      "the-only-live-desi-dating-show-in-nyc",
    ];
    const bySlug = new Map(journalPosts.map((p) => [p.slug, p]));
    for (const slug of aeoTargets) {
      expect(
        bySlug.get(slug)?.keyTakeaway,
        `${slug} missing keyTakeaway`,
      ).toBeTruthy();
    }
  });

  it("rankedItems, when present, have contiguous 1-based positions and names", () => {
    for (const post of journalPosts) {
      if (!post.rankedItems) continue;
      expect(
        post.rankedItems.length,
        `${post.slug} has empty rankedItems`,
      ).toBeGreaterThan(0);
      const positions = post.rankedItems
        .map((item) => item.position)
        .sort((a, b) => a - b);
      positions.forEach((pos, idx) => {
        expect(
          pos,
          `${post.slug} rankedItems positions must be contiguous 1..n`,
        ).toBe(idx + 1);
      });
      for (const item of post.rankedItems) {
        expect(item.name.trim(), `${post.slug} rankedItem name`).not.toBe("");
      }
    }
  });

  // WHY: ranked listicles are countdowns by editorial doctrine. The original
  // best-first order revealed the winner in the first heading and readers
  // bounced without reaching the mid-article CTAs. Body order is hand-written
  // heading text, so without this test a future ranked article written 1..n
  // would silently regress. rankedItems keeps ascending schema positions
  // (1 = best) while the body presents worst first; that mismatch is the
  // design, not a bug.
  it("ranked posts present body headings as a countdown (n down to 1)", () => {
    for (const post of journalPosts) {
      if (!post.rankedItems) continue;
      const headingRanks = post.body
        .filter((block) => block.type === "h2" || block.type === "h3")
        .map((block) => block.text.match(/^(\d+)\.\s/)?.[1])
        .filter((rank): rank is string => rank !== undefined)
        .map(Number);
      expect(
        headingRanks.length,
        `${post.slug} has rankedItems but no numbered body headings`,
      ).toBe(post.rankedItems.length);
      const expected = [...post.rankedItems]
        .map((item) => item.position)
        .sort((a, b) => b - a);
      expect(
        headingRanks,
        `${post.slug} ranked headings must count down (worst first, winner last)`,
      ).toEqual(expected);
    }
  });

  it("posts titled as rankings declare rankedItems so countdown order is enforced", () => {
    for (const post of journalPosts) {
      const titledAsRanking =
        /rank/i.test(post.title) || /rank/i.test(post.seoTitle ?? "");
      const numberedHeadings = post.body.filter(
        (block) =>
          (block.type === "h2" || block.type === "h3") &&
          /^\d+\.\s/.test(block.text),
      ).length;
      if (titledAsRanking && numberedHeadings >= 3) {
        expect(
          post.rankedItems,
          `${post.slug} reads as a ranking (title mentions rank, ${numberedHeadings} numbered headings) but has no rankedItems, so the countdown test cannot protect it`,
        ).toBeDefined();
      }
    }
  });

  it("appReview, when present, has a 1-5 rating and non-empty verdict content", () => {
    for (const post of journalPosts) {
      if (!post.appReview) continue;
      const review = post.appReview;
      expect(review.appName.trim()).not.toBe("");
      expect(review.operatingSystem.trim()).not.toBe("");
      expect(review.applicationCategory.trim()).not.toBe("");
      expect(review.ratingValue).toBeGreaterThanOrEqual(1);
      expect(review.ratingValue).toBeLessThanOrEqual(5);
      expect(
        review.pros.length,
        `${post.slug} appReview needs pros for the visible verdict box`,
      ).toBeGreaterThan(0);
      expect(
        review.cons.length,
        `${post.slug} appReview needs cons for the visible verdict box`,
      ).toBeGreaterThan(0);
      for (const line of [...review.pros, ...review.cons]) {
        expect(line.trim()).not.toBe("");
      }
    }
  });

  it("app reviews never review Garam Masala itself (Google self serving review policy)", () => {
    for (const post of journalPosts) {
      if (!post.appReview) continue;
      expect(post.appReview.appName.toLowerCase()).not.toContain(
        "garam masala",
      );
    }
  });
});

describe("journalPostsSorted", () => {
  it("is sorted newest-first by datePublished", () => {
    for (let i = 1; i < journalPostsSorted.length; i++) {
      const prev = new Date(journalPostsSorted[i - 1].datePublished).getTime();
      const curr = new Date(journalPostsSorted[i].datePublished).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("has the same length as journalPosts", () => {
    expect(journalPostsSorted).toHaveLength(journalPosts.length);
  });
});

describe("getPostBySlug", () => {
  it("returns the correct post for a valid slug", () => {
    const first = journalPosts[0];
    expect(getPostBySlug(first.slug)?.title).toBe(first.title);
  });

  it("returns undefined for a non-existent slug", () => {
    expect(getPostBySlug("does-not-exist")).toBeUndefined();
  });
});
