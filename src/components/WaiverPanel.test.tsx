import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { WaiverPanel } from "./WaiverPanel";
import { WAIVER_PANEL } from "@/data/contestantPortal";

vi.mock("@/components/ContestantPortal.module.css", () => ({
  default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

let resizeCallback: (() => void) | null = null;

function setBox(
  el: Element,
  box: { scrollHeight: number; clientHeight: number },
) {
  Object.defineProperty(el, "scrollHeight", {
    configurable: true,
    value: box.scrollHeight,
  });
  Object.defineProperty(el, "clientHeight", {
    configurable: true,
    value: box.clientHeight,
  });
}

function renderPanel(
  overrides: Partial<Parameters<typeof WaiverPanel>[0]> = {},
) {
  const props = {
    waiverText: "I agree to everything.",
    scrolled: false,
    onScrolledToEnd: vi.fn(),
    signature: "",
    onSignatureChange: vi.fn(),
    signatureValid: false,
    agreed: false,
    onAgreedChange: vi.fn(),
    ...overrides,
  };
  render(<WaiverPanel {...props} />);
  return props;
}

describe("WaiverPanel", () => {
  beforeEach(() => {
    resizeCallback = null;
    vi.stubGlobal(
      "ResizeObserver",
      class {
        constructor(cb: () => void) {
          resizeCallback = cb;
        }
        observe() {}
        disconnect() {}
      },
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps signing locked and never unlocks an unlaid-out (zero height) box", () => {
    const props = renderPanel();
    expect(screen.getByRole("checkbox")).toBeDisabled();
    expect(screen.getByLabelText(WAIVER_PANEL.signatureLabel)).toBeDisabled();
    expect(props.onScrolledToEnd).not.toHaveBeenCalled();
  });

  it("unlocks once when the box is laid out and the document fits without scrolling", () => {
    const props = renderPanel();
    const region = screen.getByRole("region", { name: "Waiver document" });
    setBox(region, { scrollHeight: 100, clientHeight: 120 });
    resizeCallback?.();
    resizeCallback?.();
    expect(props.onScrolledToEnd).toHaveBeenCalledTimes(1);
  });

  it("does not unlock while the reader is mid-document", () => {
    const props = renderPanel();
    const region = screen.getByRole("region", { name: "Waiver document" });
    setBox(region, { scrollHeight: 1000, clientHeight: 200 });
    region.scrollTop = 100;
    fireEvent.scroll(region);
    expect(props.onScrolledToEnd).not.toHaveBeenCalled();
  });

  it("unlocks once the reader reaches the bottom", () => {
    const props = renderPanel();
    const region = screen.getByRole("region", { name: "Waiver document" });
    setBox(region, { scrollHeight: 1000, clientHeight: 200 });
    region.scrollTop = 795;
    fireEvent.scroll(region);
    expect(props.onScrolledToEnd).toHaveBeenCalledTimes(1);
  });

  it("ignores scrolling after it is already unlocked and enables the controls", () => {
    const props = renderPanel({ scrolled: true });
    const region = screen.getByRole("region", { name: "Waiver document" });
    setBox(region, { scrollHeight: 1000, clientHeight: 200 });
    region.scrollTop = 800;
    fireEvent.scroll(region);
    expect(props.onScrolledToEnd).not.toHaveBeenCalled();
    expect(screen.getByRole("checkbox")).not.toBeDisabled();
  });

  it("reports signature edits and agreement toggles to the parent", () => {
    const props = renderPanel({ scrolled: true });
    fireEvent.change(screen.getByLabelText(WAIVER_PANEL.signatureLabel), {
      target: { value: "Priya Sharma" },
    });
    fireEvent.click(screen.getByRole("checkbox"));
    expect(props.onSignatureChange).toHaveBeenCalledWith("Priya Sharma");
    expect(props.onAgreedChange).toHaveBeenCalledWith(true);
  });

  it("announces a mismatch only after the waiver is read and a signature is typed", () => {
    renderPanel({ scrolled: true, signature: "Wrong Name" });
    expect(
      screen.getByText("Signature must match your legal name above.", {
        selector: "[role=alert]",
      }),
    ).toBeInTheDocument();
  });

  it("stays quiet about mismatch while the signature is valid", () => {
    renderPanel({
      scrolled: true,
      signature: "Priya Sharma",
      signatureValid: true,
    });
    expect(
      screen.queryByText("Signature must match your legal name above.", {
        selector: "[role=alert]",
      }),
    ).not.toBeInTheDocument();
  });
});
