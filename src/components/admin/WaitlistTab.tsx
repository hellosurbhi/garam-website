import { useState, useEffect, useRef, useCallback } from "react";
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState("");
  const [debouncedCity, setDebouncedCity] = useState("");
  const [exporting, setExporting] = useState(false);
  const [exportError, setExportError] = useState<string | null>(null);
  const loadedOnce = useRef(false);

  // Debounce the raw input so we hit the endpoint once the operator stops
  // typing rather than on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedCity(cityFilter.trim()), 300);
    return () => clearTimeout(t);
  }, [cityFilter]);

  const fetchLeads = useCallback(async (city: string) => {
    if (loadedOnce.current) setRefreshing(true);
    else setLoading(true);
    setError(null);
    try {
      const idToken = await adminIdToken();
      if (!idToken) {
        setError("Session expired. Please log in again.");
        return;
      }
      const qs = new URLSearchParams();
      if (city) qs.set("city", city);
      const query = qs.toString();
      const res = await fetch(
        `/api/admin/leads${query ? `?${query}` : ""}`,
        { headers: { Authorization: `Bearer ${idToken}` } },
      );
      if (!res.ok) {
        const body = (await res.json()) as { error?: string };
        setError(body.error ?? "Failed to load waitlist.");
        return;
      }
      const json = (await res.json()) as { total: number; leads: WaitlistLead[] };
      setLeads(json.leads);
      loadedOnce.current = true;
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await fetchLeads(debouncedCity);
    })();
  }, [debouncedCity, fetchLeads]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    setExportError(null);
    try {
      const idToken = await adminIdToken();
      if (!idToken) {
        setExportError("Session expired. Please log in again.");
        return;
      }
      const q = new URLSearchParams({ format: "csv" });
      if (debouncedCity) q.set("city", debouncedCity);
      const res = await fetch(`/api/admin/leads?${q.toString()}`, {
        headers: { Authorization: `Bearer ${idToken}` },
      });
      if (!res.ok) {
        setExportError("Export failed. Please try again.");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `waitlist${debouncedCity ? `-${debouncedCity.toLowerCase()}` : ""}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch {
      setExportError("Export failed. Please try again.");
    } finally {
      setExporting(false);
    }
  }, [debouncedCity]);

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
        <div className={styles.errorState} role="alert">
          <p>{error}</p>
          <button
            onClick={() => void fetchLeads(debouncedCity)}
            className={styles.retryButton}
          >
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
          {refreshing
            ? "Updating..."
            : `${leads.length} ${leads.length === 1 ? "signup" : "signups"}`}
        </span>
        <button
          onClick={() => void handleExport()}
          disabled={exporting || leads.length === 0}
          className={styles.exportButton}
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </button>
      </div>
      {exportError && (
        <p className={styles.exportError} role="alert">{exportError}</p>
      )}

      <div className={styles.section}>
        {leads.length === 0 ? (
          <div className={styles.emptyHint}>
            {debouncedCity
              ? "No signups match this city filter."
              : "No waitlist signups yet."}
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
                {leads.map((l) => (
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
