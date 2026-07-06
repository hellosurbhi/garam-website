import { useState, useEffect, useMemo, useCallback } from "react";
import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc,
  where,
  Timestamp,
  serverTimestamp,
  query,
  orderBy,
  limit,
  startAfter,
  type QueryDocumentSnapshot,
  type DocumentData,
} from "firebase/firestore";
import { ChevronRight, ChevronDown, Search, X } from "lucide-react";
import Select from "react-select";
import { getFirebaseDb, getFirebaseAuth } from "@/lib/firebase";
import {
  type Application,
  type ApplicantStatus,
  STATUS_COLORS,
  STATUS_ORDER,
  STATUS_SECTION_DEFAULTS,
} from "@/types/application";
import { adminSelectStyles } from "@/utils/reactSelectStyles";
import Skeleton from "../ui/Skeleton";
import ApplicantCard from "./ApplicantCard";
import ApplicantModal from "./ApplicantModal";
import AnalyticsDashboard from "./AnalyticsDashboard";
import ContestantFunnel from "./ContestantFunnel";
import TaskInbox from "./TaskInbox";
import WaitlistTab from "./WaitlistTab";
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

const ORIENTATION_OPTIONS: FilterOption[] = [
  { value: "Straight", label: "Straight" },
  { value: "Gay", label: "Gay" },
  { value: "Bisexual", label: "Bisexual" },
  { value: "Other", label: "Other" },
];

function sectionId(status: ApplicantStatus): string {
  return `section-${status.toLowerCase().replace(/\s+/g, "-")}`;
}

interface StatusSectionProps {
  status: ApplicantStatus;
  apps: Application[];
  onCardClick: (app: Application) => void;
  onDelete: (id: string) => void;
  onParticipated: (id: string) => void;
}

