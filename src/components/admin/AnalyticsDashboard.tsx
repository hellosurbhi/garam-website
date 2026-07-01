import { useState, useEffect, useCallback } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  BarChart,
  Bar,
  type TooltipProps,
} from "recharts";
import { getFirebaseAuth } from "@/lib/firebase";
import type { AnalyticsSnapshot } from "@/types/analytics";
import styles from "./AnalyticsDashboard.module.css";

type TooltipFormatter = NonNullable<TooltipProps["formatter"]>;
type TooltipLabelFormatter = NonNullable<TooltipProps["labelFormatter"]>;

type Period = AnalyticsSnapshot["period"];
const PERIODS: { value: Period; label: string }[] = [
  { value: "7d", label: "7D" },
  { value: "30d", label: "30D" },
  { value: "90d", label: "90D" },
  { value: "all", label: "All" },
];

function fmt(n: number, prefix = "") {
  if (n >= 1000) return `${prefix}${(n / 1000).toFixed(1)}k`;
  return `${prefix}${n.toFixed(0)}`;
}

function fmtMoney(n: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function fmtDateShort(iso: string) {
  return iso.slice(5); // "MM-DD"
}

const revenueFormatter: TooltipFormatter = (value) => [
  fmtMoney(Number(value)),
  "Net Revenue",
];

const dateLabelFormatter: TooltipLabelFormatter = (label) =>
  fmtDate(String(label));

export default function AnalyticsDashboard() {
  const [period, setPeriod] = useState<Period>("30d");
  const [data, setData] = useState<AnalyticsSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  const fetchData = useCallback(async (p: Period) => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await getFirebaseAuth().currentUser?.getIdToken();
      if (!idToken) {
        setError("Session expired. Please log in again.");
        return;
      }
      const res = await fetch(`/api/analytics?period=${p}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Failed to load analytics.");
        return;
      }
      const json = (await res.json()) as AnalyticsSnapshot;
      setData(json);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchData(period);
    })();
  }, [period, fetchData]);

  async function handleSync() {
    setSyncing(true);
    setSyncMsg(null);
    try {
      const idToken = await getFirebaseAuth().currentUser?.getIdToken();
      if (!idToken) {
        setSyncMsg("Session expired.");
        return;
      }
      const res = await fetch("/api/sync-orders", {
        method: "POST",
        headers: { Authorization: `Bearer ${idToken}` },
      });
      const body = (await res.json()) as {
        ok?: boolean;
        ordersProcessed?: number;
        error?: string;
      };
      if (res.ok && body.ok) {
        setSyncMsg(`Synced ${body.ordersProcessed ?? 0} orders`);
        fetchData(period);
      } else {
        setSyncMsg(body.error ?? "Sync failed.");
      }
    } catch {
      setSyncMsg("Sync failed.");
    } finally {
      setSyncing(false);
      setTimeout(() => setSyncMsg(null), 4000);
    }
  }

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingState}>Loading analytics...</div>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.errorState}>
          <p>{error ?? "No data available."}</p>
          <button
            onClick={() => fetchData(period)}
            className={styles.retryButton}
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  const conversionPct = (data.funnel.conversionRate * 100).toFixed(1);
  const hasOrders = data.totalTicketsSold > 0;
  const hasLeads = data.funnel.totalLeads > 0;
  const hasAttribution = data.channelAttribution.length > 0;

  return (
    <div className={styles.dashboard}>
      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.periodGroup}>
          {PERIODS.map((p) => (
            <button
              key={p.value}
              className={styles.periodButton}
              data-active={period === p.value || undefined}
              onClick={() => setPeriod(p.value)}
            >
              {p.label}
            </button>
          ))}
        </div>
        <button
          className={styles.syncButton}
          onClick={handleSync}
          disabled={syncing}
        >
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
        {(syncMsg ?? data.lastSyncAt) && (
          <span className={styles.syncMeta}>
            {syncMsg ? syncMsg : `Last sync: ${fmtDate(data.lastSyncAt!)}`}
          </span>
        )}
      </div>

      {/* KPI cards */}
      <div className={styles.metricsGrid}>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Net Revenue</div>
          <div className={styles.metricValue}>
            {fmtMoney(data.totalNetRevenue)}
          </div>
          <div className={styles.metricSub}>
            {fmtMoney(data.totalGrossRevenue)} gross
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Tickets Sold</div>
          <div className={styles.metricValue}>{fmt(data.totalTicketsSold)}</div>
          <div className={styles.metricSub}>
            {data.totalUniqueBuyers} unique buyers
          </div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Avg Ticket Price</div>
          <div className={styles.metricValue}>
            {fmtMoney(data.averageTicketPrice)}
          </div>
          <div className={styles.metricSub}>net per ticket</div>
        </div>
        <div className={styles.metricCard}>
          <div className={styles.metricLabel}>Conversion Rate</div>
          <div className={styles.metricValue}>{conversionPct}%</div>
          <div className={styles.metricSub}>
            {data.funnel.totalBuyers} of {data.funnel.totalLeads} leads
          </div>
        </div>
      </div>

      {/* Revenue trend */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Revenue Over Time</div>
        {hasOrders && data.revenueSeries.length > 1 ? (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data.revenueSeries}
                margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis
                  dataKey="date"
                  tick={{ fontSize: 11, fill: "#888" }}
                  tickFormatter={fmtDateShort}
                  tickLine={false}
                  axisLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: "#888" }}
                  tickFormatter={(v: number) => `$${fmt(v)}`}
                  tickLine={false}
                  axisLine={false}
                  width={50}
                />
                <Tooltip
                  formatter={revenueFormatter}
                  labelFormatter={dateLabelFormatter}
                />
                <Line
                  type="monotone"
                  dataKey="netRevenue"
                  stroke="#DC2626"
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        ) : (
          <div className={styles.emptyHint}>
            {hasOrders
              ? "Not enough data points to show a trend."
              : "No order data yet. Run a sync once your Eventbrite API token is configured."}
          </div>
        )}
      </div>

      {/* Revenue by show and city */}
      <div className={styles.twoCol}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Revenue by Show</div>
          {data.revenueByShow.length > 0 ? (
            <div className={styles.chartWrap}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={data.revenueByShow.slice(0, 8)}
                  margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#e5e7eb"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="eventDate"
                    tick={{ fontSize: 10, fill: "#888" }}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    tick={{ fontSize: 10, fill: "#888" }}
                    tickFormatter={(v: number) => `$${fmt(v)}`}
                    tickLine={false}
                    axisLine={false}
                    width={44}
                  />
                  <Tooltip formatter={revenueFormatter} />
                  <Bar
                    dataKey="netRevenue"
                    fill="#DC2626"
                    radius={[3, 3, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className={styles.emptyHint}>No show data yet.</div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Revenue by City</div>
          {data.revenueByCity.length > 0 ? (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>City</th>
                  <th>Tickets</th>
                  <th>Revenue</th>
                </tr>
              </thead>
              <tbody>
                {data.revenueByCity.slice(0, 8).map((row) => (
                  <tr key={row.citySlug}>
                    <td>{row.city}</td>
                    <td>{row.ticketsSold}</td>
                    <td>{fmtMoney(row.netRevenue)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className={styles.emptyHint}>No city data yet.</div>
          )}
        </div>
      </div>

      {/* Lead funnel and recent leads */}
      <div className={styles.twoCol}>
        <div className={styles.section}>
          <div className={styles.sectionTitle}>Lead Funnel</div>
          <div className={styles.conversionBig}>{conversionPct}%</div>
          <div className={styles.conversionSub}>
            email-to-ticket conversion rate
          </div>
          <div className={styles.funnelSteps}>
            {[
              {
                label: "Total leads",
                count: data.funnel.totalLeads,
                ratio: 1,
              },
              {
                label: "Bought tickets",
                count: data.funnel.totalBuyers,
                ratio:
                  data.funnel.totalLeads > 0
                    ? data.funnel.totalBuyers / data.funnel.totalLeads
                    : 0,
              },
            ].map((row) => (
              <div key={row.label} className={styles.funnelRow}>
                <div className={styles.funnelLabel}>{row.label}</div>
                <div className={styles.funnelBar}>
                  <div
                    className={styles.funnelFill}
                    style={{ width: `${(row.ratio * 100).toFixed(1)}%` }}
                  />
                </div>
                <div className={styles.funnelCount}>{row.count}</div>
              </div>
            ))}
          </div>

          {hasLeads && (
            <div className={styles.funnelSources}>
              <div className={styles.funnelSourcesLabel}>Top Sources</div>
              {Object.entries(data.funnel.leadsBySource)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 5)
                .map(([src, count]) => (
                  <div key={src} className={styles.funnelRow}>
                    <div className={styles.funnelLabel}>{src}</div>
                    <div className={styles.funnelBar}>
                      <div
                        className={styles.funnelFill}
                        style={{
                          width: `${((count / data.funnel.totalLeads) * 100).toFixed(1)}%`,
                        }}
                      />
                    </div>
                    <div className={styles.funnelCount}>{count}</div>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className={styles.section}>
          <div className={styles.sectionTitle}>Recent Leads</div>
          {data.funnel.recentLeads.length > 0 ? (
            data.funnel.recentLeads.map((lead, i) => (
              <div key={i} className={styles.recentLeadRow}>
                <div>
                  <div className={styles.recentEmail}>{lead.email}</div>
                  <div className={styles.recentMeta}>
                    {lead.source} · {lead.city}
                  </div>
                </div>
                <div>
                  {lead.hasPurchased && (
                    <span className={styles.purchasedBadge}>Purchased</span>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className={styles.emptyHint}>No leads in this period.</div>
          )}
        </div>
      </div>

      {/* Channel attribution */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Channel Attribution</div>
        {hasAttribution ? (
          <table className={styles.table}>
            <thead>
              <tr>
                <th>Source</th>
                <th>Leads</th>
                <th>Buyers</th>
                <th>CVR</th>
                <th>Revenue</th>
              </tr>
            </thead>
            <tbody>
              {data.channelAttribution.map((row) => (
                <tr key={row.utmSource}>
                  <td>
                    <span className={styles.pill}>{row.utmSource}</span>
                  </td>
                  <td>{row.leads}</td>
                  <td>{row.buyers}</td>
                  <td>{(row.conversionRate * 100).toFixed(1)}%</td>
                  <td>{fmtMoney(row.revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className={styles.emptyHint}>
            No UTM-attributed leads in this period. Add UTM parameters to your
            social and ad links to track which channels drive ticket sales.
          </div>
        )}
      </div>

      {/* Applications */}
      <div className={styles.section}>
        <div className={styles.sectionTitle}>Applications</div>
        <div className={styles.metricsGrid}>
          {Object.entries(data.applications.byStatus).map(([status, count]) => (
            <div key={status} className={styles.metricCard}>
              <div className={styles.metricLabel}>{status}</div>
              <div className={styles.metricValue}>{count}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sync errors */}
      {data.syncErrors.length > 0 && (
        <div className={styles.syncErrorList}>
          <div className={styles.syncErrorLabel}>Recent Sync Errors</div>
          {data.syncErrors.map((e, i) => (
            <div key={i} className={styles.syncErrorItem}>
              {e}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
