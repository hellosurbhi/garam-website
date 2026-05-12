import type { Order } from "@/types/analytics";

// Raw Eventbrite API types (not exported)
interface EBOrderCost {
  major_value: string;
}

interface EBAttendee {
  profile: {
    name: string;
    email: string;
  };
}

interface EBOrder {
  id: string;
  event_id: string;
  email: string;
  name: string;
  status: string;
  created: string;
  costs: {
    gross: EBOrderCost;
    net: EBOrderCost;
  };
  attendees: EBAttendee[];
}

interface EBOrdersResponse {
  orders: EBOrder[];
  pagination: {
    has_more_items: boolean;
    continuation?: string;
  };
}

function mapEBOrderToOrder(
  order: EBOrder,
  eventSlug: string,
  syncedAt: string,
): Order {
  const status = (
    ["placed", "refunded", "cancelled"].includes(order.status)
      ? order.status
      : "placed"
  ) as Order["status"];

  return {
    orderId: order.id,
    eventbriteEventId: order.event_id,
    eventSlug,
    email: order.email.toLowerCase(),
    name: order.name,
    quantity: order.attendees.length || 1,
    grossRevenue: parseFloat(order.costs.gross.major_value) || 0,
    netRevenue: parseFloat(order.costs.net.major_value) || 0,
    currency: "USD",
    status,
    createdAt: order.created,
    syncedAt,
    matchedLeadId: null,
    attendees: order.attendees.map((a) => ({
      name: a.profile.name,
      email: a.profile.email,
    })),
  };
}

export interface FetchOrdersResult {
  orders: Order[];
  rateLimitRemaining: number;
}

export async function fetchEventOrders(
  eventbriteId: string,
  eventSlug: string,
  token: string,
  modifiedSince?: string,
): Promise<FetchOrdersResult> {
  const syncedAt = new Date().toISOString();
  const allOrders: Order[] = [];
  let continuation: string | undefined;
  let rateLimitRemaining = 1000;

  do {
    const url = new URL(
      `https://www.eventbriteapi.com/v3/events/${eventbriteId}/orders/`,
    );
    url.searchParams.set("expand", "attendees");
    if (modifiedSince) {
      url.searchParams.set("changed_since", modifiedSince);
    }
    if (continuation) {
      url.searchParams.set("continuation", continuation);
    }

    const res = await fetch(url.toString(), {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: "application/json",
      },
    });

    // Track rate limit from response header
    const remaining = res.headers.get("X-RateLimit-Remaining");
    if (remaining !== null) {
      rateLimitRemaining = parseInt(remaining, 10);
    }

    if (rateLimitRemaining < 100) {
      // Log warning but still process this response; caller should slow down
      process.stdout.write(
        `[eventbrite] Rate limit low: ${rateLimitRemaining} remaining\n`,
      );
    }

    if (!res.ok) {
      const body = await res.text();
      throw new Error(
        `Eventbrite API error for event ${eventbriteId}: ${res.status} ${body}`,
      );
    }

    const data = (await res.json()) as EBOrdersResponse;

    for (const order of data.orders) {
      allOrders.push(mapEBOrderToOrder(order, eventSlug, syncedAt));
    }

    continuation = data.pagination.has_more_items
      ? data.pagination.continuation
      : undefined;
  } while (continuation);

  return { orders: allOrders, rateLimitRemaining };
}
