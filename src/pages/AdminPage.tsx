import { useState, useEffect } from "react";
import { collection, getDocs, doc, updateDoc, type Timestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";

const SESSION_KEY = "gm-admin-auth";
const PASSWORD = "secret";

interface Application {
  id: string;
  name: string;
  age: number | null;
  gender: string;
  orientation: string;
  city: string;
  height: string;
  instagram: string;
  community: string;
  income: string;
  applicationType: string;
  referrerName: string;
  pitch: string;
  photoUrl: string;
  photoBase64?: string;
  status: "New" | "Contacted" | "Cast" | "Rejected";
  notes: string;
  submittedAt: Timestamp | null;
}

const STATUS_COLORS: Record<Application["status"], string> = {
  New: "#D4A843",
  Contacted: "#3B82F6",
  Cast: "#22C55E",
  Rejected: "#9CA3AF",
};

/* ─── Login ─────────────────────────────────────────────────── */

function LoginScreen({ onLogin }: { onLogin: () => void }) {
  const [pw, setPw] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (pw === PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      onLogin();
    } else {
      setError("Incorrect password");
      setPw("");
    }
  }

  return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#FAF7F2", padding: "24px" }}>
      <form onSubmit={handleSubmit} style={{ background: "#fff", padding: "48px 40px", borderRadius: "16px", boxShadow: "0 4px 32px rgba(0,0,0,0.08)", width: "100%", maxWidth: "360px" }}>
        <p style={{ textAlign: "center", fontSize: "2rem", marginBottom: "8px" }}>🌶️</p>
        <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "26px", fontWeight: 700, color: "#3D3532", textAlign: "center", marginBottom: "28px" }}>
          Team Access
        </h1>
        <input
          type="password"
          autoComplete="new-password"
          value={pw}
          onChange={(e) => { setPw(e.target.value); setError(""); }}
          placeholder="Password"
          autoFocus
          style={{ width: "100%", padding: "12px 18px", borderRadius: "100px", border: `1px solid ${error ? "#C0392B" : "#E0D5C8"}`, fontSize: "15px", color: "#3D3532", outline: "none", boxSizing: "border-box", marginBottom: "8px" }}
        />
        {error && <p style={{ color: "#C0392B", fontSize: "13px", marginBottom: "8px", paddingLeft: "8px" }}>{error}</p>}
        <button type="submit" style={{ width: "100%", padding: "13px", borderRadius: "100px", border: "none", background: "#4A0E1B", color: "#fff", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "4px" }}>
          Enter
        </button>
      </form>
    </div>
  );
}

/* ─── Card ───────────────────────────────────────────────────── */

