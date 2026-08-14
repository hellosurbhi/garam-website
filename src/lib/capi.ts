/**
 * Meta Conversions API (CAPI): server-to-server event delivery.
 *
 * WHY server-to-server, in addition to the existing browser Pixel: on this
 * show's traffic (majority mobile, cold Instagram ad clicks), Safari ITP,
 * ad blockers, and users who decline tracking prompts all silently drop the
 * browser-side fbq() call. CAPI is a plain server fetch and is not subject
 * to any of that, so it is the only reliable way to see InitiateCheckout /
 * Purchase for a meaningful share of ad-driven traffic.
 *
 * Every caller must pass the SAME `eventId` used for the paired browser
 * Pixel event (see src/lib/analyticsCapture.ts) so Meta dedupes the two
 * deliveries into a single event instead of double counting. For Purchase
 * events sourced from Eventbrite order sync (no browser event exists),
 * the Eventbrite order ID is used as `eventId`, since it's already the
 * authoritative unique key for that order, see src/pages/api/sync-orders.ts.
 */

import { createHash } from "node:crypto";

// Same Pixel ID already hardcoded in src/components/meta-pixel.astro and
// public/js/meta-pixel.js. Kept as a literal here to match that existing
// convention rather than introducing a new env-var pattern for one file;
// if the Pixel ID ever rotates, update all three call sites together.
const META_PIXEL_ID = "1469248418329402";
const CAPI_API_VERSION = "v21.0";
const CAPI_ENDPOINT = `https://graph.facebook.com/${CAPI_API_VERSION}/${META_PIXEL_ID}/events`;

export type CapiEventName = "InitiateCheckout" | "Purchase";

export interface CapiUserData {
  email?: string;
  phone?: string;
  clientIpAddress?: string;
  clientUserAgent?: string;
  /** Meta browser click/first-party cookie IDs, forwarded from the request when present. */
  fbp?: string;
  fbc?: string;
}

export interface CapiCustomData {
  value?: number;
  currency?: string;
  contentIds?: string[];
  contentType?: string;
  numItems?: number;
}

export interface CapiEventParams {
  eventName: CapiEventName;
  /** Shared with the paired browser Pixel eventID (or the Eventbrite order ID for Purchase), required for dedup. */
  eventId: string;
  /** Unix seconds. */
  eventTime: number;
  eventSourceUrl: string;
  userData: CapiUserData;
  customData?: CapiCustomData;
}

export interface CapiResult {
  ok: boolean;
  error?: string;
}

function sha256Hex(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

/** Meta's required normalization: lowercase, trim whitespace, then hash. */
export function hashEmail(email: string): string {
  return sha256Hex(email.trim().toLowerCase());
}

/** Meta's required normalization: digits only (strips +, spaces, dashes, parens), then hash. */
export function hashPhone(phone: string): string {
  return sha256Hex(phone.replace(/\D/g, ""));
}

function buildUserData(userData: CapiUserData): Record<string, unknown> {
  const fields: Record<string, unknown> = {};
  if (userData.email) fields.em = [hashEmail(userData.email)];
  if (userData.phone) fields.ph = [hashPhone(userData.phone)];
  if (userData.clientIpAddress)
    fields.client_ip_address = userData.clientIpAddress;
  if (userData.clientUserAgent)
    fields.client_user_agent = userData.clientUserAgent;
  if (userData.fbp) fields.fbp = userData.fbp;
  if (userData.fbc) fields.fbc = userData.fbc;
  return fields;
}

function buildCustomData(
  customData: CapiCustomData | undefined,
): Record<string, unknown> | undefined {
  if (!customData) return undefined;
  const fields: Record<string, unknown> = {};
  if (customData.value !== undefined) fields.value = customData.value;
  if (customData.currency) fields.currency = customData.currency;
  if (customData.contentIds) fields.content_ids = customData.contentIds;
  if (customData.contentType) fields.content_type = customData.contentType;
  if (customData.numItems !== undefined) fields.num_items = customData.numItems;
  return Object.keys(fields).length > 0 ? fields : undefined;
}

/**
 * Send a single event to the Meta Conversions API. Never throws: a failed
 * or misconfigured CAPI call must never break the redirect/sync flow that
 * calls it, so every failure is caught and returned as `{ ok: false }` for
 * the caller to log and move on from.
 */
export async function sendCapiEvent(
  params: CapiEventParams,
  accessToken: string,
): Promise<CapiResult> {
  const body = {
    data: [
      {
        event_name: params.eventName,
        event_time: params.eventTime,
        event_id: params.eventId,
        event_source_url: params.eventSourceUrl,
        action_source: "website",
        user_data: buildUserData(params.userData),
        ...(buildCustomData(params.customData)
          ? { custom_data: buildCustomData(params.customData) }
          : {}),
      },
    ],
  };

  try {
    const res = await fetch(
      `${CAPI_ENDPOINT}?access_token=${encodeURIComponent(accessToken)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      const errText = await res.text();
      console.error(
        `[capi] ${params.eventName} failed: ${res.status} ${errText}`,
      );
      return { ok: false, error: `${res.status}: ${errText}` };
    }

    return { ok: true };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[capi] ${params.eventName} error: ${msg}`);
    return { ok: false, error: msg };
  }
}
