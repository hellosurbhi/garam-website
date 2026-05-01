import { describe, it, expect } from "vitest";
import { deriveSeoTitle, pageTitle, ogTitle } from "./meta";

describe("deriveSeoTitle", () => {
  it("passes through titles at or under the 43-char limit unchanged", () => {
    expect(deriveSeoTitle("Short Title")).toBe("Short Title");
    expect(deriveSeoTitle("Exactly forty-three characters long!!!!!")).toBe(
      "Exactly forty-three characters long!!!!!",
    );
  });

  it("splits at the first colon when it falls within the limit", () => {
    expect(
      deriveSeoTitle(
        "Indian Matchmaking: What 4 Years of Running One Taught Me",
      ),
    ).toBe("Indian Matchmaking");
  });

  it("truncates at the last word boundary when no colon is present", () => {
    expect(
      deriveSeoTitle("What We Learned From 100 Desi Blind Dates On Stage"),
    ).toBe("What We Learned From 100 Desi Blind Dates");
  });

  it("removes a trailing preposition (in)", () => {
    expect(
      deriveSeoTitle(
        "The Realest Way to Meet Desi Singles in NYC (That Isn't an App)",
      ),
    ).toBe("The Realest Way to Meet Desi Singles");
  });

  it("removes a trailing conjunction (and)", () => {
    expect(
      deriveSeoTitle(
        "Bollywood Movies About Breadcrumbing and Toxic Situationships",
      ),
    ).toBe("Bollywood Movies About Breadcrumbing");
  });

  it("removes a trailing preposition (for)", () => {
    expect(
      deriveSeoTitle("Is Dil Mil Worth It? An Honest Review for Desi Singles"),
    ).toBe("Is Dil Mil Worth It? An Honest Review");
  });

  it("removes a trailing preposition (to)", () => {
    expect(
      deriveSeoTitle(
        "How to Introduce Your Black Partner to Your Indian Parents",
      ),
    ).toBe("How to Introduce Your Black Partner");
  });

  it("removes trailing 'your' after word-boundary cut", () => {
    expect(
      deriveSeoTitle(
        "Why Going With the Flow is Ruining Your Dating Life Today",
      ),
    ).toBe("Why Going With the Flow is Ruining");
  });

  it("does not remove the only remaining word (safety guard)", () => {
    // Title longer than 43 chars that truncates to all function words
    expect(
      deriveSeoTitle("In on at to for of and or but is the and in at"),
    ).toBe("In");
  });

  it("preserves titles that end on a meaningful word after truncation", () => {
    expect(
      deriveSeoTitle(
        "Dating Apps for Brown People: What Actually Works in 2026",
      ),
    ).toBe("Dating Apps for Brown People");
  });
});

describe("pageTitle", () => {
  it("formats as 'Name | Garam Masala Dating'", () => {
    expect(pageTitle("NYC Shows")).toBe("NYC Shows | Garam Masala Dating");
  });
});

describe("ogTitle", () => {
  it("formats as 'Garam Masala Dating | Name'", () => {
    expect(ogTitle("NYC Shows")).toBe("Garam Masala Dating | NYC Shows");
  });
});
