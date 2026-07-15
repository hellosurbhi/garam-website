import { useState, useEffect, useMemo, useSyncExternalStore } from "react";
import styles from "./ContestantPrepPage.module.css";
import Skeleton from "./ui/Skeleton";

/* ─── Hydration gate ───────────────────────────────────────────── */

const emptySubscribe = () => () => {};

// WHY: this page is statically prerendered, so the first client render must
// match the baked HTML exactly. Reading window.location or sessionStorage in
// a state initializer bakes the no-params "authed" branch at build time; a
// real visitor arrives with ?date&sig, hydrates into "checking", and React
// swaps the baked guide for a short skeleton, then re-expands it after auth:
// a full-page double layout shift. useSyncExternalStore's server snapshot
// pins both the build output and the hydration pass to the skeleton; the
// real gate is derived at render only after hydration.
function useHydrated(): boolean {
  return useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false,
  );
}

/* ─── Session helpers ──────────────────────────────────────────── */

const TOKEN_KEY = "gm-prep-token";
const EXPIRES_KEY = "gm-prep-expires";

/** Pure read: an expired or malformed session is treated as absent. */
function readSession(): { token: string; expiresAt: number } | null {
  const token = sessionStorage.getItem(TOKEN_KEY);
  const expires = sessionStorage.getItem(EXPIRES_KEY);
  if (!token || !expires) return null;
  const expiresAt = parseInt(expires, 10);
  if (Number.isNaN(expiresAt) || Date.now() >= expiresAt) return null;
  return { token, expiresAt };
}

/** Storage hygiene, called from the effect (never during render). */
function clearExpiredSession() {
  if (readSession() !== null) return;
  sessionStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(EXPIRES_KEY);
}

function saveSession(token: string, expiresAt: number) {
  sessionStorage.setItem(TOKEN_KEY, token);
  sessionStorage.setItem(EXPIRES_KEY, String(expiresAt));
}

/* ─── Loading state ────────────────────────────────────────────── */

function PrepLoading() {
  return (
    <div className={styles.loadingWrapper} aria-busy="true">
      <Skeleton count={8} />
    </div>
  );
}

/* ─── Error / expired state ────────────────────────────────────── */

function PrepError() {
  return (
    <div className={styles.errorWrapper}>
      <div role="alert" className={styles.errorCard}>
        <p className={styles.errorEmoji}>🌶️</p>
        <h1 className={styles.errorTitle}>Link expired</h1>
        <p className={styles.errorText}>
          This link has expired or is invalid. Ask your host for a new one.
        </p>
      </div>
    </div>
  );
}

/* ─── Prep guide ───────────────────────────────────────────────── */

