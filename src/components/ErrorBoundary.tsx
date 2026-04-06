import { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false };

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          minHeight: "60vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "32px",
          textAlign: "center",
          fontFamily: "var(--font-body), sans-serif",
        }}>
          <p style={{ fontSize: "48px", marginBottom: "16px" }}>🌶️</p>
          <h1 style={{ fontSize: "22px", marginBottom: "12px", color: "var(--charcoal)" }}>
            Something went wrong
          </h1>
          <p style={{ fontSize: "16px", color: "#666", lineHeight: 1.6, maxWidth: "400px" }}>
            Please refresh the page and try again. If the problem persists,
            DM us on{" "}
            <a
              href="https://instagram.com/garammasaladating"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: "var(--brand-red)" }}
            >
              @garammasaladating
            </a>.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{
              marginTop: "24px",
              padding: "14px 32px",
              borderRadius: "50px",
              border: "none",
              background: "var(--brand-red)",
              color: "white",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
              fontFamily: "var(--font-body), sans-serif",
            }}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
