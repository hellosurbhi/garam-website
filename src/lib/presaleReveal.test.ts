import { afterEach, describe, expect, it } from "vitest";
import { revealPresales } from "./presaleReveal";

const expired =
  '<button data-presale-notify="2000-01-01T00:00:00Z">Notify Me</button><a data-presale-live hidden>Get Tickets</a>';

function expectTicketsVisible(): void {
  expect(document.querySelector<HTMLElement>("button")?.hidden).toBe(true);
  expect(document.querySelector<HTMLElement>("a")?.hidden).toBe(false);
}

afterEach(() => document.body.replaceChildren());

describe("presale checkout reveal", () => {
  it("reveals expired cards in the initial document", () => {
    document.body.innerHTML = expired;
    revealPresales(document);
    expectTicketsVisible();
  });

  it("reveals expired cards inserted later by a server island", async () => {
    const island = document.createElement("section");
    island.innerHTML = expired;
    document.body.append(island);
    await Promise.resolve();
    expectTicketsVisible();
    island.append(document.createElement("p"));
    await Promise.resolve();
    expectTicketsVisible();
  });

  it("waits for the checkout sibling when nodes arrive separately", async () => {
    document.body.innerHTML =
      '<button data-presale-notify="2000-01-01T00:00:00Z">Notify Me</button>';
    await Promise.resolve();
    expect(document.querySelector<HTMLElement>("button")?.hidden).toBe(false);
    document.body.insertAdjacentHTML(
      "beforeend",
      "<a data-presale-live hidden>Get Tickets</a>",
    );
    await Promise.resolve();
    expectTicketsVisible();
  });

  it("keeps future presale cards on Notify Me", async () => {
    document.body.innerHTML = expired.replace("2000-01-01", "2999-01-01");
    await Promise.resolve();
    expect(document.querySelector<HTMLElement>("button")?.hidden).toBe(false);
    expect(document.querySelector<HTMLElement>("a")?.hidden).toBe(true);
  });
});
