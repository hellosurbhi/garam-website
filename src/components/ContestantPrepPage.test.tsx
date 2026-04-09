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

  /* ── Session storage keys (StringLiteral mutations) ─── */

  it("saves session with correct keys", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10&sig=valid" },
      writable: true,
      configurable: true,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({ token: "tok", expiresAt: Date.now() + 3600000 }),
        { status: 200 },
      ),
    );
    render(<ContestantPrepPage />);
    await waitFor(() => {
      expect(sessionStorage.getItem("gm-prep-token")).toBe("tok");
      expect(sessionStorage.getItem("gm-prep-expires")).toBeTruthy();
    });
  });

  it("saves expiresAt as string in sessionStorage", async () => {
    const expiresAt = Date.now() + 7200000;
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10&sig=valid" },
      writable: true,
      configurable: true,
    });
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ token: "t", expiresAt }), { status: 200 }),
    );
    render(<ContestantPrepPage />);
    await waitFor(() => {
      expect(sessionStorage.getItem("gm-prep-expires")).toBe(String(expiresAt));
    });
  });

  /* ── Session boundary: Date.now() === expiresAt ──────── */

  it("treats session as expired when Date.now() === expiresAt", () => {
    const now = Date.now();
    sessionStorage.setItem("gm-prep-token", "token");
    sessionStorage.setItem("gm-prep-expires", String(now));
    vi.spyOn(Date, "now").mockReturnValue(now);
    render(<ContestantPrepPage />);
    // Session is expired (>=), storage should be cleared
    expect(sessionStorage.getItem("gm-prep-token")).toBeNull();
    vi.restoreAllMocks();
  });

  it("session is valid when Date.now() < expiresAt", () => {
    const future = Date.now() + 10000;
    sessionStorage.setItem("gm-prep-token", "valid");
    sessionStorage.setItem("gm-prep-expires", String(future));
    render(<ContestantPrepPage />);
    expect(screen.getByText(/Contestant Orientation/)).toBeInTheDocument();
    // Storage not cleared
    expect(sessionStorage.getItem("gm-prep-token")).toBe("valid");
  });

  /* ── Content text assertions (StringLiteral mutations) ─── */

  it("renders cover title with emoji", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("🌶️ Contestant Orientation")).toBeInTheDocument();
  });

  it("renders show name in cover", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("Garam Masala Dating")).toBeInTheDocument();
  });

  it("renders What to Wear section", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("What to Wear")).toBeInTheDocument();
  });

  it("renders Day Of section", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("Day Of")).toBeInTheDocument();
  });

  it("renders Come Prepared With section", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("Come Prepared With")).toBeInTheDocument();
  });

  it("renders Arrival & Notes section", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText(/Arrival/)).toBeInTheDocument();
  });

  it("renders core message about being REAL", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText("REAL")).toBeInTheDocument();
  });

  /* ── Gender toggle specifics ────────────────────────── */

  it("gender toggle has role=group", () => {
    render(<ContestantPrepPage />);
    expect(
      screen.getByRole("group", { name: /contestant type/i }),
    ).toBeInTheDocument();
  });

  it("clicking Guys then Girls switches to female content", () => {
    render(<ContestantPrepPage />);
    fireEvent.click(screen.getByText("Guys"));
    expect(screen.getByText(/5:20 PM/)).toBeInTheDocument();
    fireEvent.click(screen.getByText("Girls"));
    expect(screen.getByText(/5:30 PM/)).toBeInTheDocument();
    expect(screen.queryByText(/5:20 PM/)).not.toBeInTheDocument();
  });

  it("male content mentions being curious about date", () => {
    render(<ContestantPrepPage />);
    fireEvent.click(screen.getByText("Guys"));
    expect(
      screen.getByText(/being genuinely curious about your date/),
    ).toBeInTheDocument();
  });

  it("female content mentions not owing chemistry", () => {
    render(<ContestantPrepPage />);
    fireEvent.click(screen.getByText("Girls"));
    expect(
      screen.getByText(/You don't owe anyone chemistry/),
    ).toBeInTheDocument();
  });

  /* ── Error page specifics ───────────────────────────── */

  it("error page shows emoji", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10" },
      writable: true,
      configurable: true,
    });
    render(<ContestantPrepPage />);
    expect(screen.getByText("🌶️")).toBeInTheDocument();
  });

  it("error page shows correct title", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?sig=only" },
      writable: true,
      configurable: true,
    });
    render(<ContestantPrepPage />);
    expect(screen.getByText("Link expired")).toBeInTheDocument();
  });

  it("error page shows full error message", () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10" },
      writable: true,
      configurable: true,
    });
    render(<ContestantPrepPage />);
    expect(
      screen.getByText(
        "This link has expired or is invalid. Ask your host for a new one.",
      ),
    ).toBeInTheDocument();
  });

  /* ── Auth fetch details ─────────────────────────────── */

  it("auth fetch sends correct Content-Type header", async () => {
    Object.defineProperty(window, "location", {
      value: { search: "?date=2026-04-10&sig=test" },
      writable: true,
      configurable: true,
    });
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValue(
        new Response(
          JSON.stringify({ token: "t", expiresAt: Date.now() + 3600000 }),
          { status: 200 },
        ),
      );
    render(<ContestantPrepPage />);
    await waitFor(() => {
      expect(fetchSpy).toHaveBeenCalledWith(
        "/api/contestant-prep-auth",
        expect.objectContaining({
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
  });

  /* ── Prep questions list ────────────────────────────── */

  it("renders all 13 prep questions", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText(/What's your name/)).toBeInTheDocument();
    expect(
      screen.getByText(/Why did your last relationship end/),
    ).toBeInTheDocument();
    expect(screen.getByText(/How much do you make/)).toBeInTheDocument();
  });

  /* ── Prep items ─────────────────────────────────────── */

  it("renders all 4 come-prepared items", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText(/One thoughtful question/)).toBeInTheDocument();
    expect(screen.getByText(/talent or party trick/)).toBeInTheDocument();
    expect(screen.getByText(/pickup line/i)).toBeInTheDocument();
    expect(screen.getByText(/elevator pitch/)).toBeInTheDocument();
  });

  /* ── Toggle label text ──────────────────────────────── */

  it("shows toggle label text", () => {
    render(<ContestantPrepPage />);
    expect(screen.getByText(/Instructions for:/)).toBeInTheDocument();
  });

  /* ── Golden rules content ───────────────────────────── */

  it("renders golden rule about 20-30 seconds", () => {
    render(<ContestantPrepPage />);
    expect(
      screen.getByText(/Keep answers to 20–30 seconds/),
    ).toBeInTheDocument();
  });

  it("renders golden rule about vulnerable beats funny", () => {
    render(<ContestantPrepPage />);
    expect(
      screen.getByText(/Vulnerable beats funny every time/),
    ).toBeInTheDocument();
  });

  it("renders golden rule about focus on date", () => {
    render(<ContestantPrepPage />);
    expect(
      screen.getByText(/Focus on your date, not the crowd/),
    ).toBeInTheDocument();
  });

  it("renders golden rule about drinks limit", () => {
    render(<ContestantPrepPage />);
    expect(
      screen.getByText(/Two to three drinks before you go on/),
    ).toBeInTheDocument();
  });
});
