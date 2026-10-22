import { describe, it, expect } from "vitest";
import { firstNameOf, applicationReceived, schedulingInvite } from "./emails";

describe("firstNameOf", () => {
  it("takes the first word of a plain full name", () => {
    expect(firstNameOf("Ada Lovelace")).toBe("Ada");
  });

  it("ignores leading, trailing and repeated whitespace", () => {
    expect(firstNameOf("  Ada Lovelace")).toBe("Ada");
    expect(firstNameOf("Ada   Lovelace  ")).toBe("Ada");
    expect(firstNameOf("\tAda\nLovelace")).toBe("Ada");
  });
});

describe("templates use the normalized first name", () => {
  it("applicationReceived greets a space-prefixed name without a blank", () => {
    const { subject, text } = applicationReceived(" Ada Lovelace");
    expect(subject).toContain("Ada");
    expect(text).toContain("Ada");
  });

  it("schedulingInvite does not render an empty first name", () => {
    const { subject, text } = schedulingInvite(
      "  Ada Lovelace",
      "https://example.com/cal",
    );
    expect(`${subject}${text}`).toContain("Ada");
    expect(subject).not.toMatch(/,\s*$/);
  });
});
