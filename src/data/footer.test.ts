import { describe, expect, it } from "vitest";
import { FOOTER_EXPLORE_LINKS, FOOTER_SHOW_LINKS } from "./footer";

describe("footer links", () => {
  it("keeps Shows to five city links plus All Cities", () => {
    expect(FOOTER_SHOW_LINKS).toHaveLength(6);
    expect(
      FOOTER_SHOW_LINKS.filter((link) => link.href === "/cities"),
    ).toHaveLength(1);
    expect(
      FOOTER_SHOW_LINKS.filter((link) => link.href.startsWith("/cities/")),
    ).toHaveLength(5);
  });

  it("does not include the Links page in the footer explore list", () => {
    expect(FOOTER_EXPLORE_LINKS.some((link) => link.href === "/links")).toBe(
      false,
    );
  });
});
