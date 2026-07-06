import { describe, it, expect } from "vitest";
import {
  normalizeDomain,
  domainFromUrl,
  isTicketVendorUrl,
  isSocialUrl,
  vendorFromUrl,
} from "./analyticsCapture";

describe("normalizeDomain", () => {
  it("lowercases and strips a leading www.", () => {
    expect(normalizeDomain("WWW.Eventbrite.com")).toBe("eventbrite.com");
    expect(normalizeDomain("eventbrite.com")).toBe("eventbrite.com");
    expect(normalizeDomain("sub.EVENTBRITE.com")).toBe("sub.eventbrite.com");
  });
});

describe("domainFromUrl", () => {
  it("returns the normalized hostname of a valid URL", () => {
    expect(domainFromUrl("https://www.eventbrite.com/e/123")).toBe(
      "eventbrite.com",
    );
    expect(domainFromUrl("https://dccomedyloft.com/shows/378527")).toBe(
      "dccomedyloft.com",
    );
  });

  it("returns an empty string for an invalid URL", () => {
    expect(domainFromUrl("not a url")).toBe("");
    expect(domainFromUrl("")).toBe("");
  });
});

describe("isTicketVendorUrl", () => {
  it("matches known ticket vendors and their subdomains", () => {
    expect(isTicketVendorUrl("https://www.eventbrite.com/e/1")).toBe(true);
    expect(isTicketVendorUrl("https://tickets.citywinery.com/x")).toBe(true);
    expect(isTicketVendorUrl("https://dccomedyloft.com/shows/1")).toBe(true);
  });

  it("rejects non-vendor and invalid URLs", () => {
    expect(isTicketVendorUrl("https://example.com")).toBe(false);
    expect(isTicketVendorUrl("https://noteventbrite.com")).toBe(false);
    expect(isTicketVendorUrl("garbage")).toBe(false);
  });
});

describe("isSocialUrl", () => {
  it("matches social domains", () => {
    expect(isSocialUrl("https://instagram.com/garammasaladating")).toBe(true);
    expect(isSocialUrl("https://x.com/GaramDatingShow")).toBe(true);
    expect(isSocialUrl("https://youtu.be/abc")).toBe(true);
  });

  it("rejects non-social and invalid URLs", () => {
    expect(isSocialUrl("https://eventbrite.com")).toBe(false);
    expect(isSocialUrl("nope")).toBe(false);
  });
});

describe("vendorFromUrl", () => {
  it("returns the vendor slug for known vendors, including subdomains", () => {
    expect(vendorFromUrl("https://www.eventbrite.com/e/1")).toBe("eventbrite");
    expect(vendorFromUrl("https://tickets.citywinery.com/x")).toBe(
      "citywinery",
    );
    expect(vendorFromUrl("https://dccomedyloft.com/shows/1")).toBe(
      "dccomedyloft",
    );
  });

  it("falls back to the first domain label for unknown vendors", () => {
    expect(vendorFromUrl("https://somevenue.com/tickets")).toBe("somevenue");
  });

  it("returns an empty string for an invalid URL", () => {
    expect(vendorFromUrl("not a url")).toBe("");
  });
});
