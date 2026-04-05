import { useState, useEffect } from "react";
import { Clock, Users, Shirt, Star } from "lucide-react";
import styles from "./ContestantPrepPage.module.css";

/* ─── Session helpers ──────────────────────────────────────────── */

const TOKEN_KEY = "gm-prep-token";
const EXPIRES_KEY = "gm-prep-expires";

function getSession(): { token: string; expiresAt: number } | null {
  if (typeof window === "undefined") return null;
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expires = sessionStorage.getItem(EXPIRES_KEY);
  if (!token || !expires) return null;
  const expiresAt = parseInt(expires, 10);
  if (Number.isNaN(expiresAt) || Date.now() >= expiresAt) {
    sessionStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(EXPIRES_KEY);
    return null;
  }
  return { token, expiresAt };
}

function saveSession(token: string, expiresAt: number) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

/* ─── Loading state ────────────────────────────────────────────── */

function PrepLoading() {
  return (
    <div className={styles.loadingWrapper}>
      <div className={styles.spinner} />
    </div>
  );
}

/* ─── Error / expired state ────────────────────────────────────── */

function PrepError() {
  return (
    <div className={styles.errorWrapper}>
      <div className={styles.errorCard}>
        <p className={styles.errorEmoji}>🌶️</p>
        <h1 className={styles.errorTitle}>Link expired</h1>
        <p className={styles.errorText}>
          This link has expired or is invalid. Ask your host for a new one.
        </p>
      </div>
    </div>
  );
}

/* ─── Section divider ──────────────────────────────────────────── */

function Divider() {
  return <div className={styles.divider} />;
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
    <div className={styles.sectionHeader}>
      {Icon && <Icon size={18} className={styles.sectionIcon} />}
      <h2 className={styles.sectionTitle}>{title}</h2>
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
    <div className={styles.callout}>
      <p className={styles.calloutLabel}>{title}</p>
      <div className={styles.calloutBody}>{children}</div>
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
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Header ── */}
        <div className={styles.headerArea}>
          <p className={styles.headerEmoji}>🌶️</p>
          <h1 className={styles.headerTitle}>
            Welcome to Garam Mas
            <em className={styles.headerTitleAccent}>ala</em>{" "}
            Dating!
          </h1>
          <p className={styles.headerSubtitle}>
            You&apos;re about to be on a live comedy dating show in front of 250
            people. Here&apos;s the secret: we don&apos;t need you to be funny.{" "}
            <strong className={styles.headerSubtitleStrong}>We need you to be REAL.</strong>
          </p>
        </div>

        <Divider />

        {/* ── The Golden Rules ── */}
        <SectionHeader icon={Star} title="The Golden Rules" />
        <div className={styles.rulesList}>
          {GOLDEN_RULES.map((rule, i) => (
            <div key={i} className={styles.ruleCard}>
              <span className={styles.ruleNumber}>{i + 1}</span>
              <p className={styles.ruleText}>{rule}</p>
            </div>
          ))}
        </div>

        <Divider />

        {/* ── Questions ── */}
        <SectionHeader title="Questions You Will Be Asked" />
        <div className={styles.questionsList}>
          {QUESTIONS.map((q, i) => (
            <div key={i} className={styles.questionRow}>
              <span className={styles.questionNumber}>{i + 1}.</span>
              <p className={styles.questionText}>{q}</p>
            </div>
          ))}
        </div>

        <Divider />

        {/* ── Come Prepared With ── */}
        <SectionHeader icon={Star} title="Come Prepared With" />
        <div className={styles.prepList}>
          {PREPARED_WITH.map((item, i) => (
            <div key={i} className={styles.prepCard}>
              <div className={styles.prepBullet} />
              <div>
                <p className={styles.prepTitle}>{item.title}</p>
                <p className={styles.prepDetail}>{item.detail}</p>
              </div>
            </div>
          ))}
        </div>

        <Divider />

        {/* ── What to Wear ── */}
        <SectionHeader icon={Shirt} title="What to Wear" />
        <p className={styles.bodyText}>
          This is a real date. Dress hot &mdash; bright colors, bold fits, sequins
          welcome. No &ldquo;just came from the office&rdquo; energy.
        </p>

        <Divider />

        {/* ── Bring Your Friends ── */}
        <SectionHeader icon={Users} title="Bring Your Friends" />
        <p className={styles.bodyText}>
          Invite your friends to come support you. More energy in the room = better
          show for everyone.
        </p>

        <Divider />

        {/* ── Arrival Times ── */}
        <SectionHeader icon={Clock} title="Arrival Times" />
        <div className={styles.timeGrid}>
          {[
            { label: "Guys", time: "5:20 PM sharp" },
            { label: "Girls", time: "5:30 PM sharp" },
          ].map((item) => (
            <div key={item.label} className={styles.timeCard}>
              <p className={styles.timeLabel}>{item.label}</p>
              <p className={styles.timeValue}>{item.time}</p>
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
        <div className={styles.footer}>
          <p className={styles.footerText}>See you on stage 🌶️</p>
        </div>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function ContestantPrepPage() {
  const [params] = useState(() => {
    if (typeof window === "undefined") return { date: null as string | null, sig: null as string | null };
    const sp = new URLSearchParams(window.location.search);
    return { date: sp.get("date"), sig: sp.get("sig") };
  });

  const [state, setState] = useState<"checking" | "authed" | "error">(() => {
    if (getSession() !== null) return "authed";
    if (!params.date && !params.sig) return "authed";
    if (!params.date || !params.sig) return "error";
    return "checking";
  });

  useEffect(() => {
    if (state !== "checking") return;

    fetch("/api/contestant-prep-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: params.date, sig: params.sig }),
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
  }, [state, params]);

  if (state === "authed") return <PrepGuide />;
  if (state === "checking") return <PrepLoading />;
  return <PrepError />;
}
