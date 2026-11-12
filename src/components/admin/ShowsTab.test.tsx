import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
  within,
} from "@testing-library/react";
import {
  COMING_SOON,
  EDITOR,
  SHOWS_LIST,
  SHOWS_TOAST,
} from "@/data/adminShows";
import type { EventEntry, EventsSnapshot } from "@/data/eventsSnapshot";
import type { EventsAdminLoad } from "@/lib/eventsAdmin.server";
import AdminDashboard from "./AdminDashboard";
import ShowsTab from "./ShowsTab";

const tokenMock = vi.hoisted(() => vi.fn());

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
  getFirebaseAuth: vi.fn(() => ({
    currentUser: { getIdToken: tokenMock },
  })),
}));

// WHY: one test renders the whole AdminDashboard to switch tabs; its
// applicant lists read Firestore on mount. Empty answers are enough here.
vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  doc: vi.fn(),
  getDocs: vi.fn(async () => ({ docs: [] })),
  where: vi.fn(),
  query: vi.fn(),
  orderBy: vi.fn(),
  limit: vi.fn(),
  startAfter: vi.fn(),
}));

// ── Fixtures (never production data) ─────────────────────────────────────

function fixtureShow(overrides: Partial<EventEntry> = {}): EventEntry {
  return {
    date: "Jan 9",
    city: "Chicago",
    state: "Illinois",
    stateAbbr: "IL",
    citySlug: "chicago",
    slug: "chicago-2099-01-09",
    description: "Garam Masala Dating comes to Chicago.",
    lineup: ["surbhi", "wyatt"],
    ticketSource: "our-eventbrite",
    url: "https://www.eventbrite.com/e/garam-masala-dating-chicago-tickets-123",
    isoDate: "2099-01-09",
    startTime: "19:00",
    endTime: "21:00",
    venue: {
      name: "Lincoln Lodge",
      addressLocality: "Chicago",
      addressRegion: "IL",
      addressCountry: "US",
    },
    price: "25",
    eventbriteId: "123",
    timezone: "America/Chicago",
    updatedAt: "2026-11-11T20:00:00.000Z",
    ...overrides,
  };
}

const austin = fixtureShow({
  date: "Feb 1",
  city: "Austin",
  state: "Texas",
  stateAbbr: "TX",
  citySlug: "austin",
  slug: "austin-2099-02-01",
  isoDate: "2099-02-01",
  venue: undefined,
});

const live: EventsSnapshot = { events: [fixtureShow()], tbaCities: [] };
const draft: EventsSnapshot = {
  events: [fixtureShow(), austin],
  tbaCities: [],
};
const noChanges = {
  added: [],
  changed: [],
  canceled: [],
  tbaCitiesAdded: [],
  tbaCitiesChanged: [],
  tbaCitiesRemoved: [],
};

function adminLoad(): EventsAdminLoad {
  return {
    live: {
      version: 3,
      snapshot: live,
      publishedAt: "2026-11-10T20:00:00.000Z",
      rebuild: null,
    },
    draft: {
      snapshot: draft,
      basedOnVersion: 3,
      updatedAt: "2026-11-11T10:00:00.000Z",
      updatedBy: "owner@example.test",
      updateTime: "2026-11-11T10:00:00.123456Z",
      changes: { ...noChanges, added: [austin.slug] },
    },
    history: [3, 2].map((version) => ({
      version,
      kind: "publish" as const,
      note: `Fixture version ${version}`,
      authorUid: "uid",
      authorEmail: "owner@example.test",
      createdAt: "2026-11-10T20:00:00.000Z",
      changes: noChanges,
    })),
    cities: [
      { slug: "chicago", name: "Chicago", region: "IL" },
      { slug: "austin", name: "Austin", region: "TX" },
    ],
    waitlist: {
      live: { datedSlugs: [], cities: [] },
      draft: { datedSlugs: [], cities: [] },
    },
  };
}

// ── fetch stub ────────────────────────────────────────────────────────────

