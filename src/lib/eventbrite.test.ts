import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchEventOrders } from "./eventbrite";

const mockOrderResponse = {
  orders: [
    {
      id: "order-1",
      event_id: "event-123",
      email: "Buyer@Example.com",
      name: "Test Buyer",
      status: "placed",
      created: "2024-01-15T18:30:00Z",
      costs: {
        gross: { major_value: "15.00" },
        net: { major_value: "13.50" },
      },
      attendees: [
        { profile: { name: "Test Buyer", email: "Buyer@Example.com" } },
      ],
    },
  ],
  pagination: { has_more_items: false },
};

describe("fetchEventOrders", () => {
  const mockFetch = vi.fn();

  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  it("fetches orders and maps them correctly", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "500" },
      json: async () => mockOrderResponse,
    });

    const result = await fetchEventOrders(
      "event-123",
      "manhattan",
      "test-token",
    );

    expect(result.orders).toHaveLength(1);
    expect(result.orders[0].orderId).toBe("order-1");
    expect(result.orders[0].email).toBe("buyer@example.com"); // lowercased
    expect(result.orders[0].grossRevenue).toBe(15);
    expect(result.orders[0].netRevenue).toBe(13.5);
    expect(result.orders[0].quantity).toBe(1);
    expect(result.orders[0].matchedLeadId).toBeNull();
  });

  it("handles pagination", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "500" },
        json: async () => ({
          ...mockOrderResponse,
          pagination: { has_more_items: true, continuation: "page2" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "499" },
        json: async () => mockOrderResponse,
      });

    const result = await fetchEventOrders(
      "event-123",
      "manhattan",
      "test-token",
    );
    expect(result.orders).toHaveLength(2);
    expect(mockFetch).toHaveBeenCalledTimes(2);
  });

  it("throws on API error", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 401,
      headers: { get: () => null },
      text: async () => "Unauthorized",
    });

    await expect(
      fetchEventOrders("event-123", "manhattan", "bad-token"),
    ).rejects.toThrow("Eventbrite API error");
  });

  it("includes continuation token in second request URL", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "500" },
        json: async () => ({
          ...mockOrderResponse,
          pagination: { has_more_items: true, continuation: "tok-abc" },
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        headers: { get: () => "490" },
        json: async () => mockOrderResponse,
      });

    await fetchEventOrders("event-123", "manhattan", "test-token");

    const secondCallUrl = mockFetch.mock.calls[1][0] as string;
    expect(secondCallUrl).toContain("continuation=tok-abc");
  });

  it("sets modifiedSince as changed_since query param when provided", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "500" },
      json: async () => mockOrderResponse,
    });

    await fetchEventOrders(
      "event-123",
      "manhattan",
      "test-token",
      "2024-01-01T00:00:00Z",
    );

    const url = mockFetch.mock.calls[0][0] as string;
    expect(url).toContain("changed_since=2024-01-01T00%3A00%3A00Z");
  });

  it("reports rateLimitRemaining from response header", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "42" },
      json: async () => mockOrderResponse,
    });

    const result = await fetchEventOrders(
      "event-123",
      "manhattan",
      "test-token",
    );
    expect(result.rateLimitRemaining).toBe(42);
  });

  it("normalises unknown order status to placed", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      headers: { get: () => "500" },
      json: async () => ({
        orders: [
          {
            ...mockOrderResponse.orders[0],
            status: "pending",
          },
        ],
        pagination: { has_more_items: false },
      }),
    });

    const result = await fetchEventOrders(
      "event-123",
      "manhattan",
      "test-token",
    );
    expect(result.orders[0].status).toBe("placed");
  });
});
