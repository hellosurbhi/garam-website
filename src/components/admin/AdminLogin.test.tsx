import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import AdminLogin from "./AdminLogin";

const mockSignIn = vi.fn();

vi.mock("firebase/auth", () => ({
  signInWithEmailAndPassword: (...args: unknown[]) => mockSignIn(...args),
}));

vi.mock("@/lib/firebase", () => ({
  getFirebaseAuth: vi.fn(() => "mock-auth"),
}));

describe("AdminLogin", () => {
  const onSuccess = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockResolvedValue({
      user: { uid: "admin-1", getIdToken: vi.fn().mockResolvedValue("token") },
    });
  });

  it("renders the email input", () => {
    render(<AdminLogin onSuccess={onSuccess} />);
    expect(screen.getByLabelText("Email")).toBeInTheDocument();
  });

  it("renders the password input", () => {
    render(<AdminLogin onSuccess={onSuccess} />);
    expect(screen.getByLabelText("Password")).toBeInTheDocument();
  });

  it("renders the submit button with 'Enter' text", () => {
    render(<AdminLogin onSuccess={onSuccess} />);
    expect(screen.getByRole("button", { name: "Enter" })).toBeInTheDocument();
  });

  it("renders the title 'Team Access'", () => {
    render(<AdminLogin onSuccess={onSuccess} />);
    expect(screen.getByText("Team Access")).toBeInTheDocument();
  });

  it("calls signInWithEmailAndPassword with entered credentials on submit", async () => {
    render(<AdminLogin onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith(
        "mock-auth",
        "admin@test.com",
        "secret123",
      );
    });
  });

  it("calls onSuccess after successful login", async () => {
    render(<AdminLogin onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "admin@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "secret123" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledOnce();
    });
  });

  it("shows error message on failed login", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("auth/invalid-credential"));
    render(<AdminLogin onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "bad@test.com" },
    });
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    await waitFor(() => {
      expect(
        screen.getByText("Invalid email or password."),
      ).toBeInTheDocument();
    });
  });

  it("clears password field on login error", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("auth/invalid-credential"));
    render(<AdminLogin onSuccess={onSuccess} />);
    fireEvent.change(screen.getByLabelText("Password"), {
      target: { value: "wrong" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    await waitFor(() => {
      expect(screen.getByLabelText("Password")).toHaveValue("");
    });
  });

  it("clears error when user types in email field", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("auth/invalid-credential"));
    render(<AdminLogin onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    await waitFor(() => {
      expect(
        screen.getByText("Invalid email or password."),
      ).toBeInTheDocument();
    });
    fireEvent.change(screen.getByLabelText("Email"), {
      target: { value: "a" },
    });
    expect(
      screen.queryByText("Invalid email or password."),
    ).not.toBeInTheDocument();
  });

  it("does not call onSuccess on failed login", async () => {
    mockSignIn.mockRejectedValueOnce(new Error("auth/invalid-credential"));
    render(<AdminLogin onSuccess={onSuccess} />);
    fireEvent.click(screen.getByRole("button", { name: "Enter" }));
    await waitFor(() => {
      expect(
        screen.getByText("Invalid email or password."),
      ).toBeInTheDocument();
    });
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
