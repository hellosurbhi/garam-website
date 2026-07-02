import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, render, screen, waitFor } from "@testing-library/react";
import AdminPage from "./AdminPage";

let authCallback: ((user: { uid: string } | null) => void) | undefined;

vi.mock("firebase/auth", () => ({
  onAuthStateChanged: (
    _auth: unknown,
    cb: (user: { uid: string } | null) => void,
  ) => {
    authCallback = cb;
    return vi.fn(); // unsubscribe
  },
  signOut: vi.fn(),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(() => Promise.resolve("mock-auth")),
}));

vi.mock("@/components/admin/AdminLogin", () => ({
  default: ({ onSuccess }: { onSuccess: () => void }) => (
    <div data-testid="admin-login">
      <button onClick={onSuccess}>mock-login</button>
    </div>
  ),
}));

vi.mock("@/components/admin/AdminDashboard", () => ({
  default: ({ onLogout }: { onLogout: () => void }) => (
    <div data-testid="admin-dashboard">
      <button onClick={onLogout}>mock-logout</button>
    </div>
  ),
}));

describe("AdminPage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    authCallback = undefined;
  });

  it("renders nothing while checking auth state", () => {
    const { container } = render(<AdminPage />);
    // authCallback hasn't been called yet, so checking=true → renders null
    expect(container.innerHTML).toBe("");
  });

  it("renders AdminLogin when user is not authenticated", async () => {
    render(<AdminPage />);
    await waitFor(() => expect(authCallback).toBeTypeOf("function"));
    act(() => authCallback?.(null));
    await waitFor(() => {
      expect(screen.getByTestId("admin-login")).toBeInTheDocument();
    });
  });

  it("renders AdminDashboard when user is authenticated", async () => {
    render(<AdminPage />);
    await waitFor(() => expect(authCallback).toBeTypeOf("function"));
    act(() => authCallback?.({ uid: "admin-1" }));
    await waitFor(() => {
      expect(screen.getByTestId("admin-dashboard")).toBeInTheDocument();
    });
  });
});
