import { describe, it, expect } from "vitest";
import { isSpeculativeRequest } from "@/lib/isSpeculativeRequest";

const CHROME_UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36";

function req(headers: Record<string, string> = {}): Request {
  return new Request("https://garammasaladating.com/api/go/manhattan", {
    headers: { "user-agent": CHROME_UA, ...headers },
  });
}

describe("isSpeculativeRequest", () => {
  // Every one of these carries the visitor's own browser User-Agent, so
  // isBotUserAgent() can never catch them; the announcing header is the only
  // signal that separates a prefetch from a click.
  it.each([
    ["sec-purpose", "prefetch"],
    ["sec-purpose", "prefetch;prerender"],
    ["sec-purpose", "prerender"],
    ["Sec-Purpose", "Prefetch"],
    ["purpose", "prefetch"],
    ["purpose", "preview"],
    ["x-purpose", "prefetch"],
    ["x-purpose", "preview"],
    ["x-moz", "prefetch"],
    ["x-moz", "preview"],
  ])("flags a %s: %s request", (header, value) => {
    expect(isSpeculativeRequest(req({ [header]: value }))).toBe(true);
  });

  // Fetch Metadata: the only human path to a tracked redirect is a top-level
  // navigation, so any other mode is a script fetch, not someone opening
  // checkout.
  it.each(["cors", "no-cors", "same-origin", "websocket"])(
    "flags sec-fetch-mode: %s as not a navigation",
    (mode) => {
      expect(isSpeculativeRequest(req({ "sec-fetch-mode": mode }))).toBe(true);
    },
  );

  it("passes a real top-level navigation", () => {
    expect(
      isSpeculativeRequest(
        req({ "sec-fetch-mode": "navigate", "sec-fetch-dest": "document" }),
      ),
    ).toBe(false);
  });

  // Non-browser clients (curl, an unfurl bot, a no-JS fetch) send no Fetch
  // Metadata at all. Treating a missing header as speculative would suppress
  // real conversions, so they are deliberately left to the UA denylist.
  it("passes a request with no speculation or Fetch Metadata headers", () => {
    expect(isSpeculativeRequest(req())).toBe(false);
  });

  // A header that exists but says nothing about speculation must not trip the
  // filter: Chrome sends Purpose on some ordinary requests.
  it("passes a purpose header that does not announce speculation", () => {
    expect(isSpeculativeRequest(req({ purpose: "subresource" }))).toBe(false);
  });

  it("passes an empty speculation header", () => {
    expect(isSpeculativeRequest(req({ "x-moz": "" }))).toBe(false);
  });

  // A prerender arrives as a top-level navigation, so Sec-Fetch-Mode alone
  // would clear it; Sec-Purpose is what catches it.
  it("flags a prerender that also claims to be a navigation", () => {
    expect(
      isSpeculativeRequest(
        req({
          "sec-purpose": "prefetch;prerender",
          "sec-fetch-mode": "navigate",
          "sec-fetch-dest": "document",
        }),
      ),
    ).toBe(true);
  });
});
