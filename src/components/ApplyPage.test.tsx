import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ApplyPage from "./ApplyPage";

const mockAddDoc = vi.fn();
const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
  getFirebaseStorage: vi.fn(() => "mock-storage"),
}));

interface MockSelectProps {
  placeholder: string;
  onChange: (v: { value: string; label: string } | null) => void;
  value: { value: string; label: string } | null;
}

vi.mock("react-select", () => ({
  default: ({ placeholder, onChange, value }: MockSelectProps) => (
    <select
      data-testid={`select-${placeholder}`}
      value={value?.value ?? ""}
      onChange={(e) => onChange(e.target.value ? { value: e.target.value, label: e.target.value } : null)}
    >
      <option value="">{placeholder}</option>
      <option value="US">United States</option>
      <option value="NY">New York</option>
      <option value="NYC">New York City</option>
    </select>
  ),
}));

vi.mock("@/hooks/useGeoData", () => ({
  useGeoData: () => ({
    loading: false,
    countryOptions: [{ value: "US", label: "United States" }],
    stateOptions: [{ value: "NY", label: "New York" }],
    cityOptions: [{ value: "NYC", label: "New York City" }],
  }),
}));

vi.mock("@/data/events", () => ({
  events: [
    { date: "Apr 19", city: "Manhattan", url: "https://example.com/tickets", isoDate: "2099-04-19" },
  ],
}));

vi.mock("./ApplyPage.module.css", () => ({
  default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

describe("ApplyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: "doc-1" });
    mockUploadBytes.mockResolvedValue({});
    mockGetDownloadURL.mockResolvedValue("https://example.com/photo.jpg");
    // Mock fetch for notify-application
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    // Mock crypto.randomUUID
    vi.spyOn(crypto, "randomUUID").mockReturnValue("test-uuid" as `${string}-${string}-${string}-${string}-${string}`);
  });

  it("renders the form title", () => {
    render(<ApplyPage />);
    expect(screen.getByText("Apply to Be on Garam Masala Dating")).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<ApplyPage />);
    expect(screen.getByText(/NYC's hottest live comedy dating show/)).toBeInTheDocument();
  });

  it("shows 'For myself' and 'For a friend' toggle buttons", () => {
    render(<ApplyPage />);
    expect(screen.getByText("For myself")).toBeInTheDocument();
    expect(screen.getByText("For a friend")).toBeInTheDocument();
  });

  it("shows 'About You' section title by default", () => {
    render(<ApplyPage />);
    expect(screen.getByText("About You")).toBeInTheDocument();
  });

  it("changes section title to 'About Your Friend' when Nomination is selected", () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("For a friend"));
    expect(screen.getByText("About Your Friend")).toBeInTheDocument();
  });

  it("shows referrer name field only for Nomination type", () => {
    render(<ApplyPage />);
    expect(screen.queryByPlaceholderText("So we know who nominated them")).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("For a friend"));
    expect(screen.getByPlaceholderText("So we know who nominated them")).toBeInTheDocument();
  });

  it("shows error text when submitting with empty required fields", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application 🌶️"));
    await waitFor(() => {
      expect(screen.getByText("Please fill in all required fields")).toBeInTheDocument();
    });
  });

  it("shows 'Required' error for empty name after submit", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application 🌶️"));
    await waitFor(() => {
      const errors = screen.getAllByText("Required");
      expect(errors.length).toBeGreaterThan(0);
    });
  });

  it("renders the submit button", () => {
    render(<ApplyPage />);
    expect(screen.getByText("Submit Application 🌶️")).toBeInTheDocument();
  });

  it("renders the disclaimer text", () => {
    render(<ApplyPage />);
    expect(screen.getByText(/By submitting, you agree to be contacted/)).toBeInTheDocument();
  });
});
