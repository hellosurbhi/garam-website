/// <reference types="astro/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

declare global {
  interface Window {
    dataLayer?: Array<Record<string, unknown>>;
    posthog?: {
      capture?: (event: string, properties?: Record<string, unknown>) => void;
      identify?: (
        distinctId: string,
        properties?: Record<string, unknown>,
      ) => void;
      get_distinct_id?: () => string | undefined;
    };
    __garamAnalytics?: {
      posthog?: boolean;
    };
    _gtmLoaded?: boolean;
    _fbLoaded?: boolean;
  }
}

export {};
