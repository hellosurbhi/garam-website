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
  fireEvent.change(screen.getByLabelText(/legal first name/i), {
    target: { value: "Priya" },
  });
  fireEvent.change(screen.getByLabelText(/legal last name/i), {
    target: { value: "Shah" },
  });
  fireEvent.change(screen.getByLabelText(/^email$/i), {
    target: { value: "priya@example.com" },
  });
  fireEvent.change(screen.getByLabelText(/phone number/i), {
    target: { value: "(212) 555-1234" },
  });
  fireEvent.change(screen.getByLabelText(/^signature$/i), {
    target: { value: "Priya Shah" },
  });
  const waiver = screen.getByLabelText(/waiver text/i);
  Object.defineProperty(waiver, "clientHeight", {
    configurable: true,
    value: 100,
  });
  Object.defineProperty(waiver, "scrollHeight", {
    configurable: true,
    value: 400,
  });
  Object.defineProperty(waiver, "scrollTop", {
    configurable: true,
    value: 300,
  });
  fireEvent.scroll(waiver);
  fireEvent.click(screen.getByLabelText(/I have read and agree/i));
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

    expect(await screen.findByText("Sign your waiver")).toBeInTheDocument();
    fillPortalSignupForm();
    fireEvent.click(screen.getByRole("button", { name: /sign & open prep/i }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent(
        "Could not finish signup. Please try again or email contact@garammasaladating.com.",
      );
    });
    expect(
      screen.queryByText(/unexpected end of json input/i),
    ).not.toBeInTheDocument();
  });

  it("requires scrolling through the waiver before agreement is enabled", async () => {
    history.replaceState(
      null,
      "",
      "/contestant-portal?show=manhattan-2026-06-01&role=female",
    );
    mockPortalState();

    render(<ContestantPortal />);

    expect(await screen.findByText("Sign your waiver")).toBeInTheDocument();
    const agree = screen.getByLabelText(/I have read and agree/i);
    expect(agree).toBeDisabled();
    expect(
      screen.getByText(/Scroll through the full waiver/i),
    ).toBeInTheDocument();

    const waiver = screen.getByLabelText(/waiver text/i);
    Object.defineProperty(waiver, "clientHeight", {
      configurable: true,
      value: 100,
    });
    Object.defineProperty(waiver, "scrollHeight", {
      configurable: true,
      value: 400,
    });
    Object.defineProperty(waiver, "scrollTop", {
      configurable: true,
      value: 300,
    });
    fireEvent.scroll(waiver);

    expect(agree).not.toBeDisabled();
  });

  it("lets a spectator sign the waiver without opening contestant prep", async () => {
    history.replaceState(
      null,
      "",
      "/contestant-portal?show=manhattan-2026-06-01",
    );
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
            role: null,
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      if (requestUrl.includes("/api/stage-waiver")) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("", { status: 500 });
    });

    render(<ContestantPortal />);

    expect(await screen.findByText("Sign your waiver")).toBeInTheDocument();
    fireEvent.click(screen.getByLabelText(/Spectator going on stage/i));
    fillPortalSignupForm();
    fireEvent.click(screen.getByRole("button", { name: /^sign waiver$/i }));

    expect(await screen.findByText("You're signed.")).toBeInTheDocument();
    await waitFor(() => {
      const [, init] = vi
        .mocked(fetch)
        .mock.calls.find(([url]) => String(url).includes("/api/stage-waiver"))!;
      expect(JSON.parse(String(init?.body))).toMatchObject({
        firstName: "Priya",
        lastName: "Shah",
        signature: "Priya Shah",
        showId: "manhattan-2026-06-01",
      });
    });
    expect(screen.queryByText(/The Golden Rules/i)).not.toBeInTheDocument();
  });
});
