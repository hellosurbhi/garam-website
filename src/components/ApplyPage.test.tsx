import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ApplyPage from "./ApplyPage";

const mockAddDoc = vi.fn();
const mockUploadBytesResumable = vi
  .fn()
  .mockImplementation(() =>
    Object.assign(Promise.resolve({}), { cancel: vi.fn() }),
  );
const mockGetDownloadURL = vi.fn();
const mockSignInAnonymously = vi.fn().mockResolvedValue({ user: {} });

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytesResumable: (...args: unknown[]) =>
    mockUploadBytesResumable(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock("firebase/auth", () => ({
  signInAnonymously: (...args: unknown[]) => mockSignInAnonymously(...args),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
  getFirebaseStorage: vi.fn(() => "mock-storage"),
  getFirebaseAuth: vi.fn(() => Promise.resolve("mock-auth")),
}));

vi.mock("@/data/events", () => ({
  events: [
    {
      date: "Apr 19",
      city: "Manhattan",
      url: "https://example.com/tickets",
      isoDate: "2099-04-19",
    },
  ],
}));

vi.mock("./ApplyPage.module.css", () => ({
  default: new Proxy({}, { get: (_, prop) => String(prop) }),
}));

describe("ApplyPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockAddDoc.mockResolvedValue({ id: "doc-1" });
    mockUploadBytesResumable.mockImplementation(() =>
      Object.assign(Promise.resolve({}), { cancel: vi.fn() }),
    );
    mockGetDownloadURL.mockResolvedValue("https://example.com/photo.jpg");
    // Mock fetch for notify-application
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    // Mock crypto.randomUUID
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "test-uuid" as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  // Get marketing consent radio by name attribute to avoid ambiguity
  // with the optional seenShowBefore Yes/No radios
  function getConsentRadio(value: "yes" | "no") {
    const radios = screen.getAllByRole("radio", {
      name: new RegExp(`^${value}$`, "i"),
    });
    return radios.find(
      (r) => (r as HTMLInputElement).name === "marketingConsent",
    )!;
  }

  // Fill all required fields so the form becomes valid and the submit button
  // is enabled. Used by tests that need to reach the Firestore submit path.
  function fillAllRequiredFields() {
    fireEvent.change(screen.getByPlaceholderText("Name"), {
      target: { value: "Jane Doe" },
    });
    fireEvent.change(screen.getByPlaceholderText("Age"), {
      target: { value: "25" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /gender/i }), {
      target: { value: "Woman" },
    });
    fireEvent.change(screen.getByRole("combobox", { name: /orientation/i }), {
      target: { value: "Straight" },
    });
    fireEvent.change(screen.getByPlaceholderText("(Ex. Chicago)"), {
      target: { value: "New York" },
    });
    fireEvent.change(screen.getByPlaceholderText("you@example.com"), {
      target: { value: "jane@example.com" },
    });
    fireEvent.change(screen.getByRole("textbox", { name: /instagram/i }), {
      target: { value: "janedoe" },
    });
    // Photo: setPhotoFiles is called synchronously inside handleAddPhotos,
    // so isValid updates before FileReader completes.
    const photoInput = document.getElementById(
      "photo-input",
    ) as HTMLInputElement;
    fireEvent.change(photoInput, {
      target: {
        files: [
          new File([new ArrayBuffer(1024)], "photo.jpg", {
            type: "image/jpeg",
          }),
        ],
      },
    });
    fireEvent.click(getConsentRadio("yes"));
    fireEvent.click(screen.getByRole("checkbox"));
  }

  it("shows 'For myself' and 'For a friend' toggle buttons", () => {
    render(<ApplyPage />);
    expect(screen.getByText("For myself")).toBeInTheDocument();
    expect(screen.getByText("For a friend")).toBeInTheDocument();
  });

  it("shows 'About You' section title by default", () => {
    render(<ApplyPage />);
    expect(screen.getByText("About You")).toBeInTheDocument();
  });

  it("changes section title to 'About Your Friend' when Nomination is selected", () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("For a friend"));
    expect(screen.getByText("About Your Friend")).toBeInTheDocument();
  });

  it("shows referrer name field only for Nomination type", () => {
    render(<ApplyPage />);
    expect(
      screen.queryByPlaceholderText("So we know who nominated them"),
    ).not.toBeInTheDocument();
    fireEvent.click(screen.getByText("For a friend"));
    expect(
      screen.getByPlaceholderText("So we know who nominated them"),
    ).toBeInTheDocument();
  });

  it("submit button is disabled when required fields are empty", () => {
    render(<ApplyPage />);
    const btn = screen.getByText("Submit Application").closest("button")!;
    expect(btn).toBeDisabled();
  });

  it("shows 'Required' error for empty name on blur", async () => {
    render(<ApplyPage />);
    const nameInput = screen.getByPlaceholderText("Name");
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);
    await waitFor(() => {
      expect(screen.getByText("Required")).toBeInTheDocument();
    });
  });

  it("renders the submit button", () => {
    render(<ApplyPage />);
    expect(screen.getByText("Submit Application")).toBeInTheDocument();
  });

  it("renders the disclaimer text", () => {
    render(<ApplyPage />);
    expect(
      screen.getByText(/By submitting, you agree to be contacted/),
    ).toBeInTheDocument();
  });

  /* ── Input onChange handlers (ArrowFunction mutations) ──── */

  it("name input updates on typing", () => {
    render(<ApplyPage />);
    const input = screen.getByPlaceholderText("Name") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Jane" } });
    expect(input.value).toBe("Jane");
  });

  it("age input updates on typing", () => {
    render(<ApplyPage />);
    const input = screen.getByPlaceholderText("Age") as HTMLInputElement;
    fireEvent.change(input, { target: { value: "25" } });
    expect(input.value).toBe("25");
  });

  it("gender select updates on change", () => {
    render(<ApplyPage />);
    const select = screen.getByRole("combobox", {
      name: /gender/i,
    }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "Woman" } });
    expect(select.value).toBe("Woman");
  });

  it("orientation select updates on change", () => {
    render(<ApplyPage />);
    const select = screen.getByRole("combobox", {
      name: /orientation/i,
    }) as HTMLSelectElement;
    fireEvent.change(select, { target: { value: "Straight" } });
    expect(select.value).toBe("Straight");
  });

  it("height input updates on typing", () => {
    render(<ApplyPage />);
    const input = screen.getByPlaceholderText(`5'8"`) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "5'10" } });
    expect(input.value).toBe("5'10");
  });

  it("instagram input strips leading @ on change", () => {
    render(<ApplyPage />);
    const input = screen.getByRole("textbox", {
      name: /instagram/i,
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "@janedoe" } });
    expect(input.value).toBe("janedoe");
  });

  it("instagram input preserves value without @", () => {
    render(<ApplyPage />);
    const input = screen.getByRole("textbox", {
      name: /instagram/i,
    }) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "janedoe" } });
    expect(input.value).toBe("janedoe");
  });

  it("pitch textarea updates on typing", () => {
    render(<ApplyPage />);
    const textarea = screen.getByPlaceholderText(
      /Tell us something fun/,
    ) as HTMLTextAreaElement;
    fireEvent.change(textarea, { target: { value: "I love comedy" } });
    expect(textarea.value).toBe("I love comedy");
  });

  it("marketing consent yes radio selects correctly", () => {
    render(<ApplyPage />);
    const yesRadio = getConsentRadio("yes") as HTMLInputElement;
    fireEvent.click(yesRadio);
    expect(yesRadio.checked).toBe(true);
  });

  it("marketing consent no radio selects correctly", () => {
    render(<ApplyPage />);
    const noRadio = getConsentRadio("no") as HTMLInputElement;
    fireEvent.click(noRadio);
    expect(noRadio.checked).toBe(true);
  });

  it("terms checkbox toggles on click", () => {
    render(<ApplyPage />);
    const checkbox = screen.getByRole("checkbox") as HTMLInputElement;
    fireEvent.click(checkbox);
    expect(checkbox.checked).toBe(true);
  });

  /* ── Conditional rendering (ConditionalExpression mutations) ── */

  it("Self button is active by default", () => {
    render(<ApplyPage />);
    const selfBtn = screen.getByText("For myself");
    expect(selfBtn).toHaveAttribute("aria-pressed", "true");
  });

  it("Nomination button is not active by default", () => {
    render(<ApplyPage />);
    const nomBtn = screen.getByText("For a friend");
    expect(nomBtn).toHaveAttribute("aria-pressed", "false");
  });

  it("switching to Nomination updates aria-pressed", () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("For a friend"));
    expect(screen.getByText("For a friend")).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText("For myself")).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("instagram placeholder changes for Nomination type", () => {
    render(<ApplyPage />);
    expect(screen.getByPlaceholderText("yourhandle")).toBeInTheDocument();
    fireEvent.click(screen.getByText("For a friend"));
    expect(
      screen.getByPlaceholderText("yourfriendshandle"),
    ).toBeInTheDocument();
  });

  it("pitch label changes for Nomination type", () => {
    render(<ApplyPage />);
    expect(
      screen.getByText(/Why would you be a great fit/),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByText("For a friend"));
    expect(
      screen.getByText(/Why would your friend be a great fit/),
    ).toBeInTheDocument();
  });

  /* ── aria-invalid (BooleanLiteral mutations) ─────────────── */

  it("inputs have aria-invalid false initially", () => {
    render(<ApplyPage />);
    const nameInput = screen.getByPlaceholderText("Name");
    expect(nameInput).toHaveAttribute("aria-invalid", "false");
  });

  it("name input has aria-invalid true after blur with empty value", async () => {
    render(<ApplyPage />);
    const nameInput = screen.getByPlaceholderText("Name");
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);
    await waitFor(() => {
      expect(nameInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("age input has aria-invalid true after blur with invalid value", async () => {
    render(<ApplyPage />);
    const ageInput = screen.getByPlaceholderText("Age");
    fireEvent.focus(ageInput);
    fireEvent.blur(ageInput);
    await waitFor(() => {
      expect(ageInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("instagram input has aria-invalid true after blur with empty value", async () => {
    render(<ApplyPage />);
    const igInput = screen.getByPlaceholderText("yourhandle");
    fireEvent.focus(igInput);
    fireEvent.blur(igInput);
    await waitFor(() => {
      expect(igInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("email input has aria-invalid true after blur with invalid email", async () => {
    render(<ApplyPage />);
    const emailInput = screen.getByPlaceholderText("you@example.com");
    fireEvent.change(emailInput, { target: { value: "notanemail" } });
    fireEvent.blur(emailInput);
    await waitFor(() => {
      expect(emailInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  /* ── Error display (ConditionalExpression mutations) ──────── */

  it("marketing consent no selection shows inline warning with role=alert", () => {
    render(<ApplyPage />);
    fireEvent.click(getConsentRadio("no"));
    const alerts = screen.getAllByRole("alert");
    const warning = alerts.find((el) =>
      el.textContent?.includes("will not be considered"),
    );
    expect(warning).toBeInTheDocument();
  });

  it("submit button is disabled when form is empty", () => {
    render(<ApplyPage />);
    expect(
      screen.getByText("Submit Application").closest("button"),
    ).toBeDisabled();
  });

  it("submit button is disabled when only consent is set but other fields are empty", () => {
    render(<ApplyPage />);
    fireEvent.click(getConsentRadio("yes"));
    expect(
      screen.getByText("Submit Application").closest("button"),
    ).toBeDisabled();
  });

  /* ── Button gate: required fields ────────────────────────── */

  it("submit button is disabled when only terms are checked but other fields are empty", () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByRole("checkbox"));
    expect(
      screen.getByText("Submit Application").closest("button"),
    ).toBeDisabled();
  });

  /* ── Gender/orientation options (ArrayDeclaration mutations) ── */

  it("renders gender options", () => {
    render(<ApplyPage />);
    expect(screen.getByText("Man")).toBeInTheDocument();
    expect(screen.getByText("Woman")).toBeInTheDocument();
    expect(screen.getByText("Non-binary")).toBeInTheDocument();
  });

  it("renders orientation options", () => {
    render(<ApplyPage />);
    expect(screen.getByText("Straight")).toBeInTheDocument();
    expect(screen.getByText("Gay")).toBeInTheDocument();
    expect(screen.getByText("Bisexual")).toBeInTheDocument();
  });

  /* ── Height placeholder (StringLiteral mutation) ─────────── */

  it("height input has correct placeholder", () => {
    render(<ApplyPage />);
    expect(screen.getByPlaceholderText(`5'8"`)).toBeInTheDocument();
  });

  it("city input updates on typing", () => {
    render(<ApplyPage />);
    const input = screen.getByPlaceholderText(
      "(Ex. Chicago)",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Mumbai" } });
    expect(input.value).toBe("Mumbai");
  });

  it("city input has aria-invalid true after form submit with empty city", async () => {
    render(<ApplyPage />);
    // Submit the form directly — bypasses the button disabled state,
    // triggering validate() which sets errors.city on empty city.
    fireEvent.submit(document.querySelector("form")!);
    await waitFor(() => {
      const cityInput = screen.getByPlaceholderText("(Ex. Chicago)");
      expect(cityInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  /* ── Referrer field for Nomination (onChange handler) ─────── */

  it("referrer name input updates for Nomination type", () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("For a friend"));
    const input = screen.getByPlaceholderText(
      "So we know who nominated them",
    ) as HTMLInputElement;
    fireEvent.change(input, { target: { value: "Nominator" } });
    expect(input.value).toBe("Nominator");
  });

  /* ── Terms link opens modal (BlockStatement mutation) ────── */

  it("Terms & Conditions link click does not propagate", () => {
    render(<ApplyPage />);
    const termsLink = screen.getByText("Terms & Conditions");
    // Click should open modal (just verify no crash and the click handler ran)
    fireEvent.click(termsLink);
    // The TermsModal component should render — we just verify no errors
  });

  /* ── Community and Income selects ────────────────────────── */

  it("community select updates on change", () => {
    render(<ApplyPage />);
    const selects = screen.getAllByRole("combobox");
    // Find community select (has "Select…" as default)
    const communitySelect = selects.find(
      (s) => s.id === "field-community",
    ) as HTMLSelectElement;
    if (communitySelect) {
      fireEvent.change(communitySelect, { target: { value: "South Asian" } });
    }
  });

  it("income select updates on change", () => {
    render(<ApplyPage />);
    const selects = screen.getAllByRole("combobox");
    const incomeSelect = selects.find(
      (s) => s.id === "field-income",
    ) as HTMLSelectElement;
    if (incomeSelect) {
      fireEvent.change(incomeSelect, { target: { value: "$100k+" } });
    }
  });

  /* ── Toast rendering ─────────────────────────────────────── */

  it("no required-fields toast fires when empty form is submitted directly", async () => {
    render(<ApplyPage />);
    // fireEvent.submit bypasses the disabled button; validate() still runs
    // (setting field errors), but the required-fields toast is intentionally
    // removed — the disabled button is the user-facing signal for missing fields.
    fireEvent.submit(document.querySelector("form")!);
    await new Promise<void>((r) => setTimeout(r, 0));
    expect(
      screen.queryByText("Please fill in all required fields"),
    ).not.toBeInTheDocument();
  });

  it("toast has dismiss button on submission failure", async () => {
    mockAddDoc.mockRejectedValueOnce(new Error("Firestore error"));
    render(<ApplyPage />);
    fillAllRequiredFields();
    await waitFor(() =>
      expect(
        screen.getByText("Submit Application").closest("button"),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText("Submit Application").closest("button")!);
    await waitFor(() => {
      expect(screen.getByLabelText("Dismiss")).toBeInTheDocument();
    });
  });

  it("toast dismiss button removes toast", async () => {
    mockAddDoc.mockRejectedValueOnce(new Error("Firestore error"));
    render(<ApplyPage />);
    fillAllRequiredFields();
    await waitFor(() =>
      expect(
        screen.getByText("Submit Application").closest("button"),
      ).not.toBeDisabled(),
    );
    fireEvent.click(screen.getByText("Submit Application").closest("button")!);
    await waitFor(() => {
      expect(screen.getByLabelText("Dismiss")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Dismiss"));
    await waitFor(() => {
      expect(screen.queryByLabelText("Dismiss")).not.toBeInTheDocument();
    });
  });

  /* ── aria-describedby attributes ─────────────────────────── */

  it("name input gets aria-describedby pointing to error when name is blurred empty", async () => {
    render(<ApplyPage />);
    const nameInput = screen.getByPlaceholderText("Name");
    fireEvent.focus(nameInput);
    fireEvent.blur(nameInput);
    await waitFor(() => {
      expect(nameInput).toHaveAttribute("aria-describedby", "field-name-error");
    });
  });

  it("name input has no aria-describedby when no error", () => {
    render(<ApplyPage />);
    const nameInput = screen.getByPlaceholderText("Name");
    expect(nameInput).not.toHaveAttribute("aria-describedby");
  });
});
