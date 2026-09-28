import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { initMixerRsvpForm } from "./mixerRsvpForm";
import type { MixerRsvpFormConfig } from "./mixerRsvpForm";
import { captureLead } from "./leadSubmission";
import { identifyLead } from "./analytics";
import { reportFailure } from "./failureAlert";
import { MIXER_STORAGE_KEY } from "@/data/mixers";

vi.mock("./leadAttribution", () => ({
  buildLeadAttribution: vi.fn().mockResolvedValue({ source: "cuffing-season" }),
}));
vi.mock("./leadSubmission", () => ({
  captureLead: vi.fn(),
}));
vi.mock("./analytics", () => ({
  identifyLead: vi.fn(),
  trackLeadEvent: vi.fn(),
  capture: vi.fn(),
}));
vi.mock("./failureAlert", () => ({
  reportFailure: vi.fn(),
}));

const mockCaptureLead = vi.mocked(captureLead);
const mockReportFailure = vi.mocked(reportFailure);

function buildDOM() {
  document.body.innerHTML = `
    <form id="test-form" novalidate>
      <input type="text" id="test-name" />
      <input type="email" id="test-email" />
      <p id="test-error" hidden role="alert"></p>
      <button type="submit">Send</button>
    </form>
  `;
}

function els() {
  return {
    form: document.getElementById("test-form") as HTMLFormElement,
    name: document.getElementById("test-name") as HTMLInputElement,
    email: document.getElementById("test-email") as HTMLInputElement,
    error: document.getElementById("test-error") as HTMLParagraphElement,
    submit: document.querySelector('[type="submit"]') as HTMLButtonElement,
  };
}

function setField(input: HTMLInputElement, value: string) {
  input.value = value;
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

function blurField(input: HTMLInputElement) {
  input.dispatchEvent(new Event("blur"));
}

async function submitForm(form: HTMLFormElement) {
  form.dispatchEvent(new Event("submit", { cancelable: true }));
  // Let the async handleSubmit chain settle.
  await vi.waitFor(() => {});
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

function init(overrides: Partial<MixerRsvpFormConfig> = {}) {
  const onCaptureSuccess = vi.fn();
  const onCaptureFailure = vi.fn().mockReturnValue(true);
  initMixerRsvpForm({
    formId: "test-form",
    nameInputId: "test-name",
    emailInputId: "test-email",
    errorElId: "test-error",
    source: "cuffing-season",
    copy: {
      nameError: "Please enter your name.",
      errorMessage: "Something went wrong. Try again.",
      submittingLabel: "Sending...",
    },
    onCaptureSuccess,
    onCaptureFailure,
    ...overrides,
  });
  return { onCaptureSuccess, onCaptureFailure };
}

describe("initMixerRsvpForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorage.clear();
    buildDOM();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}")));
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    document.body.innerHTML = "";
  });

  it("does nothing when the form is absent", () => {
    document.body.innerHTML = "";
    expect(() => init()).not.toThrow();
  });

  it("disables submit until both fields are valid", () => {
    init();
    const { name, email, submit } = els();
    expect(submit.disabled).toBe(true);

    setField(name, "Priya");
    expect(submit.disabled).toBe(true);

    setField(email, "not-an-email");
    expect(submit.disabled).toBe(true);

    setField(email, "priya@example.com");
    expect(submit.disabled).toBe(false);
  });

  it("shows the specific email error after the field is left invalid", () => {
    init();
    const { email, error } = els();
    setField(email, "not-an-email");
    blurField(email);
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe("Please enter a valid email address");
    expect(email.getAttribute("aria-invalid")).toBe("true");
  });

  it("shows the name error after the name field is left empty", () => {
    init();
    const { name, error } = els();
    blurField(name);
    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe("Please enter your name.");
    expect(name.getAttribute("aria-invalid")).toBe("true");
  });

  it("clears the error once the field becomes valid", () => {
    init();
    const { email, error } = els();
    setField(email, "nope");
    blurField(email);
    expect(error.hidden).toBe(false);
    setField(email, "priya@example.com");
    expect(error.hidden).toBe(true);
    expect(email.getAttribute("aria-invalid")).toBe("false");
  });

  it("never calls captureLead when a forced submit carries invalid input", async () => {
    init();
    const { form, name } = els();
    setField(name, "Priya");
    await submitForm(form);
    expect(mockCaptureLead).not.toHaveBeenCalled();
  });

  it("on success: saves the lead, sets the storage key, notifies, calls onCaptureSuccess", async () => {
    mockCaptureLead.mockResolvedValue({ id: "lead-1" });
    const { onCaptureSuccess, onCaptureFailure } = init();
    const { form, name, email } = els();
    setField(name, "Priya");
    setField(email, "priya@example.com");
    await submitForm(form);

    expect(mockCaptureLead).toHaveBeenCalledWith(
      expect.objectContaining({ name: "Priya", email: "priya@example.com" }),
    );
    expect(localStorage.getItem(MIXER_STORAGE_KEY)).toBe("true");
    expect(fetch).toHaveBeenCalledWith(
      "/api/notify-mixer-rsvp",
      expect.objectContaining({ method: "POST", keepalive: true }),
    );
    expect(onCaptureSuccess).toHaveBeenCalledOnce();
    expect(onCaptureFailure).not.toHaveBeenCalled();
  });

  it("on failure: pages the owner with contact info and calls onCaptureFailure, storage key stays unset", async () => {
    mockCaptureLead.mockRejectedValue(new Error("Valid email required"));
    const { onCaptureSuccess, onCaptureFailure } = init();
    const { form, name, email } = els();
    setField(name, "Priya");
    setField(email, "priya@example.com");
    await submitForm(form);

    expect(mockReportFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "lead",
        stage: "mixer_rsvp",
        contact: { name: "Priya", email: "priya@example.com" },
      }),
    );
    expect(onCaptureFailure).toHaveBeenCalledOnce();
    expect(onCaptureSuccess).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIXER_STORAGE_KEY)).toBeNull();
  });

  it("an analytics throw after a successful save still runs the success path", async () => {
    mockCaptureLead.mockResolvedValue({ id: "lead-1" });
    vi.mocked(identifyLead).mockImplementationOnce(() => {
      throw new Error("posthog exploded");
    });
    const { onCaptureSuccess, onCaptureFailure } = init();
    const { form, name, email } = els();
    setField(name, "Priya");
    setField(email, "priya@example.com");
    await submitForm(form);

    expect(onCaptureSuccess).toHaveBeenCalledOnce();
    expect(onCaptureFailure).not.toHaveBeenCalled();
    expect(mockReportFailure).not.toHaveBeenCalled();
    expect(localStorage.getItem(MIXER_STORAGE_KEY)).toBe("true");
  });

  it("on failure with a stay-on-page handler: shows the fallback error and re-enables submit", async () => {
    mockCaptureLead.mockRejectedValue(new Error("boom"));
    init({ onCaptureFailure: vi.fn().mockReturnValue(false) });
    const { form, name, email, error, submit } = els();
    setField(name, "Priya");
    setField(email, "priya@example.com");
    await submitForm(form);

    expect(error.hidden).toBe(false);
    expect(error.textContent).toBe("Something went wrong. Try again.");
    expect(submit.disabled).toBe(false);
    expect(submit.textContent).toBe("Send");
  });
});
