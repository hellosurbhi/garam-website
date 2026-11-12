/**
 * Calls to the admin Shows routes (issue 337) and the public /api/version.
 * One place for the Bearer header, the JSON body and the error shape so the
 * Shows hook never repeats them.
 */
import { SHOWS_LOAD } from "@/data/adminShows";
import { adminIdToken } from "./adminIdToken";

/** A field problem from the draft route: path like "events.3.url". */
export interface FieldIssue {
  path: string;
  message: string;
}

export type ApiResult<T> =
  | { ok: true; data: T }
  | { ok: false; status: number; error: string; issues: FieldIssue[] };

export const SHOWS_ROUTES = {
  load: "/api/admin/events",
  draft: "/api/admin/events/draft",
  publish: "/api/admin/events/publish",
  rollback: "/api/admin/events/rollback",
  rebuild: "/api/admin/events/rebuild",
} as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function issuesOf(body: unknown): FieldIssue[] {
  if (!isRecord(body) || !Array.isArray(body.issues)) return [];
  return body.issues.filter(
    (i): i is FieldIssue =>
      isRecord(i) &&
      typeof i.path === "string" &&
      typeof i.message === "string",
  );
}

/** Call one admin Shows route. Never throws; failures come back as `ok: false`. */
export async function showsRequest<T>(
  path: string,
  options: { method?: "GET" | "POST" | "PUT"; body?: unknown } = {},
): Promise<ApiResult<T>> {
  const token = await adminIdToken();
  if (!token) {
    return {
      ok: false,
      status: 401,
      error: SHOWS_LOAD.sessionExpired,
      issues: [],
    };
  }
  const hasBody = options.body !== undefined;
  let res: Response;
  try {
    res = await fetch(path, {
      method: options.method ?? (hasBody ? "POST" : "GET"),
      headers: {
        Authorization: `Bearer ${token}`,
        ...(hasBody ? { "Content-Type": "application/json" } : {}),
      },
      body: hasBody ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    return { ok: false, status: 0, error: SHOWS_LOAD.network, issues: [] };
  }
  const body: unknown = await res.json().catch(() => null);
  if (res.ok) {
    // WHY a cast and not a client schema: these are this app's own routes,
    // typed by EventsAdminLoad and the route handlers; a second schema here
    // would be a copy of the server types that could drift from them.
    return { ok: true, data: body as T };
  }
  const error =
    isRecord(body) && typeof body.error === "string"
      ? body.error
      : SHOWS_LOAD.failed;
  return { ok: false, status: res.status, error, issues: issuesOf(body) };
}

/** The show list version the deployed website rendered, or null if unknown. */
export async function fetchSiteVersion(): Promise<number | null> {
  try {
    const res = await fetch("/api/version", { cache: "no-store" });
    if (!res.ok) return null;
    const body: unknown = await res.json();
    return isRecord(body) && typeof body.eventsVersion === "number"
      ? body.eventsVersion
      : null;
  } catch {
    return null;
  }
}