const fetchMock = vi.fn();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function routeFetch(
  loadStatus = 200,
  writes: Record<string, () => Response | Promise<Response>> = {},
) {
  fetchMock.mockImplementation(async (path: string) => {
    if (path === "/api/version") return json(200, { eventsVersion: 3 });
    if (path === "/api/admin/events") {
      return loadStatus === 200
        ? json(200, adminLoad())
        : json(loadStatus, { error: "Unauthorized" });
    }
    const write = writes[path];
    if (write) return write();
    return json(200, { version: 4, rebuild: "requested", changes: noChanges });
  });
}

/** The parsed bodies of every call to `path`. */
function callsTo(path: string): unknown[] {
  return fetchMock.mock.calls
    .filter(([p]) => p === path)
    .map(([, init]) => JSON.parse((init as RequestInit).body as string));
}

// WHY: jsdom has no showModal/close, so the shared Modal's <dialog> stays
// closed and everything inside it is hidden from getByRole. These two
// stand in for the browser's open attribute toggling, nothing more.
const dialogProto = HTMLDialogElement.prototype;
const nativeShowModal = dialogProto.showModal;
const nativeClose = dialogProto.close;

beforeEach(() => {
  tokenMock.mockReset();
  tokenMock.mockResolvedValue("tok");
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
  dialogProto.showModal = function showModal(this: HTMLDialogElement) {
    this.setAttribute("open", "");
  };
  dialogProto.close = function close(this: HTMLDialogElement) {
    this.removeAttribute("open");
  };
});

afterEach(() => {
  cleanup(); // unmount while the stand-in close() still exists
  vi.unstubAllGlobals();
  dialogProto.showModal = nativeShowModal;
  dialogProto.close = nativeClose;
});

