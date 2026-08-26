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
      propertiesSetOnce?: Record<string, unknown>,
    ) => void;
    get_distinct_id?: () => string | undefined;
  };
  fbq?: (
    action: string,
    eventName: string,
    parameters?: Record<string, unknown>,
    // 4th arg is Meta's browser/server dedup contract: passing the same
    // eventID used in a paired server-side CAPI call (src/lib/capi.ts) tells
    // Meta the two deliveries are one event, not two. See capture()'s
    // `options.eventId` in src/lib/analyticsCapture.ts.
    eventOptions?: { eventID?: string },
  ) => void;
  __garamAnalytics?: {
    posthog?: boolean;
  };
  __garamErrorQueue?: Array<{
    event: string;
    properties: Record<string, unknown>;
  }>;
  __garamEventQueue?: Array<{
    event: string;
    properties: Record<string, unknown>;
  }>;
  _gtmLoaded?: boolean;
  _fbLoaded?: boolean;
  __GMD_CONSENT?: {
    v: 1;
    analytics: boolean;
    marketing: boolean;
    ts: number;
  } | null;
  __gmdOpenCookiePrefs?: () => void;
}

declare namespace astroHTML.JSX {
  interface HTMLAttributes {
    toolname?: string;
    tooldescription?: string;
    toolparamdescription?: string;
  }
}
