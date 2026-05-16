import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import type { Application } from "@/types/application";
import ContestantInviteModal from "./ContestantInviteModal";

vi.mock("./ContestantInviteModal.module.css", () => ({
  default: new Proxy({}, { get: (_target, prop) => String(prop) }),
}));

vi.mock("@/components/ui/Modal", () => ({
  Modal: ({ children }: { children: ReactNode }) => (
    <div role="dialog">{children}</div>
  ),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(() => ({
    currentUser: {
      getIdToken: vi.fn().mockResolvedValue("admin-token"),
    },
  })),
}));

vi.mock("@/data/events", () => ({
  events: [
    {
      citySlug: "manhattan",
      city: "Manhattan",
      date: "June 1, 2026",
      isoDate: "2026-06-01",
      hidden: false,
    },
  ],
}));

const application = {
  id: "app-1",
  name: "Priya Shah",
  age: 29,
  gender: "Woman",
  orientation: "Straight",
  city: "New York",
  height: "5'6",
  instagram: "priya",
  community: "Hindu",
  income: "$100k to $150k",
  applicationType: "Self",
  photoUrl: "https://example.com/photo.jpg",
  email: "priya@example.com",
  status: "New",
  submittedAt: { toDate: () => new Date("2026-05-01") },
} as Application;

describe("ContestantInviteModal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          ok: true,
          inviteUrl:
            "https://garammasaladating.com/contestant-portal?invite=invite-1",
        }),
        { status: 200 },
      ),
    );
  });

  it("submits lowercase role values that create-invite accepts", async () => {
    const onSuccess = vi.fn();

    render(
      <ContestantInviteModal
        app={application}
        onClose={vi.fn()}
        onSuccess={onSuccess}
      />,
    );

    fireEvent.change(screen.getByLabelText("Select contestant role"), {
      target: { value: "female" },
    });
    fireEvent.change(screen.getByLabelText("Select show"), {
      target: { value: "manhattan-2026-06-01" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Send Invite" }));

    await waitFor(() => expect(fetch).toHaveBeenCalledOnce());

    const [, init] = vi.mocked(fetch).mock.calls[0];
    expect(init?.headers).toMatchObject({
      "Content-Type": "application/json",
      Authorization: "Bearer admin-token",
    });
    expect(JSON.parse(String(init?.body))).toMatchObject({
      applicantId: "app-1",
      applicantName: "Priya Shah",
      applicantEmail: "priya@example.com",
      showId: "manhattan-2026-06-01",
      role: "female",
    });
    expect(onSuccess).toHaveBeenCalledWith(
      "priya@example.com",
      "https://garammasaladating.com/contestant-portal?invite=invite-1",
    );
  });
});
