// Shared portal-state loader for /contestant-portal.
//
// WHY: the portal island used to start its /api/portal-state fetch inside
// useEffect, so the request could not begin until the island bundle had
// downloaded AND React had hydrated. This module lets the Astro page script
// start the same request at module-execution time, overlapping the server
// round trip (cold start + rate limit + Firestore) with hydration. The page
// script chunk and the island chunk are bundled separately, so module-scope
// memoization cannot be shared between them: the window global IS the memo.
// Removing the global re-introduces either the serialized fetch or duplicate
// requests that burn the 5/min rate limit.

import { missingRoleError, PORTAL_LOAD_ERROR } from "@/data/contestantPortal";

export type ContestantRole = "female" | "male";

export type PortalResponseData = {
  state?: string;
  inviteId?: string;
  showId?: string;
  showCity?: string;
  showDate?: string;
  showDisplayDate?: string;
  startTime?: string | null;
  venueName?: string | null;
  role?: string | null;
  firstName?: string;
  message?: string;
  error?: string;
};

export type PortalStateResult =
  { kind: "ok"; status: number; data: PortalResponseData } | { kind: "failed" };

// Everything the portal can resolve to once loading finishes.
export type PortalResolution =
  | { type: "open" }
  | {
      type: "invite";
      inviteId: string;
      showCity: string;
      showDate: string;
      showDisplayDate?: string;
      startTime?: string | null;
      venueName?: string | null;
      role: ContestantRole;
    }
  | {
      type: "show";
      showId: string;
      showCity: string;
      showDate: string;
      showDisplayDate?: string;
      startTime?: string | null;
      venueName?: string | null;
    }
  | {
      type: "active";
      firstName: string;
      role: ContestantRole;
      showCity: string;
      showDate: string;
      showDisplayDate?: string;
      startTime?: string | null;
      venueName?: string | null;
    }
  | { type: "expired" }
  | { type: "error"; message: string };

declare global {
  interface Window {
    __portalStateLoad?: Promise<PortalStateResult>;
    // Set by the inline head script ONLY when sessionStorage is unavailable,
    // so the URL scrub never has to leave the bearer token in place.
    __portalCtx?: PortalContext;
  }
}

// One slot holds whichever link context the visitor last followed. The
// inline head script in contestant-portal.astro writes the same keys with the
// same shapes BEFORE analytics load; keep the two in sync.
export const PORTAL_CONTEXT_KEY = "gmd_portal_ctx";
export const PORTAL_CONTEXT_EXPLICIT_KEY = "gmd_portal_ctx_explicit";
const TOTAL_BUDGET_MS = 12_000;

export type PortalContext = { kind: "invite" | "show"; id: string };

// WHY: sessionStorage throws in some private-browsing and storage-disabled
// configurations. The link context must survive within the page session even
// then, so storage failures fall back to a module-scoped value instead of
// crashing the bootstrap. The fallback intentionally does not survive a
// reload; the explicit URL param path still works there.
let memoryContext: PortalContext | null = null;

function parseContext(raw: string | null): PortalContext | null {
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (
      parsed &&
      typeof parsed === "object" &&
      "kind" in parsed &&
      "id" in parsed &&
      ((parsed as PortalContext).kind === "invite" ||
        (parsed as PortalContext).kind === "show") &&
      typeof (parsed as PortalContext).id === "string" &&
      (parsed as PortalContext).id.length > 0
    ) {
      return {
        kind: (parsed as PortalContext).kind,
        id: (parsed as PortalContext).id,
      };
    }
    return null;
  } catch {
    return null;
  }
}

function readStoredContext(): PortalContext | null {
  try {
    return (
      parseContext(window.sessionStorage.getItem(PORTAL_CONTEXT_KEY)) ??
      memoryContext
    );
  } catch {
    return memoryContext;
  }
}

function storeContext(context: PortalContext): void {
  memoryContext = context;
  try {
    window.sessionStorage.setItem(PORTAL_CONTEXT_KEY, JSON.stringify(context));
  } catch {
    // memoryContext already holds it
  }
}

