import { describe, it, expect } from "vitest";
import { serializeJsonLd } from "../src/utils/jsonLd";

describe("serializeJsonLd", () => {
  const hostile = {
    name: "</script><script>alert(1)</script>",
    other: "a & b > c \u2028\u2029",
  };

  it("leaves no raw <, >, & or line separators in the output", () => {
    expect(serializeJsonLd(hostile)).not.toMatch(/[<>&\u2028\u2029]/);
  });

  it("round-trips through JSON.parse unchanged", () => {
    expect(JSON.parse(serializeJsonLd(hostile))).toEqual(hostile);
  });

  it("stays inside exactly one ld+json script when inlined in HTML", () => {
    document.body.innerHTML = `<script type="application/ld+json">${serializeJsonLd(hostile)}</script>`;
    const scripts = document.querySelectorAll("script");
    expect(scripts).toHaveLength(1);
    expect(JSON.parse(scripts[0].textContent ?? "")).toEqual(hostile);
  });

  it("throws on values JSON cannot represent", () => {
    expect(() => serializeJsonLd(undefined)).toThrow(TypeError);
  });
});
