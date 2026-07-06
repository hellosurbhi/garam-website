export const prerender = false;

import type { APIRoute } from "astro";
import { verifyAdminToken } from "@/lib/verifyToken";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";

// Admin-only read of the waitlist (leads collection) for the Waitlist CRM.
// firestore.rules blocks client reads of leads, so this route uses the service
// account (bypasses rules) behind an admin ID token. Supports filter-by-city
// and CSV export so a city's waitlist can be pulled when a show is announced.

interface FirestoreValue {
  stringValue?: string;
  doubleValue?: number;
  integerValue?: string;
}

interface FirestoreDocument {
  name: string;
  fields?: Record<string, FirestoreValue>;
}

interface FirestoreListResponse {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

function str(fields: Record<string, FirestoreValue>, key: string): string {
  const v = fields[key];
  return v && typeof v.stringValue === "string" ? v.stringValue : "";
}

async function listLeads(
  projectId: string,
  accessToken: string,
): Promise<FirestoreDocument[]> {
  const docs: FirestoreDocument[] = [];
  let pageToken: string | undefined;
  do {
    const qs = new URLSearchParams({ pageSize: "300" });
    if (pageToken) qs.set("pageToken", pageToken);
    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/leads?${qs.toString()}`;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
      signal: controller.signal,
    }).finally(() => clearTimeout(timer));
    if (!res.ok) {
      throw new Error(`Failed to list leads: ${res.status}`);
    }
    const data = (await res.json()) as FirestoreListResponse;
    if (data.documents) docs.push(...data.documents);
    pageToken = data.nextPageToken;
  } while (pageToken);
  return docs;
}

export interface WaitlistLead {
  id: string;
  email: string;
  phone: string;
  name: string;
  city: string;
  sourceCitySlug: string;
  source: string;
  createdAt: string;
}

function toLead(doc: FirestoreDocument): WaitlistLead {
  const f = doc.fields ?? {};
  return {
    id: doc.name.split("/").pop() ?? "",
    email: str(f, "email"),
    phone: str(f, "phone"),
    name: str(f, "name"),
    // Prefer the explicit city, fall back to IP-derived geoCity.
    city: str(f, "city") || str(f, "geoCity"),
    sourceCitySlug: str(f, "sourceCitySlug"),
    source: str(f, "source"),
    createdAt: str(f, "createdAt"),
  };
}

function csvCell(value: string): string {
  // RFC 4180 quoting; guard against CSV formula injection.
  const safe = /^[=+\-@]/.test(value) ? `'${value}` : value;
  return `"${safe.replace(/"/g, '""')}"`;
}

function toCsv(leads: WaitlistLead[]): string {
  const header = ["Name", "Email", "Phone", "City", "Source", "Date"];
  const rows = leads.map((l) =>
    [l.name, l.email, l.phone, l.city, l.source, l.createdAt]
      .map(csvCell)
      .join(","),
  );
  return [header.map(csvCell).join(","), ...rows].join("\r\n");
}

export const GET: APIRoute = async ({ request, url }) => {
  const uid = await verifyAdminToken(
    request.headers.get("authorization") ?? "",
  );
  if (!uid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return new Response(
      JSON.stringify({ error: "Server configuration error" }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  const cityFilter = url.searchParams.get("city")?.trim().toLowerCase() ?? "";
  const sourceFilter =
    url.searchParams.get("source")?.trim().toLowerCase() ?? "";
  const from = url.searchParams.get("from")?.trim() ?? "";
  const to = url.searchParams.get("to")?.trim() ?? "";
  const format = url.searchParams.get("format")?.trim() ?? "json";

  try {
    const accessToken = await getFirestoreAccessToken();
    const docs = await listLeads(projectId, accessToken);
    let leads = docs.map(toLead);

    if (cityFilter) {
      leads = leads.filter(
        (l) =>
          l.city.toLowerCase().includes(cityFilter) ||
          l.sourceCitySlug.toLowerCase().includes(cityFilter),
      );
    }
    if (sourceFilter) {
      leads = leads.filter((l) =>
        l.source.toLowerCase().includes(sourceFilter),
      );
    }
    if (from) leads = leads.filter((l) => l.createdAt >= from);
    if (to) leads = leads.filter((l) => l.createdAt <= to);

    // Default sort: city A→Z, then newest first within a city.
    leads.sort(
      (a, b) =>
        a.city.localeCompare(b.city) || b.createdAt.localeCompare(a.createdAt),
    );

    if (format === "csv") {
      return new Response(toCsv(leads), {
        status: 200,
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": `attachment; filename="waitlist${cityFilter ? `-${cityFilter.replace(/[^a-z0-9]/gi, "")}` : ""}.csv"`,
        },
      });
    }

    return new Response(JSON.stringify({ total: leads.length, leads }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[admin/leads] fetch failed:", msg);
    return new Response(JSON.stringify({ error: "Failed to load leads" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
};
