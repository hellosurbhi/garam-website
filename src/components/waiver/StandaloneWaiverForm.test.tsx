import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StandaloneWaiverForm from "./StandaloneWaiverForm";

const mockReportFailure = vi.fn();
vi.mock("@/lib/failureAlert", () => ({
  reportFailure: (...args: unknown[]) => mockReportFailure(...args),
}));

vi.mock("./StandaloneWaiverForm.module.css", () => ({
  default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

function fillForm() {
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
  fireEvent.change(screen.getByLabelText("Signature"), {
    target: { value: "Priya Sharma" },
  });
  // jsdom panels have zero scroll height, so the hook marks the waiver read
  // on mount and the agreement checkbox is enabled.
  fireEvent.click(screen.getByRole("checkbox"));
}

describe("StandaloneWaiverForm", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), { status: 200 }),
    );
  });

  it("submit stays disabled until every requirement is met", () => {
    render(<StandaloneWaiverForm />);
    const submit = screen.getByTestId("waiver-submit");
    expect(submit).toBeDisabled();
    fillForm();
    expect(submit).not.toBeDisabled();
  });

  it("signature must match the legal name", () => {
    render(<StandaloneWaiverForm />);
    fillForm();
    fireEvent.change(screen.getByLabelText("Signature"), {
      target: { value: "Someone Else" },
    });
    expect(screen.getByRole("alert").textContent).toContain(
      "Signature must match",
    );
    expect(screen.getByTestId("waiver-submit")).toBeDisabled();
  });

  it("posts to stage-waiver with mailingListOptIn false and shows success", async () => {
    render(<StandaloneWaiverForm />);
    fillForm();
    fireEvent.click(screen.getByTestId("waiver-submit"));

    await waitFor(() =>
      expect(screen.getByTestId("waiver-success")).toBeInTheDocument(),
    );
    const [url, init] = (globalThis.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0] as [string, RequestInit];
    expect(url).toBe("/api/stage-waiver");
    const body = JSON.parse(String(init.body));
    expect(body.signature).toBe("Priya Sharma");
    // A waiver page is a legal surface, never a marketing capture.
    expect(body.mailingListOptIn).toBe(false);
    expect(mockReportFailure).not.toHaveBeenCalled();
  });

  it("shows the server error, keeps the form, and pages on failure", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ error: "Waiver version mismatch." }), {
        status: 400,
      }),
    );
    render(<StandaloneWaiverForm />);
    fillForm();
    fireEvent.click(screen.getByTestId("waiver-submit"));

    await waitFor(() =>
      expect(screen.getAllByRole("alert")[0].textContent).toContain(
        "Waiver version mismatch.",
      ),
    );
    expect(screen.getByTestId("waiver-form")).toBeInTheDocument();
    expect(mockReportFailure).toHaveBeenCalledWith(
      expect.objectContaining({
        flow: "waiver",
        stage: "standalone_submit",
        contact: expect.objectContaining({ email: "priya@example.com" }),
      }),
    );
  });
});
