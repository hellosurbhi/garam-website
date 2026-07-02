import { describe, expect, it } from "vitest";
import { WAIVER_TEXT } from "@/data/waiver";
import { formatWaiverForReading, parseWaiverDocument } from "./waiverDisplay";

describe("waiver document display", () => {
  it("removes markdown-only separators from the signer-facing document", () => {
    const blocks = parseWaiverDocument(WAIVER_TEXT);

    expect(
      blocks.some((block) => "text" in block && block.text === "---"),
    ).toBe(false);
    expect(blocks[0]).toMatchObject({
      type: "title",
      text: "Garam Masala Dating: Contestant Waiver, Media Release, and Participation Agreement",
    });
    expect(blocks).not.toContainEqual(
      expect.objectContaining({ text: "Contestant Signature" }),
    );
  });

  it("formats a readable copy without raw markdown markers", () => {
    const readable = formatWaiverForReading(WAIVER_TEXT);

    expect(readable).not.toContain("---");
    expect(readable).not.toContain("## ");
    expect(readable).not.toContain("**");
    expect(readable).not.toContain("___________________________");
    expect(readable).not.toContain("Contestant Signature");
    expect(readable).not.toContain("Name (printed)");
    expect(readable).not.toContain("Date of signature");
    expect(readable).not.toContain("Show date (if known)");
    expect(readable).not.toContain("IMPORTANT NOTE FOR PRODUCER");
  });
});
