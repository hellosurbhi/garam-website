import { describe, it, expect, vi, beforeEach } from "vitest";

const mockReportFailure = vi.fn();
vi.mock("@/lib/failureAlert", () => ({
  reportFailure: (...args: unknown[]) => mockReportFailure(...args),
}));

const mockTrackError = vi.fn();
vi.mock("@/lib/analytics", () => ({
  trackError: (...args: unknown[]) => mockTrackError(...args),
}));

const { reportClaimFailure } = await import("./reportClaimFailure");

const BASE_DATA = {
  firstName: "Jane",
  lastName: "Doe",
  email: "jane@example.com",
  phone: "+15550100",
  waiverAgreed: true,
  signature: "Jane Doe",
  waiverVersion: "v1",
  mailingListOptIn: true,
};

describe("reportClaimFailure", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("reports an Error's message to both failureAlert and PostHog", () => {
    reportClaimFailure(new Error("Claim expired"), BASE_DATA);

    expect(mockReportFailure).toHaveBeenCalledWith({
      flow: "portal",
      stage: "claim",
      errorMessage: "Claim expired",
      contact: {
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "+15550100",
      },
    });
    expect(mockTrackError).toHaveBeenCalledWith({
      error_message: "Claim expired",
      error_type: "api_error",
      component: "ContestantPortal",
      email: "jane@example.com",
    });
  });

  it("stringifies a non-Error thrown value for both calls", () => {
    reportClaimFailure("network down", BASE_DATA);

    expect(mockReportFailure).toHaveBeenCalledWith(
      expect.objectContaining({ errorMessage: "network down" }),
    );
    expect(mockTrackError).toHaveBeenCalledWith(
      expect.objectContaining({ error_message: "network down" }),
    );
  });

  it("trims and joins first/last name into contact.name", () => {
    reportClaimFailure(new Error("x"), {
      ...BASE_DATA,
      firstName: " Anika ",
      lastName: "",
    });

    expect(mockReportFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        contact: expect.objectContaining({ name: "Anika" }),
      }),
    );
  });
});
