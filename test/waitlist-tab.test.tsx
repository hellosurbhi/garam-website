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
    const url = new URL(String(input), "https://x.test");
    if (url.searchParams.get("format") === "csv") {
      return {
        ok: true,
        blob: async () => new Blob(["Name,Email\r\n"], { type: "text/csv" }),
      } as unknown as Response;
    }
    // Server-side city filter: return only matching leads.
    const city = url.searchParams.get("city")?.toLowerCase() ?? "";
    const rows = city
      ? LEADS.filter(
          (l) =>
            l.city.toLowerCase().includes(city) ||
            l.sourceCitySlug.toLowerCase().includes(city),
        )
      : LEADS;
    return {
      ok: true,
      json: async () => ({ total: rows.length, leads: rows }),
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

  it("filters server-side by city (refetches with ?city=)", async () => {
    render(<WaitlistTab />);
    await screen.findByText("a@x.com");
    fireEvent.change(screen.getByLabelText("Filter waitlist by city"), {
      target: { value: "austin" },
    });
    // Debounced refetch drops the non-matching row.
    await waitFor(() =>
      expect(screen.queryByText("b@x.com")).not.toBeInTheDocument(),
    );
    expect(screen.getByText("a@x.com")).toBeInTheDocument();
    const fetchMock = globalThis.fetch as unknown as ReturnType<typeof vi.fn>;
    const cityCall = fetchMock.mock.calls.find((c) =>
      String(c[0]).includes("city=austin"),
    );
    expect(cityCall).toBeDefined();
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
    // Override only the static blob helpers; keep the URL constructor so the
    // fetch mock's `new URL(...)` still works.
    const createUrl = vi.fn(() => "blob:url");
    const revokeUrl = vi.fn();
    const origCreate = URL.createObjectURL;
    const origRevoke = URL.revokeObjectURL;
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    try {
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
    } finally {
      URL.createObjectURL = origCreate;
      URL.revokeObjectURL = origRevoke;
    }
  });
});
