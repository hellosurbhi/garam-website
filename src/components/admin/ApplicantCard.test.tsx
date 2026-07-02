import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Application } from "@/types/application";
import ApplicantCard from "./ApplicantCard";

function makeApp(overrides?: Partial<Application>): Application {
  return {
    id: "test-1",
    name: "Priya Sharma",
    age: 27,
    gender: "Woman",
    orientation: "Straight",
    city: "New York",
    state: "NY",
    height: "5'6\"",
    instagram: "applicant_fixture_1",
    community: "Hindu",
    income: "$50k–$100k",
    applicationType: "Self",
    photoUrl: "https://example.com/photo.jpg",
    status: "New",
    notes: "",
    submittedAt: {
      toDate: () => new Date("2026-03-15"),
      seconds: 1742054400,
    } as unknown as Application["submittedAt"],
    ...overrides,
  };
}

describe("ApplicantCard", () => {
  it("renders the applicant name", () => {
    render(<ApplicantCard app={makeApp()} onClick={vi.fn()} />);
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
  });

  it("renders the applicant age", () => {
    render(<ApplicantCard app={makeApp()} onClick={vi.fn()} />);
    expect(screen.getByText(/27\s*·\s*Woman\s*·/)).toBeInTheDocument();
  });

  it("renders the formatted location", () => {
    render(<ApplicantCard app={makeApp()} onClick={vi.fn()} />);
    expect(screen.getByText(/New York,\s*NY/)).toBeInTheDocument();
  });

  it("renders the Instagram handle as a link", () => {
    render(<ApplicantCard app={makeApp()} onClick={vi.fn()} />);
    const link = screen.getByText("@applicant_fixture_1");
    expect(link.closest("a")).toHaveAttribute(
      "href",
      "https://instagram.com/applicant_fixture_1",
    );
  });

  it("renders the status badge", () => {
    render(
      <ApplicantCard app={makeApp({ status: "Cast" })} onClick={vi.fn()} />,
    );
    expect(screen.getByText("Cast")).toBeInTheDocument();
  });

  it("calls onClick when the card is clicked", () => {
    const onClick = vi.fn();
    render(<ApplicantCard app={makeApp()} onClick={onClick} />);
    fireEvent.click(screen.getByText("Priya Sharma"));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders delete button that calls onDelete", () => {
    const onDelete = vi.fn();
    const onClick = vi.fn();
    render(
      <ApplicantCard app={makeApp()} onClick={onClick} onDelete={onDelete} />,
    );
    const deleteBtn = screen.getByLabelText("Delete application");
    fireEvent.click(deleteBtn);
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it("delete button does not trigger card onClick", () => {
    const onClick = vi.fn();
    const onDelete = vi.fn();
    render(
      <ApplicantCard app={makeApp()} onClick={onClick} onDelete={onDelete} />,
    );
    const deleteBtn = screen.getByLabelText("Delete application");
    fireEvent.click(deleteBtn);
    expect(onClick).not.toHaveBeenCalled();
  });

  it("renders restore button when onRestore is provided", () => {
    const onRestore = vi.fn();
    render(
      <ApplicantCard app={makeApp()} onClick={vi.fn()} onRestore={onRestore} />,
    );
    const restoreBtn = screen.getByLabelText("Restore application");
    fireEvent.click(restoreBtn);
    expect(onRestore).toHaveBeenCalledOnce();
  });

  it("shows fallback emoji when photoUrl is empty", () => {
    render(<ApplicantCard app={makeApp({ photoUrl: "" })} onClick={vi.fn()} />);
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });

  it("renders photo when photoUrl is provided", () => {
    render(<ApplicantCard app={makeApp()} onClick={vi.fn()} />);
    const img = screen.getByRole("img");
    expect(img).toHaveAttribute("src", "https://example.com/photo.jpg");
  });

  it("strips leading @ from instagram handle", () => {
    render(
      <ApplicantCard
        app={makeApp({ instagram: "@testuser" })}
        onClick={vi.fn()}
      />,
    );
    expect(screen.getByText("@testuser")).toBeInTheDocument();
    const link = screen.getByText("@testuser").closest("a");
    expect(link).toHaveAttribute("href", "https://instagram.com/testuser");
  });
});
