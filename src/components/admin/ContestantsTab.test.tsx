import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import ContestantsTab from "./ContestantsTab";

const getDocs = vi.fn();

vi.mock("./ContestantsTab.module.css", () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: (...args: unknown[]) => getDocs(...args),
  orderBy: vi.fn(),
  query: vi.fn((collectionRef: unknown) => collectionRef),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
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
  });

  it("derives invite status from stored claimed and showDate fields", async () => {
    getDocs.mockResolvedValue({
      docs: [
        {
          id: "pending-1",
          data: () => ({
            applicantName: "Priya",
            applicantEmail: "priya@example.com",
            role: "female",
            showId: "manhattan-2099-01-01",
            showDate: "2099-01-01",
            claimed: false,
          }),
        },
        {
          id: "claimed-1",
          data: () => ({
            applicantName: "Rohan",
            applicantEmail: "rohan@example.com",
            role: "male",
            showId: "manhattan-2099-01-01",
            showDate: "2099-01-01",
            claimed: true,
          }),
        },
        {
          id: "expired-1",
          data: () => ({
            applicantName: "Anika",
            applicantEmail: "anika@example.com",
            role: "stealer",
            showId: "manhattan-2000-01-01",
            showDate: "2000-01-01",
            claimed: false,
          }),
        },
      ],
    });

    render(<ContestantsTab />);

    await waitFor(() => {
      expect(screen.getByText("Priya")).toBeInTheDocument();
    });
    expect(screen.getByText("pending")).toBeInTheDocument();
    expect(screen.getByText("claimed")).toBeInTheDocument();
    expect(screen.getByText("expired")).toBeInTheDocument();
  });
});
