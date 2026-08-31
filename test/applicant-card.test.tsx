import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";

vi.mock("@/components/admin/useApplicantPhotos", () => ({
  useApplicantPhotos: vi.fn(() => ({ photos: [], count: 0, loading: false })),
}));

import { Timestamp } from "firebase/firestore";
import ApplicantCard from "@/components/admin/ApplicantCard";
import type { Application } from "@/types/application";

const BASE_APP: Application = {
  submittedAt: Timestamp.fromDate(new Date("2026-08-30T12:00:00Z")),
  id: "a1",
  name: "Priya Sharma",
  age: 28,
  gender: "Woman",
  orientation: "Straight",
  city: "New York",
  instagram: "@priya_applies",
  applicationType: "Self",
  status: "New",
};

describe("ApplicantCard photos-failed pill", () => {
  it("flags applications whose photo uploads failed so the producer chases photos", () => {
    render(
      <ApplicantCard
        app={{ ...BASE_APP, photoUploadFailed: true }}
        onClick={() => {}}
      />,
    );
    expect(screen.getByText("Photos failed")).toBeInTheDocument();
  });

  it("shows no pill for a normal application", () => {
    render(<ApplicantCard app={BASE_APP} onClick={() => {}} />);
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
    expect(screen.queryByText("Photos failed")).toBeNull();
  });
});
