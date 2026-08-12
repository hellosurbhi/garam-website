import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  MODAL_OPEN_DEADLINE_MS,
  installInitFailureFallback,
  reportWidgetFailure,
  watchModalOpenAfterClick,
} from "./eventbriteRecovery";
import { capture } from "@/lib/analyticsCapture";
import { navigateTo } from "@/lib/navigation";

vi.mock("@/lib/analyticsCapture", () => ({
  capture: vi.fn(),
}));
// jsdom's window.location is unforgeable (see src/lib/navigation.ts), so
// navigation is asserted through the seam module instead.
vi.mock("@/lib/navigation", () => ({
  navigateTo: vi.fn(),
}));

const captureMock = vi.mocked(capture);
const assignSpy = vi.mocked(navigateTo);
const FALLBACK_URL = "https://www.eventbrite.com/e/123?aff=site";
const FAILURE_PROPS = { event_id: "123", city: "NYC" };

function insertModal(): HTMLDivElement {
  const modal = document.createElement("div");
  modal.className = "eds-structure_main";
  document.body.appendChild(modal);
  return modal;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  captureMock.mockReset();
  assignSpy.mockReset();
  document.body.innerHTML = "";
});

describe("reportWidgetFailure", () => {
  it("captures widget_load_failed with the given props", () => {
    reportWidgetFailure(FAILURE_PROPS);
    expect(captureMock).toHaveBeenCalledExactlyOnceWith(
      "widget_load_failed",
      FAILURE_PROPS,
    );
  });
});

describe("watchModalOpenAfterClick", () => {
  it("recovers same-tab when the modal never appears", async () => {
    watchModalOpenAfterClick({
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    await vi.advanceTimersByTimeAsync(MODAL_OPEN_DEADLINE_MS);

    expect(captureMock).toHaveBeenCalledExactlyOnceWith(
      "widget_load_failed",
      FAILURE_PROPS,
    );
    expect(assignSpy).toHaveBeenCalledExactlyOnceWith(FALLBACK_URL);
  });

  it("does nothing when the modal appears and stays open", async () => {
    watchModalOpenAfterClick({
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    insertModal();
    await vi.advanceTimersByTimeAsync(MODAL_OPEN_DEADLINE_MS);

    expect(captureMock).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("does nothing when the modal appears and is closed again before the deadline", async () => {
    watchModalOpenAfterClick({
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    // Insertion and removal within one macrotask: a presence check at the
    // deadline would miss this appearance; the observer must not.
    const modal = insertModal();
    modal.remove();
    await vi.advanceTimersByTimeAsync(MODAL_OPEN_DEADLINE_MS);

    expect(captureMock).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("detects the modal when it arrives nested inside an added container", async () => {
    watchModalOpenAfterClick({
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    const container = document.createElement("div");
    const modal = document.createElement("div");
    modal.className = "eds-structure_main";
    container.appendChild(modal);
    document.body.appendChild(container);
    await vi.advanceTimersByTimeAsync(MODAL_OPEN_DEADLINE_MS);

    expect(captureMock).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("treats a modal already on screen at click time as appeared", async () => {
    insertModal();

    watchModalOpenAfterClick({
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });
    await vi.advanceTimersByTimeAsync(MODAL_OPEN_DEADLINE_MS);

    expect(captureMock).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("reports the failure without navigating when fallbackUrl is empty", async () => {
    watchModalOpenAfterClick({ fallbackUrl: "", failureProps: FAILURE_PROPS });

    await vi.advanceTimersByTimeAsync(MODAL_OPEN_DEADLINE_MS);

    expect(captureMock).toHaveBeenCalledExactlyOnceWith(
      "widget_load_failed",
      FAILURE_PROPS,
    );
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("does nothing after its disposer runs", async () => {
    const dispose = watchModalOpenAfterClick({
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    dispose();
    await vi.advanceTimersByTimeAsync(MODAL_OPEN_DEADLINE_MS);

    expect(captureMock).not.toHaveBeenCalled();
    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("keeps a single active watch when re-armed after dispose (no duplicate telemetry)", async () => {
    const first = watchModalOpenAfterClick({
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });
    first();
    watchModalOpenAfterClick({
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    await vi.advanceTimersByTimeAsync(MODAL_OPEN_DEADLINE_MS * 2);

    expect(captureMock).toHaveBeenCalledExactlyOnceWith(
      "widget_load_failed",
      FAILURE_PROPS,
    );
    expect(assignSpy).toHaveBeenCalledTimes(1);
  });
});

describe("installInitFailureFallback", () => {
  it("reports the failure once at install time", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);

    installInitFailureFallback(button, {
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    expect(captureMock).toHaveBeenCalledExactlyOnceWith(
      "widget_load_failed",
      FAILURE_PROPS,
    );
  });

  it("navigates on button click (buttons have no native navigation)", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);
    installInitFailureFallback(button, {
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(assignSpy).toHaveBeenCalledExactlyOnceWith(FALLBACK_URL);
  });

  it("lets an anchor's intact native navigation proceed untouched", () => {
    const anchor = document.createElement("a");
    // Hash href: real enough for the has-native-href check without tripping
    // jsdom's not-implemented navigation on the un-prevented click below.
    anchor.setAttribute("href", "#tickets");
    document.body.appendChild(anchor);
    installInitFailureFallback(anchor, {
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    anchor.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(assignSpy).not.toHaveBeenCalled();
  });

  it("rescues an anchor click whose default was suppressed by another handler", () => {
    const anchor = document.createElement("a");
    anchor.setAttribute("href", FALLBACK_URL);
    document.body.appendChild(anchor);
    anchor.addEventListener("click", (event) => event.preventDefault());
    installInitFailureFallback(anchor, {
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });

    anchor.dispatchEvent(
      new MouseEvent("click", { bubbles: true, cancelable: true }),
    );

    expect(assignSpy).toHaveBeenCalledExactlyOnceWith(FALLBACK_URL);
  });

  it("installs no navigation when fallbackUrl is empty or the element is missing", () => {
    const button = document.createElement("button");
    document.body.appendChild(button);

    installInitFailureFallback(button, {
      fallbackUrl: "",
      failureProps: FAILURE_PROPS,
    });
    installInitFailureFallback(null, {
      fallbackUrl: FALLBACK_URL,
      failureProps: FAILURE_PROPS,
    });
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));

    expect(captureMock).toHaveBeenCalledTimes(2);
    expect(assignSpy).not.toHaveBeenCalled();
  });
});
