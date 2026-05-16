import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContestantPortal from "./ContestantPortal";

function mockPortalState() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    if (requestUrl.includes("/api/portal-state")) {
      return new Response(
        JSON.stringify({
          state: "show-invite",
          showId: "manhattan-2026-06-01",
          showCity: "Manhattan",
          showDate: "2026-06-01",
          showDisplayDate: "June 1, 2026",
          role: "female",
        }),
        { headers: { "Content-Type": "application/json" } },
      );
    }

    return new Response("", { status: 500 });
  });
}

function fillPortalSignupForm() {
  fireEvent.click(screen.getByRole("button", { name: /start here/i }));
  fireEvent.change(screen.getByLabelText(/first name/i), {
    target: { value: "Priya" },
  });
  fireEvent.change(screen.getByLabelText(/last name/i), {
    target: { value: "Shah" },
  });
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: "priya@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/phone number/i), {
    target: { value: "(212) 555-1234" },
  });
  fireEvent.click(screen.getByLabelText(/read and agree/i));
  fireEvent.change(screen.getByLabelText(/signature/i), {
    target: { value: "Priya Shah" },
  });
}

describe("ContestantPortal", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    history.replaceState(null, "", "/");
  });

  it("renders the expired portal state returned by the API", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "expired" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<ContestantPortal />);

    expect(
      await screen.findByText("Thank you for being part of the show!"),
    ).toBeInTheDocument();
  });

  it("shows a friendly signup error when the claim API returns an empty error body", async () => {
    history.replaceState(
      null,
      "",
      "/contestant-portal?show=manhattan-2026-06-01&role=female",
    );
    mockPortalState();

    render(<ContestantPortal />);

    expect(await screen.findByText("Congratulations!")).toBeInTheDocument();
    fillPortalSignupForm();
    fireEvent.click(
      screen.getByRole("button", { name: /sign & enter portal/i }),
    );

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not finish signup. Please try again or email contact@garammasaladating.com.",
      );
    });
    expect(
      screen.queryByText(/unexpected end of json input/i),
    ).not.toBeInTheDocument();
  });
});
