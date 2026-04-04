import { describe, it, expect } from "vitest";
import { tipPosts, tipPostsSorted, getTipBySlug } from "./tips";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("tipPosts", () => {
  it("is a non-empty array", () => {
    expect(tipPosts.length).toBeGreaterThan(0);
  });

  it("every post has a non-empty slug", () => {
    for (const post of tipPosts) {
      expect(post.slug.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty title", () => {
    for (const post of tipPosts) {
      expect(post.title.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty metaDescription", () => {
    for (const post of tipPosts) {
      expect(post.metaDescription.trim()).not.toBe("");
    }
  });

  it("every post has a datePublished in YYYY-MM-DD format", () => {
    for (const post of tipPosts) {
      expect(post.datePublished).toMatch(ISO_DATE_RE);
    }
  });

  it("every post has a dateModified in YYYY-MM-DD format", () => {
    for (const post of tipPosts) {
      expect(post.dateModified).toMatch(ISO_DATE_RE);
    }
  });

  it("every post has a non-empty author", () => {
    for (const post of tipPosts) {
      expect(post.author.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty excerpt", () => {
    for (const post of tipPosts) {
      expect(post.excerpt.trim()).not.toBe("");
    }
  });

  it("every post body is a non-empty array", () => {
    for (const post of tipPosts) {
      expect(post.body.length).toBeGreaterThan(0);
    }
  });

  it("every body block has type 'p' or 'h3' and non-empty text", () => {
    for (const post of tipPosts) {
      for (const block of post.body) {
        expect(["p", "h3"]).toContain(block.type);
        expect(block.text.trim()).not.toBe("");
      }
    }
  });

  it("slugs are unique across all posts", () => {
    const slugs = tipPosts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});

describe("tipPostsSorted", () => {
  it("is sorted newest-first by datePublished", () => {
    for (let i = 1; i < tipPostsSorted.length; i++) {
      const prev = new Date(tipPostsSorted[i - 1].datePublished).getTime();
      const curr = new Date(tipPostsSorted[i].datePublished).getTime();
      expect(prev).toBeGreaterThanOrEqual(curr);
    }
  });

  it("has the same length as tipPosts", () => {
    expect(tipPostsSorted).toHaveLength(tipPosts.length);
  });
});

describe("getTipBySlug", () => {
  it("returns the correct post for a valid slug", () => {
    const first = tipPosts[0];
    expect(getTipBySlug(first.slug)?.title).toBe(first.title);
  });

  it("returns undefined for a non-existent slug", () => {
    expect(getTipBySlug("does-not-exist")).toBeUndefined();
  });
});
