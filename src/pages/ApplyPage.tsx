import { useState, useEffect, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { signInAnonymously } from "firebase/auth";
import { db, storage, auth } from "@/lib/firebase";
import { COMMUNITY_OPTIONS, INCOME_OPTIONS } from "@/types/application";

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "14px 16px",
  borderRadius: "12px",
  border: "1px solid #E0D5C8",
  fontFamily: "var(--font-cormorant)",
  fontSize: "16px",
  color: "#3D3532",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s, box-shadow 0.2s",
  appearance: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle,
  cursor: "pointer",
  backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%237A6F66' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E")`,
  backgroundRepeat: "no-repeat",
  backgroundPosition: "right 16px center",
  paddingRight: "42px",
};

const textareaStyle: React.CSSProperties = {
  ...inputStyle,
  borderRadius: "14px",
  resize: "vertical",
  minHeight: "100px",
  lineHeight: 1.55,
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontFamily: "var(--font-jetbrains)",
  fontSize: "11px",
  fontWeight: 500,
  textTransform: "uppercase" as const,
  letterSpacing: "0.15em",
  color: "#3D3532",
  marginBottom: "7px",
};

function FieldGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <label style={labelStyle}>{label}</label>
      {children}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-playfair)",
        fontSize: "24px",
        fontWeight: 600,
        color: "#4A0E1B",
        marginBottom: "20px",
        paddingBottom: "10px",
        borderBottom: "1px solid rgba(201, 168, 76, 0.2)",
      }}
    >
      {children}
    </h2>
  );
}

interface FormState {
  applicationType: "Self" | "Nomination";
  name: string;
  age: string;
  gender: string;
  orientation: string;
  city: string;
  height: string;
  instagram: string;
  community: string;
  income: string;
  referrerName: string;
  pitch: string;
}

const INITIAL: FormState = {
  applicationType: "Self",
  name: "",
  age: "",
  gender: "",
  orientation: "",
  city: "",
  height: "",
  instagram: "",
  community: "",
  income: "",
  referrerName: "",
  pitch: "",
};

