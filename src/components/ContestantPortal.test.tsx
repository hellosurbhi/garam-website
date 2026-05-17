import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import ContestantPortal from "./ContestantPortal";

function mockPortalState() {
  vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
    const requestUrl = input instanceof Request ? input.url : String(input);
    if (requestUrl.includes("/api/portal-state")) {
      return new Response(
        JSON.stringify({
          state: "invite",
          inviteId: "invite-1",
          showCity: "Manhattan",
          showDate: "2026-06-01",
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
    history.replaceState(null, "", "/contestant-portal?invite=invite-1");
    mockPortalState();

    render(<ContestantPortal />);

    expect(
      await screen.findByText("Your Contestant Packet"),
    ).toBeInTheDocument();
    fillPortalSignupForm();
    fireEvent.click(
      screen.getByRole("button", { name: /complete packet & open prep/i }),
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

  it("requires scrolling through the waiver before agreement is enabled", async () => {
    history.replaceState(null, "", "/contestant-portal?invite=invite-1");
    mockPortalState();

    render(<ContestantPortal />);

    expect(
      await screen.findByText("Your Contestant Packet"),
    ).toBeInTheDocument();
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

  it("submits selected contestants through the private packet link", async () => {
    history.replaceState(null, "", "/contestant-portal?invite=invite-1");
    vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      const requestUrl = input instanceof Request ? input.url : String(input);
      if (requestUrl.includes("/api/portal-state")) {
        return new Response(
          JSON.stringify({
            state: "invite",
            inviteId: "invite-1",
            showCity: "Manhattan",
            showDate: "2026-06-01",
            role: "female",
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      }
      if (requestUrl.includes("/api/contestant-claim")) {
        return new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      return new Response("", { status: 500 });
    });

    render(<ContestantPortal />);

    expect(
      await screen.findByText("Your Contestant Packet"),
    ).toBeInTheDocument();
    expect(screen.queryByText(/choose your role/i)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(/Spectator going on stage/i),
    ).not.toBeInTheDocument();
    fillPortalSignupForm();
    fireEvent.click(
      screen.getByRole("button", { name: /complete packet & open prep/i }),
    );

    expect(await screen.findByText("The Golden Rules")).toBeInTheDocument();
    await waitFor(() => {
      const [, init] = vi
        .mocked(fetch)
        .mock.calls.find(([url]) =>
          String(url).includes("/api/contestant-claim"),
        )!;
      expect(JSON.parse(String(init?.body))).toMatchObject({
        inviteId: "invite-1",
        firstName: "Priya",
        lastName: "Shah",
        signature: "Priya Shah",
      });
    });
  });

  it("does not expose a random show waiver from the contestant portal", async () => {
    history.replaceState(null, "", "/contestant-portal");
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ state: "no-access" }), {
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<ContestantPortal />);

    expect(await screen.findByText("Contestant Packet")).toBeInTheDocument();
    expect(screen.getByText(/private packet link/i)).toBeInTheDocument();
    expect(
      screen.queryByText(/Your Contestant Packet/i),
    ).not.toBeInTheDocument();
  });
});
