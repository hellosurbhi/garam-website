import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ContestantsTab from "./ContestantsTab";

const getIdToken = vi.fn().mockResolvedValue("admin-token");

vi.mock("./ContestantsTab.module.css", () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(() => ({
    currentUser: {
      isAnonymous: false,
      getIdToken,
    },
  })),
}));

vi.mock("@/data/events", () => ({
  events: [
    {
      citySlug: "manhattan",
      city: "Manhattan",
      date: "January 1, 2099",
      isoDate: "2099-01-01",
      hidden: false,
    },
  ],
}));

describe("ContestantsTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getIdToken.mockResolvedValue("admin-token");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("derives invite status from stored claimed and showDate fields", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          invites: [
            {
              id: "pending-1",
              applicantName: "Priya",
              applicantEmail: "priya@example.com",
              role: "female",
              showId: "manhattan-2099-01-01",
              showDate: "2099-01-01",
              claimed: false,
            },
            {
              id: "claimed-1",
              applicantName: "Rohan",
              applicantEmail: "rohan@example.com",
              role: "male",
              showId: "manhattan-2099-01-01",
              showDate: "2099-01-01",
              claimed: true,
            },
            {
              id: "expired-1",
              applicantName: "Anika",
              applicantEmail: "anika@example.com",
              role: "stealer",
              showId: "manhattan-2000-01-01",
              showDate: "2000-01-01",
              claimed: false,
            },
          ],
        }),
        {
          headers: { "Content-Type": "application/json" },
        },
      ),
    );

    render(<ContestantsTab />);

    await waitFor(() => {
      expect(screen.getByText("Priya")).toBeInTheDocument();
    });
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("claimed")).toBeInTheDocument();
    expect(screen.getByText("expired")).toBeInTheDocument();
    expect(fetch).toHaveBeenCalledWith("/api/contestants", {
      headers: { Authorization: "Bearer admin-token" },
    });
  });
});
