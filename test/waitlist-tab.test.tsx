import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

const mocks = vi.hoisted(() => ({
  getIdToken: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(async () => ({
    currentUser: { getIdToken: mocks.getIdToken },
  })),
}));

import WaitlistTab from "@/components/admin/WaitlistTab";

const LEADS = [
  {
    id: "1",
    email: "a@x.com",
    phone: "+15551110000",
    name: "Ana",
    city: "Austin",
    sourceCitySlug: "austin",
    source: "city-waitlist",
    createdAt: "2026-07-02T00:00:00Z",
  },
  {
    id: "2",
    email: "b@x.com",
    phone: "",
    name: "Bo",
    city: "New York",
    sourceCitySlug: "nyc",
    source: "popup",
    createdAt: "2026-07-01T00:00:00Z",
  },
];

function mockLeadsFetch() {
  return vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    if (url.includes("format=csv")) {
      return {
        ok: true,
        blob: async () => new Blob(["Name,Email\r\n"], { type: "text/csv" }),
      } as unknown as Response;
    }
    return {
      ok: true,
      json: async () => ({ total: LEADS.length, leads: LEADS }),
    } as unknown as Response;
  });
}

describe("WaitlistTab", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getIdToken.mockResolvedValue("admin-token");
    vi.stubGlobal("fetch", mockLeadsFetch());
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("renders the waitlist rows", async () => {
    render(<WaitlistTab />);
    expect(await screen.findByText("a@x.com")).toBeInTheDocument();
    expect(screen.getByText("b@x.com")).toBeInTheDocument();
    expect(screen.getByText("Austin")).toBeInTheDocument();
    expect(screen.getByText("+15551110000")).toBeInTheDocument();
  });

  it("filters rows by city", async () => {
    render(<WaitlistTab />);
    await screen.findByText("a@x.com");
    fireEvent.change(screen.getByLabelText("Filter waitlist by city"), {
      target: { value: "austin" },
    });
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
    expect(screen.queryByText("b@x.com")).not.toBeInTheDocument();
  });

  it("shows a 401 error with retry when the session is expired", async () => {
    mocks.getIdToken.mockResolvedValue(null);
    render(<WaitlistTab />);
    expect(
      await screen.findByText(/Session expired/),
    ).toBeInTheDocument();
    expect(screen.getByText("Try again")).toBeInTheDocument();
  });

  it("exports CSV via an authorized blob fetch", async () => {
    const createUrl = vi.fn(() => "blob:url");
    const revokeUrl = vi.fn();
    vi.stubGlobal("URL", {
      createObjectURL: createUrl,
      revokeObjectURL: revokeUrl,
    } as unknown as typeof URL);

    render(<WaitlistTab />);
    await screen.findByText("a@x.com");
    fireEvent.click(screen.getByText("Export CSV"));

    await waitFor(() => expect(createUrl).toHaveBeenCalled());
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const csvCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("format=csv"),
    );
    expect(csvCall).toBeDefined();
    expect(csvCall?.[1]?.headers.Authorization).toBe("Bearer admin-token");
  });
});
