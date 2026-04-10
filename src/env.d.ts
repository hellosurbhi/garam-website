/// <reference types="astro/client" />
/// <reference types="@testing-library/jest-dom/vitest" />

declare module "virtual:git-dates" {
  export const gitDates: Record<string, string>;
}

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
  __garamErrorQueue?: Array<{
    event: string;
    properties: Record<string, unknown>;
  }>;
  _gtmLoaded?: boolean;
  _fbLoaded?: boolean;
}

declare namespace astroHTML.JSX {
  interface HTMLAttributes {
    toolname?: string;
    tooldescription?: string;
    toolparamdescription?: string;
  }
}
