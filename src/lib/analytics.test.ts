import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { trackLeadEvent, identifyLead } from "./analytics";

declare global {
  interface Window {
    posthog?: {
      capture?: (...args: unknown[]) => void;
      identify?: (...args: unknown[]) => void;
    };
    dataLayer?: Array<Record<string, unknown>>;
  }
}

describe("trackLeadEvent", () => {
  let captureMock: ReturnType<typeof vi.fn>;
  let dataLayerPush: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    captureMock = vi.fn();
    dataLayerPush = vi.fn();
    window.posthog = { capture: captureMock };
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
    expect(captureMock).toHaveBeenCalledWith("test_event", { source: "web" });
  });

  it("calls dataLayer.push with event name and props", () => {
    trackLeadEvent("test_event", { source: "web" });
    expect(dataLayerPush).toHaveBeenCalledWith({
      event: "test_event",
      source: "web",
    });
  });

  it("filters out undefined properties", () => {
    trackLeadEvent("test_event", {
      source: "web",
      campaign: undefined,
    });
    expect(captureMock).toHaveBeenCalledWith("test_event", { source: "web" });
    expect(dataLayerPush).toHaveBeenCalledWith({
      event: "test_event",
      source: "web",
    });
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
    expect(captureMock).toHaveBeenCalledWith("test_event", {});
    expect(dataLayerPush).toHaveBeenCalledWith({ event: "test_event" });
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
    expect(captureMock).toHaveBeenCalledWith("evt", {});
    expect(dataLayerPush).toHaveBeenCalledWith({ event: "evt" });
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
    window.posthog = { identify: identifyMock };
  });

  afterEach(() => {
    delete window.posthog;
  });

  it("calls posthog.identify with email and merged props", () => {
    identifyLead("test@example.com", { source: "apply" });
    expect(identifyMock).toHaveBeenCalledWith("test@example.com", {
      email: "test@example.com",
      source: "apply",
    });
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
    expect(identifyMock).toHaveBeenCalledWith("test@example.com", {
      email: "test@example.com",
      source: "web",
    });
  });

  it("includes email in identify properties by default", () => {
    identifyLead("test@example.com");
    expect(identifyMock).toHaveBeenCalledWith("test@example.com", {
      email: "test@example.com",
    });
  });

  it("does not throw when posthog is undefined", () => {
    delete window.posthog;
    expect(() => identifyLead("test@example.com")).not.toThrow();
  });

  it("calls posthog.identify exactly once for valid email", () => {
    identifyLead("test@example.com");
    expect(identifyMock).toHaveBeenCalledTimes(1);
  });
});
