import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

vi.mock("./ContestantPrepPage.module.css", () => ({
  default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

import ContestantPrepPage from "./ContestantPrepPage";

describe("ContestantPrepPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sessionStorage.clear();
    Object.defineProperty(window, "location", {
      value: { search: "" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    sessionStorage.clear();
  });

  /* ── No params, no session → authed (open access) ────── */

  it("renders prep guide when no params and no session", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText(/Contestant Orientation/)).toBeInTheDocument();
  });

  it("renders golden rules section in prep guide", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("The Golden Rules")).toBeInTheDocument();
  });

  it("renders questions section", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("Questions You May Be Asked")).toBeInTheDocument();
  });

  /* ── Valid session → authed ────────────────────────────── */

  it("renders prep guide when valid session exists", () => {
    sessionStorage.setItem("gm-prep-token", "valid-token");
    sessionStorage.setItem("gm-prep-expires", String(Date.now() + 3600000));
    render(<ContestantPrepPage />);
    expect(screen.getByText(/Contestant Orientation/)).toBeInTheDocument();
  });

  /* ── Expired session → no session, falls through ──────── */

  it("clears expired session from storage", () => {
    sessionStorage.setItem("gm-prep-token", "old-token");
    sessionStorage.setItem("gm-prep-expires", String(Date.now() - 1000));
    // Expired session → getSession() returns null → no params → "authed"
    render(<ContestantPrepPage />);
    expect(sessionStorage.getItem("gm-prep-token")).toBeNull();
    expect(sessionStorage.getItem("gm-prep-expires")).toBeNull();
  });

  /* ── Incomplete params → error ─────────────────────────── */

  it("shows error when only date param is present (no sig)", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10" },
      writable: true,
      configurable: true,
    });
    render(<ContestantPrepPage />);
    expect(screen.getByText("Link expired")).toBeInTheDocument();
  });

  it("shows error when only sig param is present (no date)", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?sig=abc123" },
      writable: true,
      configurable: true,
    });
    render(<ContestantPrepPage />);
    expect(screen.getByText("Link expired")).toBeInTheDocument();
  });

  /* ── Both params → checking → authed on success ────────── */

  it("shows loading then authed on successful auth", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10&sig=valid-sig" },
      writable: true,
      configurable: true,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "new-token",
          expiresAt: Date.now() + 3600000,
        }),
        { status: 200 },
      ),
    );

    render(<ContestantPrepPage />);

    await waitFor(() => {
      expect(screen.getByText(/Contestant Orientation/)).toBeInTheDocument();
    });

    // Session was saved
    expect(sessionStorage.getItem("gm-prep-token")).toBe("new-token");
  });

  it("shows error on failed auth response", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10&sig=bad-sig" },
      writable: true,
      configurable: true,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response("Unauthorized", { status: 401 }),
    );

    render(<ContestantPrepPage />);

    await waitFor(() => {
      expect(screen.getByText("Link expired")).toBeInTheDocument();
    });
  });

  it("shows error on network failure", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10&sig=valid" },
      writable: true,
      configurable: true,
    });
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("Network error"));

    render(<ContestantPrepPage />);

    await waitFor(() => {
      expect(screen.getByText("Link expired")).toBeInTheDocument();
    });
  });

  it("calls auth endpoint with correct params", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10&sig=test-sig" },
      writable: true,
      configurable: true,
    });
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          token: "t",
          expiresAt: Date.now() + 3600000,
        }),
        { status: 200 },
      ),
    );

    render(<ContestantPrepPage />);

    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/contestant-prep-auth",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ date: "2026-04-10", sig: "test-sig" }),
        }),
      );
    });
  });

  /* ── PrepGuide gender toggle ──────────────────────────── */

  it("shows gender toggle buttons", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("Guys")).toBeInTheDocument();
    expect(screen.getByText("Girls")).toBeInTheDocument();
  });

  it("does not show arrival instructions before gender selection", () => {
    render(<ContestantPrepPage />);
    expect(screen.queryByText(/Arrive by/)).not.toBeInTheDocument();
  });

  it("shows male arrival time when Guys is clicked", () => {
    render(<ContestantPrepPage />);
    fireEvent.click(screen.getByText("Guys"));
    expect(screen.getByText(/Arrive by 5:20 PM sharp/)).toBeInTheDocument();
  });

  it("shows female arrival time when Girls is clicked", () => {
    render(<ContestantPrepPage />);
    fireEvent.click(screen.getByText("Girls"));
    expect(screen.getByText(/Arrive by 5:30 PM sharp/)).toBeInTheDocument();
  });

  it("shows male-specific advice for guys", () => {
    render(<ContestantPrepPage />);
    fireEvent.click(screen.getByText("Guys"));
    expect(
      screen.getByText(/Arrive 15 minutes before the girls/),
    ).toBeInTheDocument();
  });

  it("shows female-specific advice for girls", () => {
    render(<ContestantPrepPage />);
    fireEvent.click(screen.getByText("Girls"));
    expect(
      screen.getByText(/Arrive 15 minutes after the guys/),
    ).toBeInTheDocument();
  });

  /* ── Error page content ──────────────────────────────── */

  it("error page shows contact message", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10" },
      writable: true,
      configurable: true,
    });
    render(<ContestantPrepPage />);
    expect(screen.getByText(/Ask your host for a new one/)).toBeInTheDocument();
  });

  /* ── Session NaN expires ─────────────────────────────── */

  it("treats NaN expires as expired session", () => {
    sessionStorage.setItem("gm-prep-token", "token");
    sessionStorage.setItem("gm-prep-expires", "not-a-number");
    // NaN expires → getSession() returns null → cleans up → no params → authed
    render(<ContestantPrepPage />);
    expect(sessionStorage.getItem("gm-prep-token")).toBeNull();
  });

  /* ── PrepGuide footer ───────────────────────────────── */

  it("renders footer text", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText(/See you on stage/)).toBeInTheDocument();
  });
});