describe("ShowsTab", () => {
  it("shows the denied state when the routes answer 401", async () => {
    routeFetch(401);
    render(<ShowsTab />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/can't manage shows/);
    expect(screen.queryByText("Add show")).toBeNull();
  });

  it("publish asks for confirmation naming the changes, then posts the note", async () => {
    routeFetch();
    render(<ShowsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));

    expect(screen.getByText("Publish these changes?")).toBeTruthy();
    expect(screen.getByText("New shows")).toBeTruthy();
    expect(screen.getByText("Austin, Feb 1")).toBeTruthy();
    expect(callsTo("/api/admin/events/publish")).toHaveLength(0);

    // No note yet: the dialog refuses and says why.
    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    expect(screen.getByRole("alert").textContent).toMatch(/short note/);
    expect(callsTo("/api/admin/events/publish")).toHaveLength(0);

    fireEvent.change(screen.getByLabelText("What changed and why"), {
      target: { value: "Austin is booked" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/publish")).toEqual([
        {
          expectedVersion: 3,
          // Names the draft the confirmation showed, so a later save is refused.
          expectedDraftUpdateTime: "2026-11-11T10:00:00.123456Z",
          note: "Austin is booked",
        },
      ]),
    );
  });

  it("blocks a bad ticket link inline and never sends the draft", async () => {
    routeFetch();
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    const url = screen.getByLabelText("Ticket link");
    fireEvent.change(url, { target: { value: "http://example.com/tickets" } });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));

    await waitFor(() => expect(url.getAttribute("aria-invalid")).toBe("true"));
    const errorId = url.getAttribute("aria-describedby") ?? "";
    const error = document.getElementById(errorId.split(" ")[0]);
    expect(error?.getAttribute("role")).toBe("alert");
    expect(error?.textContent).toBeTruthy();
    expect(callsTo("/api/admin/events/draft")).toHaveLength(0);
  });

  it("restore posts the target and the expected live version", async () => {
    routeFetch();
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Version history" }),
    );
    expect(screen.queryByRole("button", { name: "Restore version 3" })).toBe(
      null,
    );
    fireEvent.click(screen.getByRole("button", { name: "Restore version 2" }));
    fireEvent.change(screen.getByLabelText("What changed and why"), {
      target: { value: "Back to the old list" },
    });
    // The history row and the dialog's confirm share the label; the
    // dialog renders last.
    const restores = screen.getAllByRole("button", {
      name: "Restore version 2",
    });
    fireEvent.click(restores[restores.length - 1]);
    await waitFor(() =>
      expect(callsTo("/api/admin/events/rollback")).toEqual([
        {
          targetVersion: 2,
          expectedVersion: 3,
          // The draft the confirmation was shown over: a save after it
          // opened makes the server refuse the restore instead of losing it.
          expectedDraftUpdateTime: "2026-11-11T10:00:00.123456Z",
          note: "Back to the old list",
        },
      ]),
    );
  });
  it("shows the denied state when the load answers 403", async () => {
    routeFetch(403);
    render(<ShowsTab />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/can't manage shows/);
    expect(screen.queryByText("Add show")).toBeNull();
  });

  it("denies the whole tab when a publish answers 403", async () => {
    routeFetch(200, {
      "/api/admin/events/publish": () => json(403, { error: "Forbidden" }),
    });
    render(<ShowsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    fireEvent.change(screen.getByLabelText("What changed and why"), {
      target: { value: "Austin is booked" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    await waitFor(() =>
      expect(screen.getByRole("alert").textContent).toMatch(
        /can't manage shows/,
      ),
    );
    expect(screen.queryByText("Add show")).toBeNull();
  });

  it("shows the error and a retry when the token refresh fails on load", async () => {
    routeFetch();
    tokenMock.mockRejectedValue(new Error("auth/network-request-failed"));
    render(<ShowsTab />);
    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toMatch(/Couldn't reach the server/);
    expect(screen.getByRole("button", { name: "Try again" })).toBeTruthy();
  });

  it("frees the buttons when the token refresh fails during a publish", async () => {
    routeFetch();
    render(<ShowsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    fireEvent.change(screen.getByLabelText("What changed and why"), {
      target: { value: "Austin is booked" },
    });
    tokenMock.mockRejectedValue(new Error("auth/network-request-failed"));
    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    await waitFor(() =>
      expect(
        screen
          .getByRole("button", { name: "Publish now" })
          .hasAttribute("disabled"),
      ).toBe(false),
    );
    expect(screen.getByText(/Couldn't reach the server/)).toBeTruthy();
    expect(callsTo("/api/admin/events/publish")).toHaveLength(0);
  });

  it("closes the editor after a 409 so stale values are never sent again", async () => {
    let version = 3;
    routeFetch(200, {
      "/api/admin/events/draft": () => json(409, { error: "Conflict" }),
    });
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      // After the conflict, the reload sees another admin's version 4.
      if (path === "/api/admin/events" && version === 4) {
        const next = adminLoad();
        next.live.version = 4;
        next.live.snapshot = {
          events: [fixtureShow({ price: "35" })],
          tbaCities: [],
        };
        next.draft = null;
        return json(200, next);
      }
      if (path === "/api/admin/events/draft") version = 4;
      return base?.(path, init);
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Card tagline"), {
      target: { value: "Back by demand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));

    // Wait for the reload that follows the conflict, then check the editor.
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([p]) => p === "/api/admin/events"),
      ).toHaveLength(2),
    );
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Edit Chicago, Jan 9" }),
      ).toBeNull(),
    );
    expect(screen.getByText(/nothing was saved/)).toBeTruthy();
    expect(callsTo("/api/admin/events/draft")).toHaveLength(1);
  });
  it("drops an open editor when a rebuild reload brings a newer live version", async () => {
    let finishRebuild: (res: Response) => void = () => {};
    let version = 3;
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events/rebuild") {
        return new Promise<Response>((resolve) => {
          finishRebuild = (res) => {
            version = 4;
            resolve(res);
          };
        });
      }
      if (path === "/api/admin/events" && version === 4) {
        const next = adminLoad();
        next.live.version = 4;
        next.draft = null;
        return json(200, next);
      }
      return base?.(path, init);
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Rebuild site" }),
    );
    // The rebuild is still running; the show rows stay clickable.
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Card tagline"), {
      target: { value: "Typed before the reload" },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([p]) => p === "/api/admin/events/rebuild"),
      ).toHaveLength(1),
    );
    finishRebuild(json(200, { version: 4, rebuild: "requested" }));

    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Edit Chicago, Jan 9" }),
      ).toBeNull(),
    );
    expect(screen.getByText(EDITOR.stale)).toBeTruthy();
    expect(callsTo("/api/admin/events/draft")).toHaveLength(0);
  });

  it("drops an open editor when a reload brings a draft another admin saved", async () => {
    let finishRebuild: (res: Response) => void = () => {};
    let otherAdminSaved = false;
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events/rebuild") {
        return new Promise<Response>((resolve) => {
          finishRebuild = (res) => {
            otherAdminSaved = true;
            resolve(res);
          };
        });
      }
      if (path === "/api/admin/events" && otherAdminSaved) {
        // Same live version, but another admin saved price 35 meanwhile.
        const next = adminLoad();
        if (next.draft) {
          next.draft.snapshot = {
            ...draft,
            events: [fixtureShow({ price: "35" }), austin],
          };
          next.draft.updateTime = "2026-11-11T10:07:00.000000Z";
        }
        return json(200, next);
      }
      return base?.(path, init);
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Rebuild site" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    expect(screen.getByLabelText<HTMLInputElement>(EDITOR.price).value).toBe(
      "25",
    );
    fireEvent.change(screen.getByLabelText("Card tagline"), {
      target: { value: "Typed before the reload" },
    });
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.filter(([p]) => p === "/api/admin/events/rebuild"),
      ).toHaveLength(1),
    );
    finishRebuild(json(200, { version: 3, rebuild: "requested" }));

    // The editor still holds price 25; saving it would undo the other
    // admin's 35, so it is set aside instead of re-based on the new draft.
    await waitFor(() =>
      expect(
        screen.queryByRole("heading", { name: "Edit Chicago, Jan 9" }),
      ).toBeNull(),
    );
    expect(screen.getByText(EDITOR.stale)).toBeTruthy();
    expect(callsTo("/api/admin/events/draft")).toHaveLength(0);
  });

  it("shows a failed save inside the open editor", async () => {
    routeFetch();
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Card tagline"), {
      target: { value: "Back by demand" },
    });
    tokenMock.mockRejectedValue(new Error("auth/network-request-failed"));
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toMatch(
        /Couldn't reach the server/,
      ),
    );
  });

  it("opens no editor while a save is still out, so it cannot undo that save", async () => {
    let finishSave: (res: Response) => void = () => {};
    let saved = false;
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events/draft" && !saved) {
        return new Promise<Response>((resolve) => {
          finishSave = (res) => {
            saved = true;
            resolve(res);
          };
        });
      }
      if (path === "/api/admin/events" && saved) {
        const next = adminLoad();
        if (next.draft) {
          next.draft.snapshot = {
            ...draft,
            events: [fixtureShow({ price: "35" }), austin],
          };
        }
        return json(200, next);
      }
      return base?.(path, init);
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Ticket price in USD"), {
      target: { value: "35" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(1),
    );
    // The admin closes the editor while the price save is still out.
    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", {
        name: "Close",
      })[0],
    );
    const edit = screen.getByRole("button", { name: "Edit Chicago, Jan 9" });
    expect((edit as HTMLButtonElement).disabled).toBe(true);
    fireEvent.click(edit);
    expect(screen.queryByLabelText("Card tagline")).toBeNull();

    finishSave(json(200, { basedOnVersion: 3, changes: noChanges }));
    await waitFor(() =>
      expect((edit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(edit);
    fireEvent.change(screen.getByLabelText("Card tagline"), {
      target: { value: "Back by demand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(2),
    );
    const second = callsTo("/api/admin/events/draft")[1] as {
      snapshot: { events: Array<{ slug: string; price?: string }> };
    };
    // The reopened editor starts from the saved draft, so 35 stays.
    expect(
      second.snapshot.events.find((e) => e.slug === "chicago-2099-01-09")
        ?.price,
    ).toBe("35");
  });

  it("locks the editor's fields while its save is out, so no typing is lost", async () => {
    let finishSave: (res: Response) => void = () => {};
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events/draft")
        return new Promise<Response>((resolve) => (finishSave = resolve));
      return base?.(path, init);
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Ticket price in USD"), {
      target: { value: "35" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(1),
    );
    for (const label of ["Card tagline", "Ticket price in USD"])
      expect(
        (screen.getByLabelText(label) as HTMLInputElement).matches(":disabled"),
      ).toBe(true);
    finishSave(json(200, { basedOnVersion: 3, changes: noChanges }));
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  });

  it("labels a dated show that gets a Notify Me card the way /tickets shows it", async () => {
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events") {
        const next = adminLoad();
        if (next.draft) {
          next.draft.snapshot = {
            ...draft,
            events: [
              fixtureShow({
                ticketSource: "none",
                url: "",
                eventbriteId: undefined,
              }),
              austin,
            ],
          };
        }
        next.waitlist.draft = {
          datedSlugs: ["chicago-2099-01-09"],
          cities: ["Chicago", "Dallas"],
        };
        return json(200, next);
      }
      return base?.(path, init);
    });
    render(<ShowsTab />);
    expect(await screen.findByText(SHOWS_LIST.notifyCard)).toBeTruthy();
    expect(screen.queryByText(SHOWS_LIST.hidden)).toBeNull();
    expect(
      screen.getByText(COMING_SOON.notifyNow(["Chicago", "Dallas"])),
    ).toBeTruthy();
  });

  it("keeps editing locked while a save is out, even when a rebuild settles first", async () => {
    let finishRebuild: (res: Response) => void = () => {};
    let finishSave: (res: Response) => void = () => {};
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events/rebuild") {
        return new Promise<Response>((resolve) => (finishRebuild = resolve));
      }
      if (path === "/api/admin/events/draft") {
        return new Promise<Response>((resolve) => (finishSave = resolve));
      }
      return base?.(path, init);
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Rebuild site" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Ticket price in USD"), {
      target: { value: "35" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(1),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", {
        name: "Close",
      })[0],
    );
    // The rebuild settles first; the price save is still out.
    finishRebuild(json(200, { version: 3, rebuild: "requested" }));
    await waitFor(() =>
      expect(screen.getByText(SHOWS_TOAST.rebuildStarted)).toBeTruthy(),
    );
    const edit = screen.getByRole("button", { name: "Edit Chicago, Jan 9" });
    expect((edit as HTMLButtonElement).disabled).toBe(true);

    finishSave(json(200, { basedOnVersion: 3, changes: noChanges }));
    await waitFor(() =>
      expect((edit as HTMLButtonElement).disabled).toBe(false),
    );
  });

  it("shows an untouched on-sale time in a newly picked zone and saves it unchanged", async () => {
    const onSaleAt = "2099-01-01T01:00:00.000Z"; // 19:00 in Chicago on Dec 31
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events") {
        const next = adminLoad();
        if (next.draft) {
          next.draft.snapshot = {
            ...draft,
            events: [fixtureShow({ onSaleAt }), austin],
          };
        }
        return json(200, next);
      }
      return base?.(path, init);
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    const onSale = screen.getByLabelText(
      "Tickets go on sale (show's local time)",
    ) as HTMLInputElement;
    expect(onSale.value).toBe("2098-12-31T19:00");

    fireEvent.change(screen.getByLabelText("Time zone"), {
      target: { value: "America/New_York" },
    });
    // The same instant, shown as New York's clock, matches what is saved.
    expect(onSale.value).toBe("2098-12-31T20:00");
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(1),
    );
    const sent = callsTo("/api/admin/events/draft")[0] as {
      snapshot: { events: Array<{ slug: string; onSaleAt?: string }> };
    };
    expect(
      sent.snapshot.events.find((e) => e.slug === "chicago-2099-01-09")
        ?.onSaleAt,
    ).toBe(onSaleAt);
  });

  it("shows a failed publish inside the open confirm dialog", async () => {
    routeFetch(200, {
      "/api/admin/events/publish": () => json(500, { error: "Publish broke" }),
    });
    render(<ShowsTab />);
    fireEvent.click(await screen.findByRole("button", { name: "Publish" }));
    fireEvent.change(screen.getByLabelText("What changed and why"), {
      target: { value: "Austin is booked" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Publish now" }));
    const dialog = screen.getByRole("dialog");
    await waitFor(() =>
      expect(within(dialog).getByRole("alert").textContent).toMatch(
        /Publish broke/,
      ),
    );
  });

  it("still reports a failed rebuild when no dialog is open", async () => {
    routeFetch(200, {
      "/api/admin/events/rebuild": () => json(500, { error: "Rebuild broke" }),
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Rebuild site" }),
    );
    expect(await screen.findByText("Rebuild broke")).toBeTruthy();
  });

  it("links a checkbox error to its checkbox", async () => {
    routeFetch();
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Ticket link"), {
      target: { value: "" },
    });
    const soldOut = screen.getByLabelText("Sold out");
    fireEvent.click(soldOut);
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));

    await waitFor(() =>
      expect(soldOut.getAttribute("aria-invalid")).toBe("true"),
    );
    const error = document.getElementById(
      soldOut.getAttribute("aria-describedby") ?? "",
    );
    expect(error?.getAttribute("role")).toBe("alert");
    expect(error?.textContent).toMatch(/sold out show needs its link/);
  });

  it("links the lineup error to its group and both checkboxes", async () => {
    routeFetch();
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    const boxes = [
      screen.getByLabelText("Surbhi"),
      screen.getByLabelText("Wyatt Feegrado"),
    ];
    for (const box of boxes) fireEvent.click(box);
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));

    const group = await screen.findByRole("group", { name: "On stage" });
    await waitFor(() =>
      expect(group.getAttribute("aria-describedby")).toBeTruthy(),
    );
    const errorId = group.getAttribute("aria-describedby") ?? "";
    expect(document.getElementById(errorId)?.getAttribute("role")).toBe(
      "alert",
    );
    for (const box of boxes) {
      expect(box.getAttribute("aria-invalid")).toBe("true");
      expect(box.getAttribute("aria-describedby")).toBe(errorId);
    }
  });

  it("never lets an older reload overwrite a newer one, so a save is not undone", async () => {
    let finishRebuild: (res: Response) => void = () => {};
    let finishSave: (res: Response) => void = () => {};
    let finishOldReload: () => void = () => {};
    let loads = 0;
    const priced = (price: string) => {
      const next = adminLoad();
      if (next.draft) {
        next.draft.snapshot = {
          ...draft,
          events: [fixtureShow({ price }), austin],
        };
      }
      return json(200, next);
    };
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events/rebuild") {
        return new Promise<Response>((resolve) => (finishRebuild = resolve));
      }
      if (path === "/api/admin/events/draft") {
        if (callsTo(path).length > 1) return base?.(path, init);
        return new Promise<Response>((resolve) => (finishSave = resolve));
      }
      if (path === "/api/admin/events") {
        loads += 1;
        // The rebuild's reload (the second load) read the draft before the
        // save landed and answers last, after the save's reload.
        if (loads === 2) {
          return new Promise<Response>(
            (resolve) => (finishOldReload = () => resolve(priced("25"))),
          );
        }
        return priced(loads === 1 ? "25" : "35");
      }
      return base?.(path, init);
    });
    render(<ShowsTab />);
    fireEvent.click(
      await screen.findByRole("button", { name: "Rebuild site" }),
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Ticket price in USD"), {
      target: { value: "35" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(1),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", {
        name: "Close",
      })[0],
    );
    finishRebuild(json(200, { version: 3, rebuild: "requested" }));
    await waitFor(() => expect(loads).toBe(2));
    finishSave(json(200, { basedOnVersion: 3, changes: noChanges }));
    await waitFor(() => expect(loads).toBe(3));
    finishOldReload();
    await waitFor(() =>
      expect(screen.getByText(SHOWS_TOAST.rebuildStarted)).toBeTruthy(),
    );
    const edit = screen.getByRole("button", { name: "Edit Chicago, Jan 9" });
    await waitFor(() =>
      expect((edit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(edit);
    fireEvent.change(screen.getByLabelText("Card tagline"), {
      target: { value: "Back by demand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(2),
    );
    const second = callsTo("/api/admin/events/draft")[1] as {
      snapshot: { events: Array<{ slug: string; price?: string }> };
    };
    expect(
      second.snapshot.events.find((e) => e.slug === "chicago-2099-01-09")
        ?.price,
    ).toBe("35");
  });

  it("previews the tickets page on the UTC day the public pages use", async () => {
    const zone = process.env.TZ;
    // WHY only Date: waitFor and the fetch stub still need real timers.
    vi.useFakeTimers({ toFake: ["Date"] });
    // 8pm on Nov 11 in New York is already Nov 12 in UTC, so the public
    // pages (which use the UTC day) no longer list a Nov 11 show.
    process.env.TZ = "America/New_York";
    vi.setSystemTime(new Date("2026-11-12T01:00:00Z"));
    try {
      const nov11 = fixtureShow({
        date: "Nov 11",
        isoDate: "2026-11-11",
        slug: "chicago-2026-11-11",
      });
      routeFetch();
      const base = fetchMock.getMockImplementation();
      fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
        if (path === "/api/admin/events") {
          const next = adminLoad();
          if (next.draft) {
            next.draft.snapshot = { ...draft, events: [nov11] };
          }
          return json(200, next);
        }
        return base?.(path, init);
      });
      render(<ShowsTab />);
      expect(await screen.findByText(SHOWS_LIST.past)).toBeTruthy();
      expect(screen.queryByText(SHOWS_LIST.listed)).toBeNull();
    } finally {
      vi.useRealTimers();
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("keeps a save's editing lock when the admin leaves the Shows tab and returns", async () => {
    let finishSave: (res: Response) => void = () => {};
    let saved = false;
    routeFetch();
    const base = fetchMock.getMockImplementation();
    fetchMock.mockImplementation(async (path: string, init?: RequestInit) => {
      if (path === "/api/admin/events/draft") {
        if (callsTo(path).length > 1) return base?.(path, init);
        return new Promise<Response>((resolve) => {
          finishSave = (res) => {
            saved = true;
            resolve(res);
          };
        });
      }
      if (path === "/api/admin/events" && saved) {
        const next = adminLoad();
        if (next.draft) {
          next.draft.snapshot = {
            ...draft,
            events: [fixtureShow({ price: "35" }), austin],
          };
          next.draft.updateTime = "2026-11-11T10:05:00.000000Z";
        }
        return json(200, next);
      }
      return base?.(path, init);
    });
    render(<AdminDashboard onLogout={() => {}} />);
    fireEvent.click(screen.getByRole("button", { name: "Shows" }));
    fireEvent.click(
      await screen.findByRole("button", { name: "Edit Chicago, Jan 9" }),
    );
    fireEvent.change(screen.getByLabelText("Ticket price in USD"), {
      target: { value: "35" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(1),
    );
    fireEvent.click(
      within(screen.getByRole("dialog")).getAllByRole("button", {
        name: "Close",
      })[0],
    );
    // Leave the Shows tab and come back while the price save is still out.
    fireEvent.click(screen.getByRole("button", { name: /Applicants/ }));
    fireEvent.click(screen.getByRole("button", { name: "Shows" }));
    const edit = await screen.findByRole("button", {
      name: "Edit Chicago, Jan 9",
    });
    expect((edit as HTMLButtonElement).disabled).toBe(true);

    finishSave(json(200, { basedOnVersion: 3, changes: noChanges }));
    await waitFor(() =>
      expect((edit as HTMLButtonElement).disabled).toBe(false),
    );
    fireEvent.click(edit);
    fireEvent.change(screen.getByLabelText("Card tagline"), {
      target: { value: "Back by demand" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save to draft" }));
    await waitFor(() =>
      expect(callsTo("/api/admin/events/draft")).toHaveLength(2),
    );
    const [first, second] = callsTo("/api/admin/events/draft") as Array<{
      expectedDraftUpdateTime: string | null;
      snapshot: { events: Array<{ slug: string; price?: string }> };
    }>;
    // Each save names the draft it was built on, so the server can refuse
    // a stale one; the second builds on the saved draft and keeps 35.
    expect(first.expectedDraftUpdateTime).toBe(adminLoad().draft?.updateTime);
    expect(second.expectedDraftUpdateTime).toBe("2026-11-11T10:05:00.000000Z");
    expect(
      second.snapshot.events.find((e) => e.slug === "chicago-2099-01-09")
        ?.price,
    ).toBe("35");
  });
});
