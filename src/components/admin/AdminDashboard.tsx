import { useState, useEffect, useMemo } from "react";
import { collection, getDocs, query, orderBy, doc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { type Application, COMMUNITY_OPTIONS, INCOME_OPTIONS } from "@/types/application";
import ApplicantCard from "./ApplicantCard";
import ApplicantModal from "./ApplicantModal";

interface AdminDashboardProps {
  onLogout: () => void;
}

type SortOption = "newest" | "oldest" | "city-az" | "age-asc" | "age-desc";

const FILTER_STYLE: React.CSSProperties = {
  padding: "7px 14px",
  borderRadius: "100px",
  border: "1px solid var(--border)",
  background: "#fff",
  fontFamily: "var(--font-dm-sans)",
  fontSize: "13px",
  color: "var(--text)",
  outline: "none",
  cursor: "pointer",
  flexShrink: 0,
};

export default function AdminDashboard({ onLogout }: AdminDashboardProps) {
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedApp, setSelectedApp] = useState<Application | null>(null);

  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [cityFilter, setCityFilter] = useState("");
  const [genderFilter, setGenderFilter] = useState("All");
  const [orientationFilter, setOrientationFilter] = useState("All");
  const [communityFilter, setCommunityFilter] = useState("All");
  const [incomeFilter, setIncomeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  useEffect(() => {
    async function fetchApps() {
      try {
        const q = query(collection(db, "applications"), orderBy("submittedAt", "desc"));
        const snap = await getDocs(q);
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Application));
        setApplications(docs);
      } catch (err) {
        console.error("Failed to fetch applications:", err);
      } finally {
        setLoading(false);
      }
    }
    fetchApps();
  }, []);

  async function handleUpdate(id: string, patch: Partial<Omit<Application, "id">>) {
    try {
      await updateDoc(doc(db, "applications", id), patch);
      setApplications((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      setSelectedApp((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
    } catch (err) {
      console.error("Failed to update application:", err);
    }
  }

  function clearFilters() {
    setSortBy("newest");
    setCityFilter("");
    setGenderFilter("All");
    setOrientationFilter("All");
    setCommunityFilter("All");
    setIncomeFilter("All");
    setStatusFilter("All");
  }

  const filtered = useMemo(() => {
    let result = [...applications];
    if (cityFilter.trim()) {
      const q = cityFilter.trim().toLowerCase();
      result = result.filter((a) => a.city.toLowerCase().includes(q));
    }
    if (genderFilter !== "All") result = result.filter((a) => a.gender === genderFilter);
    if (orientationFilter !== "All") result = result.filter((a) => a.orientation === orientationFilter);
    if (communityFilter !== "All") result = result.filter((a) => a.community === communityFilter);
    if (incomeFilter !== "All") result = result.filter((a) => a.income === incomeFilter);
    if (statusFilter !== "All") result = result.filter((a) => a.status === statusFilter);
    switch (sortBy) {
      case "oldest": result.sort((a, b) => a.submittedAt?.seconds - b.submittedAt?.seconds); break;
      case "city-az": result.sort((a, b) => a.city.localeCompare(b.city)); break;
      case "age-asc": result.sort((a, b) => a.age - b.age); break;
      case "age-desc": result.sort((a, b) => b.age - a.age); break;
    }
    return result;
  }, [applications, sortBy, cityFilter, genderFilter, orientationFilter, communityFilter, incomeFilter, statusFilter]);

  const hasActiveFilters =
    sortBy !== "newest" || cityFilter.trim() !== "" || genderFilter !== "All" ||
    orientationFilter !== "All" || communityFilter !== "All" || incomeFilter !== "All" || statusFilter !== "All";

  return (
    <div style={{ minHeight: "100vh", background: "var(--cream)" }}>
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
              <span style={{ fontSize: "13px", color: "var(--text-light)" }}>{applications.length} total</span>
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

        <div style={{ maxWidth: "1200px", margin: "0 auto", overflowX: "auto", paddingBottom: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: "max-content" }}>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value as SortOption)} style={FILTER_STYLE}>
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="city-az">City A–Z</option>
              <option value="age-asc">Age ↑</option>
              <option value="age-desc">Age ↓</option>
            </select>

            <div style={{ width: "1px", height: "20px", background: "var(--border)", flexShrink: 0 }} />

            <input
              type="text" value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
              placeholder="City…" style={{ ...FILTER_STYLE, cursor: "text", minWidth: "100px" }}
            />

            <select value={genderFilter} onChange={(e) => setGenderFilter(e.target.value)} style={FILTER_STYLE}>
              <option value="All">All genders</option>
              {["Man", "Woman", "Non-binary", "Other"].map((g) => <option key={g} value={g}>{g}</option>)}
            </select>

            <select value={orientationFilter} onChange={(e) => setOrientationFilter(e.target.value)} style={FILTER_STYLE}>
              <option value="All">All orientations</option>
              {["Straight", "Gay", "Bisexual", "Other"].map((o) => <option key={o} value={o}>{o}</option>)}
            </select>

            <select value={communityFilter} onChange={(e) => setCommunityFilter(e.target.value)} style={FILTER_STYLE}>
              <option value="All">All communities</option>
              {COMMUNITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <select value={incomeFilter} onChange={(e) => setIncomeFilter(e.target.value)} style={FILTER_STYLE}>
              <option value="All">All incomes</option>
              {INCOME_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
            </select>

            <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={FILTER_STYLE}>
              <option value="All">All statuses</option>
              {(["New", "Contacted", "Cast", "Rejected"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>

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
        ) : applications.length === 0 ? (
          <div style={{ textAlign: "center", padding: "80px 0", color: "var(--text-light)", fontSize: "16px" }}>
            No applications yet. Share the link! 🌶️
          </div>
        ) : filtered.length === 0 ? (
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
              Showing {filtered.length} of {applications.length}
            </p>
            <div
              style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "20px" }}
              className="applicant-grid"
            >
              {filtered.map((app) => (
                <ApplicantCard key={app.id} app={app} onClick={() => setSelectedApp(app)} />
              ))}
            </div>
          </>
        )}
      </main>

      <style>{`
        @media (max-width: 900px) { .applicant-grid { grid-template-columns: repeat(2, 1fr) !important; } }
        @media (max-width: 600px) { .applicant-grid { grid-template-columns: 1fr !important; } }
      `}</style>

      {selectedApp && (
        <ApplicantModal app={selectedApp} onClose={() => setSelectedApp(null)} onUpdate={handleUpdate} />
      )}
    </div>
  );
}
