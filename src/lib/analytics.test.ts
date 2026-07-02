import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackError, trackLeadEvent, identifyLead } from "./analytics";

describe("trackLeadEvent", () => {
  let captureMock: ReturnType<typeof vi.fn>;
  let dataLayerPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captureMock = vi.fn();
    dataLayerPush = vi.fn();
    window.posthog = { capture: captureMock } as typeof window.posthog;
    window.dataLayer = { push: dataLayerPush } as unknown as Array<
      Record<string, unknown>
    >;
  });

  afterEach(() => {
    delete window.posthog;
    delete window.dataLayer;
  });

  it("calls posthog.capture with event name and clean props", () => {
    trackLeadEvent("test_event", { source: "web" });
    expect(captureMock).toHaveBeenCalledWith(
      "test_event",
      expect.objectContaining({ source: "web", pathname: "/" }),
    );
  });

  it("calls dataLayer.push with event name and props", () => {
    trackLeadEvent("test_event", { source: "web" });
    expect(dataLayerPush).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "test_event",
        source: "web",
        pathname: "/",
      }),
    );
  });

  it("filters out undefined properties", () => {
    trackLeadEvent("test_event", {
      source: "web",
      campaign: undefined,
    });
    expect(captureMock).toHaveBeenCalledWith(
      "test_event",
      expect.objectContaining({ source: "web" }),
    );
    expect(dataLayerPush).toHaveBeenCalledWith(
      expect.objectContaining({
        event: "test_event",
        source: "web",
      }),
    );
    expect(captureMock.mock.calls[0][1]).not.toHaveProperty("campaign");
  });

  it("does not throw when posthog is undefined", () => {
    delete window.posthog;
    expect(() => trackLeadEvent("test_event")).not.toThrow();
  });

  it("does not throw when dataLayer is undefined", () => {
    delete window.dataLayer;
    expect(() => trackLeadEvent("test_event")).not.toThrow();
  });

  it("does not throw when posthog.capture is undefined", () => {
    window.posthog = {};
    expect(() => trackLeadEvent("test_event")).not.toThrow();
  });

  it("works with default empty properties", () => {
    trackLeadEvent("test_event");
    expect(captureMock).toHaveBeenCalledWith(
      "test_event",
      expect.objectContaining({ pathname: "/" }),
    );
    expect(dataLayerPush).toHaveBeenCalledWith(
      expect.objectContaining({ event: "test_event", pathname: "/" }),
    );
  });

  it("calls posthog.capture exactly once per call", () => {
    trackLeadEvent("evt");
    expect(captureMock).toHaveBeenCalledTimes(1);
  });

  it("calls dataLayer.push exactly once per call", () => {
    trackLeadEvent("evt");
    expect(dataLayerPush).toHaveBeenCalledTimes(1);
  });

  it("passes all-undefined props as empty object to both", () => {
    trackLeadEvent("evt", { a: undefined, b: undefined });
    expect(captureMock).toHaveBeenCalledWith(
      "evt",
      expect.objectContaining({ pathname: "/" }),
    );
    expect(dataLayerPush).toHaveBeenCalledWith(
      expect.objectContaining({ event: "evt", pathname: "/" }),
    );
    expect(captureMock.mock.calls[0][1]).not.toHaveProperty("a");
    expect(captureMock.mock.calls[0][1]).not.toHaveProperty("b");
  });

  it("event name is passed as first argument to capture", () => {
    trackLeadEvent("my_event", { x: 1 });
    expect(captureMock.mock.calls[0][0]).toBe("my_event");
  });

  it("dataLayer push includes event key with event name", () => {
    trackLeadEvent("my_event", { x: 1 });
    const pushed = dataLayerPush.mock.calls[0][0];
    expect(pushed.event).toBe("my_event");
    expect(pushed.x).toBe(1);
  });
});

describe("identifyLead", () => {
  let identifyMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    identifyMock = vi.fn();
    window.posthog = { identify: identifyMock } as typeof window.posthog;
  });

  afterEach(() => {
    delete window.posthog;
  });

  it("calls posthog.identify with email and merged props", () => {
    identifyLead("test@example.com", { source: "apply" });
    expect(identifyMock).toHaveBeenCalledWith(
      "test@example.com",
      { email: "test@example.com" },
      { source: "apply" },
    );
  });

  it("returns early for empty string — identify not called", () => {
    identifyLead("");
    expect(identifyMock).not.toHaveBeenCalled();
  });

  it("returns early for whitespace-only string", () => {
    identifyLead("   ");
    expect(identifyMock).not.toHaveBeenCalled();
  });

  it("filters undefined properties", () => {
    identifyLead("test@example.com", { source: "web", extra: undefined });
    expect(identifyMock).toHaveBeenCalledWith(
      "test@example.com",
      { email: "test@example.com" },
      { source: "web" },
    );
  });

  it("includes email in identify properties by default", () => {
    identifyLead("test@example.com");
    expect(identifyMock).toHaveBeenCalledWith(
      "test@example.com",
      { email: "test@example.com" },
      {},
    );
  });

  it("does not throw when posthog is undefined", () => {
    delete window.posthog;
    expect(() => identifyLead("test@example.com")).not.toThrow();
  });

  it("calls posthog.identify exactly once for valid email", () => {
    identifyLead("test@example.com");
    expect(identifyMock).toHaveBeenCalledTimes(1);
  });

  it("returns early for tab-only string", () => {
    identifyLead("\t\t");
    expect(identifyMock).not.toHaveBeenCalled();
  });

  it("returns early for newline-only string", () => {
    identifyLead("\n");
    expect(identifyMock).not.toHaveBeenCalled();
  });

  it("does not throw when posthog.identify is undefined", () => {
    window.posthog = {};
    expect(() => identifyLead("test@example.com")).not.toThrow();
  });

  it("keeps null, false, and 0 in properties (only filters undefined)", () => {
    identifyLead("test@example.com", {
      a: null as unknown as undefined,
      b: false,
      c: 0,
    });
    expect(identifyMock).toHaveBeenCalledWith(
      "test@example.com",
      { email: "test@example.com" },
      { a: null, b: false, c: 0 },
    );
  });
});

