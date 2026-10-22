import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/lib/ticketCtaTracking", () => ({
  wireTicketCtaTracking: vi.fn(),
}));

import { ApplySuccessPanel } from "@/components/apply/ApplySuccessPanel";
import { APPLY_PAGE } from "@/data/copy";

describe("ApplySuccessPanel photo failure note", () => {
  it("tells the applicant their photos did not attach when uploads failed", () => {
    render(<ApplySuccessPanel photosFailed />);
    const note = screen.getByRole("alert");
    expect(note).toHaveTextContent(APPLY_PAGE.photosFailedTitle);
    expect(note).toHaveTextContent(APPLY_PAGE.photosFailedNote);
  });

  it("shows the plain success panel with no photo warning by default", () => {
    render(<ApplySuccessPanel />);
    expect(screen.getByTestId("apply-success")).toBeInTheDocument();
    expect(screen.queryByRole("alert")).toBeNull();
  });
});
