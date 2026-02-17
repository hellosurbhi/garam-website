import { useState, useRef, type ChangeEvent } from "react";
import { Link } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { ref, uploadBytes, getDownloadURL } from "firebase/storage";
import { db, storage } from "@/lib/firebase";
import { COMMUNITY_OPTIONS, INCOME_OPTIONS } from "@/types/application";

/* ─── Shared input styles ────────────────────────────────────── */

const inputStyle: React.CSSProperties = {
  width: "100%",
  padding: "13px 18px",
  borderRadius: "100px",
  border: "1.5px solid var(--border)",
  fontFamily: "var(--font-dm-sans)",
  fontSize: "15px",
  color: "var(--text)",
  background: "#fff",
  outline: "none",
  boxSizing: "border-box",
  transition: "border-color 0.2s",
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
  fontSize: "11px",
  fontWeight: 600,
  textTransform: "uppercase" as const,
  letterSpacing: "0.07em",
  color: "var(--text-light)",
  marginBottom: "7px",
};

function FieldGroup({
  label,
  required,
  error,
  children,
}: {
  label: string;
  required?: boolean;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: "18px" }}>
      <label style={labelStyle}>
        {label}
        {required && (
          <span style={{ color: "var(--crimson)", marginLeft: "3px" }}>*</span>
        )}
      </label>
      {children}
      {error && (
        <p
          style={{
            fontSize: "12px",
            color: "var(--crimson)",
            marginTop: "5px",
            paddingLeft: "4px",
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        fontFamily: "var(--font-playfair)",
        fontSize: "18px",
        fontWeight: 700,
        color: "var(--text)",
        marginBottom: "20px",
        paddingBottom: "10px",
        borderBottom: "1px solid var(--border)",
      }}
    >
      {children}
    </h2>
  );
}

/* ─── Success screen ─────────────────────────────────────────── */

function SuccessScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--cream)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "24px",
      }}
    >
      <div
        style={{
          textAlign: "center",
          maxWidth: "400px",
          animation: "fadeUp 0.5s ease-out both",
        }}
      >
        <style>{`@keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:translateY(0)}}`}</style>
        <p style={{ fontSize: "3.5rem", marginBottom: "16px" }}>🌶️</p>
        <h1
          style={{
            fontFamily: "var(--font-playfair)",
            fontSize: "32px",
            fontWeight: 700,
            color: "var(--crimson)",
            marginBottom: "12px",
          }}
        >
          You&apos;re in!
        </h1>
        <p
          style={{
            fontFamily: "var(--font-dm-sans)",
            fontSize: "16px",
            color: "var(--text-light)",
            lineHeight: 1.6,
          }}
        >
          Application received. We&apos;ll be in touch soon. 🎭
        </p>
      </div>
    </div>
  );
}

