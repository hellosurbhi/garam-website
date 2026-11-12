import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  cleanup,
  render,
  screen,
  fireEvent,
  waitFor,
} from "@testing-library/react";
import type { EventEntry, EventsSnapshot } from "@/data/eventsSnapshot";
import type { EventsAdminLoad } from "@/lib/eventsAdmin.server";
import ShowsTab from "./ShowsTab";

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(() => ({
    currentUser: { getIdToken: vi.fn().mockResolvedValue("tok") },
  })),
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
  };
}

// ── fetch stub ────────────────────────────────────────────────────────────

const fetchMock = vi.fn();

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

function routeFetch(loadStatus = 200) {
  fetchMock.mockImplementation(async (path: string) => {
    if (path === "/api/version") return json(200, { eventsVersion: 3 });
    if (path === "/api/admin/events") {
      return loadStatus === 200
        ? json(200, adminLoad())
        : json(loadStatus, { error: "Unauthorized" });
    }
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
        { expectedVersion: 3, note: "Austin is booked" },
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
        { targetVersion: 2, expectedVersion: 3, note: "Back to the old list" },
      ]),
    );
  });
});
