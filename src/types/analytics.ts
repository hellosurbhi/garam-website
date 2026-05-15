/** Attendee on an Eventbrite order. */
export interface OrderAttendee {
  name: string;
  email: string;
}

/** Firestore document in the `orders` collection (keyed by Eventbrite order ID). */
export interface Order {
  orderId: string; // Eventbrite order ID
  eventbriteEventId: string; // Eventbrite event ID
  eventSlug: string; // matches citySlug in src/data/events.ts (e.g. "manhattan")
  email: string; // buyer email (lowercase)
  name: string; // buyer name
  quantity: number; // number of tickets
  grossRevenue: number; // in dollars (before fees/discounts)
  netRevenue: number; // in dollars (after fees/discounts)
  currency: string; // e.g. "USD"
  status: "placed" | "refunded" | "cancelled";
  createdAt: string; // ISO 8601 timestamp from Eventbrite
  syncedAt: string; // ISO 8601 timestamp when we synced this
  matchedLeadId: string | null; // Firestore lead doc ID if email matched
  attendees: OrderAttendee[];
}

/** Firestore document in syncMeta/eventbrite. */
export interface SyncMeta {
  lastSyncAt: string; // ISO 8601 timestamp
  ordersProcessed: number; // total orders ever processed
  errors: string[]; // recent error messages (last 10)
}

/** Revenue breakdown per show. */
export interface RevenueByShow {
  eventbriteEventId: string;
  eventSlug: string;
  eventDate: string; // human-readable from events.ts
  city: string;
  grossRevenue: number;
  netRevenue: number;
  ticketsSold: number;
  uniqueBuyers: number;
}

/** Revenue breakdown per city. */
export interface RevenueByCity {
  city: string;
  citySlug: string;
  grossRevenue: number;
  netRevenue: number;
  ticketsSold: number;
  uniqueBuyers: number;
}

/** Individual lead entry in the funnel's recent leads list. */
export interface RecentLead {
  email: string; // masked: "j***@gmail.com"
  source: string;
  city: string;
  createdAt: string; // ISO 8601
  hasPurchased: boolean; // matchedLeadId found
}

/** Lead funnel metrics. */
export interface LeadFunnel {
  totalLeads: number;
  leadsBySource: Record<string, number>; // source -> count
  leadsByCity: Record<string, number>; // citySlug -> count
  totalBuyers: number; // orders with matchedLeadId != null
  conversionRate: number; // 0-1 (buyers / totalLeads)
  recentLeads: RecentLead[]; // last 10
}

/** Channel attribution: UTM source mapped to metrics. */
export interface ChannelAttribution {
  utmSource: string; // "instagram", "organic", "email", etc.
  leads: number;
  buyers: number;
  revenue: number; // net revenue attributed to this source
  conversionRate: number; // 0-1
}

/** Application pipeline metrics. */
export interface ApplicationMetrics {
  total: number;
  byStatus: Record<string, number>; // "New" | "Contacted" | "Cast" | "Rejected" -> count
  byCity: Record<string, number>; // city -> count
}

/** Revenue time series point. */
export interface RevenuePoint {
  date: string; // "YYYY-MM-DD"
  grossRevenue: number;
  netRevenue: number;
  ticketsSold: number;
}

/** Full analytics snapshot returned by /api/analytics. */
export interface AnalyticsSnapshot {
  period: "7d" | "30d" | "90d" | "all";
  generatedAt: string; // ISO 8601
  // Revenue
  totalGrossRevenue: number;
  totalNetRevenue: number;
  totalTicketsSold: number;
  totalUniqueBuyers: number;
  averageTicketPrice: number; // totalNetRevenue / totalTicketsSold
  revenueByShow: RevenueByShow[];
  revenueByCity: RevenueByCity[];
  revenueSeries: RevenuePoint[];
  // Leads
  funnel: LeadFunnel;
  // Attribution
  channelAttribution: ChannelAttribution[];
  // Applications
  applications: ApplicationMetrics;
  // Sync status
  lastSyncAt: string | null;
  syncErrors: string[];
}
