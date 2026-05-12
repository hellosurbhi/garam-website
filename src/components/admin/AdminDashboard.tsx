import { useState, useEffect, useMemo, useRef } from "react";
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  Timestamp,
} from "firebase/firestore";
import { ChevronRight, ChevronDown, Copy, Check } from "lucide-react";
import Select from "react-select";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase";
import { type Application } from "@/types/application";
import { adminSelectStyles } from "@/utils/reactSelectStyles";
import { events } from "@/data/events";
import Skeleton from "../ui/Skeleton";
import ApplicantCard from "./ApplicantCard";
import ApplicantModal from "./ApplicantModal";
import AnalyticsDashboard from "./AnalyticsDashboard";
import styles from "./AdminDashboard.module.css";

interface AdminDashboardProps {
  onLogout: () => void;
}

type FilterOption = { value: string; label: string };

const GENDER_OPTIONS: FilterOption[] = [
  { value: "Man", label: "Man" },
  { value: "Woman", label: "Woman" },
  { value: "Non-binary", label: "Non-binary" },
  { value: "Other", label: "Other" },
];

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<"applicants" | "analytics">(
    "applicants",
  );
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [deletedOpen, setDeletedOpen] = useState(false);

  const [genderFilter, setGenderFilter] = useState<readonly FilterOption[]>([]);
  const [cityFilter, setCityFilter] = useState<readonly FilterOption[]>([]);
  const [prepLinkLoading, setPrepLinkLoading] = useState<string | null>(null);
  const [prepLinkCopied, setPrepLinkCopied] = useState<string | null>(null);

  const today = new Date().toLocaleDateString("en-CA");
  const upcomingEvents = events.filter(
    (e) => e.isoDate && e.isoDate > today && !e.hidden,
  );

  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  useEffect(
    () => () => {
      clearTimeout(toastTimerRef.current);
    },
    [],
  );

  function showToast(msg: string, ok: boolean) {
    clearTimeout(toastTimerRef.current);
    setToast({ msg, ok });
    toastTimerRef.current = setTimeout(() => setToast(null), 2500);
  }

  async function handleCopyPrepLink(isoDate: string) {
    setPrepLinkLoading(isoDate);
    try {
      const idToken = await getFirebaseAuth().currentUser?.getIdToken();
      if (!idToken) {
        showToast("Session expired. Please log in again.", false);
        return;
      }
      const res = await fetch("/api/generate-contestant-link", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({ showDate: isoDate }),
      });
      let url: string;
      if (res.ok) {
        ({ url } = (await res.json()) as { url: string });
      } else {
        url = `${window.location.origin}/contestant-prep`;
      }
      try {
        await navigator.clipboard.writeText(url);
      } catch {
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
      }
      setPrepLinkCopied(isoDate);
      setTimeout(() => setPrepLinkCopied(null), 2000);
      if (!res.ok) {
        showToast("Copied link (without auth token)", true);
      }
    } catch {
      showToast("Failed to generate link", false);
    } finally {
      setPrepLinkLoading(null);
    }
  }

  async function fetchApps() {
    setLoading(true);
    setFetchError(false);
    try {
      const snap = await getDocs(collection(getFirebaseDb(), "applications"));
      const docs = snap.docs.map(
        (d) => ({ id: d.id, ...d.data() }) as Application,
      );
      setApplications(docs);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchApps();
  }, []);

  async function handleUpdate(
    id: string,
    patch: Partial<Omit<Application, "id">>,
  ) {
    try {
      await updateDoc(doc(getFirebaseDb(), "applications", id), patch);
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
      setSelectedApp((prev) =>
        prev?.id === id ? { ...prev, ...patch } : prev,
      );
      showToast("Saved", true);
    } catch {
      showToast("Save failed", false);
    }
  }

  async function handleDelete(id: string) {
    await handleUpdate(id, { deletedAt: Timestamp.now() } as Partial<
      Omit<Application, "id">
    >);
    setSelectedApp(null);
  }

  function handleRestore(id: string) {
    handleUpdate(id, { deletedAt: null });
  }

  const cityOptions = useMemo(() => {
    const cities = new Set(
      applications
        .filter((a) => !a.deletedAt && a.city?.trim())
        .map((a) => a.city.trim()),
    );
    return [...cities].sort().map((c) => ({ value: c, label: c }));
  }, [applications]);

  function clearFilters() {
    setGenderFilter([]);
    setCityFilter([]);
  }

  const { activeApps, deletedApps } = useMemo(() => {
    const active = applications.filter((a) => !a.deletedAt);
    const deleted = applications.filter((a) => !!a.deletedAt);

    let result = [...active];
    if (genderFilter.length > 0) {
      const selected = new Set(genderFilter.map((o) => o.value));
      result = result.filter((a) => selected.has(a.gender));
    }
    if (cityFilter.length > 0) {
      const selected = new Set(cityFilter.map((o) => o.value));
      result = result.filter((a) => selected.has(a.city?.trim()));
    }

    result.sort(
      (a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0),
    );
    result.sort((a, b) => {
      const aRej = a.status === "Rejected" ? 1 : 0;
      const bRej = b.status === "Rejected" ? 1 : 0;
      return aRej - bRej;
    });

    deleted.sort((a, b) => {
      const aTime =
        a.deletedAt && "seconds" in a.deletedAt ? a.deletedAt.seconds : 0;
      const bTime =
        b.deletedAt && "seconds" in b.deletedAt ? b.deletedAt.seconds : 0;
      return bTime - aTime;
    });

    return { activeApps: result, deletedApps: deleted };
  }, [applications, genderFilter, cityFilter]);

  const hasActiveFilters = genderFilter.length > 0 || cityFilter.length > 0;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Admin</h1>
            <div className={styles.tabs}>
              <button
                className={styles.tab}
                data-active={activeTab === "applicants" || undefined}
                onClick={() => setActiveTab("applicants")}
              >
                Applicants
                {!loading && activeTab === "applicants" && (
                  <span className={styles.tabCount}>{activeApps.length}</span>
                )}
              </button>
              <button
                className={styles.tab}
                data-active={activeTab === "analytics" || undefined}
                onClick={() => setActiveTab("analytics")}
              >
                Analytics
              </button>
            </div>
          </div>
          <button onClick={onLogout} className={styles.logoutButton}>
            Logout
          </button>
        </div>

        {activeTab === "applicants" && (
          <div className={styles.filterBar}>
            <div className={styles.filterRow}>
              <div className={styles.filterItem}>
                <Select
                  isMulti
                  options={GENDER_OPTIONS}
                  value={genderFilter}
                  onChange={(v) => setGenderFilter(v)}
                  placeholder="Gender…"
                  styles={adminSelectStyles<FilterOption>()}
                  aria-label="Filter by gender"
                />
              </div>
              <div className={styles.filterItemWide}>
                <Select
                  isMulti
                  options={cityOptions}
                  value={cityFilter}
                  onChange={(v) => setCityFilter(v)}
                  placeholder="City…"
                  styles={adminSelectStyles<FilterOption>()}
                  aria-label="Filter by city"
                />
              </div>
              {hasActiveFilters && (
                <button onClick={clearFilters} className={styles.clearButton}>
                  Clear all
                </button>
              )}
            </div>
          </div>
        )}
      </header>

      {activeTab === "analytics" && <AnalyticsDashboard />}

      {activeTab === "applicants" && upcomingEvents.length > 0 && (
        <div className={styles.prepSection}>
          <div className={styles.prepBox}>
            <span className={styles.prepLabel}>Contestant Prep Links</span>
            <div className={styles.prepList}>
              {upcomingEvents.map((event) => {
                const isCopied = prepLinkCopied === event.isoDate;
                const isLoading = prepLinkLoading === event.isoDate;
                return (
                  <div key={event.isoDate} className={styles.prepRow}>
                    <span className={styles.prepEventLabel}>
                      {event.date}: {event.city}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleCopyPrepLink(event.isoDate!)}
                      disabled={isLoading}
                      className={styles.copyButton}
                      data-copied={isCopied || undefined}
                    >
                      {isCopied ? <Check size={14} /> : <Copy size={14} />}
                      {isLoading
                        ? "Generating…"
                        : isCopied
                          ? "Copied!"
                          : "Copy Link"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {activeTab === "applicants" && (
        <main className={styles.main}>
          {loading ? (
            <div
              role="status"
              aria-live="polite"
              aria-label="Loading applications"
            >
              <Skeleton count={5} />
            </div>
          ) : fetchError ? (
            <div className={styles.errorState}>
              <p style={{ marginBottom: "12px" }}>
                Failed to load applications.
              </p>
              <button onClick={fetchApps} className={styles.retryButton}>
                Try again
              </button>
            </div>
          ) : applications.length === 0 ? (
            <div className={styles.emptyState}>
              No applications yet. Share the link! 🌶️
            </div>
          ) : activeApps.length === 0 && deletedApps.length === 0 ? (
            <div className={styles.emptyState}>
              <p style={{ marginBottom: "12px" }}>
                No applications match these filters.
              </p>
              <button
                onClick={clearFilters}
                className={styles.clearFiltersButton}
              >
                Clear filters
              </button>
            </div>
          ) : (
            <>
              <p className={styles.summary}>
                Showing {activeApps.length} active · {deletedApps.length}{" "}
                deleted
              </p>

              {activeApps.length > 0 && (
                <div className={styles.grid}>
                  {activeApps.map((app) => (
                    <ApplicantCard
                      key={app.id}
                      app={app}
                      onClick={() => setSelectedApp(app)}
                      onDelete={() => handleDelete(app.id)}
                      dimmed={app.status === "Rejected"}
                    />
                  ))}
                </div>
              )}

              {deletedApps.length > 0 && (
                <div className={styles.deletedSection}>
                  <button
                    onClick={() => setDeletedOpen((v) => !v)}
                    className={styles.deletedToggle}
                    aria-expanded={deletedOpen}
                    aria-controls="deleted-apps-list"
                  >
                    {deletedOpen ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    Deleted Applications ({deletedApps.length})
                  </button>

                  {deletedOpen && (
                    <div id="deleted-apps-list" className={styles.grid}>
                      {deletedApps.map((app) => (
                        <ApplicantCard
                          key={app.id}
                          app={app}
                          onClick={() => setSelectedApp(app)}
                          onRestore={() => handleRestore(app.id)}
                          dimmed
                        />
                      ))}
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </main>
      )}

      {activeTab === "applicants" && selectedApp && (
        <ApplicantModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onRestore={handleRestore}
        />
      )}

      {toast && (
        <div
          className={styles.toast}
          style={{
            background: toast.ok ? "var(--success)" : "var(--brand-red)",
          }}
          role="alert"
          aria-live="assertive"
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
