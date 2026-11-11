import { expect, it } from "vitest";
import { isBotUserAgent } from "./isBotUserAgent";
it("excludes the explicit monitor from purchase intent without impersonating a search engine", () => {
  expect(isBotUserAgent("GaramMasalaMonitor/1.0")).toBe(true);
  expect(isBotUserAgent("Mozilla/5.0")).toBe(false);
});
