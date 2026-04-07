import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Application } from "@/types/application";
import AdminDashboard from "./AdminDashboard";

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
    instagram: "priyasharma",
    community: "Hindu",
    income: "$50k–$100k",
    applicationType: "Self",
    photoUrl: "https://example.com/photo.jpg",
    status: "New",
    notes: "",
    submittedAt: { toDate: () => new Date("2026-03-15"), seconds: 1742054400 } as unknown as Application["submittedAt"],
    ...overrides,
  };
}

const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: vi.fn(),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  Timestamp: { now: vi.fn(() => ({ seconds: 1742054400, toDate: () => new Date() })) },
}));

vi.mock("firebase/auth", () => ({}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
  getFirebaseAuth: vi.fn(() => ({ currentUser: { getIdToken: vi.fn().mockResolvedValue("tok") } })),
}));

vi.mock("react-select", () => ({
  default: ({ placeholder, onChange }: { placeholder: string; onChange: (v: unknown) => void }) => (
    <select data-testid={`select-${placeholder}`} onChange={(e) => onChange(e.target.value ? [{ value: e.target.value, label: e.target.value }] : [])}>
      <option value="">{placeholder}</option>
    </select>
  ),
}));

vi.mock("@/data/events", () => ({
  events: [],
}));

describe("AdminDashboard", () => {
  const onLogout = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it("shows loading state while fetching", () => {
    mockGetDocs.mockReturnValue(new Promise(() => {})); // never resolves
    render(<AdminDashboard onLogout={onLogout} />);
    expect(screen.getByText("Loading…")).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    mockGetDocs.mockRejectedValue(new Error("Network error"));
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText("Failed to load applications.")).toBeInTheDocument();
    });
  });

  it("shows retry button on error", async () => {
    mockGetDocs.mockRejectedValue(new Error("Network error"));
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });
  });

  it("shows empty state when no applications exist", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText(/No applications yet/)).toBeInTheDocument();
    });
  });

  it("renders applicant cards when applications are loaded", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "1", data: () => ({ ...makeApp({ id: "1", name: "Priya" }) }) },
        { id: "2", data: () => ({ ...makeApp({ id: "2", name: "Anika" }) }) },
      ],
    });
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText("Priya")).toBeInTheDocument();
    });
    expect(screen.getByText("Anika")).toBeInTheDocument();
  });

  it("shows active count in header", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "1", data: () => ({ ...makeApp({ id: "1" }) }) },
      ],
    });
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText("1 active")).toBeInTheDocument();
    });
  });

  it("renders logout button that calls onLogout", async () => {
    mockGetDocs.mockResolvedValue({ docs: [] });
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText("Logout")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("Logout"));
    expect(onLogout).toHaveBeenCalledOnce();
  });

  it("shows summary with active and deleted counts", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        { id: "1", data: () => ({ ...makeApp({ id: "1" }) }) },
        { id: "2", data: () => ({ ...makeApp({ id: "2", deletedAt: { seconds: 100, nanoseconds: 0, toDate: () => new Date(), toMillis: () => 100000, isEqual: () => false, toJSON: () => ({ seconds: 100, nanoseconds: 0 }) } }) }) },
      ],
    });
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText(/Showing 1 active · 1 deleted/)).toBeInTheDocument();
    });
  });

  it("retry button re-fetches applications", async () => {
    mockGetDocs.mockRejectedValueOnce(new Error("fail"));
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });
    mockGetDocs.mockResolvedValueOnce({ docs: [] });
    fireEvent.click(screen.getByText("Try again"));
    await waitFor(() => {
      expect(screen.getByText(/No applications yet/)).toBeInTheDocument();
    });
  });
});
