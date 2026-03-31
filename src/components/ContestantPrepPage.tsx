import { useState, useEffect } from "react";
import { Check, Clock, Users, Shirt, Star } from "lucide-react";

/* ─── Session helpers ──────────────────────────────────────────── */

const TOKEN_KEY = "gm-prep-token";
const EXPIRES_KEY = "gm-prep-expires";

function getSession(): { token: string; expiresAt: number } | null {
  if (typeof window === "undefined") return null;
  const token = localStorage.getItem(TOKEN_KEY);
  const expires = localStorage.getItem(EXPIRES_KEY);
  if (!token || !expires) return null;
  const expiresAt = parseInt(expires, 10);
  if (Number.isNaN(expiresAt) || Date.now() >= expiresAt) {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(EXPIRES_KEY);
    return null;
  }
  return { token, expiresAt };
}

function saveSession(token: string, expiresAt: number) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

/* ─── Loading state ────────────────────────────────────────────── */

function PrepLoading() {
  return (
    <>
      <style>{`@keyframes prepSpin { to { transform: rotate(360deg); } }`}</style>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          position: "relative",
          zIndex: 1,
        }}
      >
        <div
          style={{
            width: "32px",
            height: "32px",
            border: "2px solid rgba(201, 168, 76, 0.2)",
            borderTopColor: "#C9A84C",
            borderRadius: "50%",
            animation: "prepSpin 0.7s linear infinite",
          }}
        />
      </div>
    </>
  );
}

/* ─── Error / expired state ────────────────────────────────────── */