/* ─── Main form ──────────────────────────────────────────────── */

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
  const [errors, setErrors] = useState<Partial<Record<keyof FormState | "photo", string>>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (submitted) return <SuccessScreen />;

  function set(field: keyof FormState, value: string) {
    setForm((prev) => ({ ...prev, [field]: value }));
    setErrors((prev) => ({ ...prev, [field]: undefined }));
  }

  function handlePhotoChange(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, photo: "Photo must be under 10 MB" }));
      e.target.value = "";
      return;
    }
    setPhotoFile(file);
    setErrors((prev) => ({ ...prev, photo: undefined }));
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result as string);
    reader.readAsDataURL(file);
  }

  function validate(): boolean {
    const errs: typeof errors = {};
    if (!form.name.trim()) errs.name = "Required";
    if (!form.age || parseInt(form.age) < 18) errs.age = "Must be 18 or older";
    if (!form.gender) errs.gender = "Required";
    if (!form.orientation) errs.orientation = "Required";
    if (!form.city.trim()) errs.city = "Required";
    if (!form.instagram.trim()) errs.instagram = "Required";
    if (!form.community) errs.community = "Required";
    if (!form.income) errs.income = "Required";
    if (!photoFile) errs.photo = "A photo is required";
    if (form.applicationType === "Nomination" && !form.referrerName.trim()) {
      errs.referrerName = "Required";
    }
    setErrors(errs);
    return Object.keys(errs).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validate()) return;

    setSubmitError("");
    setSubmitting(true);
    try {
      const ext = photoFile!.name.split(".").pop() ?? "jpg";
      const storageRef = ref(storage, `photos/${crypto.randomUUID()}.${ext}`);
      await uploadBytes(storageRef, photoFile!);
      const photoUrl = await getDownloadURL(storageRef);

      await addDoc(collection(db, "applications"), {
        applicationType: form.applicationType,
        name: form.name.trim(),
        age: parseInt(form.age),
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

      setSubmitted(true);
    } catch (err) {
      console.error("Submission error:", err);
      setSubmitError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  const focusStyle = `
    input:focus, select:focus, textarea:focus { border-color: var(--crimson) !important; }
  `;

  return (
    <>
      <style>{focusStyle}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--cream)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "500px",
            height: "500px",
            top: "-120px",
            left: "-160px",
            background: "radial-gradient(circle, rgba(196,30,58,0.06) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(60px)",
            pointerEvents: "none",
          }}
        />
        <div
          aria-hidden="true"
          style={{
            position: "absolute",
            width: "400px",
            height: "400px",
            top: "40%",
            right: "-120px",
            background: "radial-gradient(circle, rgba(212,168,67,0.07) 0%, transparent 70%)",
            borderRadius: "50%",
            filter: "blur(50px)",
            pointerEvents: "none",
          }}
        />

        <div
          style={{
            position: "relative",
            zIndex: 1,
            maxWidth: "560px",
            margin: "0 auto",
            padding: "48px 24px 72px",
          }}
        >
          <div style={{ marginBottom: "24px" }}>
            <Link
              to="/"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                color: "var(--text-light)",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "14px",
                textDecoration: "none",
              }}
            >
              ← Home
            </Link>
          </div>

          <div style={{ textAlign: "center", marginBottom: "40px" }}>
            <h1
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "34px",
                fontWeight: 700,
                color: "var(--crimson)",
                lineHeight: 1.15,
                marginBottom: "10px",
              }}
            >
              Apply to Be on the Show
            </h1>
            <p
              style={{
                fontFamily: "var(--font-dm-sans)",
                fontSize: "15px",
                color: "var(--text-light)",
                lineHeight: 1.5,
              }}
            >
              NYC&apos;s hottest live comedy dating show 🌶️
            </p>
            <div
              style={{
                width: "48px",
                height: "2px",
                background: "var(--gold)",
                borderRadius: "2px",
                margin: "18px auto 0",
              }}
            />
          </div>

          <form onSubmit={handleSubmit} noValidate>
            <div style={{ marginBottom: "36px" }}>
              <p style={{ ...labelStyle, marginBottom: "12px" }}>I am applying…</p>
              <div style={{ display: "flex", gap: "10px" }}>
                {(["Self", "Nomination"] as const).map((type) => {
                  const active = form.applicationType === type;
                  return (
                    <button
                      key={type}
                      type="button"
                      onClick={() => set("applicationType", type)}
                      style={{
                        flex: 1,
                        padding: "12px 16px",
                        borderRadius: "100px",
                        border: `2px solid ${active ? "var(--crimson)" : "var(--border)"}`,
                        background: active ? "var(--crimson)" : "#fff",
                        color: active ? "#fff" : "var(--text-light)",
                        fontFamily: "var(--font-dm-sans)",
                        fontSize: "14px",
                        fontWeight: 600,
                        cursor: "pointer",
                        transition: "all 0.2s",
                      }}
                    >
                      {type === "Self" ? "For myself" : "For a friend"}
                    </button>
                  );
                })}
              </div>
            </div>

            <div style={{ marginBottom: "32px" }}>
              <SectionTitle>
                {form.applicationType === "Self" ? "About You" : "About Your Friend"}
              </SectionTitle>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <FieldGroup label="Full Name" required error={errors.name}>
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => set("name", e.target.value)}
                    placeholder="Name"
                    style={inputStyle}
                  />
                </FieldGroup>

                <FieldGroup label="Age" required error={errors.age}>
                  <input
                    type="number"
                    value={form.age}
                    onChange={(e) => set("age", e.target.value)}
                    placeholder="Age"
                    min={18}
                    max={99}
                    style={inputStyle}
                  />
                </FieldGroup>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <FieldGroup label="Gender" required error={errors.gender}>
                  <select value={form.gender} onChange={(e) => set("gender", e.target.value)} style={selectStyle}>
                    <option value="">Select…</option>
                    {["Man", "Woman", "Non-binary", "Other"].map((g) => (
                      <option key={g} value={g}>{g}</option>
                    ))}
                  </select>
                </FieldGroup>

                <FieldGroup label="Orientation" required error={errors.orientation}>
                  <select value={form.orientation} onChange={(e) => set("orientation", e.target.value)} style={selectStyle}>
                    <option value="">Select…</option>
                    {["Straight", "Gay", "Bisexual", "Other"].map((o) => (
                      <option key={o} value={o}>{o}</option>
                    ))}
                  </select>
                </FieldGroup>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <FieldGroup label="City" required error={errors.city}>
                  <input
                    type="text"
                    value={form.city}
                    onChange={(e) => set("city", e.target.value)}
                    placeholder="New York City"
                    style={inputStyle}
                  />
                </FieldGroup>

                <FieldGroup label="Height" error={errors.height}>
                  <input
                    type="text"
                    value={form.height}
                    onChange={(e) => set("height", e.target.value)}
                    placeholder={`5'8"`}
                    style={inputStyle}
                  />
                </FieldGroup>
              </div>

              <FieldGroup label="Instagram Handle" required error={errors.instagram}>
                <div style={{ position: "relative" }}>
                  <span
                    style={{
                      position: "absolute",
                      left: "18px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-light)",
                      fontSize: "15px",
                      pointerEvents: "none",
                    }}
                  >
                    @
                  </span>
                  <input
                    type="text"
                    value={form.instagram}
                    onChange={(e) => set("instagram", e.target.value.replace(/^@/, ""))}
                    placeholder="yourhandle"
                    style={{ ...inputStyle, paddingLeft: "34px" }}
                  />
                </div>
              </FieldGroup>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0 16px" }}>
                <FieldGroup label="Community" required error={errors.community}>
                  <select value={form.community} onChange={(e) => set("community", e.target.value)} style={selectStyle}>
                    <option value="">Select…</option>
                    {COMMUNITY_OPTIONS.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </FieldGroup>

                <FieldGroup label="Income" required error={errors.income}>
                  <select value={form.income} onChange={(e) => set("income", e.target.value)} style={selectStyle}>
                    <option value="">Select…</option>
                    {INCOME_OPTIONS.map((i) => (
                      <option key={i} value={i}>{i}</option>
                    ))}
                  </select>
                </FieldGroup>
              </div>
            </div>

            {form.applicationType === "Nomination" && (
              <div style={{ marginBottom: "32px" }}>
                <SectionTitle>Your Info</SectionTitle>
                <FieldGroup label="Your Name" required error={errors.referrerName}>
                  <input
                    type="text"
                    value={form.referrerName}
                    onChange={(e) => set("referrerName", e.target.value)}
                    placeholder="So we know who nominated them"
                    style={inputStyle}
                  />
                </FieldGroup>
              </div>
            )}

            <div style={{ marginBottom: "32px" }}>
              <SectionTitle>Photo</SectionTitle>
              <p style={{ ...labelStyle, marginBottom: "12px" }}>
                Best recent photo
                <span style={{ color: "var(--crimson)", marginLeft: "3px" }}>*</span>
              </p>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handlePhotoChange}
                style={{ display: "none" }}
              />

              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  border: `2px dashed ${errors.photo ? "var(--crimson)" : "var(--border)"}`,
                  borderRadius: "14px",
                  padding: "24px",
                  textAlign: "center",
                  cursor: "pointer",
                  transition: "border-color 0.2s",
                  background: "#fff",
                  overflow: "hidden",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.borderColor = "var(--crimson)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.borderColor = errors.photo ? "var(--crimson)" : "var(--border)")
                }
              >
                {photoPreview ? (
                  <img
                    src={photoPreview}
                    alt="Preview"
                    style={{
                      width: "100%",
                      maxHeight: "280px",
                      objectFit: "cover",
                      borderRadius: "8px",
                      display: "block",
                    }}
                  />
                ) : (
                  <>
                    <p style={{ fontSize: "2rem", marginBottom: "8px" }}>📸</p>
                    <p style={{ fontSize: "14px", color: "var(--text-light)", fontFamily: "var(--font-dm-sans)" }}>
                      Tap to upload a photo
                    </p>
                  </>
                )}
              </div>

              {photoPreview && (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    marginTop: "8px",
                    background: "none",
                    border: "none",
                    color: "var(--crimson)",
                    fontFamily: "var(--font-dm-sans)",
                    fontSize: "13px",
                    cursor: "pointer",
                    textDecoration: "underline",
                    padding: 0,
                  }}
                >
                  Change photo
                </button>
              )}

              {errors.photo && (
                <p style={{ fontSize: "12px", color: "var(--crimson)", marginTop: "6px" }}>
                  {errors.photo}
                </p>
              )}
            </div>

            <div style={{ marginBottom: "40px" }}>
              <SectionTitle>Anything else?</SectionTitle>
              <FieldGroup
                label={
                  form.applicationType === "Self"
                    ? "Why would you be a great fit? (optional)"
                    : "Why would your friend be a great fit? (optional)"
                }
              >
                <textarea
                  value={form.pitch}
                  onChange={(e) => set("pitch", e.target.value)}
                  placeholder="Tell us something fun, bold, or irresistible…"
                  style={textareaStyle}
                />
              </FieldGroup>
            </div>

            {submitError && (
              <p style={{ textAlign: "center", color: "var(--crimson)", fontSize: "14px", marginBottom: "12px" }}>
                {submitError}
              </p>
            )}

            <button
              type="submit"
              disabled={submitting}
              style={{
                width: "100%",
                padding: "16px",
                borderRadius: "100px",
                border: "none",
                background: submitting ? "var(--crimson-dark)" : "var(--crimson)",
                color: "#fff",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "16px",
                fontWeight: 600,
                letterSpacing: "0.02em",
                cursor: submitting ? "not-allowed" : "pointer",
                transition: "background 0.2s",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "10px",
              }}
              onMouseEnter={(e) => {
                if (!submitting) e.currentTarget.style.background = "var(--crimson-dark)";
              }}
              onMouseLeave={(e) => {
                if (!submitting) e.currentTarget.style.background = "var(--crimson)";
              }}
            >
              {submitting ? (
                <>
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
                      border: "2px solid rgba(255,255,255,0.4)",
                      borderTopColor: "#fff",
                      borderRadius: "50%",
                      display: "inline-block",
                      animation: "spin 0.7s linear infinite",
                    }}
                  />
                  Submitting…
                  <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
                </>
              ) : (
                "Submit Application 🌶️"
              )}
            </button>

            <p
              style={{
                textAlign: "center",
                fontSize: "12px",
                color: "var(--text-light)",
                marginTop: "16px",
                lineHeight: 1.5,
              }}
            >
              By submitting, you agree to be contacted by the Garam Masala Dating team.
            </p>
          </form>
        </div>
      </div>
    </>
  );
}
