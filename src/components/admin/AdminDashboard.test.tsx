import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import type { Timestamp } from "firebase/firestore";
import type { Application } from "@/types/application";
import AdminDashboard from "./AdminDashboard";

function makeTimestamp(seconds: number): Timestamp {
  return {
    seconds,
    nanoseconds: 0,
    toDate: () => new Date(seconds * 1000),
    toMillis: () => seconds * 1000,
    isEqual: () => false,
    toJSON: () => ({ seconds, nanoseconds: 0 }),
  } as unknown as Timestamp;
}

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

const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  getDocs: (...args: unknown[]) => mockGetDocs(...args),
  doc: vi.fn(),
  updateDoc: (...args: unknown[]) => mockUpdateDoc(...args),
  // query helpers used by AdminDashboard — must be present so queries don't throw
  where: vi.fn(),
  query: vi.fn((...args: unknown[]) => ({ _args: args })),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
  Timestamp: {
    now: vi.fn(() => ({ seconds: 1742054400, toDate: () => new Date() })),
  },
}));

vi.mock("firebase/auth", () => ({}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
  getFirebaseAuth: vi.fn(() => ({
    currentUser: { getIdToken: vi.fn().mockResolvedValue("tok") },
  })),
}));

vi.mock("react-select", () => ({
  default: ({
    placeholder,
    onChange,
  }: {
    placeholder: string;
    onChange: (v: unknown) => void;
  }) => (
    <select
      data-testid={`select-${placeholder}`}
      onChange={(e) =>
        onChange(
          e.target.value
            ? [{ value: e.target.value, label: e.target.value }]
            : [],
        )
      }
    >
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
    // The Today tab is shown by default; it uses inboxLoading state
    expect(
      screen.getByRole("status", { name: "Loading today's tasks" }),
    ).toBeInTheDocument();
  });

  it("shows error state when fetch fails", async () => {
    mockGetDocs.mockRejectedValue(new Error("Network error"));
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(
        screen.getByText("Failed to load applications."),
      ).toBeInTheDocument();
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
    // Today tab shows TaskInbox empty state when inboxApps is empty
    await waitFor(() => {
      expect(screen.getByText(/You're all caught up/)).toBeInTheDocument();
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

  it("shows active count in tab badge", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [{ id: "1", data: () => ({ ...makeApp({ id: "1" }) }) }],
    });
    render(<AdminDashboard onLogout={onLogout} />);
    // Badge only renders when Applicants tab is active — click it first
    fireEvent.click(screen.getByRole("button", { name: /applicants/i }));
    await waitFor(() => {
      const tab = screen.getByRole("button", { name: /applicants/i });
      expect(tab).toHaveTextContent("1");
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
        {
          id: "2",
          data: () => ({
            ...makeApp({ id: "2", deletedAt: makeTimestamp(100) }),
          }),
        },
      ],
    });
    render(<AdminDashboard onLogout={onLogout} />);
    // Summary is only rendered when the Applicants tab is active
    fireEvent.click(screen.getByRole("button", { name: /applicants/i }));
    await waitFor(() => {
      expect(
        screen.getByText(
          /1 active across 1 stage · 0 participated · 1 deleted/,
        ),
      ).toBeInTheDocument();
    });
  });

  it("retry button re-fetches applications", async () => {
    // Both initial queries (fetchApps + fetchInboxApps) must fail to show error in Today tab
    mockGetDocs.mockRejectedValue(new Error("fail"));
    render(<AdminDashboard onLogout={onLogout} />);
    await waitFor(() => {
      expect(screen.getByText("Try again")).toBeInTheDocument();
    });
    // Override to succeed; clicking Try again retries fetchInboxApps
    mockGetDocs.mockResolvedValue({ docs: [] });
    fireEvent.click(screen.getByText("Try again"));
    // Today tab empty state after successful retry with no inbox items
    await waitFor(() => {
      expect(screen.getByText(/You're all caught up/)).toBeInTheDocument();
    });
  });
});
