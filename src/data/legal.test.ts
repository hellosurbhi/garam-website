import { describe, expect, it } from "vitest";
import { LEGAL_DOCS } from "./legal";

function flattenDocText(docKey: keyof typeof LEGAL_DOCS) {
  return LEGAL_DOCS[docKey].sections
    .flatMap((section) =>
      section.blocks.flatMap((block) =>
        block.type === "p" ? [block.text] : block.items,
      ),
    )
    .join("\n");
}

describe("legal copy", () => {
  it("keeps Terms audience likeness language pointed at the consent notice", () => {
    const terms = flattenDocText("terms");

    expect(terms).not.toContain(
      "If you'd prefer not to be featured as an audience member",
    );
    expect(terms).toContain('<a href="/consent">');
  });

  it("defines the /consent legal notice linked from Terms", () => {
    const consent = LEGAL_DOCS.consent;

    expect(consent.title).toBe("Photo and Video Consent Notice");
    expect(flattenDocText("consent")).toContain(
      "By entering or remaining at the event",
    );
  });
});