function StatusSection({
  status,
  apps,
  onCardClick,
  onDelete,
  onParticipated,
}: StatusSectionProps) {
  const [isOpen, setIsOpen] = useState(STATUS_SECTION_DEFAULTS[status]);
  const id = sectionId(status);
  const isDimmed =
    status === "Rejected" ||
    status === "Not Interested" ||
    status === "Not Interested Anymore" ||
    status === "Bailed";

  return (
    <div id={id} className={styles.statusSection}>
      <button
        onClick={() => setIsOpen((v) => !v)}
        className={styles.sectionToggle}
        aria-expanded={isOpen}
        aria-controls={`${id}-list`}
      >
        <span
          className={styles.sectionDot}
          style={{ background: STATUS_COLORS[status] }}
        />
        {status} ({apps.length})
        {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>

      {isOpen && (
        <div id={`${id}-list`}>
          {apps.length === 0 ? (
            <p className={styles.emptySection}>No applications</p>
          ) : (
            <div className={styles.grid}>
              {apps.map((app) => (
                <ApplicantCard
                  key={app.id}
                  app={app}
                  onClick={() => onCardClick(app)}
                  onDelete={() => onDelete(app.id)}
                  onParticipated={() => onParticipated(app.id)}
                  dimmed={isDimmed}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Statuses that are definitively closed — these apps never appear in the Today inbox.
// "Cast" is intentionally omitted: cast members still need waiver nudging.
const INBOX_EXCLUDED_STATUSES: ApplicantStatus[] = [
  "Rejected",
  "Not Interested",
  "Not Interested Anymore",
  "Said Not Now",
  "Bailed",
  "Participated",
];

const PAGE_SIZE = 50;

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [activeTab, setActiveTab] = useState<
    "today" | "applicants" | "analytics" | "waitlist"
  >("today");
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [inboxApps, setInboxApps] = useState<Application[]>([]);
  const [inboxLoading, setInboxLoading] = useState(true);
  const [inboxError, setInboxError] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [deletedOpen, setDeletedOpen] = useState(false);
  const [participatedOpen, setParticipatedOpen] = useState(false);

  const [lastDoc, setLastDoc] =
    useState<QueryDocumentSnapshot<DocumentData> | null>(null);
  const [hasMore, setHasMore] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);

  const [genderFilter, setGenderFilter] = useState<readonly FilterOption[]>([]);
  const [orientationFilter, setOrientationFilter] = useState<
    readonly FilterOption[]
  >([]);
  const [cityFilter, setCityFilter] = useState<readonly FilterOption[]>([]);
  const [nameSearch, setNameSearch] = useState("");

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;
    if (toast) {
      timer = setTimeout(() => setToast(null), 2500);
    }
    return () => clearTimeout(timer);
  }, [toast]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
  }

  const fetchApps = useCallback(
    async (after?: QueryDocumentSnapshot<DocumentData> | null) => {
      if (after) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }
      setFetchError(false);
      try {
        const colRef = collection(await getFirebaseDb(), "applications");
        const q = after
          ? query(
              colRef,
              orderBy("submittedAt", "desc"),
              startAfter(after),
              limit(PAGE_SIZE),
            )
          : query(colRef, orderBy("submittedAt", "desc"), limit(PAGE_SIZE));
        const snap = await getDocs(q);
        const docs = snap.docs.map(
          (d) => ({ id: d.id, ...d.data() }) as Application,
        );
        setHasMore(snap.docs.length === PAGE_SIZE);
        setLastDoc(snap.docs[snap.docs.length - 1] ?? null);
        if (after) {
          setApplications((prev) => [...prev, ...docs]);
        } else {
          setApplications(docs);
        }
      } catch {
        if (after) {
          setToast({ msg: "Failed to load more applications", ok: false });
        } else {
          setFetchError(true);
        }
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [],
  );

  useEffect(() => {
    (async () => {
      await fetchApps();
    })();
  }, [fetchApps]);

  async function fetchInboxApps() {
    setInboxLoading(true);
    setInboxError(false);
    try {
      const db = await getFirebaseDb();
      const colRef = collection(db, "applications");
      const q = query(
        colRef,
        where("status", "not-in", INBOX_EXCLUDED_STATUSES),
      );
      const snap = await getDocs(q);
      const docs = snap.docs
        .map((d) => ({ id: d.id, ...d.data() }) as Application)
        .filter((a) => !a.deletedAt);
      setInboxApps(docs);
    } catch {
      setInboxError(true);
    } finally {
      setInboxLoading(false);
    }
  }

  useEffect(() => {
    (async () => {
      await fetchInboxApps();
    })();
  }, []);

  async function handleUpdate(
    id: string,
    patch: Partial<Omit<Application, "id">>,
  ): Promise<boolean> {
    try {
      await updateDoc(doc(await getFirebaseDb(), "applications", id), patch);
      setApplications((prev) =>
        prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
      );
      setSelectedApp((prev) =>
        prev?.id === id ? { ...prev, ...patch } : prev,
      );
      showToast("Saved", true);
      return true;
    } catch {
      showToast("Save failed", false);
      return false;
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

  async function handleParticipated(id: string) {
    const ok = await handleUpdate(id, {
      status: "Participated",
      participatedAt: serverTimestamp(),
    } as Partial<Omit<Application, "id">>);
    if (!ok) {
      setSelectedApp(null);
      return;
    }
    try {
      const auth = await getFirebaseAuth();
      const db = await getFirebaseDb();
      await addDoc(collection(db, "applications", id, "events"), {
        type: "participated",
        timestamp: serverTimestamp(),
        actor: auth.currentUser?.email ?? "admin",
        payload: {},
      });
    } catch {
      // non-fatal event log failure
    }
    setSelectedApp(null);
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
    setOrientationFilter([]);
    setCityFilter([]);
    setNameSearch("");
  }

  const { filteredActiveApps, deletedApps, participatedApps } = useMemo(() => {
    const participated = applications.filter(
      (a) => !a.deletedAt && a.status === "Participated",
    );
    const active = applications.filter(
      (a) => !a.deletedAt && a.status !== "Participated",
    );
    const deleted = applications.filter((a) => !!a.deletedAt);

    let result = [...active];
    if (genderFilter.length > 0) {
      const selected = new Set(genderFilter.map((o) => o.value));
      result = result.filter((a) => selected.has(a.gender));
    }
    if (orientationFilter.length > 0) {
      const selected = new Set(orientationFilter.map((o) => o.value));
      result = result.filter((a) => selected.has(a.orientation));
    }
    if (cityFilter.length > 0) {
      const selected = new Set(cityFilter.map((o) => o.value));
      result = result.filter((a) => selected.has(a.city?.trim()));
    }

    const nameQuery = nameSearch.trim().toLowerCase();
    if (nameQuery) {
      result = result.filter((a) => a.name.toLowerCase().includes(nameQuery));
    }

    result.sort(
      (a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0),
    );

    let filteredDeleted = [...deleted];
    let filteredParticipated = [...participated];
    if (nameQuery) {
      filteredDeleted = filteredDeleted.filter((a) =>
        a.name.toLowerCase().includes(nameQuery),
      );
      filteredParticipated = filteredParticipated.filter((a) =>
        a.name.toLowerCase().includes(nameQuery),
      );
    }

    filteredDeleted.sort((a, b) => {
      const aTime =
        a.deletedAt && "seconds" in a.deletedAt ? a.deletedAt.seconds : 0;
      const bTime =
        b.deletedAt && "seconds" in b.deletedAt ? b.deletedAt.seconds : 0;
      return bTime - aTime;
    });

    return {
      filteredActiveApps: result,
      deletedApps: filteredDeleted,
      participatedApps: filteredParticipated,
    };
  }, [applications, genderFilter, orientationFilter, cityFilter, nameSearch]);

  const appsByStatus = useMemo(() => {
    const map: Record<ApplicantStatus, Application[]> = {} as Record<
      ApplicantStatus,
      Application[]
    >;
    for (const status of STATUS_ORDER) {
      map[status] = filteredActiveApps.filter((a) => a.status === status);
    }
    return map;
  }, [filteredActiveApps]);

  const hasActiveFilters =
    genderFilter.length > 0 ||
    orientationFilter.length > 0 ||
    cityFilter.length > 0 ||
    nameSearch.trim().length > 0;

  const activeCount = filteredActiveApps.length;
  const activeStatuses = STATUS_ORDER.filter(
    (s) => appsByStatus[s]?.length > 0,
  ).length;

  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <div className={styles.headerInner}>
          <div className={styles.titleGroup}>
            <h1 className={styles.title}>Admin</h1>
            <div className={styles.tabs}>
              <button
                className={styles.tab}
                data-active={activeTab === "today" || undefined}
                onClick={() => setActiveTab("today")}
              >
                Today
              </button>
              <button
                className={styles.tab}
                data-active={activeTab === "applicants" || undefined}
                onClick={() => setActiveTab("applicants")}
              >
                Applicants
                {!loading && activeTab === "applicants" && (
                  <span className={styles.tabCount}>{activeCount}</span>
                )}
              </button>
              <button
                className={styles.tab}
                data-active={activeTab === "analytics" || undefined}
                onClick={() => setActiveTab("analytics")}
              >
                Analytics
              </button>
              <button
                className={styles.tab}
                data-active={activeTab === "waitlist" || undefined}
                onClick={() => setActiveTab("waitlist")}
              >
                Waitlist
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
              <div className={styles.searchWrapper}>
                <Search
                  size={14}
                  className={styles.searchIcon}
                  aria-hidden="true"
                />
                <input
                  type="search"
                  className={styles.searchInput}
                  placeholder="Search by name…"
                  value={nameSearch}
                  onChange={(e) => setNameSearch(e.target.value)}
                  aria-label="Search contestants by name"
                />
                {nameSearch && (
                  <button
                    className={styles.searchClear}
                    onClick={() => setNameSearch("")}
                    aria-label="Clear search"
                  >
                    <X size={12} aria-hidden="true" />
                  </button>
                )}
              </div>
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
              <div className={styles.filterItem}>
                <Select
                  isMulti
                  options={ORIENTATION_OPTIONS}
                  value={orientationFilter}
                  onChange={(v) => setOrientationFilter(v)}
                  placeholder="Orientation…"
                  styles={adminSelectStyles<FilterOption>()}
                  aria-label="Filter by orientation"
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

      {activeTab === "today" &&
        (inboxLoading ? (
          <div
            role="status"
            aria-live="polite"
            aria-label="Loading today's tasks"
          >
            <Skeleton count={3} />
          </div>
        ) : inboxError ? (
          <div className={styles.errorState}>
            <p style={{ marginBottom: "12px" }}>Failed to load applications.</p>
            <button
              onClick={() => void fetchInboxApps()}
              className={styles.retryButton}
            >
              Try again
            </button>
          </div>
        ) : (
          <TaskInbox
            applications={inboxApps}
            onOpenApp={(app) => {
              setSelectedApp(app);
              setActiveTab("applicants");
            }}
            onRefresh={(id, patch) => {
              setInboxApps((prev) =>
                prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
              );
            }}
          />
        ))}

      {activeTab === "analytics" && (
        <>
          <ContestantFunnel applications={applications} />
          <AnalyticsDashboard />
        </>
      )}

      {activeTab === "waitlist" && <WaitlistTab />}

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
              <button
                onClick={() => void fetchApps()}
                className={styles.retryButton}
              >
                Try again
              </button>
            </div>
          ) : applications.length === 0 ? (
            <div className={styles.emptyState}>
              No applications yet. Share the link! 🌶️
            </div>
          ) : activeCount === 0 && deletedApps.length === 0 ? (
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
                {activeCount} active across {activeStatuses} stage
                {activeStatuses !== 1 ? "s" : ""} · {participatedApps.length}{" "}
                participated · {deletedApps.length} deleted
              </p>

              <nav className={styles.jumpRow} aria-label="Jump to section">
                {STATUS_ORDER.map((status) => (
                  <button
                    key={status}
                    className={styles.jumpChip}
                    onClick={() => {
                      document
                        .getElementById(sectionId(status))
                        ?.scrollIntoView({
                          behavior: "smooth",
                          block: "start",
                        });
                    }}
                  >
                    <span
                      className={styles.jumpChipDot}
                      style={{ background: STATUS_COLORS[status] }}
                    />
                    {status}
                    {appsByStatus[status]?.length > 0 && (
                      <span className={styles.jumpChipCount}>
                        {appsByStatus[status].length}
                      </span>
                    )}
                  </button>
                ))}
              </nav>

              {STATUS_ORDER.map((status) => (
                <StatusSection
                  key={status}
                  status={status}
                  apps={appsByStatus[status] ?? []}
                  onCardClick={setSelectedApp}
                  onDelete={handleDelete}
                  onParticipated={handleParticipated}
                />
              ))}

              {participatedApps.length > 0 && (
                <div className={styles.deletedSection}>
                  <button
                    onClick={() => setParticipatedOpen((v) => !v)}
                    className={styles.deletedToggle}
                    aria-expanded={participatedOpen}
                    aria-controls="participated-apps-list"
                  >
                    {participatedOpen ? (
                      <ChevronDown size={16} />
                    ) : (
                      <ChevronRight size={16} />
                    )}
                    Participated Applications ({participatedApps.length})
                  </button>

                  {participatedOpen && (
                    <div id="participated-apps-list" className={styles.grid}>
                      {participatedApps.map((app) => (
                        <ApplicantCard
                          key={app.id}
                          app={app}
                          onClick={() => setSelectedApp(app)}
                        />
                      ))}
                    </div>
                  )}
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

      {selectedApp && (
        <ApplicantModal
          app={selectedApp}
          onClose={() => setSelectedApp(null)}
          onUpdate={handleUpdate}
          onDelete={handleDelete}
          onRestore={handleRestore}
          onParticipated={handleParticipated}
        />
      )}

      {activeTab === "applicants" && hasMore && !loading && !fetchError && (
        <div className={styles.loadMoreRow}>
          <button
            className={styles.loadMoreBtn}
            onClick={() => void fetchApps(lastDoc)}
            disabled={loadingMore}
          >
            {loadingMore ? "Loading..." : "Load more"}
          </button>
        </div>
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