function AppCard({ app, onClick }: { app: Application; onClick: () => void }) {
  return (
    <article
      onClick={onClick}
      style={{ background: "#fff", borderRadius: "12px", boxShadow: "0 1px 6px rgba(0,0,0,0.07)", overflow: "hidden", cursor: "pointer", transition: "transform 0.2s, box-shadow 0.2s" }}
      onMouseEnter={(e) => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 20px rgba(0,0,0,0.12)"; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = "translateY(0)"; e.currentTarget.style.boxShadow = "0 1px 6px rgba(0,0,0,0.07)"; }}
    >
      <div style={{ width: "100%", aspectRatio: "3/4", maxHeight: "220px", overflow: "hidden" }}>
        {(app.photoBase64 || app.photoUrl) ? (
          <img src={app.photoBase64 || app.photoUrl} alt={app.name} loading="lazy" style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
        ) : (
          <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg, #C9A84C33 0%, #4A0E1B33 100%)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem" }}>🌶️</div>
        )}
      </div>
      <div style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
          <span style={{ fontWeight: 600, fontSize: "15px", color: "#3D3532" }}>{app.name || "—"}</span>
          {app.age && <span style={{ fontSize: "13px", color: "#A09590" }}>{app.age}</span>}
        </div>
        <p style={{ fontSize: "12px", color: "#A09590", marginBottom: "8px" }}>{app.city || "—"}</p>
        <span style={{ display: "inline-block", padding: "2px 8px", borderRadius: "100px", fontSize: "11px", fontWeight: 600, background: STATUS_COLORS[app.status] + "22", color: STATUS_COLORS[app.status] }}>
          {app.status}
        </span>
      </div>
    </article>
  );
}

/* ─── Modal ──────────────────────────────────────────────────── */

function AppModal({ app, onClose, onUpdate }: { app: Application; onClose: () => void; onUpdate: (id: string, patch: Partial<Application>) => void }) {
  const [status, setStatus] = useState<Application["status"]>(app.status);
  const [notes, setNotes] = useState(app.notes ?? "");

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") onClose(); }
    window.addEventListener("keydown", onKey);
    return () => { document.body.style.overflow = prev; window.removeEventListener("keydown", onKey); };
  }, [onClose]);

  function handleStatus(e: React.ChangeEvent<HTMLSelectElement>) {
    const next = e.target.value as Application["status"];
    setStatus(next);
    onUpdate(app.id, { status: next });
  }

  function handleNotesBlur() {
    onUpdate(app.id, { notes });
  }

  const date = app.submittedAt
    ? new Date(app.submittedAt.toDate()).toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })
    : "—";
  const handle = app.instagram?.replace(/^@/, "") ?? "";

  function Row({ label, value }: { label: string; value?: string | number | null }) {
    if (!value && value !== 0) return null;
    return (
      <div>
        <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#A09590", marginBottom: "2px" }}>{label}</p>
        <p style={{ fontSize: "14px", fontWeight: 500, color: "#3D3532" }}>{value}</p>
      </div>
    );
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.5)", backdropFilter: "blur(4px)", zIndex: 50, display: "flex", alignItems: "center", justifyContent: "center", padding: "16px" }}>
      <div onClick={(e) => e.stopPropagation()} style={{ background: "#fff", borderRadius: "16px", maxWidth: "640px", width: "100%", maxHeight: "90vh", overflowY: "auto", position: "relative" }}>

        {/* Photo header */}
        <div style={{ position: "relative", width: "100%", overflow: "hidden", borderRadius: "16px 16px 0 0", background: (app.photoBase64 || app.photoUrl) ? undefined : "linear-gradient(135deg, #C9A84C33 0%, #4A0E1B33 100%)" }}>
          {(app.photoBase64 || app.photoUrl) ? (
            <img src={app.photoBase64 || app.photoUrl} alt={app.name} style={{ width: "100%", maxHeight: "380px", objectFit: "cover", display: "block" }} />
          ) : (
            <div style={{ height: "200px", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "4rem" }}>🌶️</div>
          )}
          <button
            onClick={onClose}
            style={{ position: "absolute", top: "12px", right: "12px", background: "rgba(0,0,0,0.5)", border: "none", borderRadius: "100px", width: "32px", height: "32px", cursor: "pointer", color: "#fff", fontSize: "18px", display: "flex", alignItems: "center", justifyContent: "center" }}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        {/* Content */}
        <div style={{ padding: "24px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "20px", flexWrap: "wrap" }}>
            <h2 style={{ fontFamily: "var(--font-playfair)", fontSize: "22px", fontWeight: 700, color: "#3D3532" }}>{app.name || "No name"}</h2>
            <span style={{ padding: "3px 10px", borderRadius: "100px", fontSize: "12px", fontWeight: 600, background: STATUS_COLORS[status] + "22", color: STATUS_COLORS[status] }}>{status}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px 24px", marginBottom: "20px" }}>
            <Row label="Age" value={app.age} />
            <Row label="Gender" value={app.gender} />
            <Row label="Orientation" value={app.orientation} />
            <Row label="City" value={app.city} />
            <Row label="Height" value={app.height} />
            <Row label="Community" value={app.community} />
            <Row label="Income" value={app.income} />
            <Row label="Application Type" value={app.applicationType} />
            {app.applicationType === "Nomination" && <Row label="Referred by" value={app.referrerName} />}
            {handle && (
              <div>
                <p style={{ fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#A09590", marginBottom: "2px" }}>Instagram</p>
                <a href={`https://instagram.com/${handle}`} target="_blank" rel="noopener noreferrer" style={{ fontSize: "14px", fontWeight: 500, color: "#4A0E1B" }}>@{handle}</a>
              </div>
            )}
          </div>

          {app.pitch && (
            <blockquote style={{ borderLeft: "3px solid #4A0E1B", paddingLeft: "14px", margin: "0 0 20px" }}>
              <p style={{ fontStyle: "italic", fontSize: "14px", color: "#3D3532", lineHeight: 1.6 }}>{app.pitch}</p>
            </blockquote>
          )}

          <p style={{ fontSize: "12px", color: "#A09590", marginBottom: "20px" }}>Submitted {date}</p>
          <hr style={{ border: "none", borderTop: "1px solid #E0D5C8", marginBottom: "20px" }} />

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#A09590", marginBottom: "6px", fontWeight: 600 }}>Status</label>
            <select value={status} onChange={handleStatus} style={{ padding: "10px 14px", borderRadius: "100px", border: "1px solid #E0D5C8", fontSize: "14px", color: "#3D3532", background: "#fff", cursor: "pointer", outline: "none" }}>
              {(["New", "Contacted", "Cast", "Rejected"] as const).map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>

          <div>
            <label style={{ display: "block", fontSize: "11px", textTransform: "uppercase", letterSpacing: "0.06em", color: "#A09590", marginBottom: "6px", fontWeight: 600 }}>Internal Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={handleNotesBlur}
              rows={4}
              placeholder="Add internal notes..."
              style={{ width: "100%", padding: "12px 14px", borderRadius: "10px", border: "1px solid #E0D5C8", fontSize: "14px", color: "#3D3532", background: "#fff", resize: "vertical", outline: "none", boxSizing: "border-box", lineHeight: 1.5 }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

/* ─── Main ───────────────────────────────────────────────────── */

export default function AdminPage() {
  const [authed, setAuthed] = useState<boolean | null>(null);
  const [apps, setApps] = useState<Application[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Application | null>(null);
  const [sort, setSort] = useState<"newest" | "city" | "age">("newest");

  async function fetchApps() {
    setLoading(true);
    try {
      const snap = await getDocs(collection(db, "applications"));
      console.log("Raw snapshot:", snap.docs.length, snap.docs.map(d => ({ id: d.id, ...d.data() })));
      setApps(snap.docs.map((d) => ({ id: d.id, ...d.data() })) as Application[]);
    } catch (err) {
      console.error("Firestore fetch failed:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const isAuthed = sessionStorage.getItem(SESSION_KEY) === "true";
    setAuthed(isAuthed);
    if (isAuthed) fetchApps();
  }, []); // runs once on mount — no state deps to avoid infinite loop

  if (authed === null) return null;
  if (!authed) return <LoginScreen onLogin={() => { setAuthed(true); fetchApps(); }} />;

  async function handleUpdate(id: string, patch: Partial<Application>) {
    try {
      await updateDoc(doc(db, "applications", id), patch);
      setApps((prev) => prev.map((a) => (a.id === id ? { ...a, ...patch } : a)));
      setSelected((prev) => (prev?.id === id ? { ...prev, ...patch } : prev));
    } catch (err) {
      console.error("Update failed:", err);
    }
  }

  const sorted = [...apps].sort((a, b) => {
    if (sort === "newest") return (b.submittedAt?.toMillis() ?? 0) - (a.submittedAt?.toMillis() ?? 0);
    if (sort === "city") return (a.city ?? "").localeCompare(b.city ?? "");
    if (sort === "age") return (a.age ?? 999) - (b.age ?? 999);
    return 0;
  });

  return (
    <>
      <style>{`.admin-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; } @media(max-width: 640px) { .admin-grid { grid-template-columns: 1fr; } }`}</style>
      <div style={{ minHeight: "100vh", background: "#FAF7F2" }}>

        {/* Header */}
        <div style={{ background: "#fff", borderBottom: "1px solid #E0D5C8", padding: "16px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "16px", flexWrap: "wrap" }}>
          <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "20px", fontWeight: 700, color: "#3D3532" }}>
            🌶️ Applications ({apps.length})
          </h1>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as typeof sort)}
              style={{ padding: "8px 14px", borderRadius: "100px", border: "1px solid #E0D5C8", fontSize: "13px", color: "#3D3532", background: "#fff", cursor: "pointer", outline: "none" }}
            >
              <option value="newest">Newest first</option>
              <option value="city">City A–Z</option>
              <option value="age">Age ↑</option>
            </select>
            <button
              onClick={() => { sessionStorage.removeItem(SESSION_KEY); setAuthed(false); }}
              style={{ padding: "8px 16px", borderRadius: "100px", border: "1px solid #E0D5C8", background: "transparent", fontSize: "13px", color: "#3D3532", cursor: "pointer" }}
            >
              Logout
            </button>
          </div>
        </div>

        {/* Grid */}
        <div style={{ padding: "24px", maxWidth: "1200px", margin: "0 auto" }}>
          {loading ? (
            <p style={{ textAlign: "center", color: "#A09590", padding: "48px 0" }}>Loading…</p>
          ) : apps.length === 0 ? (
            <p style={{ textAlign: "center", color: "#A09590", padding: "48px 0" }}>No applications yet.</p>
          ) : (
            <div className="admin-grid">
              {sorted.map((a) => <AppCard key={a.id} app={a} onClick={() => setSelected(a)} />)}
            </div>
          )}
        </div>

        {selected && <AppModal app={selected} onClose={() => setSelected(null)} onUpdate={handleUpdate} />}
      </div>
    </>
  );
}
