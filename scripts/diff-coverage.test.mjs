import { describe, it, expect } from "vitest";

import {
  importContinuationLinesFor,
  UNINSTRUMENTABLE_RE,
} from "./diff-coverage.mjs";

describe("importContinuationLinesFor", () => {
  it("marks every line of a multi-line destructured import as excluded", () => {
    const source = [
      'import type { APIRoute } from "astro";',
      "import {",
      "  escapeHtml,",
      "  subjectSafe,",
      "  mixerRsvpDetails,",
      "  mixerRsvpMissed,",
      '} from "@/data/emails";',
      "",
      "export const prerender = false;",
    ];

    const lines = importContinuationLinesFor(source);

    // Line 2 ("import {") is already caught by UNINSTRUMENTABLE_RE's
    // `import\s` branch, so this function only needs to own lines 3-7.
    expect(lines).toEqual(new Set([3, 4, 5, 6, 7]));
    expect(lines.has(1)).toBe(false);
    expect(lines.has(8)).toBe(false);
    expect(lines.has(9)).toBe(false);
  });

  it("does not flag a file with only single-line imports", () => {
    const source = [
      'import { z } from "zod";',
      "",
      "export const schema = z.object({});",
    ];

    expect(importContinuationLinesFor(source)).toEqual(new Set());
  });

  it("closes the block on the line containing the closing brace and from clause", () => {
    const source = ["import {", "  a,", "  b,", '} from "./x.js";', "a(b);"];

    const lines = importContinuationLinesFor(source);
    expect(lines).toEqual(new Set([2, 3, 4]));
    expect(lines.has(5)).toBe(false);
  });
});

describe("UNINSTRUMENTABLE_RE (opening import line)", () => {
  it("matches a multi-line import's opening line", () => {
    expect(UNINSTRUMENTABLE_RE.test("import {")).toBe(true);
  });

  it("does not match a bare named-import continuation line", () => {
    expect(UNINSTRUMENTABLE_RE.test("  escapeHtml,")).toBe(false);
  });
});
