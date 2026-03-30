import { useState, useRef } from "react";

interface AdminLoginProps {
  onSuccess: (sessionToken: string) => void;
}

export default function AdminLogin({ onSuccess }: AdminLoginProps) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [shaking, setShaking] = useState(false);
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const res = await fetch("/api/admin-auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        const { sessionToken } = await res.json();
        onSuccess(sessionToken);
      } else {
        setError("Incorrect password.");
        setShaking(true);
        setPassword("");
        inputRef.current?.focus();
      }
    } catch {
      setError("Something went wrong. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <style>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          20%       { transform: translateX(-6px); }
          40%       { transform: translateX(6px); }
          60%       { transform: translateX(-6px); }
          80%       { transform: translateX(6px); }
        }
        .shake { animation: shake 0.4s ease; }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          background: "var(--cream)",
          position: "relative",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "16px",
            boxShadow: "0 4px 32px rgba(0,0,0,0.08)",
            padding: "48px 40px",
            width: "100%",
            maxWidth: "380px",
          }}
        >
          <p style={{ textAlign: "center", fontSize: "2rem", marginBottom: "12px" }}>
            🌶️
          </p>
          <h1
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "28px",
              fontWeight: 700,
              color: "var(--text)",
              textAlign: "center",
              marginBottom: "32px",
            }}
          >
            Team Access
          </h1>

          <form onSubmit={handleSubmit} noValidate>
            <div
              className={shaking ? "shake" : ""}
              onAnimationEnd={() => setShaking(false)}
            >
              <input
                ref={inputRef}
                type="password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setError("");
                }}
                placeholder="Password"
                autoFocus
                style={{
                  width: "100%",
                  padding: "12px 18px",
                  borderRadius: "100px",
                  border: `1px solid ${error ? "var(--crimson)" : "var(--border)"}`,
                  fontFamily: "var(--font-dm-sans)",
                  fontSize: "15px",
                  color: "var(--text)",
                  background: "#fff",
                  outline: "none",
                  boxSizing: "border-box",
                  marginBottom: "8px",
                  transition: "border-color 0.2s",
                }}
              />
            </div>

            {error && (
              <p
                style={{
                  color: "var(--crimson)",
                  fontSize: "13px",
                  marginBottom: "12px",
                  paddingLeft: "4px",
                }}
              >
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              style={{
                width: "100%",
                padding: "13px",
                borderRadius: "100px",
                border: "none",
                background: "var(--crimson)",
                color: "#fff",
                fontFamily: "var(--font-dm-sans)",
                fontSize: "15px",
                fontWeight: 600,
                letterSpacing: "0.02em",
                cursor: "pointer",
                marginTop: error ? "0" : "4px",
                transition: "background 0.2s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "var(--crimson-dark)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background = "var(--crimson)")
              }
            >
              {loading ? "..." : "Enter"}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
