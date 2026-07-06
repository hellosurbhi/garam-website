import { useState, useEffect, useMemo, useCallback } from "react";
import { getFirebaseAuth } from "@/lib/firebase";
import type { WaitlistLead } from "@/pages/api/admin/leads";
import styles from "./WaitlistTab.module.css";

async function adminIdToken(): Promise<string | null> {
  return (await (await getFirebaseAuth()).currentUser?.getIdToken()) ?? null;
}

function fmtDate(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
}

export default function WaitlistTab() {
  const [leads, setLeads] = useState<WaitlistLead[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [exporting, setExporting] = useState(false);

  const fetchLeads = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const idToken = await adminIdToken();
      if (!idToken) {
        setError("Session expired. Please log in again.");
        return;
      }
      const res = await fetch("/api/admin/leads", {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Failed to load waitlist.");
        return;
      }
      const json = (await res.json()) as { total: number; leads: WaitlistLead[] };
      setLeads(json.leads);
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchLeads();
    })();
  }, [fetchLeads]);

  const filtered = useMemo(() => {
    const q = cityFilter.trim().toLowerCase();
    if (!q) return leads;
    return leads.filter(
      (l) =>
        l.city.toLowerCase().includes(q) ||
        l.sourceCitySlug.toLowerCase().includes(q),
    );
  }, [leads, cityFilter]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try {
      const idToken = await adminIdToken();
      if (!idToken) {
        setError("Session expired. Please log in again.");
        return;
      }
      const q = new URLSearchParams({ format: "csv" });
      const city = cityFilter.trim();
      if (city) q.set("city", city);
      const res = await fetch(`/api/admin/leads?${q.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setError("Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waitlist${city ? `-${city.toLowerCase()}` : ""}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [cityFilter]);

  if (loading) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.loadingState}>Loading waitlist...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.dashboard}>
        <div className={styles.errorState}>
          <p>{error}</p>
          <button onClick={() => void fetchLeads()} className={styles.retryButton}>
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.dashboard}>
      <div className={styles.toolbar}>
        <input
          type="text"
          value={cityFilter}
          onChange={(e) => setCityFilter(e.target.value)}
          placeholder="Filter by city..."
          aria-label="Filter waitlist by city"
          className={styles.filterInput}
        />
        <span className={styles.count}>
          {filtered.length} {filtered.length === 1 ? "signup" : "signups"}
        </span>
        <button
          onClick={() => void handleExport()}
          disabled={exporting || filtered.length === 0}
          className={styles.exportButton}
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>

      <div className={styles.section}>
        {filtered.length === 0 ? (
          <div className={styles.emptyHint}>
            {leads.length === 0
              ? "No waitlist signups yet."
              : "No signups match this city filter."}
          </div>
        ) : (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>City</th>
                  <th>Name</th>
                  <th>Email</th>
                  <th>Phone</th>
                  <th>Source</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((l) => (
                  <tr key={l.id}>
                    <td>{l.city}</td>
                    <td>{l.name}</td>
                    <td>{l.email}</td>
                    <td>{l.phone}</td>
                    <td>
                      <span className={styles.pill}>{l.source || "unknown"}</span>
                    </td>
                    <td>{fmtDate(l.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
