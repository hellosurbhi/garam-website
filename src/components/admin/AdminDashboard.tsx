import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, doc, updateDoc, Timestamp } from "firebase/firestore";
import { ChevronRight, ChevronDown } from "lucide-react";
import Select from "react-select";
import { db } from "@/lib/firebase";
import { type Application } from "@/types/application";
import { adminSelectStyles } from "@/utils/reactSelectStyles";
import ApplicantCard from "./ApplicantCard";
import ApplicantModal from "./ApplicantModal";

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
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(false);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);
  const [deletedOpen, setDeletedOpen] = useState(false);

  const [genderFilter, setGenderFilter] = useState<readonly FilterOption[]>([]);
  const [cityFilter, setCityFilter] = useState<readonly FilterOption[]>([]);

  async function fetchApps() {
    setLoading(true);
    setFetchError(false);
    try {
      const snap = await getDocs(collection(db, "applications"));
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Application));
      setApplications(docs);
    } catch {
      setFetchError(true);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { fetchApps(); }, []);

  async function handleUpdate(id: string, patch: Partial<Omit<Application, "id">>) {
    try {
      await updateDoc(doc(db, "applications", id), patch);
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      setSelectedApp((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
      setToast({ msg: "Saved", ok: true });
    } catch {
      setToast({ msg: "Save failed", ok: false });
    } finally {
      setTimeout(() => setToast(null), 2500);
    }
  }

  function handleDelete(id: string) {
    handleUpdate(id, { deletedAt: Timestamp.now() } as Partial<Omit<Application, "id">>);
    setSelectedApp(null);
  }

  function handleRestore(id: string) {
    handleUpdate(id, { deletedAt: null });
  }

  const cityOptions = useMemo(() => {
    const cities = new Set(
      applications.filter((a) => !a.deletedAt && a.city?.trim()).map((a) => a.city.trim())
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

    // Filter active list
    let result = [...active];
    if (genderFilter.length > 0) {
      const selected = new Set(genderFilter.map((o) => o.value));
      result = result.filter((a) => selected.has(a.gender));
    }
    if (cityFilter.length > 0) {
      const selected = new Set(cityFilter.map((o) => o.value));
      result = result.filter((a) => selected.has(a.city?.trim()));
    }

    // Sort newest first, then push rejected to bottom
    result.sort((a, b) => (b.submittedAt?.seconds ?? 0) - (a.submittedAt?.seconds ?? 0));
    result.sort((a, b) => {
      const aRej = a.status === "Rejected" ? 1 : 0;
      const bRej = b.status === "Rejected" ? 1 : 0;
      return aRej - bRej;
    });

    // Sort deleted by deletedAt descending
    deleted.sort((a, b) => {
      const aTime = a.deletedAt && "seconds" in a.deletedAt ? a.deletedAt.seconds : 0;
      const bTime = b.deletedAt && "seconds" in b.deletedAt ? b.deletedAt.seconds : 0;
      return bTime - aTime;
    });

    return { activeApps: result, deletedApps: deleted };
  }, [applications, genderFilter, cityFilter]);

  const hasActiveFilters = genderFilter.length > 0 || cityFilter.length > 0;

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)", position: "relative" }}>
      <header style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "0 32px" }}>
        <div
          style={{
            maxWidth: "1200px", margin: "0 auto", display: "flex", alignItems: "center",
            justifyContent: "space-between", height: "64px", gap: "16px",
          }}
        >
          <div style={{ display: "flex", alignItems: "baseline", gap: "12px" }}>
            <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "22px", fontWeight: 700, color: "var(--text)" }}>
              Applications
            </h1>
            {!loading && (
              <span style={{ fontSize: "13px", color: "var(--text-light)" }}>
                {activeApps.length} active
              </span>
            )}
          </div>
          <button
            onClick={onLogout}
            style={{
              padding: "7px 18px", borderRadius: "100px", border: "1px solid var(--border)",
              background: "transparent", fontFamily: "var(--font-dm-sans)", fontSize: "13px",
              color: "var(--text-light)", cursor: "pointer", transition: "border-color 0.2s, color 0.2s",
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = "var(--crimson)"; e.currentTarget.style.color = "var(--crimson)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.color = "var(--text-light)"; }}
          >
            Logout
          </button>
        </div>

        <div style={{ maxWidth: "1200px", margin: "0 auto", paddingBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ minWidth: "180px" }}>
              <Select
                isMulti
                options={GENDER_OPTIONS}
                value={genderFilter}
                onChange={(v) => setGenderFilter(v)}
                placeholder="Gender…"
                styles={adminSelectStyles}
              />
            </div>
            <div style={{ minWidth: "220px" }}>
              <Select
                isMulti
                options={cityOptions}
                value={cityFilter}
                onChange={(v) => setCityFilter(v)}
                placeholder="City…"
                styles={adminSelectStyles}
              />
            </div>
            {hasActiveFilters && (
              <button
                onClick={clearFilters}
                style={{
                  background: "none", border: "none", fontFamily: "var(--font-dm-sans)", fontSize: "13px",
                  color: "var(--crimson)", cursor: "pointer", padding: "4px 0", flexShrink: 0, textDecoration: "underline",
                }}
              >
                Clear all
              </button>
            )}
          </div>
        </div>
      </header>

      <main style={{ maxWidth: "1200px", margin: "0 auto", padding: "32px" }}>
        {loading ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-light)" }}>Loading…</div>
        ) : fetchError ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-light)", fontSize: "16px" }}>
            <p style={{ marginBottom: "12px" }}>Failed to load applications.</p>
            <button
              onClick={fetchApps}
              style={{ background: "none", border: "none", color: "var(--crimson)", fontFamily: "var(--font-dm-sans)", fontSize: "14px", cursor: "pointer", textDecoration: "underline" }}
            >
              Try again
            </button>
          </div>
        ) : applications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-light)", fontSize: "16px" }}>
            No applications yet. Share the link! 🌶️
          </div>
        ) : activeApps.length === 0 && deletedApps.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-light)", fontSize: "16px" }}>
            <p style={{ marginBottom: "12px" }}>No applications match these filters.</p>
            <button
              onClick={clearFilters}
              style={{ background: "none", border: "none", color: "var(--crimson)", fontFamily: "var(--font-dm-sans)", fontSize: "14px", cursor: "pointer", textDecoration: "underline" }}
            >
              Clear filters
            </button>
          </div>
        ) : (
          <>
            <p style={{ fontSize: "13px", color: "var(--text-light)", marginBottom: "20px" }}>
              Showing {activeApps.length} active · {deletedApps.length} deleted
            </p>

            {activeApps.length > 0 && (
              <div
                style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}
                className="applicant-grid"
              >
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
              <div style={{ marginTop: "40px" }}>
                <button
                  onClick={() => setDeletedOpen((v) => !v)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    background: "none",
                    border: "none",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "var(--text-light)",
                    cursor: "pointer",
                    padding: "8px 0",
                    marginBottom: "16px",
                  }}
                >
                  {deletedOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                  Deleted Applications ({deletedApps.length})
                </button>

                {deletedOpen && (
                  <div
                    style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}
                    className="applicant-grid"
                  >
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

      <style>{`
        @media (max-width: 900px) { .applicant-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 600px) { .applicant-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {selectedApp && (
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
          style={{
            position: "fixed",
            bottom: "24px",
            right: "24px",
            padding: "10px 20px",
            borderRadius: "100px",
            background: toast.ok ? "var(--success)" : "var(--crimson)",
            color: "#fff",
            fontFamily: "var(--font-dm-sans)",
            fontSize: "14px",
            fontWeight: 600,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            zIndex: 100,
            pointerEvents: "none",
          }}
        >
          {toast.msg}
        </div>
      )}
    </div>
  );
}
