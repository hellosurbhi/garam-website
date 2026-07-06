import { describe, it, expect } from "vitest";
import { GET as getLlms } from "@/pages/llms.txt";
import { GET as getLlmsFull } from "@/pages/llms-full.txt";

async function bodyOf(res: Response): Promise<string> {
  return await res.text();
}

describe("llms.txt (concise AI index)", () => {
  it("serves plain text with the brand, definition and disambiguation", async () => {
    const res = getLlms({} as never) as Response;
    expect(res.headers.get("Content-Type")).toContain("text/plain");
    const body = await bodyOf(res);
    expect(body).toContain("Garam Masala Dating");
    // Entity disambiguation from the spice blend is the key AEO signal.
    expect(body.toLowerCase()).toContain("not the spice blend");
    expect(body).toContain("https://garammasaladating.com/llms-full.txt");
  });

  it("lists the key pages AI systems should know about", async () => {
    const body = await bodyOf(getLlms({} as never) as Response);
    for (const path of ["/tickets", "/apply", "/faq", "/hosts", "/journal"]) {
      expect(body).toContain(`https://garammasaladating.com${path}`);
    }
  });
});

describe("llms-full.txt (comprehensive AI dump)", () => {
  it("leads with the entity disambiguation section", async () => {
    const body = await bodyOf(getLlmsFull({} as never) as Response);
    expect(body).toContain("What Garam Masala Dating Is (and Is Not)");
    expect(body).toContain("NOT the spice blend");
  });

  it("names both hosts so 'who hosts Garam Masala Dating' resolves", async () => {
    const body = await bodyOf(getLlmsFull({} as never) as Response);
    expect(body).toContain("Surbhi");
    expect(body).toContain("Wyatt Feegrado");
  });
});
