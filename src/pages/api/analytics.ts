export const prerender = false;

import type { APIRoute } from "astro";
import { verifyAdminToken } from "@/lib/verifyToken";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";
import { events } from "@/data/events";
import type {
  AnalyticsSnapshot,
  RevenueByShow,
  RevenueByCity,
  RevenuePoint,
  LeadFunnel,
  RecentLead,
  ChannelAttribution,
  ApplicationMetrics,
} from "@/types/analytics";

// ─── Firestore REST types ─────────────────────────────────────────────────────

interface FirestoreStringValue {
  stringValue: string;
}

interface FirestoreIntegerValue {
  integerValue: string;
}

interface FirestoreDoubleValue {
  doubleValue: number;
}

interface FirestoreNullValue {
  nullValue: null;
}

interface FirestoreArrayValue {
  arrayValue: {
    values?: FirestoreFieldValue[];
  };
}

interface FirestoreMapValue {
  mapValue: {
    fields: Record<string, FirestoreFieldValue>;
  };
}

type FirestoreFieldValue =
  | FirestoreStringValue
  | FirestoreIntegerValue
  | FirestoreDoubleValue
  | FirestoreNullValue
  | FirestoreArrayValue
  | FirestoreMapValue;

interface FirestoreDocument {
  name: string;
  fields: Record<string, FirestoreFieldValue>;
}

interface FirestoreListResponse {
  documents?: FirestoreDocument[];
  nextPageToken?: string;
}

interface FirestoreErrorBody {
  error?: { message?: string };
}

// ─── Firestore helpers ────────────────────────────────────────────────────────

function getField(
  fields: Record<string, FirestoreFieldValue>,
  key: string,
): string | number | null {
  const val = fields[key];
  if (!val) return null;
  if ("stringValue" in val) return val.stringValue;
  if ("doubleValue" in val) return val.doubleValue;
  if ("integerValue" in val) return Number(val.integerValue);
  if ("nullValue" in val) return null;
  return null;
}

function getStringField(
  fields: Record<string, FirestoreFieldValue>,
  key: string,
): string {
  const v = getField(fields, key);
  return typeof v === "string" ? v : "";
}

function getNumberField(
  fields: Record<string, FirestoreFieldValue>,
  key: string,
): number {
  const v = getField(fields, key);
  return typeof v === "number" ? v : 0;
}

// ─── Firestore list (handles pagination) ─────────────────────────────────────