export function clearStoredPortalContext(): void {
  memoryContext = null;
  try {
    window.sessionStorage.removeItem(PORTAL_CONTEXT_KEY);
  } catch {
    // nothing stored beyond memoryContext
  }
}

export async function parsePortalResponseBody(
  response: Response,
): Promise<PortalResponseData> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    const parsed = JSON.parse(text) as unknown;
    // A body of "null", a bare string or an array parses fine but is not a
    // portal payload; treating it as {} keeps the never-rejects contract
    // (property reads on null would throw inside run()).
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as PortalResponseData;
    }
    return {};
  } catch {
    return {};
  }
}

async function fetchPortalState(
  url: string,
  deadline: number,
): Promise<PortalStateResult> {
  // The deadline is one hard budget for the whole run, retry included; an
  // exhausted budget fails immediately instead of extending the wait.
  const remaining = deadline - Date.now();
  if (remaining <= 0) return { kind: "failed" };
  const ctrl = new AbortController();
  const timerId = setTimeout(() => ctrl.abort(), remaining);
  try {
    const response = await fetch(url, {
      credentials: "same-origin",
      signal: ctrl.signal,
    });
    // WHY: the body read must stay inside this try block so the abort timer
    // still covers response.text(); reading after clearTimeout leaves a
    // stalled body read with no deadline (same constraint as claimPortal).
    const data = await parsePortalResponseBody(response);
    return { kind: "ok", status: response.status, data };
  } catch {
    return { kind: "failed" };
  } finally {
    clearTimeout(timerId);
  }
}

// A stored context is dropped only when the server definitively rejects the
// link itself (invalid, already claimed, show passed). Rate limiting and
// server/network failures are transient: keeping the context lets the next
// visit retry it instead of silently downgrading to the bare portal.
function isDefinitiveRejection(result: PortalStateResult): boolean {
  if (result.kind !== "ok") return false;
  if (result.status === 429 || result.status >= 500) return false;
  return result.data.state === "error";
}

function scrubUrl(): void {
  window.history.replaceState(null, "", "/contestant-portal");
}

// The inline head script sets a one-load flag when this page load followed
// an explicit link; consuming it here restores the explicit-vs-stored
// distinction the URL scrub erased. Reads destroy it so a refresh counts as
// a stored visit.
function consumeExplicitFlag(): boolean {
  try {
    const flag = window.sessionStorage.getItem(PORTAL_CONTEXT_EXPLICIT_KEY);
    if (flag !== null) {
      window.sessionStorage.removeItem(PORTAL_CONTEXT_EXPLICIT_KEY);
    }
    return flag === "1";
  } catch {
    return false;
  }
}

// WHY: invite IDs are single-use bearer tokens. The inline head script in
// contestant-portal.astro stashes the context and scrubs the URL before
// analytics can capture it; the URL-param branches below repeat that work
// for environments where the inline script did not run (unit tests, direct
// island mounts, storage-disabled browsers where the inline scrub is
// skipped). Explicit URL params always REPLACE the stored slot, so following
// a show link never resurrects an older invite on refresh and vice versa.
function resolveContext(): {
  context: PortalContext | null;
  explicit: boolean;
} {
  const params = new URLSearchParams(window.location.search);
  const invite = params.get("invite");
  const show = params.get("show");
  if (invite) {
    const context: PortalContext = { kind: "invite", id: invite };
    storeContext(context);
    scrubUrl();
    return { context, explicit: true };
  }
  if (show) {
    const context: PortalContext = { kind: "show", id: show };
    storeContext(context);
    scrubUrl();
    return { context, explicit: true };
  }
  // The inline script parks the context on window when sessionStorage is
  // unavailable (it scrubs the URL regardless, so the param is gone by now).
  const parkedContext = window.__portalCtx;
  if (parkedContext) {
    delete window.__portalCtx;
    const context = parseContext(JSON.stringify(parkedContext));
    if (context) {
      storeContext(context);
      return { context, explicit: true };
    }
  }
  return { context: readStoredContext(), explicit: consumeExplicitFlag() };
}

