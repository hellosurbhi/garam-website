import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContestantPortal from "./ContestantPortal";
import { startPortalStateLoad } from "@/lib/portalBootstrap";
import type { PortalStateResult } from "@/lib/portalBootstrap";
import { WAIVER_PANEL } from "@/data/contestantPortal";

// The form renders two alert regions (signature mismatch and claim error);
// their combined text is what a screen reader announces.
const alertText = () =>
  screen
    .getAllByRole("alert")
    .map((el) => el.textContent)
    .join(" ");

const SIGNATURE_LABEL = WAIVER_PANEL.signatureLabel;

const mockReportFailure = vi.fn();
vi.mock("@/lib/failureAlert", () => ({
  reportFailure: (...args: unknown[]) => mockReportFailure(...args),
}));

vi.mock("@/components/ContestantPortal.module.css", () => ({
  default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

// Only the network entry point is replaced; resolvePortalState and the
// storage helpers stay real so the state mapping is exercised end to end.
vi.mock("@/lib/portalBootstrap", async (importActual) => ({
  ...(await importActual<typeof import("@/lib/portalBootstrap")>()),
  startPortalStateLoad: vi.fn(),
}));

function loadResult(data: Record<string, unknown>, status = 200) {
  vi.mocked(startPortalStateLoad).mockResolvedValue({
    kind: "ok",
    status,
    data,
  } as PortalStateResult);
}

// jsdom does no layout, so the waiver region reports zero heights. Giving it
// a scrollable box and firing a scroll to the bottom is the real unlock path.
function readWaiverToEnd() {
  const region = screen.getByRole("region", { name: "Waiver document" });
  Object.defineProperty(region, "scrollHeight", {
    configurable: true,
    value: 1000,
  });
  Object.defineProperty(region, "clientHeight", {
    configurable: true,
    value: 200,
  });
  region.scrollTop = 800;
  fireEvent.scroll(region);
}

function fillPacket(opts: { role?: "female" | "male" } = {}) {
  if (opts.role) {
    fireEvent.click(
      screen.getByLabelText(
        opts.role === "female" ? "Female contestant" : "Male contestant",
      ),
    );
  }
  fireEvent.change(screen.getByLabelText("Legal first name"), {
    target: { value: "Priya" },
  });
  fireEvent.change(screen.getByLabelText("Legal last name"), {
    target: { value: "Sharma" },
  });
  fireEvent.change(screen.getByLabelText("Email"), {
    target: { value: "priya@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Phone number"), {
    target: { value: "5551230100" },
  });
  readWaiverToEnd();
  fireEvent.change(screen.getByLabelText(SIGNATURE_LABEL), {
    target: { value: "Priya Sharma" },
  });
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("ContestantPortal", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal(
      "ResizeObserver",
      class {
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows an accessible loading state until the shared load resolves", async () => {
    vi.mocked(startPortalStateLoad).mockReturnValue(new Promise(() => {}));
    render(<ContestantPortal />);
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("renders the server error message when the load is rejected", async () => {
    loadResult({ error: "Link not found." }, 404);
    render(<ContestantPortal />);
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Link not found.",
    );
  });

  it("renders the expired view with home and shows links", async () => {
    loadResult({ state: "expired" });
    render(<ContestantPortal />);
    expect(
      await screen.findByRole("link", { name: "Upcoming Shows" }),
    ).toHaveAttribute("href", "/tickets");
    expect(screen.getByRole("link", { name: "Home" })).toHaveAttribute(
      "href",
      "/",
    );
  });

  it("renders the active prep guide with call time 45 minutes before showtime", async () => {
    loadResult({
      state: "active",
      firstName: "Priya",
      role: "female",
      showCity: "Brooklyn",
      showDate: "2026-11-01",
      showDisplayDate: "Sunday, November 1",
      startTime: "19:00",
      venueName: "The Venue",
    });
    render(<ContestantPortal />);
    expect(
      await screen.findByRole("heading", { name: "Welcome, Priya!" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Your prep guide for Brooklyn on Sunday, November 1/),
    ).toBeInTheDocument();
    expect(screen.getByText("Call time: 6:15 PM sharp.")).toBeInTheDocument();
    expect(screen.getByText("Arrive at The Venue.")).toBeInTheDocument();
  });

  it("falls back to generic active copy when no show is attached and the call time is malformed", async () => {
    loadResult({
      state: "active",
      firstName: "Dev",
      role: "male",
      startTime: "99:99",
    });
    render(<ContestantPortal />);
    expect(
      await screen.findByText(/Casting will send your exact call time/),
    ).toBeInTheDocument();
    expect(screen.getByText(/Your prep guide is unlocked/)).toBeInTheDocument();
  });

  it("locks the casting track for an invite and claims it with the invite id", async () => {
    loadResult({
      state: "invite",
      inviteId: "inv-1",
      role: "male",
      showCity: "Boston",
      showDate: "2026-11-08",
      showDisplayDate: "Sunday, November 8",
      startTime: "18:00",
      venueName: "Hall",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<ContestantPortal />);

    expect(await screen.findByText("Men contestants")).toBeInTheDocument();
    expect(screen.getByText("Call time: 5:15 PM sharp")).toBeInTheDocument();
    fillPacket();
    fireEvent.click(screen.getByRole("button", { name: /Complete Packet/ }));

    expect(
      await screen.findByRole("heading", { name: "Welcome, Priya!" }),
    ).toBeInTheDocument();
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/contestant-claim");
    const body = JSON.parse(String(init.body));
    expect(body.inviteId).toBe("inv-1");
    expect(body.signature).toBe("Priya Sharma");
    expect(mockReportFailure).not.toHaveBeenCalled();
  });

  it("lets a show-link visitor pick a role and claims against the show", async () => {
    loadResult({
      state: "show",
      showId: "show-9",
      showCity: "Austin",
      showDate: "2026-12-01",
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(new Response(JSON.stringify({ ok: true })));
    render(<ContestantPortal />);

    await screen.findByText(/Austin/);
    fillPacket({ role: "female" });
    fireEvent.click(screen.getByRole("button", { name: /Complete Packet/ }));

    await screen.findByRole("heading", { name: "Welcome, Priya!" });
    const [url, init] = fetchSpy.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("/api/contestant-show-claim");
    const body = JSON.parse(String(init.body));
    expect(body.showId).toBe("show-9");
    expect(body.role).toBe("female");
  });

  it("keeps submit disabled until a role is picked on the open form", async () => {
    loadResult({ state: "open" });
    render(<ContestantPortal />);
    await screen.findByLabelText("Female contestant");
    fillPacket();
    expect(
      screen.getByRole("button", { name: /Complete Packet/ }),
    ).toBeDisabled();
    fireEvent.click(screen.getByLabelText("Male contestant"));
    expect(
      screen.getByRole("button", { name: /Complete Packet/ }),
    ).not.toBeDisabled();
  });

  it("shows the curated server message and pages the producer when a claim is rejected", async () => {
    loadResult({ state: "open" });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "This link was already used." }), {
        status: 409,
      }),
    );
    render(<ContestantPortal />);
    await screen.findByLabelText("Female contestant");
    fillPacket({ role: "female" });
    fireEvent.click(screen.getByRole("button", { name: /Complete Packet/ }));

    await waitFor(() =>
      expect(alertText()).toContain("This link was already used."),
    );
    expect(mockReportFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "portal",
        stage: "claim",
        contact: expect.objectContaining({ email: "priya@example.com" }),
      }),
    );
  });

  it("never shows a raw network exception to the contestant", async () => {
    loadResult({ state: "open" });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(
      new TypeError("Failed to fetch"),
    );
    render(<ContestantPortal />);
    await screen.findByLabelText("Female contestant");
    fillPacket({ role: "male" });
    fireEvent.click(screen.getByRole("button", { name: /Complete Packet/ }));

    await waitFor(() => expect(mockReportFailure).toHaveBeenCalled());
    expect(alertText()).not.toContain("Failed to fetch");
    expect(alertText().trim()).not.toBe("");
  });

  it("flags a mismatched signature and keeps the agreement locked until the waiver is read", async () => {
    loadResult({ state: "open" });
    render(<ContestantPortal />);
    await screen.findByLabelText("Female contestant");
    expect(screen.getByRole("checkbox")).toBeDisabled();
    fireEvent.change(screen.getByLabelText("Legal first name"), {
      target: { value: "Priya" },
    });
    readWaiverToEnd();
    fireEvent.change(screen.getByLabelText(SIGNATURE_LABEL), {
      target: { value: "Someone Else" },
    });
    expect(
      screen.getByText("Signature must match your legal name above.", {
        selector: "[role=alert]",
      }),
    ).toBeInTheDocument();
  });
});