function PrepGuide() {
  const [gender, setGender] = useState<"female" | "male" | "">("");

  return (
    <div className={styles.page}>
      <div className={styles.container}>
        {/* ── Cover ── */}
        <header className={styles.cover}>
          <h1 className={styles.coverTitle}>🌶️ Contestant Orientation</h1>
          <p className={styles.coverShow}>Garam Masala Dating</p>
          <p className={styles.coverIntro}>
            You&apos;ve been selected as a contestant on America&apos;s #1 live
            South Asian dating show. You&apos;ll be on stage, mic&apos;d up,
            matched with someone you&apos;ve never met, in front of a full
            audience. It&apos;s real, it&apos;s fast, and it&apos;s genuinely
            one of the most fun things you&apos;ll do. Read this packet before
            you arrive.
          </p>
          <p className={styles.coverCore}>
            We don&apos;t need you to be funny. We need you to be{" "}
            <strong>REAL</strong>.
          </p>
        </header>

        {/* ── Golden Rules ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>The Golden Rules</h2>
          <p className={styles.lead}>
            These apply to every contestant, every show. There are no
            exceptions.
          </p>
          <ol className={styles.numberedList}>
            <li>
              <strong>Keep answers to 20 to 30 seconds.</strong> Not a one-word
              answer. Not a five-minute story. The sweet spot is conversational,
              enough to say something real without losing the room.
            </li>
            <li>
              <strong>Vulnerable beats funny every time.</strong> A genuine
              moment lands harder than a polished joke. You don&apos;t have to
              be entertaining. You have to be honest.
            </li>
            <li>
              <strong>The audience is on your side.</strong> They showed up
              wanting to see a real connection. They are rooting for you, not
              waiting for you to fail.
            </li>
            <li>
              <strong>Focus on your date, not the crowd.</strong> The moment you
              start playing to the room, you lose everything. Your date is the
              only person that matters on that stage.
            </li>
            <li>
              <strong>It&apos;s okay to not feel it.</strong> Saying
              &ldquo;I&apos;m not feeling the chemistry&rdquo; is honest and it
              makes for great television. Faking attraction is not. The audience
              can always tell.
            </li>
            <li>
              <strong>Two to three drinks before you go on. Maximum.</strong>{" "}
              Enough to be relaxed and loose. Not enough to be impaired. You
              want your full self on stage, just without the nerves.
            </li>
          </ol>
        </section>

        {/* ── Questions ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Questions You May Be Asked</h2>
          <p className={styles.lead}>
            Prepare a 30 to 60 second answer for every question on this list.
            You won&apos;t be asked all of them, and the host may go off-script
            based on your answers, but nothing on this list should catch you off
            guard.
          </p>
          <ol className={styles.numberedList}>
            <li>What&apos;s your name, and what do you do?</li>
            <li>What are you actually looking for in a partner?</li>
            <li>What are your dealbreakers?</li>
            <li>What are your green flags?</li>
            <li>What&apos;s your biggest ick?</li>
            <li>Why did your last relationship end?</li>
            <li>Are you over your ex?</li>
            <li>What&apos;s your best quality? Your worst?</li>
            <li>Where would you take someone on a first date?</li>
            <li>How close are you to your family?</li>
            <li>What do you do for fun outside of work?</li>
            <li>How many serious relationships have you been in?</li>
            <li>How much do you make? (Yes, this comes up.)</li>
          </ol>
        </section>

        {/* ── Come Prepared With ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Come Prepared With</h2>
          <p className={styles.lead}>
            These are not suggestions. Have all four ready before you arrive.
          </p>
          <ul className={styles.prepList}>
            <li>
              <strong>One thoughtful question to ask your date.</strong> Make it
              conversational, not interview-style. Good example: &ldquo;If we
              had one free weekend anywhere, where are we going?&rdquo; Bad
              example: &ldquo;What do you do for work?&rdquo; The goal is to
              learn something real about them, not run through a checklist.
            </li>
            <li>
              <strong>
                A talent or party trick you can perform in 30 seconds.
              </strong>{" "}
              A dance move, an impression, a joke, a magic trick: whatever
              you&apos;ve got. The weirder and more specific to you, the better.
            </li>
            <li>
              <strong>A pickup line.</strong> Cheesy is completely fine.
              That&apos;s the point. Lean into it.
            </li>
            <li>
              <strong>Your 30-second elevator pitch.</strong> Who are you, and
              why should someone want to go on a date with you? Practice saying
              this out loud before you come. It should feel natural, not
              rehearsed.
            </li>
          </ul>
        </section>

        {/* ── What to Wear ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What to Wear</h2>
          <p className={styles.body}>
            Dress like you&apos;re going on a real first date. Because you are.
            Bold colors, statement fits, sequins absolutely welcome. Think about
            what you would wear if you were genuinely trying to impress someone,
            and wear that. No &ldquo;just came from the office&rdquo; energy. No
            gym clothes. You&apos;ll be on a lit stage in front of a full
            audience, so whatever reads as confident and put-together in real
            life will read even better up there.
          </p>
        </section>

        {/* ── Day of ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Day Of</h2>
          <p className={styles.body}>
            Bring your friends. The more people cheering for you in the
            audience, the better the show, and honestly, the better your own
            performance. Having friendly faces in the crowd makes a real
            difference when you&apos;re up there. Tell your people to come.
          </p>
          <p className={styles.body}>
            Your phone will be with you backstage. You can look at these notes
            again before you go on. Take a breath. You&apos;re ready.
          </p>
        </section>

        {/* ── Arrival & Notes ── */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Arrival &amp; Notes</h2>
          <p className={styles.toggleLabel}>Instructions for:</p>
          <div
            className={styles.genderToggle}
            role="group"
            aria-label="Select your contestant type"
          >
            <button
              type="button"
              className={`${styles.genderBtn}${gender === "male" ? ` ${styles.genderBtnActive}` : ""}`}
              onClick={() => setGender("male")}
            >
              Guys
            </button>
            <button
              type="button"
              className={`${styles.genderBtn}${gender === "female" ? ` ${styles.genderBtnActive}` : ""}`}
              onClick={() => setGender("female")}
            >
              Girls
            </button>
          </div>

          {gender && (
            <div className={styles.genderReveal}>
              <p className={styles.arrivalTime}>
                Arrive by {gender === "female" ? "5:30 PM" : "5:20 PM"} sharp.
              </p>
              <p className={styles.body}>
                {gender === "female"
                  ? "Arrive 15 minutes after the guys. We keep you separate so your first impression of each other happens on stage. You have full permission to not like someone. You don't owe anyone chemistry, and you don't need to perform it. \"I'm not really feeling the connection\" is great content. The girls who are remembered are the ones who said exactly what they thought. Don't fake it. The audience always knows."
                  : "Arrive 15 minutes before the girls. We keep you separate so your first impression of each other happens on stage. Audiences on this show tend to root for the women. Don't compensate by playing up charm or confidence. It reads as cocky and always backfires. What actually works: being genuinely curious about your date, not taking yourself too seriously, and being a little self-deprecating. Confident but humble."}
              </p>
            </div>
          )}
        </section>

        {/* ── Footer ── */}
        <footer className={styles.footer}>
          <p>See you on stage. 🌶️</p>
        </footer>
      </div>
    </div>
  );
}

/* ─── Page ─────────────────────────────────────────────────────── */

export default function ContestantPrepPage() {
  const hydrated = useHydrated();
  // Only the emailed-link verification is stateful; every other gate branch
  // is derived at render time from the URL and the stored session.
  const [authResult, setAuthResult] = useState<"pending" | "ok" | "fail">(
    "pending",
  );

  const link = useMemo(() => {
    if (!hydrated) return null;
    const sp = new URLSearchParams(window.location.search);
    return { date: sp.get("date"), sig: sp.get("sig") };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || link === null) return;
    clearExpiredSession();
    if (readSession() !== null) return;
    if (!link.date || !link.sig) return;

    let cancelled = false;
    fetch("/api/contestant-prep-auth", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date: link.date, sig: link.sig }),
    })
      .then(async (res) => {
        if (res.ok) {
          const data = (await res.json()) as {
            token: string;
            expiresAt: number;
          };
          if (cancelled) return;
          saveSession(data.token, data.expiresAt);
          setAuthResult("ok");
        } else if (!cancelled) {
          setAuthResult("fail");
        }
      })
      .catch(() => {
        if (!cancelled) setAuthResult("fail");
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, link]);

  // Pre-hydration (and at build time) this is always the skeleton, so the
  // baked HTML and the hydration pass agree and nothing shifts.
  let state: "checking" | "authed" | "error";
  if (!hydrated || link === null) {
    state = "checking";
  } else if (readSession() !== null) {
    state = "authed";
  } else if (!link.date && !link.sig) {
    state = "authed";
  } else if (!link.date || !link.sig) {
    state = "error";
  } else if (authResult === "pending") {
    state = "checking";
  } else {
    state = authResult === "ok" ? "authed" : "error";
  }

  if (state === "authed") return <PrepGuide />;
  if (state === "checking") return <PrepLoading />;
  return <PrepError />;
}
