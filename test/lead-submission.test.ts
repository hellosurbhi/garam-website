import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { updateLeadFields } from "@/lib/leadSubmission";
import { overLimitMessage, FIELD_LIMITS } from "@/lib/applicationFieldLimits";

const fetchMock = vi.fn();

beforeEach(() => {
  vi.stubGlobal("fetch", fetchMock);
  fetchMock.mockReset();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("updateLeadFields (step-2 progressive contact capture)", () => {
  it("posts the lead id, token and only the given contact fields", async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => ({}) });

    await updateLeadFields(
      { id: "lead-1", updateToken: "tok" },
      { instagram: "priya_applies", name: "Priya Sharma" },
    );

    expect(fetchMock).toHaveBeenCalledWith(
      "/api/update-lead",
      expect.objectContaining({ method: "POST" }),
    );
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string);
    expect(body).toEqual({
      id: "lead-1",
      token: "tok",
      instagram: "priya_applies",
      name: "Priya Sharma",
    });
  });

  it("rejects a lead without an id before touching the network", async () => {
    await expect(
      updateLeadFields({ id: "" }, { phone: "+15550100000" }),
    ).rejects.toThrow("Lead id required");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("surfaces the API error message on a failed update", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      json: async () => ({ error: "Lead not found" }),
    });
    await expect(
      updateLeadFields({ id: "lead-1" }, { phone: "+15550100000" }),
    ).rejects.toThrow("Lead not found");
  });
});

describe("overLimitMessage (the only user-visible surface of the ceilings)", () => {
  it("names the ceiling in plain words with a readable number", () => {
    expect(overLimitMessage(FIELD_LIMITS.pitch)).toBe(
      "This is over 50,000 characters, please trim it down a little",
    );
    expect(overLimitMessage(FIELD_LIMITS.freeText)).toContain("1,000");
  });
});
