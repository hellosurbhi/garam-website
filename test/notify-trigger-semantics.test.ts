// @vitest-environment node
import { readFileSync } from "node:fs";
import { parse } from "@astrojs/compiler";
import { is } from "@astrojs/compiler/utils";
import type { Node } from "@astrojs/compiler/types";
import { describe, expect, it } from "vitest";

describe("Notify Me trigger semantics", () => {
  it.each([
    ["events/EventTicketCta.astro", 3],
    ["home/HomeShowCards.astro", 2],
    ["tickets/TicketCard.astro", 2],
  ] as const)(
    "%s uses native action buttons in every notify branch",
    async (file, count) => {
      const source = readFileSync(
        new URL(`../src/components/${file}`, import.meta.url),
        "utf8",
      );
      const { ast } = await parse(source);
      let triggers = 0;
      function visit(node: Node) {
        if (is.parent(node)) node.children.forEach(visit);
        if (
          !is.element(node) ||
          !node.attributes.some((attr) => attr.name === "data-notify-city")
        )
          return;
        triggers++;
        expect(node.name).toBe("button");
        expect(
          node.attributes.find((attr) => attr.name === "type")?.value,
        ).toBe("button");
        expect(node.attributes.some((attr) => attr.name === "href")).toBe(
          false,
        );
      }
      visit(ast);
      expect(triggers).toBe(count);
    },
  );
});