export default function ApplyPage() {
  const [form, setForm] = useState<FormState>(INITIAL);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ msg: string; ok: boolean } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(id);
  }, [toast]);

  function showToast(msg: string, ok: boolean) {
    setToast({ msg, ok });
  }

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      showToast("Photo must be under 5 MB", false);
      e.target.value = "";
      return;
    }
    setPhotoFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    try {
      await signInAnonymously(auth);

      let photoUrl = "";
      if (photoFile) {
        const ext = photoFile.name.split(".").pop() ?? "jpg";
        const storageRef = ref(storage, `photos/${crypto.randomUUID()}.${ext}`);
        await uploadBytes(storageRef, photoFile);
        photoUrl = await getDownloadURL(storageRef);
      }

      await addDoc(collection(db, "applications"), {
        applicationType: form.applicationType,
        name: form.name.trim(),
        age: form.age ? parseInt(form.age) : null,
        gender: form.gender,
        orientation: form.orientation,
        city: form.city.trim(),
        height: form.height.trim(),
        instagram: form.instagram.trim().replace(/^@/, ""),
        community: form.community,
        income: form.income,
        referrerName: form.applicationType === "Nomination" ? form.referrerName.trim() : "",
        pitch: form.pitch.trim(),
        photoUrl,
        status: "New",
        notes: "",
        submittedAt: serverTimestamp(),
      });

      setForm(INITIAL);
      setPhotoFile(null);
      setPhotoPreview(null);
      showToast("Application received!", true);
    } catch (err) {
      console.error("Submission error:", err);
      showToast(err instanceof Error ? err.message : "Submission failed — please try again", false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <style>{`
        input:focus, select:focus, textarea:focus {
          border-color: #C9A84C !important;
          box-shadow: 0 0 0 3px rgba(201, 168, 76, 0.1) !important;
        }
        input::placeholder, textarea::placeholder { color: rgba(61, 53, 50, 0.35); }
        @keyframes pageIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes spin { to { transform: rotate(360deg); } }
        @keyframes toastIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div style={{ minHeight: "100vh", background: "transparent", animation: "pageIn 0.3s ease-out both" }}>
        <div style={{ maxWidth: "640px", margin: "0 auto", padding: "48px 24px 72px" }}>

          <div style={{ marginBottom: "24px" }}>
            <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "6px", color: "#F5EDE4", fontFamily: "var(--font-cormorant)", fontSize: "16px", textDecoration: "none" }}>
              ← Home
            </Link>
          </div>

          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1 style={{ fontFamily: "var(--font-playfair)", fontSize: "34px", fontWeight: 700, color: "#F5EDE4", lineHeight: 1.15, marginBottom: "10px", textShadow: "0 2px 12px rgba(0,0,0,0.4)" }}>
              Apply to Be on Garam Masala Dating
            </h1>
            <p style={{ fontFamily: "var(--font-cormorant)", fontSize: "18px", color: "rgba(245, 237, 228, 0.6)", lineHeight: 1.5 }}>
              NYC&apos;s hottest live comedy dating show 🌶️
            </p>
            <div style={{ width: "48px", height: "1px", background: "rgba(201, 168, 76, 0.4)", margin: "18px auto 0" }} />
          </div>

          <div style={{ background: "rgba(250, 247, 242, 0.95)", borderRadius: "20px", padding: "40px 36px", boxShadow: "0 8px 40px rgba(0,0,0,0.25)", border: "1px solid rgba(201, 168, 76, 0.1)" }}>
            <form onSubmit={handleSubmit} noValidate>

              {/* Application type toggle */}
              <div style={{ marginBottom: "36px" }}>
                <p style={{ fontFamily: "var(--font-jetbrains)", fontSize: "11px", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.2em", color: "#A68B3C", marginBottom: "12px" }}>
                  I am applying…
                </p>
                <div style={{ display: "flex", gap: "10px" }}>
                  {(["Self", "Nomination"] as const).map((type) => {
                    const active = form.applicationType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => set("applicationType", type)}
                        style={{ flex: 1, padding: "12px 16px", borderRadius: "100px", border: active ? "none" : "1px solid #4A0E1B", background: active ? "#4A0E1B" : "transparent", color: active ? "#F5EDE4" : "#4A0E1B", fontFamily: "var(--font-cormorant)", fontSize: "15px", fontWeight: 500, cursor: "pointer", transition: "all 0.2s" }}
                      >
                        {type === "Self" ? "For myself" : "For a friend"}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* About section */}
              <div style={{ marginBottom: "32px" }}>
                <SectionTitle>{form.applicationType === "Self" ? "About You" : "About Your Friend"}</SectionTitle>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  <FieldGroup label="Full Name">
                    <input type="text" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Name" style={inputStyle} />
                  </FieldGroup>
                  <FieldGroup label="Age">
                    <input type="number" value={form.age} onChange={(e) => set("age", e.target.value)} placeholder="Age" min={18} max={99} style={inputStyle} />
                  </FieldGroup>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  <FieldGroup label="Gender">
                    <select value={form.gender} onChange={(e) => set("gender", e.target.value)} style={selectStyle}>
                      <option value="">Select…</option>
                      {["Man", "Woman", "Non-binary", "Other"].map((g) => <option key={g} value={g}>{g}</option>)}
                    </select>
                  </FieldGroup>
                  <FieldGroup label="Orientation">
                    <select value={form.orientation} onChange={(e) => set("orientation", e.target.value)} style={selectStyle}>
                      <option value="">Select…</option>
                      {["Straight", "Gay", "Bisexual", "Other"].map((o) => <option key={o} value={o}>{o}</option>)}
                    </select>
                  </FieldGroup>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  <FieldGroup label="City">
                    <input type="text" value={form.city} onChange={(e) => set("city", e.target.value)} placeholder="New York City" style={inputStyle} />
                  </FieldGroup>
                  <FieldGroup label="Height">
                    <input type="text" value={form.height} onChange={(e) => set("height", e.target.value)} placeholder={`5'8"`} style={inputStyle} />
                  </FieldGroup>
                </div>

                <FieldGroup label="Instagram Handle">
                  <div style={{ position: "relative" }}>
                    <span style={{ position: "absolute", left: "16px", top: "50%", transform: "translateY(-50%)", color: "#A68B3C", fontFamily: "var(--font-cormorant)", fontSize: "16px", pointerEvents: "none" }}>@</span>
                    <input type="text" value={form.instagram} onChange={(e) => set("instagram", e.target.value.replace(/^@/, ""))} placeholder="yourhandle" style={{ ...inputStyle, paddingLeft: "30px" }} />
                  </div>
                </FieldGroup>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                  <FieldGroup label="Community">
                    <select value={form.community} onChange={(e) => set("community", e.target.value)} style={selectStyle}>
                      <option value="">Select…</option>
                      {COMMUNITY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </FieldGroup>
                  <FieldGroup label="Income">
                    <select value={form.income} onChange={(e) => set("income", e.target.value)} style={selectStyle}>
                      <option value="">Select…</option>
                      {INCOME_OPTIONS.map((i) => <option key={i} value={i}>{i}</option>)}
                    </select>
                  </FieldGroup>
                </div>
              </div>

              {/* Nomination referrer */}
              {form.applicationType === "Nomination" && (
                <div style={{ marginBottom: "32px" }}>
                  <SectionTitle>Your Info</SectionTitle>
                  <FieldGroup label="Your Name">
                    <input type="text" value={form.referrerName} onChange={(e) => set("referrerName", e.target.value)} placeholder="So we know who nominated them" style={inputStyle} />
                  </FieldGroup>
                </div>
              )}

              {/* Photo */}
              <div style={{ marginBottom: "32px" }}>
                <SectionTitle>Photo</SectionTitle>
                <p style={{ ...labelStyle, marginBottom: "12px" }}>Best recent photo (optional, max 5 MB)</p>

                <input id="photo-input" type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />

                <label
                  htmlFor="photo-input"
                  style={{ display: "block", border: "2px dashed rgba(201, 168, 76, 0.3)", borderRadius: "14px", padding: "24px", textAlign: "center", cursor: "pointer", transition: "border-color 0.2s", background: "rgba(201, 168, 76, 0.03)", overflow: "hidden" }}
                  onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#C9A84C")}
                  onMouseLeave={(e) => (e.currentTarget.style.borderColor = "rgba(201, 168, 76, 0.3)")}
                >
                  {photoPreview ? (
                    <img src={photoPreview} alt="Preview" style={{ width: "100%", maxHeight: "280px", objectFit: "cover", borderRadius: "8px", display: "block" }} />
                  ) : (
                    <>
                      <p style={{ fontSize: "2rem", marginBottom: "8px" }}>📸</p>
                      <p style={{ fontFamily: "var(--font-cormorant)", fontSize: "16px", color: "#A68B3C" }}>Tap to upload a photo</p>
                    </>
                  )}
                </label>

                {photoPreview && (
                  <label htmlFor="photo-input" style={{ display: "inline-block", marginTop: "8px", color: "#A68B3C", fontFamily: "var(--font-cormorant)", fontSize: "15px", cursor: "pointer", textDecoration: "underline" }}>
                    Change photo
                  </label>
                )}
              </div>

              {/* Pitch */}
              <div style={{ marginBottom: "40px" }}>
                <SectionTitle>Anything else?</SectionTitle>
                <FieldGroup label={form.applicationType === "Self" ? "Why would you be a great fit? (optional)" : "Why would your friend be a great fit? (optional)"}>
                  <textarea value={form.pitch} onChange={(e) => set("pitch", e.target.value)} placeholder="Tell us something fun, bold, or irresistible…" style={textareaStyle} />
                </FieldGroup>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={submitting}
                style={{ width: "100%", padding: "16px 48px", borderRadius: "100px", border: "none", background: submitting ? "#A68B3C" : "#C9A84C", color: "#0D0A08", fontFamily: "var(--font-cormorant)", fontSize: "17px", fontWeight: 600, letterSpacing: "0.02em", cursor: submitting ? "not-allowed" : "pointer", transition: "background 0.2s, box-shadow 0.2s", display: "flex", alignItems: "center", justifyContent: "center", gap: "10px" }}
                onMouseEnter={(e) => { if (!submitting) { e.currentTarget.style.background = "#E2C97E"; e.currentTarget.style.boxShadow = "0 4px 20px rgba(201,168,76,0.3)"; } }}
                onMouseLeave={(e) => { if (!submitting) { e.currentTarget.style.background = "#C9A84C"; e.currentTarget.style.boxShadow = "none"; } }}
              >
                {submitting ? (
                  <>
                    <span style={{ width: "16px", height: "16px", border: "2px solid rgba(13,10,8,0.3)", borderTopColor: "#0D0A08", borderRadius: "50%", display: "inline-block", animation: "spin 0.7s linear infinite" }} />
                    Submitting…
                  </>
                ) : (
                  "Submit Application 🌶️"
                )}
              </button>

              <p style={{ textAlign: "center", fontFamily: "var(--font-cormorant)", fontSize: "14px", color: "#3D3532", opacity: 0.6, marginTop: "16px", lineHeight: 1.5 }}>
                By submitting, you agree to be contacted by the Garam Masala Dating team.
              </p>
            </form>
          </div>
        </div>
      </div>

      {toast && (
        <div style={{ position: "fixed", bottom: "24px", right: "24px", display: "flex", alignItems: "center", gap: "10px", padding: "12px 20px", borderRadius: "100px", background: toast.ok ? "#22C55E" : "#C0392B", color: "#fff", fontFamily: "var(--font-cormorant)", fontSize: "15px", fontWeight: 600, boxShadow: "0 4px 20px rgba(0,0,0,0.2)", zIndex: 9999, maxWidth: "calc(100vw - 48px)", animation: "toastIn 0.2s ease-out both" }}>
          <span>{toast.msg}</span>
          <button onClick={() => setToast(null)} style={{ background: "none", border: "none", color: "rgba(255,255,255,0.8)", cursor: "pointer", padding: "0", lineHeight: 1, fontSize: "16px", flexShrink: 0 }} aria-label="Dismiss">✕</button>
        </div>
      )}
    </>
  );
}