describe("trackError", () => {
  let captureMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captureMock = vi.fn();
    window.posthog = { capture: captureMock } as typeof window.posthog;
    delete window.__garamErrorQueue;
    Object.defineProperty(window, "location", {
      value: { href: "https://garammasaladating.com/apply" },
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    delete window.posthog;
    delete window.__garamErrorQueue;
  });

  it("calls posthog.capture with 'client_error' and enriched properties", () => {
    trackError({ error_message: "boom", error_type: "uncaught" });
    expect(captureMock).toHaveBeenCalledWith(
      "client_error",
      expect.objectContaining({
        error_message: "boom",
        error_type: "uncaught",
      }),
    );
  });

  it("does NOT push to __garamErrorQueue when posthog.capture exists", () => {
    trackError({ error_message: "boom", error_type: "uncaught" });
    expect(window.__garamErrorQueue).toBeUndefined();
  });

  it("pushes to __garamErrorQueue when posthog is undefined", () => {
    delete window.posthog;
    trackError({ error_message: "boom", error_type: "uncaught" });
    expect(window.__garamErrorQueue).toHaveLength(1);
    expect(window.__garamErrorQueue![0].event).toBe("client_error");
    expect(window.__garamErrorQueue![0].properties.error_message).toBe("boom");
  });

  it("pushes to __garamErrorQueue when posthog exists but capture is undefined", () => {
    window.posthog = {};
    trackError({ error_message: "boom", error_type: "uncaught" });
    expect(window.__garamErrorQueue).toHaveLength(1);
  });

  it("initializes __garamErrorQueue as empty array when it does not exist", () => {
    delete window.posthog;
    delete window.__garamErrorQueue;
    trackError({ error_message: "boom", error_type: "uncaught" });
    expect(Array.isArray(window.__garamErrorQueue)).toBe(true);
  });

  it("appends to existing __garamErrorQueue", () => {
    delete window.posthog;
    window.__garamErrorQueue = [
      { event: "client_error", properties: { error_message: "old" } },
    ];
    trackError({ error_message: "new", error_type: "uncaught" });
    expect(window.__garamErrorQueue).toHaveLength(2);
    expect(window.__garamErrorQueue![1].properties.error_message).toBe("new");
  });

  it("enriches page_url from window.location.href when not provided", () => {
    trackError({ error_message: "boom", error_type: "uncaught" });
    expect(captureMock).toHaveBeenCalledWith(
      "client_error",
      expect.objectContaining({
        page_url: "https://garammasaladating.com/apply",
      }),
    );
  });

  it("uses provided page_url and does NOT override with window.location.href", () => {
    trackError({
      error_message: "boom",
      error_type: "uncaught",
      page_url: "https://custom.com",
    });
    expect(captureMock).toHaveBeenCalledWith(
      "client_error",
      expect.objectContaining({ page_url: "https://custom.com" }),
    );
  });

  it("queue entry event is 'client_error'", () => {
    delete window.posthog;
    trackError({ error_message: "test", error_type: "api_error" });
    expect(window.__garamErrorQueue![0].event).toBe("client_error");
  });

  it("capture is called exactly once per trackError call", () => {
    trackError({ error_message: "boom", error_type: "uncaught" });
    expect(captureMock).toHaveBeenCalledTimes(1);
  });
});

describe("trackLeadEvent — filter precision", () => {
  let captureMock: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captureMock = vi.fn();
    window.posthog = { capture: captureMock } as typeof window.posthog;
  });

  afterEach(() => {
    delete window.posthog;
  });

  it("keeps null values in properties (only filters undefined)", () => {
    trackLeadEvent("e", { a: null as unknown as string });
    expect(captureMock).toHaveBeenCalledWith(
      "e",
      expect.objectContaining({ a: null }),
    );
  });

  it("keeps false values in properties", () => {
    trackLeadEvent("e", { a: false });
    expect(captureMock).toHaveBeenCalledWith(
      "e",
      expect.objectContaining({ a: false }),
    );
  });

  it("keeps 0 values in properties", () => {
    trackLeadEvent("e", { a: 0 });
    expect(captureMock).toHaveBeenCalledWith(
      "e",
      expect.objectContaining({ a: 0 }),
    );
  });
});