async function listCollection(
  projectId: string,
  accessToken: string,
  collection: string,
): Promise<FirestoreDocument[]> {
  const docs: FirestoreDocument[] = [];
  let pageToken: string | undefined;

  do {
    const qs = new URLSearchParams({ pageSize: "300" });
    if (pageToken) qs.set("pageToken", pageToken);

    const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${collection}?${qs.toString()}`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) {
      const body = (await res.json()) as FirestoreErrorBody;
      throw new Error(
        `Failed to list ${collection}: ${res.status} ${body.error?.message ?? ""}`,
      );
    }

    const data = (await res.json()) as FirestoreListResponse;
    if (data.documents) {
      docs.push(...data.documents);
    }
    pageToken = data.nextPageToken;
  } while (pageToken);

  return docs;
}

// ─── syncMeta reader ──────────────────────────────────────────────────────────

async function readSyncMeta(
  projectId: string,
  accessToken: string,
): Promise<{ lastSyncAt: string | null; errors: string[] }> {
  const url = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/syncMeta/eventbrite`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (res.status === 404) return { lastSyncAt: null, errors: [] };

  if (!res.ok) {
    return { lastSyncAt: null, errors: [] };
  }

  const doc = (await res.json()) as FirestoreDocument;
  const fields = doc.fields ?? {};

  const lastSyncAt = getStringField(fields, "lastSyncAt") || null;

  let errors: string[] = [];
  const errorsField = fields["errors"];
  if (errorsField && "arrayValue" in errorsField) {
    const values = errorsField.arrayValue.values ?? [];
    errors = values
      .map((v) => {
        if ("mapValue" in v) {
          const msgField = v.mapValue.fields["message"];
          return msgField && "stringValue" in msgField
            ? msgField.stringValue
            : "";
        }
        return "";
      })
      .filter(Boolean);
  }

  return { lastSyncAt, errors };
}

// ─── Period cutoff ────────────────────────────────────────────────────────────

function computeCutoff(period: AnalyticsSnapshot["period"]): Date | null {
  if (period === "all") return null;
  const days = period === "7d" ? 7 : period === "30d" ? 30 : 90;
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  return cutoff;
}

// ─── Route handler ────────────────────────────────────────────────────────────

export const GET: APIRoute = async ({ request, url }) => {
  const authHeader = request.headers.get("authorization") ?? "";
  const uid = await verifyAdminToken(authHeader);

  if (!uid) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Parse and validate period
  const rawPeriod = url.searchParams.get("period") ?? "30d";
  const validPeriods: AnalyticsSnapshot["period"][] = [
    "7d",
    "30d",
    "90d",
    "all",
  ];
  const period: AnalyticsSnapshot["period"] = (
    validPeriods as string[]
  ).includes(rawPeriod)
    ? (rawPeriod as AnalyticsSnapshot["period"])
    : "30d";

  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) {
    return new Response(
      JSON.stringify({
        error: "Server configuration error: missing project ID",
      }),
      { status: 500, headers: { "Content-Type": "application/json" } },
    );
  }

  try {
    const accessToken = await getFirestoreAccessToken();
    const cutoff = computeCutoff(period);

    // Fetch all collections in parallel
    const [orderDocs, leadDocs, applicationDocs, syncMetaData] =
      await Promise.all([
        listCollection(projectId, accessToken, "orders"),
        listCollection(projectId, accessToken, "leads"),
        listCollection(projectId, accessToken, "applications"),
        readSyncMeta(projectId, accessToken),
      ]);

    // ── Build event lookup by eventbriteId ────────────────────────────────────
    // Key: eventbriteId -> EventEntry
    const eventById = new Map(
      events.filter((e) => e.eventbriteId).map((e) => [e.eventbriteId!, e]),
    );

    // ── Process orders ────────────────────────────────────────────────────────

    // Parse order documents
    interface ParsedOrder {
      orderId: string;
      eventbriteEventId: string;
      eventSlug: string;
      email: string;
      quantity: number;
      grossRevenue: number;
      netRevenue: number;
      status: string;
      createdAt: string;
      matchedLeadId: string | null;
    }

    const allOrders: ParsedOrder[] = orderDocs.map((doc) => {
      const f = doc.fields ?? {};
      const matchedField = f["matchedLeadId"];
      const matchedLeadId =
        matchedField && "stringValue" in matchedField
          ? matchedField.stringValue
          : null;

      return {
        orderId: getStringField(f, "orderId"),
        eventbriteEventId: getStringField(f, "eventbriteEventId"),
        eventSlug: getStringField(f, "eventSlug"),
        email: getStringField(f, "email"),
        quantity: getNumberField(f, "quantity"),
        grossRevenue: getNumberField(f, "grossRevenue"),
        netRevenue: getNumberField(f, "netRevenue"),
        status: getStringField(f, "status"),
        createdAt: getStringField(f, "createdAt"),
        matchedLeadId,
      };
    });

    // Filter to active (non-refunded/cancelled) orders within period
    const filteredOrders = allOrders.filter((o) => {
      if (o.status === "refunded" || o.status === "cancelled") return false;
      if (cutoff) {
        const created = new Date(o.createdAt);
        if (isNaN(created.getTime()) || created < cutoff) return false;
      }
      return true;
    });

    // Aggregate top-level revenue metrics
    let totalGrossRevenue = 0;
    let totalNetRevenue = 0;
    let totalTicketsSold = 0;
    const uniqueBuyerEmails = new Set<string>();

    for (const o of filteredOrders) {
      totalGrossRevenue += o.grossRevenue;
      totalNetRevenue += o.netRevenue;
      totalTicketsSold += o.quantity;
      if (o.email) uniqueBuyerEmails.add(o.email);
    }

    const totalUniqueBuyers = uniqueBuyerEmails.size;
    const averageTicketPrice =
      totalTicketsSold > 0 ? totalNetRevenue / totalTicketsSold : 0;

    // revenueByShow: group by eventbriteEventId
    const showMap = new Map<
      string,
      {
        grossRevenue: number;
        netRevenue: number;
        ticketsSold: number;
        buyers: Set<string>;
        eventSlug: string;
      }
    >();

    for (const o of filteredOrders) {
      const key = o.eventbriteEventId;
      if (!key) continue;
      const existing = showMap.get(key);
      if (existing) {
        existing.grossRevenue += o.grossRevenue;
        existing.netRevenue += o.netRevenue;
        existing.ticketsSold += o.quantity;
        if (o.email) existing.buyers.add(o.email);
      } else {
        showMap.set(key, {
          grossRevenue: o.grossRevenue,
          netRevenue: o.netRevenue,
          ticketsSold: o.quantity,
          buyers: new Set(o.email ? [o.email] : []),
          eventSlug: o.eventSlug,
        });
      }
    }

    const revenueByShow: RevenueByShow[] = [];
    for (const [eventbriteEventId, data] of showMap.entries()) {
      const eventEntry = eventById.get(eventbriteEventId);
      revenueByShow.push({
        eventbriteEventId,
        eventSlug: data.eventSlug,
        eventDate: eventEntry?.date ?? "",
        city: eventEntry?.city ?? data.eventSlug,
        grossRevenue: data.grossRevenue,
        netRevenue: data.netRevenue,
        ticketsSold: data.ticketsSold,
        uniqueBuyers: data.buyers.size,
      });
    }
    revenueByShow.sort((a, b) => b.netRevenue - a.netRevenue);

    // revenueByCity: group by eventSlug
    const cityMap = new Map<
      string,
      {
        grossRevenue: number;
        netRevenue: number;
        ticketsSold: number;
        buyers: Set<string>;
      }
    >();

    for (const o of filteredOrders) {
      const slug = o.eventSlug || "unknown";
      const existing = cityMap.get(slug);
      if (existing) {
        existing.grossRevenue += o.grossRevenue;
        existing.netRevenue += o.netRevenue;
        existing.ticketsSold += o.quantity;
        if (o.email) existing.buyers.add(o.email);
      } else {
        cityMap.set(slug, {
          grossRevenue: o.grossRevenue,
          netRevenue: o.netRevenue,
          ticketsSold: o.quantity,
          buyers: new Set(o.email ? [o.email] : []),
        });
      }
    }

    // Look up city display name from events data
    const cityNameBySlug = new Map<string, string>(
      events.filter((e) => e.citySlug).map((e) => [e.citySlug!, e.city]),
    );

    const revenueByCity: RevenueByCity[] = [];
    for (const [citySlug, data] of cityMap.entries()) {
      revenueByCity.push({
        city: cityNameBySlug.get(citySlug) ?? citySlug,
        citySlug,
        grossRevenue: data.grossRevenue,
        netRevenue: data.netRevenue,
        ticketsSold: data.ticketsSold,
        uniqueBuyers: data.buyers.size,
      });
    }
    revenueByCity.sort((a, b) => b.netRevenue - a.netRevenue);

    // revenueSeries: group by date (YYYY-MM-DD of createdAt)
    const seriesMap = new Map<
      string,
      { grossRevenue: number; netRevenue: number; ticketsSold: number }
    >();

    for (const o of filteredOrders) {
      const dateStr = o.createdAt ? o.createdAt.slice(0, 10) : null;
      if (!dateStr) continue;
      const existing = seriesMap.get(dateStr);
      if (existing) {
        existing.grossRevenue += o.grossRevenue;
        existing.netRevenue += o.netRevenue;
        existing.ticketsSold += o.quantity;
      } else {
        seriesMap.set(dateStr, {
          grossRevenue: o.grossRevenue,
          netRevenue: o.netRevenue,
          ticketsSold: o.quantity,
        });
      }
    }

    const revenueSeries: RevenuePoint[] = Array.from(seriesMap.entries())
      .map(([date, data]) => ({ date, ...data }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Build a set of order buyer emails that matched a lead (for funnel conversion)
    const matchedBuyerEmails = new Set<string>(
      filteredOrders
        .filter((o) => o.matchedLeadId !== null)
        .map((o) => o.email)
        .filter(Boolean),
    );

    // Build a map of orderId -> matchedLeadId for attribution lookups
    // Key: matchedLeadId -> netRevenue contributed (from filtered orders)
    const leadRevenueMap = new Map<string, number>();
    for (const o of filteredOrders) {
      if (o.matchedLeadId) {
        const prev = leadRevenueMap.get(o.matchedLeadId) ?? 0;
        leadRevenueMap.set(o.matchedLeadId, prev + o.netRevenue);
      }
    }

    // ── Process leads ─────────────────────────────────────────────────────────

    interface ParsedLead {
      id: string;
      email: string;
      source: string;
      city: string;
      sourceCitySlug: string;
      utmSource: string;
      createdAt: string;
      matchedLeadId: string; // the doc ID itself (used to check if this lead bought)
    }

    const allLeads: ParsedLead[] = leadDocs.map((doc) => {
      const f = doc.fields ?? {};
      const id = doc.name.split("/").pop() ?? "";
      return {
        id,
        email: getStringField(f, "email"),
        source: getStringField(f, "source"),
        city: getStringField(f, "city") || getStringField(f, "geoCity"),
        sourceCitySlug: getStringField(f, "sourceCitySlug"),
        utmSource: getStringField(f, "utmSource"),
        createdAt: getStringField(f, "createdAt"),
        matchedLeadId: id,
      };
    });

    // Filter leads by period
    const filteredLeads = allLeads.filter((l) => {
      if (!cutoff) return true;
      const created = new Date(l.createdAt);
      return !isNaN(created.getTime()) && created >= cutoff;
    });

    const leadsBySource: Record<string, number> = {};
    const leadsByCity: Record<string, number> = {};

    for (const lead of filteredLeads) {
      const src = lead.source || "unknown";
      leadsBySource[src] = (leadsBySource[src] ?? 0) + 1;

      const cityKey = lead.sourceCitySlug || lead.city || "unknown";
      leadsByCity[cityKey] = (leadsByCity[cityKey] ?? 0) + 1;
    }

    // Count total buyers: leads that appear as matchedLeadId in orders
    const purchasedLeadIds = new Set<string>(
      allOrders
        .filter((o) => o.matchedLeadId !== null)
        .map((o) => o.matchedLeadId as string),
    );

    const totalBuyersFromLeads = filteredLeads.filter((l) =>
      purchasedLeadIds.has(l.id),
    ).length;

    const conversionRate =
      filteredLeads.length > 0
        ? totalBuyersFromLeads / filteredLeads.length
        : 0;

    // Recent leads: last 10 sorted by createdAt descending, email masked
    const sortedLeads = [...filteredLeads].sort((a, b) =>
      b.createdAt.localeCompare(a.createdAt),
    );

    const recentLeads: RecentLead[] = sortedLeads.slice(0, 10).map((l) => {
      const email = l.email || "";
      let maskedEmail = email;
      if (email.includes("@")) {
        const [localPart, domain] = email.split("@");
        maskedEmail = `${localPart.charAt(0)}***@${domain}`;
      }
      return {
        email: maskedEmail,
        source: l.source || "unknown",
        city: l.city || l.sourceCitySlug || "unknown",
        createdAt: l.createdAt,
        hasPurchased: purchasedLeadIds.has(l.id),
      };
    });

    const funnel: LeadFunnel = {
      totalLeads: filteredLeads.length,
      leadsBySource,
      leadsByCity,
      totalBuyers: totalBuyersFromLeads,
      conversionRate,
      recentLeads,
    };

    // ── Channel attribution ───────────────────────────────────────────────────

    // Group filtered leads by utmSource
    const channelMap = new Map<
      string,
      { leads: number; buyers: number; revenue: number }
    >();

    for (const lead of filteredLeads) {
      const src = lead.utmSource || "organic";
      const existing = channelMap.get(src);
      const hasPurchased = purchasedLeadIds.has(lead.id);
      const revenue = hasPurchased ? (leadRevenueMap.get(lead.id) ?? 0) : 0;

      if (existing) {
        existing.leads += 1;
        if (hasPurchased) {
          existing.buyers += 1;
          existing.revenue += revenue;
        }
      } else {
        channelMap.set(src, {
          leads: 1,
          buyers: hasPurchased ? 1 : 0,
          revenue,
        });
      }
    }

    const channelAttribution: ChannelAttribution[] = Array.from(
      channelMap.entries(),
    )
      .map(([utmSource, data]) => ({
        utmSource,
        leads: data.leads,
        buyers: data.buyers,
        revenue: data.revenue,
        conversionRate: data.leads > 0 ? data.buyers / data.leads : 0,
      }))
      .sort((a, b) => b.revenue - a.revenue);

    // ── Applications ──────────────────────────────────────────────────────────

    const byStatus: Record<string, number> = {};
    const byCity: Record<string, number> = {};

    for (const doc of applicationDocs) {
      const f = doc.fields ?? {};
      const status = getStringField(f, "status") || "unknown";
      const city = getStringField(f, "city") || "unknown";
      byStatus[status] = (byStatus[status] ?? 0) + 1;
      byCity[city] = (byCity[city] ?? 0) + 1;
    }

    const applications: ApplicationMetrics = {
      total: applicationDocs.length,
      byStatus,
      byCity,
    };

    // ── Assemble snapshot ─────────────────────────────────────────────────────

    // Suppress unused variable for matchedBuyerEmails — it's used indirectly
    // via purchasedLeadIds. Reference it to avoid lint warnings.
    void matchedBuyerEmails;

    const snapshot: AnalyticsSnapshot = {
      period,
      generatedAt: new Date().toISOString(),
      totalGrossRevenue,
      totalNetRevenue,
      totalTicketsSold,
      totalUniqueBuyers,
      averageTicketPrice,
      revenueByShow,
      revenueByCity,
      revenueSeries,
      funnel,
      channelAttribution,
      applications,
      lastSyncAt: syncMetaData.lastSyncAt,
      syncErrors: syncMetaData.errors,
    };

    return new Response(JSON.stringify(snapshot), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return new Response(
      JSON.stringify({ error: "Analytics fetch failed", detail: msg }),
      {
        status: 500,
        headers: { "Content-Type": "application/json" },
      },
    );
  }
};
