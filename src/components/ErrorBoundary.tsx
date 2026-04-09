import { Component, type ReactNode } from "react";
import { SOCIAL_URLS } from "@/data/socials";
import styles from "./ErrorBoundary.module.css";

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

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ErrorBoundary caught:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className={styles.container}>
          <p className={styles.emoji}>🌶️</p>
          <h1 className={styles.title}>Something went wrong</h1>
          <p className={styles.description}>
            Please refresh the page and try again. If the problem persists, DM
            us on{" "}
            <a
              href={SOCIAL_URLS.instagram}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.link}
            >
              @garammasaladating
            </a>
            .
          </p>
          <button
            onClick={() => window.location.reload()}
            className={styles.reloadButton}
          >
            Refresh Page
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
