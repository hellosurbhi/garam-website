import { describe, it, expect } from "vitest";
import { tipsPosts } from "./journal/tips";

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

describe("tipsPosts", () => {
  it("is a non-empty array", () => {
    expect(tipsPosts.length).toBeGreaterThan(0);
  });

  it("every post has a non-empty slug", () => {
    for (const post of tipsPosts) {
      expect(post.slug.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty title", () => {
    for (const post of tipsPosts) {
      expect(post.title.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty metaDescription", () => {
    for (const post of tipsPosts) {
      expect(post.metaDescription.trim()).not.toBe("");
    }
  });

  it("every post has a datePublished in YYYY-MM-DD format", () => {
    for (const post of tipsPosts) {
      expect(post.datePublished).toMatch(ISO_DATE_RE);
    }
  });

  it("every post has a dateModified in YYYY-MM-DD format", () => {
    for (const post of tipsPosts) {
      expect(post.dateModified).toMatch(ISO_DATE_RE);
    }
  });

  it("every post has a non-empty author", () => {
    for (const post of tipsPosts) {
      expect(post.author.trim()).not.toBe("");
    }
  });

  it("every post has a non-empty excerpt", () => {
    for (const post of tipsPosts) {
      expect(post.excerpt.trim()).not.toBe("");
    }
  });

  it("every post body is a non-empty array", () => {
    for (const post of tipsPosts) {
      expect(post.body.length).toBeGreaterThan(0);
    }
  });

  it("every body block has a valid type and non-empty text", () => {
    for (const post of tipsPosts) {
      for (const block of post.body) {
        expect(["p", "h2", "h3"]).toContain(block.type);
        expect(block.text.trim()).not.toBe("");
      }
    }
  });

  it("every post has a relatedSlugs array", () => {
    for (const post of tipsPosts) {
      expect(Array.isArray(post.relatedSlugs)).toBe(true);
    }
  });

  it("relatedSlugs reference existing posts", () => {
    const allSlugs = new Set(tipsPosts.map((p) => p.slug));
    for (const post of tipsPosts) {
      for (const slug of post.relatedSlugs) {
        expect(allSlugs.has(slug)).toBe(true);
      }
    }
  });

  it("slugs are unique across all posts", () => {
    const slugs = tipsPosts.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
