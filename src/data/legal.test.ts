import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { LEGAL_DOCS } from "./legal";

function flattenDocText(docKey: keyof typeof LEGAL_DOCS) {
  const doc = LEGAL_DOCS[docKey];
  return [
    ...(doc.intro ?? []),
    ...doc.sections.flatMap((section) => section.blocks),
  ]
    .flatMap((section) =>
      section.type === "p" ? [section.text] : section.items,
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
    const consentText = flattenDocText("consent");

    expect(consent.title).toBe("Filming and Recording Consent");
    expect(consent.lastUpdated).toBe("May 2026");
    expect(consentText).toContain(
      "All Garam Masala Dating events are filmed and recorded",
    );
    expect(consentText).toContain(
      "By purchasing a ticket and entering the venue",
    );
    expect(consentText).toContain(
      "no right to review, approve, or request removal",
    );
  });

  it("keeps /consent noindexed and out of the sitemap", () => {
    const consentPage = readFileSync(
      join(process.cwd(), "src/pages/consent.astro"),
      "utf8",
    );
    const astroConfig = readFileSync(
      join(process.cwd(), "astro.config.mjs"),
      "utf8",
    );

    expect(consentPage).toContain("noindex={true}");
    expect(astroConfig).toContain('page.includes("/consent")');
  });

  it("keeps full consent copy out of the sitewide legal modal templates", () => {
    const legalModal = readFileSync(
      join(process.cwd(), "src/components/LegalModal.astro"),
      "utf8",
    );

    expect(legalModal).toContain('["privacy", "terms"]');
    expect(legalModal).not.toContain("Object.values(LEGAL_DOCS)");
  });
});
