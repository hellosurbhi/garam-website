import { describe, it, expect } from "vitest";
import { journalPosts, journalPostsSorted, getPostBySlug } from "./journal/index";

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
    for (const post of journalPosts) {
      expect(Array.isArray(post.relatedSlugs)).toBe(true);
      expect(post.relatedSlugs.length).toBeGreaterThanOrEqual(2);
      expect(post.relatedSlugs.length).toBeLessThanOrEqual(3);
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
