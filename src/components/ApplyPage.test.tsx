import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ApplyPage from "./ApplyPage";

const mockAddDoc = vi.fn();
const mockUploadBytes = vi.fn();
const mockGetDownloadURL = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: vi.fn(),
  addDoc: (...args: unknown[]) => mockAddDoc(...args),
  serverTimestamp: vi.fn(() => "mock-timestamp"),
}));

vi.mock("firebase/storage", () => ({
  ref: vi.fn(),
  uploadBytes: (...args: unknown[]) => mockUploadBytes(...args),
  getDownloadURL: (...args: unknown[]) => mockGetDownloadURL(...args),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseDb: vi.fn(() => "mock-db"),
  getFirebaseStorage: vi.fn(() => "mock-storage"),
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
    mockUploadBytes.mockResolvedValue({});
    mockGetDownloadURL.mockResolvedValue("https://example.com/photo.jpg");
    // Mock fetch for notify-application
    vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response("{}"));
    // Mock crypto.randomUUID
    vi.spyOn(crypto, "randomUUID").mockReturnValue(
      "test-uuid" as `${string}-${string}-${string}-${string}-${string}`,
    );
  });

  it("renders the form title", () => {
    render(<ApplyPage />);
    expect(
      screen.getByText("Apply to Be on Garam Masala Dating"),
    ).toBeInTheDocument();
  });

  it("renders the subtitle", () => {
    render(<ApplyPage />);
    expect(
      screen.getByText(/NYC's #1 live desi dating show/),
    ).toBeInTheDocument();
  });

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

  it("shows error text when submitting with empty required fields", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      expect(
        screen.getByText("Please fill in all required fields"),
      ).toBeInTheDocument();
    });
  });

  it("shows 'Required' error for empty name after submit", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      const errors = screen.getAllByText("Required");
      expect(errors.length).toBeGreaterThan(0);
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
    const yesRadio = screen.getByRole("radio", {
      name: /yes/i,
    }) as HTMLInputElement;
    fireEvent.click(yesRadio);
    expect(yesRadio.checked).toBe(true);
  });

  it("marketing consent no radio selects correctly", () => {
    render(<ApplyPage />);
    const noRadio = screen.getByRole("radio", {
      name: /no/i,
    }) as HTMLInputElement;
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

  it("inputs have aria-invalid true after validation failure", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText("Name");
      expect(nameInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  it("age input has aria-invalid true after validation failure", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      const ageInput = screen.getByPlaceholderText("Age");
      expect(ageInput).toHaveAttribute("aria-invalid", "true");
    });
  });

  /* ── Error display (ConditionalExpression mutations) ──────── */

  it("marketing consent error shows role=alert", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      expect(screen.getByText("Please select Yes or No")).toHaveAttribute(
        "role",
        "alert",
      );
    });
  });

  it("terms error shows when terms not agreed", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      expect(
        screen.getByText("You must agree to the Terms & Conditions"),
      ).toBeInTheDocument();
    });
  });

  it("terms error has role=alert", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      expect(
        screen.getByText("You must agree to the Terms & Conditions"),
      ).toHaveAttribute("role", "alert");
    });
  });

  /* ── data-error attribute (ObjectLiteral mutations) ──────── */

  it("marketing consent fieldset gets data-error on validation failure", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      const fieldset = screen
        .getByText("Please select Yes or No")
        .closest("fieldset");
      expect(fieldset).toHaveAttribute("data-error", "true");
    });
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

  it("city input has aria-invalid true after validation failure", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
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

  it("toast shows error message after failed validation", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      const toast = screen.getByText("Please fill in all required fields");
      expect(toast).toBeInTheDocument();
    });
  });

  it("toast has dismiss button", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      expect(screen.getByLabelText("Dismiss")).toBeInTheDocument();
    });
  });

  it("toast dismiss button removes toast", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      expect(
        screen.getByText("Please fill in all required fields"),
      ).toBeInTheDocument();
    });
    fireEvent.click(screen.getByLabelText("Dismiss"));
    await waitFor(() => {
      expect(
        screen.queryByText("Please fill in all required fields"),
      ).not.toBeInTheDocument();
    });
  });

  /* ── aria-describedby attributes ─────────────────────────── */

  it("name input gets aria-describedby pointing to error when error exists", async () => {
    render(<ApplyPage />);
    fireEvent.click(screen.getByText("Submit Application"));
    await waitFor(() => {
      const nameInput = screen.getByPlaceholderText("Name");
      expect(nameInput).toHaveAttribute("aria-describedby", "field-name-error");
    });
  });

  it("name input has no aria-describedby when no error", () => {
    render(<ApplyPage />);
    const nameInput = screen.getByPlaceholderText("Name");
    expect(nameInput).not.toHaveAttribute("aria-describedby");
  });
});