async function run(): Promise<PortalStateResult> {
  const deadline = Date.now() + TOTAL_BUDGET_MS;
  const { context, explicit } = resolveContext();

  if (!context) {
    return fetchPortalState("/api/portal-state", deadline);
  }

  const result = await fetchPortalState(
    `/api/portal-state?${context.kind}=${encodeURIComponent(context.id)}`,
    deadline,
  );
  if (!isDefinitiveRejection(result)) return result;

  // The link is dead. Its stored copy must not survive to poison later
  // visits either way.
  clearStoredPortalContext();
  if (explicit) {
    // The user followed this link on purpose; show them its error.
    return result;
  }
  // A stored context died in the background (typically: invite just claimed,
  // so the portal_session cookie now owns access). Fall through to the bare
  // request once, within the same budget, so the cookie branch can answer.
  return fetchPortalState("/api/portal-state", deadline);
}

/**
 * Idempotent: the first caller (Astro page script or the React island,
 * whichever runs first) starts the single fetch; every later caller gets the
 * same promise. Never rejects: any synchronous throw inside run() (storage,
 * history, URL parsing) resolves to { kind: "failed" } via the catch below.
 */
export function startPortalStateLoad(): Promise<PortalStateResult> {
  window.__portalStateLoad ??= run().catch((): PortalStateResult => {
    return { kind: "failed" };
  });
  return window.__portalStateLoad;
}

/** Test hook: forget the in-flight load and any in-memory context. */
export function resetPortalBootstrap(): void {
  delete window.__portalStateLoad;
  delete window.__portalCtx;
  memoryContext = null;
}

function normalizeRole(role?: string | null): ContestantRole | null {
  if (role === "female" || role === "male") {
    return role;
  }
  return null;
}

/** Pure mapping from a load result to what the portal should render. */
export function resolvePortalState(
  result: PortalStateResult,
  contactEmail: string,
): PortalResolution {
  if (result.kind === "failed") {
    return { type: "error", message: PORTAL_LOAD_ERROR };
  }

  const { status, data } = result;
  if (status < 200 || status >= 300) {
    return {
      type: "error",
      message: data.error ?? data.message ?? PORTAL_LOAD_ERROR,
    };
  }

  if (data.state === "open" || data.state === "no-access") {
    return { type: "open" };
  }
  if (data.state === "invite") {
    const role = normalizeRole(data.role);
    if (!role) {
      return { type: "error", message: missingRoleError(contactEmail) };
    }
    return {
      type: "invite",
      inviteId: data.inviteId ?? "",
      showCity: data.showCity ?? "",
      showDate: data.showDate ?? "",
      showDisplayDate: data.showDisplayDate ?? undefined,
      startTime: data.startTime ?? null,
      venueName: data.venueName ?? null,
      role,
    };
  }
  if (data.state === "show") {
    return {
      type: "show",
      showId: data.showId ?? "",
      showCity: data.showCity ?? "",
      showDate: data.showDate ?? "",
      showDisplayDate: data.showDisplayDate ?? undefined,
      startTime: data.startTime ?? null,
      venueName: data.venueName ?? null,
    };
  }
  if (data.state === "active") {
    const role = normalizeRole(data.role);
    if (!role) {
      return { type: "open" };
    }
    return {
      type: "active",
      firstName: data.firstName ?? "",
      role,
      showCity: data.showCity ?? "",
      showDate: data.showDate ?? "",
      showDisplayDate: data.showDisplayDate ?? undefined,
      startTime: data.startTime ?? null,
      venueName: data.venueName ?? null,
    };
  }
  if (data.state === "expired") {
    return { type: "expired" };
  }
  if (data.state === "error") {
    return { type: "error", message: data.message ?? PORTAL_LOAD_ERROR };
  }
  return { type: "error", message: PORTAL_LOAD_ERROR };
}
