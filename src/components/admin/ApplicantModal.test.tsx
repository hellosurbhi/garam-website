import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import type { Application } from "@/types/application";
import ApplicantModal from "./ApplicantModal";

// P3 added onSnapshot subscription in useEffect — mock Firestore and firebase lib
// so tests don't try to connect to a real Firebase instance.
vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
  getFirebaseAuth: vi.fn(() => Promise.resolve("mock-auth")),
}));

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(() => "mock-collection-ref"),
  query: vi.fn((...args: unknown[]) => args[0]),
  orderBy: vi.fn(() => "mock-order"),
  onSnapshot: vi.fn((_ref: unknown, cb: (snap: { docs: unknown[] }) => void) => {
    cb({ docs: [] }); // empty events list on mount
    return vi.fn(); // unsubscribe no-op
  }),
  updateDoc: vi.fn(() => Promise.resolve()),
  doc: vi.fn(() => "mock-doc-ref"),
  serverTimestamp: vi.fn(() => "mock-ts"),
  addDoc: vi.fn(() => Promise.resolve({ id: "mock-event-id" })),
}));

vi.mock("firebase/auth", () => ({
  signInAnonymously: vi.fn(() => Promise.resolve()),
}));

function makeApp(overrides?: Partial<Application>): Application {
  return {
    id: "test-1",
    name: "Priya Sharma",
    age: 27,
    gender: "Woman",
    orientation: "Straight",
    city: "New York",
    state: "NY",
    email: "priya@example.com",
    phone: "+12125551234",
    height: "5'6\"",
    instagram: "applicant_fixture_1",
    community: "Hindu",
    income: "$50k–$100k",
    applicationType: "Self",
    photoUrl: "https://example.com/photo.jpg",
    status: "New",
    notes: "",
    submittedAt: {
      toDate: () => new Date("2026-03-15T12:00:00"),
      seconds: 1742054400,
    } as unknown as Application["submittedAt"],
    ...overrides,
  };
}

const defaultProps = {
  onClose: vi.fn(),
  onUpdate: vi.fn(),
  onDelete: vi.fn(),
  onRestore: vi.fn(),
};

afterEach(() => {
  vi.restoreAllMocks();
  document.body.style.overflow = "";
});

describe("ApplicantModal", () => {
  it("displays the applicant name", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByText("Priya Sharma")).toBeInTheDocument();
  });

  it("displays the applicant age", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByText(/27\s*·\s*Woman\s*·/)).toBeInTheDocument();
  });

  it("displays the applicant gender", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByText(/27\s*·\s*Woman\s*·/)).toBeInTheDocument();
  });

  it("displays the applicant orientation", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByText("Straight")).toBeInTheDocument();
  });

  it("displays the formatted location", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByText(/New York,\s*NY/)).toBeInTheDocument();
  });

  it("displays community and income", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByText("Hindu")).toBeInTheDocument();
    expect(screen.getByText("$50k–$100k")).toBeInTheDocument();
  });

  it("displays email and phone", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByText("priya@example.com")).toBeInTheDocument();
    expect(screen.getByText("+12125551234")).toBeInTheDocument();
  });

  it("renders Instagram handle as a link", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    const link = screen.getByText("@applicant_fixture_1");
    expect(link).toHaveAttribute(
      "href",
      "https://instagram.com/applicant_fixture_1",
    );
  });

  it("shows pitch when present", () => {
    render(
      <ApplicantModal
        app={makeApp({ pitch: "I love masala chai" })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("I love masala chai")).toBeInTheDocument();
  });

  it("hides pitch when not present", () => {
    render(
      <ApplicantModal app={makeApp({ pitch: undefined })} {...defaultProps} />,
    );
    expect(screen.queryByText("I love masala chai")).not.toBeInTheDocument();
  });

  it("shows 'Referred by' for Nomination type", () => {
    render(
      <ApplicantModal
        app={makeApp({ applicationType: "Nomination", referrerName: "Rahul" })}
        {...defaultProps}
      />,
    );
    expect(screen.getByText("Rahul")).toBeInTheDocument();
  });

  it("hides 'Referred by' for Self type", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.queryByText("Referred by")).not.toBeInTheDocument();
  });

  it("calls onClose when close button is clicked", () => {
    const onClose = vi.fn();
    render(
      <ApplicantModal app={makeApp()} {...defaultProps} onClose={onClose} />,
    );
    fireEvent.click(screen.getByLabelText("Close"));
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onClose when dialog cancel event fires (Escape key)", () => {
    const onClose = vi.fn();
    render(
      <ApplicantModal app={makeApp()} {...defaultProps} onClose={onClose} />,
    );
    const dialog = screen.getByRole("dialog", { hidden: true });
    fireEvent(
      dialog,
      new Event("cancel", { cancelable: true, bubbles: false }),
    );
    expect(onClose).toHaveBeenCalled();
  });

  it("calls onUpdate when status is changed", () => {
    const onUpdate = vi.fn();
    render(
      <ApplicantModal app={makeApp()} {...defaultProps} onUpdate={onUpdate} />,
    );
    fireEvent.change(screen.getByDisplayValue("New"), {
      target: { value: "Cast" },
    });
    expect(onUpdate).toHaveBeenCalledWith("test-1", { status: "Cast" });
  });

  it("shows DELETED banner when deletedAt is set", () => {
    const app = makeApp({
      deletedAt: {
        toDate: () => new Date(),
        seconds: 1742054400,
      } as unknown as Application["deletedAt"],
    });
    render(<ApplicantModal app={app} {...defaultProps} />);
    expect(screen.getByText("DELETED")).toBeInTheDocument();
  });

  it("shows delete button for non-deleted apps", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByText("Move to Deleted")).toBeInTheDocument();
  });

  it("shows restore button for deleted apps", () => {
    const app = makeApp({
      deletedAt: {
        toDate: () => new Date(),
        seconds: 1742054400,
      } as unknown as Application["deletedAt"],
    });
    render(<ApplicantModal app={app} {...defaultProps} />);
    expect(screen.getByText("Restore")).toBeInTheDocument();
  });

  it("calls onDelete when delete button is clicked", () => {
    const onDelete = vi.fn();
    render(
      <ApplicantModal app={makeApp()} {...defaultProps} onDelete={onDelete} />,
    );
    fireEvent.click(screen.getByText("Move to Deleted"));
    expect(onDelete).toHaveBeenCalledWith("test-1");
  });

  it("renders as a modal dialog element", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByRole("dialog", { hidden: true })).toBeInTheDocument();
  });

  it("displays the photo when photoUrl is provided", () => {
    render(<ApplicantModal app={makeApp()} {...defaultProps} />);
    expect(screen.getByAltText("Priya Sharma photo 1")).toHaveAttribute(
      "src",
      "https://example.com/photo.jpg",
    );
  });
});