function PrepError() {
  return (
    <>
      <style>{`
        @keyframes prepFadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      <div
        style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          position: "relative",
          zIndex: 1,
          animation: "prepFadeIn 0.4s ease-out both",
        }}
      >
        <div
          style={{
            background: "rgba(20, 16, 13, 0.95)",
            border: "1px solid rgba(201, 168, 76, 0.2)",
            borderRadius: "20px",
            padding: "48px 36px",
            width: "100%",
            maxWidth: "380px",
            backdropFilter: "blur(20px)",
            WebkitBackdropFilter: "blur(20px)",
            boxShadow: "0 8px 40px rgba(0, 0, 0, 0.3)",
            textAlign: "center",
          }}
        >
          <p style={{ fontSize: "2.2rem", marginBottom: "12px" }}>🌶️</p>
          <h1
            style={{
              fontFamily: "var(--font-playfair)",
              fontSize: "24px",
              fontWeight: 700,
              color: "var(--text-ivory)",
              marginBottom: "12px",
              lineHeight: 1.2,
            }}
          >
            Link expired
          </h1>
          <p
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "16px",
              color: "rgba(245, 237, 228, 0.55)",
              lineHeight: 1.55,
            }}
          >
            This link has expired or is invalid. Ask your host for a new one.
          </p>
        </div>
      </div>
    </>
  );
}

/* ─── Section divider ──────────────────────────────────────────── */

function Divider() {
  return (
    <div
      style={{
        width: "48px",
        height: "1px",
        background: "rgba(201, 168, 76, 0.3)",
        margin: "40px auto",
      }}
    />
  );
}

/* ─── Section header ───────────────────────────────────────────── */

function SectionHeader({
  icon: Icon,
  title,
}: {
  icon?: typeof Star;
  title: string;
}) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "10px",
        marginBottom: "20px",
      }}
    >
      {Icon && <Icon size={18} style={{ color: "#C9A84C", flexShrink: 0 }} />}
      <h2
        style={{
          fontFamily: "var(--font-playfair)",
          fontSize: "22px",
          fontWeight: 600,
          color: "var(--text-ivory)",
          lineHeight: 1.2,
        }}
      >
        {title}
      </h2>
    </div>
  );
}

/* ─── Callout card ─────────────────────────────────────────────── */

function Callout({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        background: "rgba(201, 168, 76, 0.06)",
        border: "1px solid rgba(201, 168, 76, 0.15)",
        borderRadius: "14px",
        padding: "20px 22px",
        marginBottom: "16px",
      }}
    >
      <p
        style={{
          fontFamily: "var(--font-jetbrains)",
          fontSize: "11px",
          fontWeight: 500,
          textTransform: "uppercase",
          letterSpacing: "0.15em",
          color: "#C9A84C",
          marginBottom: "8px",
        }}
      >
        {title}
      </p>
      <div
        style={{
          fontFamily: "var(--font-cormorant)",
          fontSize: "16px",
          color: "rgba(245, 237, 228, 0.8)",
          lineHeight: 1.55,
        }}
      >
        {children}
      </div>
    </div>
  );
}

/* ─── Prep guide content ───────────────────────────────────────── */

const GOLDEN_RULES = [
  "Give 20\u201330 second answers. Not one word. Not a monologue.",
  "Be vulnerable over being funny. Honesty is funnier than forced jokes.",
  "The audience is rooting for you. They WANT you to find love.",
  "Don\u2019t try to \u201Cwin\u201D the audience. Focus on your date.",
  "It\u2019s okay to say \u201CI don\u2019t like this person.\u201D Honesty is content.",
  "2\u20133 drinks max before going on. Loose, not sloppy.",
];

const QUESTIONS = [
  "What\u2019s your name, and what do you do?",
  "What are you looking for in a partner?",
  "What are your dealbreakers / red flags?",
  "What are your green flags?",
  "What\u2019s your biggest ick?",
  "Why did your last relationship end?",
  "Are you over your ex?",
  "What\u2019s your best quality? Worst quality?",
  "Where would you take someone on a first date in NYC?",
  "How close are you to your family?",
  "What do you do for fun?",
  "How many serious relationships have you been in?",
  "How much do you make? (this might come up)",
];

const PREPARED_WITH = [
  {
    title: "One thoughtful question to ask your date",
    detail:
      'Make it conversational. Good: \u201CIf we had one weekend anywhere, where are we going?\u201D Bad: \u201CWhat do you do for work?\u201D',
  },
  {
    title: "One talent or party trick you can show in 30 seconds",
    detail: "Dance, song, joke, impression \u2014 whatever you\u2019ve got.",
  },
  {
    title: "One pickup line",
    detail: "Cheesy is fine.",
  },
  {
    title: "Your 30-second elevator pitch",
    detail: "Who are you and why should someone date you?",
  },
];

function PrepGuide() {
  return (
    <>
      <style>{`
        @keyframes guideFadeIn {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <div
        style={{
          minHeight: "100vh",
          position: "relative",
          zIndex: 1,
          animation: "guideFadeIn 0.6s ease-out both",
        }}
      >
        <div
          style={{
            maxWidth: "560px",
            margin: "0 auto",
            padding: "48px 24px 80px",
          }}
        >
          {/* ── Header ── */}
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <p style={{ fontSize: "2.5rem", marginBottom: "8px" }}>🌶️</p>
            <h1
              style={{
                fontFamily: "var(--font-playfair)",
                fontSize: "32px",
                fontWeight: 700,
                color: "var(--text-ivory)",
                lineHeight: 1.15,
                marginBottom: "12px",
              }}
            >
              Welcome to Garam Mas
              <em style={{ fontStyle: "italic", color: "var(--gold-accent)" }}>ala</em>{" "}
              Dating!
            </h1>
            <p
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "18px",
                color: "rgba(245, 237, 228, 0.65)",
                lineHeight: 1.5,
                maxWidth: "440px",
                margin: "0 auto",
              }}
            >
              You&apos;re about to be on a live comedy dating show in front of 250
              people. Here&apos;s the secret: we don&apos;t need you to be funny.{" "}
              <strong style={{ color: "var(--text-ivory)" }}>We need you to be REAL.</strong>
            </p>
          </div>

          <Divider />

          {/* ── The Golden Rules ── */}
          <SectionHeader icon={Star} title="The Golden Rules" />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {GOLDEN_RULES.map((rule, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.03)",
                  border: "1px solid rgba(245, 237, 228, 0.06)",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "18px",
                    fontStyle: "italic",
                    fontWeight: 600,
                    color: "#C9A84C",
                    lineHeight: "24px",
                    flexShrink: 0,
                    width: "20px",
                    textAlign: "right",
                  }}
                >
                  {i + 1}
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "16px",
                    color: "rgba(245, 237, 228, 0.8)",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {rule}
                </p>
              </div>
            ))}
          </div>

          <Divider />

          {/* ── Questions ── */}
          <SectionHeader title="Questions You Will Be Asked" />
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {QUESTIONS.map((q, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                }}
              >
                <span
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "15px",
                    fontStyle: "italic",
                    color: "#C9A84C",
                    lineHeight: "24px",
                    flexShrink: 0,
                    width: "24px",
                    textAlign: "right",
                  }}
                >
                  {i + 1}.
                </span>
                <p
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "16px",
                    color: "rgba(245, 237, 228, 0.75)",
                    lineHeight: 1.5,
                    margin: 0,
                  }}
                >
                  {q}
                </p>
              </div>
            ))}
          </div>

          <Divider />

          {/* ── Come Prepared With ── */}
          <SectionHeader icon={Check} title="Come Prepared With" />
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            {PREPARED_WITH.map((item, i) => (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: "14px",
                  alignItems: "flex-start",
                  padding: "16px 18px",
                  borderRadius: "12px",
                  border: "1px solid rgba(201, 168, 76, 0.15)",
                  background: "rgba(201, 168, 76, 0.04)",
                }}
              >
                <div
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "6px",
                    border: "1.5px solid rgba(201, 168, 76, 0.4)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "1px",
                  }}
                >
                  <Check size={12} style={{ color: "#C9A84C", opacity: 0.6 }} />
                </div>
                <div>
                  <p
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: "16px",
                      fontWeight: 600,
                      color: "var(--text-ivory)",
                      margin: 0,
                      lineHeight: 1.4,
                    }}
                  >
                    {item.title}
                  </p>
                  <p
                    style={{
                      fontFamily: "var(--font-cormorant)",
                      fontSize: "15px",
                      color: "rgba(245, 237, 228, 0.5)",
                      margin: "4px 0 0",
                      lineHeight: 1.45,
                    }}
                  >
                    {item.detail}
                  </p>
                </div>
              </div>
            ))}
          </div>

          <Divider />

          {/* ── What to Wear ── */}
          <SectionHeader icon={Shirt} title="What to Wear" />
          <p
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "16px",
              color: "rgba(245, 237, 228, 0.75)",
              lineHeight: 1.6,
            }}
          >
            This is a real date. Dress hot &mdash; bright colors, bold fits, sequins
            welcome. No &ldquo;just came from the office&rdquo; energy.
          </p>

          <Divider />

          {/* ── Bring Your Friends ── */}
          <SectionHeader icon={Users} title="Bring Your Friends" />
          <p
            style={{
              fontFamily: "var(--font-cormorant)",
              fontSize: "16px",
              color: "rgba(245, 237, 228, 0.75)",
              lineHeight: 1.6,
            }}
          >
            Invite your friends to come support you. More energy in the room = better
            show for everyone.
          </p>

          <Divider />

          {/* ── Arrival Times ── */}
          <SectionHeader icon={Clock} title="Arrival Times" />
          <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
            {[
              { label: "Guys", time: "5:20 PM sharp" },
              { label: "Girls", time: "5:30 PM sharp" },
            ].map((item) => (
              <div
                key={item.label}
                style={{
                  flex: "1 1 140px",
                  padding: "18px 20px",
                  borderRadius: "12px",
                  background: "rgba(255, 255, 255, 0.04)",
                  border: "1px solid rgba(245, 237, 228, 0.08)",
                  textAlign: "center",
                }}
              >
                <p
                  style={{
                    fontFamily: "var(--font-jetbrains)",
                    fontSize: "11px",
                    textTransform: "uppercase",
                    letterSpacing: "0.15em",
                    color: "#C9A84C",
                    marginBottom: "6px",
                  }}
                >
                  {item.label}
                </p>
                <p
                  style={{
                    fontFamily: "var(--font-cormorant)",
                    fontSize: "20px",
                    fontWeight: 600,
                    color: "var(--text-ivory)",
                  }}
                >
                  {item.time}
                </p>
              </div>
            ))}
          </div>

          <Divider />

          {/* ── Notes ── */}
          <Callout title="Note for Guys">
            Audiences tend to root for the girls. Don&apos;t try to win the crowd by
            being cocky or mean &mdash; it backfires every time. Charming, genuine,
            and a little self-deprecating is what wins. Confident but humble.
          </Callout>

          <Callout title="Note for Girls">
            You&apos;re allowed to not like someone. Say it. &ldquo;I&apos;m not
            feeling this&rdquo; is great content. Don&apos;t fake chemistry.
          </Callout>

          {/* ── Footer ── */}
          <div
            style={{
              textAlign: "center",
              marginTop: "48px",
              paddingTop: "24px",
              borderTop: "1px solid rgba(245, 237, 228, 0.06)",
            }}
          >
            <p
              style={{
                fontFamily: "var(--font-cormorant)",
                fontSize: "16px",
                fontStyle: "italic",
                color: "rgba(245, 237, 228, 0.25)",
              }}
            >
              See you on stage 🌶️
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function ContestantPrepPage() {

  const [state, setState] = useState<"checking" | "authed" | "error">(() =>
    getSession() !== null ? "authed" : "checking"
  );

  useEffect(() => {
    if (state !== "checking") return;

    const params = new URLSearchParams(window.location.search);
    const date = params.get("date");
    const sig = params.get("sig");

    if (!date || !sig) {
      setState("error");
      return;
    }

    fetch("/api/contestant-prep-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, sig }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as { token: string; expiresAt: number };
          saveSession(data.token, data.expiresAt);
          setState("authed");
        } else {
          setState("error");
        }
      })
      .catch(() => setState("error"));
  }, []);

  if (state === "authed") return <PrepGuide />;
  if (state === "checking") return <PrepLoading />;
  return <PrepError />;
}
