import { useCallback, useEffect, useState } from "react";
import ReactSkeleton from "react-loading-skeleton";
import "react-loading-skeleton/dist/skeleton.css";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { SOCIAL_URLS } from "@/data/socials";
import {
  PORTAL_CONTACT_EMAIL,
  PORTAL_LOADING_ANNOUNCEMENT,
  ERROR_VIEW,
  EXPIRED_VIEW,
  PACKET_HERO,
  ROLE_SELECT,
  PORTAL_INTRO,
  GOLDEN_RULES,
  SAMPLE_QUESTIONS,
  COME_PREPARED_WITH,
  WARDROBE,
  DAY_OF,
  ARRIVAL_NOTES,
  MAILING_LIST_DISCLOSURE,
  claimErrorMessage,
} from "@/data/contestantPortal";
import styles from "@/components/ContestantPortal.module.css";
import {
  startPortalStateLoad,
  resolvePortalState,
  clearStoredPortalContext,
  parsePortalResponseBody,
  type ContestantRole,
  type PortalResolution,
  type PortalResponseData,
} from "@/lib/portalBootstrap";
import { WaiverPanel } from "@/components/WaiverPanel";

type PortalState = { type: "loading" } | PortalResolution;

type PortalSignupData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  waiverAgreed: boolean;
  signature: string;
  waiverVersion: string;
  mailingListOptIn: boolean;
};

type FormPhase = "form" | "submitting";

const CLAIM_ERROR_MESSAGE = claimErrorMessage(PORTAL_CONTACT_EMAIL);

function responseErrorMessage(data: PortalResponseData, fallback: string) {
  return data.error ?? data.message ?? fallback;
}

function formatCallTime(startTime?: string | null): string | null {
  if (!startTime) return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(startTime.trim());
  if (!match) return null;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  if (hours > 23 || minutes > 59) return null;

  const totalMinutes = (hours * 60 + minutes - 45 + 24 * 60) % (24 * 60);
  const callHours = Math.floor(totalMinutes / 60);
  const callMinutes = totalMinutes % 60;
  const suffix = callHours >= 12 ? "PM" : "AM";
  const hour12 = callHours % 12 || 12;
  return `${hour12}:${String(callMinutes).padStart(2, "0")} ${suffix}`;
}

// WHY: distinguishes a curated server-side error message (safe to show verbatim)
// from a raw browser/network exception (TypeError: Failed to fetch, AbortError, etc.)
// which must never reach the user as-is. Without this, a mid-request network
// change surfaces the literal string "Failed to fetch" in the UI.
class PortalApiError extends Error {}

async function claimPortal(endpoint: string, body: Record<string, unknown>) {
  const ctrl = new AbortController();
  const timerId = setTimeout(() => ctrl.abort(), 15_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    // WHY: parsePortalResponseBody must stay inside this try block so the
    // abort signal (cleared in finally) still covers response.text(). Reading
    // the body after clearTimeout leaves a stalled body read with no timeout,
    // hanging the UI in the submitting phase.
    const data = await parsePortalResponseBody(response);
    if (!response.ok) {
      throw new PortalApiError(responseErrorMessage(data, CLAIM_ERROR_MESSAGE));
    }
    // The link is spent the moment a claim succeeds; the portal_session
    // cookie owns access from here. A stale stored context would resolve to
    // "already used" on the next refresh.
    clearStoredPortalContext();
  } finally {
    clearTimeout(timerId);
  }
}

export default function ContestantPortal() {
  const [state, setState] = useState<PortalState>({ type: "loading" });
  const [formPhase, setFormPhase] = useState<FormPhase>("form");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    // WHY: the shared load is started by the page script before hydration
    // (see src/lib/portalBootstrap.ts) and must not be aborted on unmount:
    // React StrictMode's mount/unmount/mount cycle would kill the in-flight
    // request for the second mount. The cancelled flag only stops setState
    // from firing on an unmounted component.
    let cancelled = false;
    startPortalStateLoad().then((result) => {
      if (cancelled) return;
      setState(resolvePortalState(result, PORTAL_CONTACT_EMAIL));
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.type === "loading") {
    return <PortalLoading />;
  }
  if (state.type === "error") return <ErrorView message={state.message} />;
  if (state.type === "expired") return <ExpiredView />;
  if (state.type === "open") {
    return (
      <ContestantPacketGate
        showCity=""
        showDate=""
        showDisplayDate=""
        startTime={null}
        role={null}
        formPhase={formPhase}
        formError={formError}
        onSubmit={async (data, selectedRole) => {
          setFormPhase("submitting");
          setFormError("");
          try {
            await claimPortal("/api/contestant-open-claim", {
              ...data,
              role: selectedRole,
            });
            setState({
              type: "active",
              firstName: data.firstName,
              role: selectedRole,
              showCity: "",
              showDate: "",
              showDisplayDate: "",
              startTime: null,
              venueName: null,
            });
          } catch (err) {
            setFormError(
              err instanceof PortalApiError ? err.message : CLAIM_ERROR_MESSAGE,
            );
          } finally {
            setFormPhase("form");
          }
        }}
      />
    );
  }
  if (state.type === "invite") {
    return (
      <ContestantPacketGate
        showCity={state.showCity}
        showDate={state.showDate}
        showDisplayDate={state.showDisplayDate ?? state.showDate}
        startTime={state.startTime ?? null}
        role={state.role}
        formPhase={formPhase}
        formError={formError}
        onSubmit={async (data) => {
          setFormPhase("submitting");
          setFormError("");
          try {
            await claimPortal("/api/contestant-claim", {
              ...data,
              inviteId: state.inviteId,
            });
            setState({
              type: "active",
              firstName: data.firstName,
              role: state.role,
              showCity: state.showCity,
              showDate: state.showDate,
              showDisplayDate: state.showDisplayDate,
              startTime: state.startTime,
              venueName: state.venueName,
            });
          } catch (err) {
            setFormError(
              err instanceof PortalApiError ? err.message : CLAIM_ERROR_MESSAGE,
            );
          } finally {
            setFormPhase("form");
          }
        }}
      />
    );
  }
  if (state.type === "show") {
    return (
      <ContestantPacketGate
        showCity={state.showCity}
        showDate={state.showDate}
        showDisplayDate={state.showDisplayDate ?? state.showDate}
        startTime={state.startTime ?? null}
        role={null}
        formPhase={formPhase}
        formError={formError}
        onSubmit={async (data, selectedRole) => {
          setFormPhase("submitting");
          setFormError("");
          try {
            await claimPortal("/api/contestant-show-claim", {
              ...data,
              showId: state.showId,
              role: selectedRole,
            });
            setState({
              type: "active",
              firstName: data.firstName,
              role: selectedRole,
              showCity: state.showCity,
              showDate: state.showDate,
              showDisplayDate: state.showDisplayDate,
              startTime: state.startTime,
              venueName: state.venueName,
            });
          } catch (err) {
            setFormError(
              err instanceof PortalApiError ? err.message : CLAIM_ERROR_MESSAGE,
            );
          } finally {
            setFormPhase("form");
          }
        }}
      />
    );
  }
  return (
    <ActivePortal
      firstName={state.firstName}
      role={state.role}
      showCity={state.showCity}
      showDate={state.showDate}
      showDisplayDate={state.showDisplayDate}
      startTime={state.startTime}
      venueName={state.venueName}
    />
  );
}

// Mirrors the packet-form card so the resolve swap happens in place:
// hero block, role panel, name row, email, phone, waiver box, submit.
function PortalLoading() {
  return (
    <div className={styles.skeletonWrap} aria-busy="true">
      <p role="status" className={styles.srOnly}>
        {PORTAL_LOADING_ANNOUNCEMENT}
      </p>
      <div className={styles.skeletonCard} aria-hidden="true">
        <div className={styles.skeletonHero}>
          <ReactSkeleton width={56} height={56} circle />
          <ReactSkeleton width={150} height={13} borderRadius={7} />
          <ReactSkeleton width={250} height={34} borderRadius={8} />
          <ReactSkeleton width={280} height={16} borderRadius={8} />
        </div>
        <ReactSkeleton height={88} borderRadius={12} />
        <div className={styles.skeletonRow}>
          <ReactSkeleton height={52} borderRadius={12} />
          <ReactSkeleton height={52} borderRadius={12} />
        </div>
        <ReactSkeleton height={52} borderRadius={12} />
        <ReactSkeleton height={52} borderRadius={12} />
        <ReactSkeleton height={300} borderRadius={12} />
        <ReactSkeleton height={52} borderRadius={12} />
        <ReactSkeleton height={56} borderRadius={50} />
      </div>
    </div>
  );
}

function ErrorView({ message }: { message: string }) {
  return (
    <div className={styles.center}>
      <div role="alert" className={styles.centerCard}>
        <h1 className={styles.heading}>{ERROR_VIEW.heading}</h1>
        <p className={styles.body}>{message}</p>
        <p className={styles.muted}>
          {ERROR_VIEW.supportLabel}{" "}
          <a href={SOCIAL_URLS.email} className={styles.link}>
            {PORTAL_CONTACT_EMAIL}
          </a>
        </p>
      </div>
    </div>
  );
}

function ExpiredView() {
  return (
    <div className={styles.center}>
      <div className={styles.centerCard}>
        <p className={styles.emoji} aria-hidden="true">
          🌶️
        </p>
        <h1 className={styles.heading}>{EXPIRED_VIEW.heading}</h1>
        <p className={styles.body}>
          {EXPIRED_VIEW.body}{" "}
          <a href={SOCIAL_URLS.email} className={styles.link}>
            {PORTAL_CONTACT_EMAIL}
          </a>{" "}
          {EXPIRED_VIEW.bodyTail}
        </p>
        <div className={styles.btnRow}>
          <a href="/" className={styles.btnOutline}>
            Home
          </a>
          <a href="/tickets" className={styles.btnOutline}>
            Upcoming Shows
          </a>
        </div>
      </div>
    </div>
  );
}

interface ContestantPacketGateProps {
  showCity: string;
  showDate: string;
  showDisplayDate: string;
  startTime: string | null;
  role: ContestantRole | null;
  formPhase: FormPhase;
  formError: string;
  onSubmit: (data: PortalSignupData, role: ContestantRole) => Promise<void>;
}

function ContestantPacketGate({
  showCity,
  showDate,
  showDisplayDate,
  startTime,
  role,
  formPhase,
  formError,
  onSubmit,
}: ContestantPacketGateProps) {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [selectedRole, setSelectedRole] = useState<ContestantRole | "">(
    role ?? "",
  );
  const [signature, setSignature] = useState("");
  const [waiverScrolled, setWaiverScrolled] = useState(false);
  const [agreed, setAgreed] = useState(false);
  const handleWaiverUnlock = useCallback(() => setWaiverScrolled(true), []);
  const resolvedRole = role ?? selectedRole;
  const callTime = formatCallTime(startTime);

  const fullName = `${firstName.trim()} ${lastName.trim()}`.trim();
  const signatureValid =
    signature.trim().length > 0 &&
    signature.trim().toLowerCase() === fullName.toLowerCase();
  const canSubmit =
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    email.trim().length > 0 &&
    phone.trim().length > 0 &&
    Boolean(resolvedRole) &&
    signatureValid &&
    waiverScrolled &&
    agreed &&
    formPhase !== "submitting";

  return (
    <div className={styles.formWrap}>
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (!resolvedRole) return;
          await onSubmit(
            {
              firstName: firstName.trim(),
              lastName: lastName.trim(),
              email: email.trim(),
              phone: phone.trim(),
              waiverAgreed: agreed,
              signature: signature.trim(),
              waiverVersion: WAIVER_VERSION,
              mailingListOptIn: true,
            },
            resolvedRole,
          );
        }}
        className={styles.form}
      >
        <div className={styles.packetHero}>
          <p className={styles.emoji} aria-hidden="true">
            🌶️
          </p>
          <p className={styles.kicker}>{PACKET_HERO.kicker}</p>
          <h1 className={styles.headingLg}>{PACKET_HERO.heading}</h1>
          <p className={styles.body}>{PACKET_HERO.body}</p>
          <p className={styles.muted}>
            {showCity && showDate
              ? `${showCity} · ${showDisplayDate || showDate}`
              : "Casting will send your exact show date separately."}
          </p>
        </div>

        {role ? (
          <div className={styles.roleLocked}>
            <span className={styles.label}>Casting track</span>
            <strong>
              {role === "female" ? "Women contestants" : "Men contestants"}
            </strong>
            {callTime && (
              <span className={styles.roleDetail}>
                Call time: {callTime} sharp
              </span>
            )}
          </div>
        ) : (
          <fieldset className={styles.roleSelect}>
            <legend>{ROLE_SELECT.legend}</legend>
            <p>{ROLE_SELECT.description}</p>
            <div className={styles.roleOptions}>
              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="contestant-role"
                  value="female"
                  checked={selectedRole === "female"}
                  onChange={() => setSelectedRole("female")}
                />
                <span>Female contestant</span>
              </label>
              <label className={styles.roleOption}>
                <input
                  type="radio"
                  name="contestant-role"
                  value="male"
                  checked={selectedRole === "male"}
                  onChange={() => setSelectedRole("male")}
                />
                <span>Male contestant</span>
              </label>
            </div>
          </fieldset>
        )}

        <div className={styles.fieldRow}>
          <input
            type="text"
            placeholder="Legal first name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className={styles.input}
            aria-label="Legal first name"
          />
          <input
            type="text"
            placeholder="Legal last name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className={styles.input}
            aria-label="Legal last name"
          />
        </div>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className={styles.input}
          aria-label="Email"
        />
        <input
          type="tel"
          placeholder="Phone (555) 123-4567"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className={styles.input}
          aria-label="Phone number"
        />
        <WaiverPanel
          waiverText={WAIVER_TEXT}
          scrolled={waiverScrolled}
          onScrolledToEnd={handleWaiverUnlock}
          signature={signature}
          onSignatureChange={setSignature}
          signatureValid={signatureValid}
          agreed={agreed}
          onAgreedChange={setAgreed}
        />
        <p className={styles.muted}>{MAILING_LIST_DISCLOSURE}</p>
        <button type="submit" disabled={!canSubmit} className={styles.submit}>
          {formPhase === "submitting"
            ? "Completing..."
            : "Complete Packet & Open Prep"}
        </button>
        {/* Below the button and always rendered: a claim error arriving
            after the network round trip may grow the card downward but can
            never move the button the contestant is interacting with. */}
        <p role="alert" className={styles.error}>
          {formError}
        </p>
      </form>
    </div>
  );
}

interface ActivePortalProps {
  firstName: string;
  role: ContestantRole;
  showCity: string;
  showDate: string;
  showDisplayDate?: string;
  startTime?: string | null;
  venueName?: string | null;
}

function ActivePortal({
  firstName,
  role,
  showCity,
  showDate,
  showDisplayDate,
  startTime,
  venueName,
}: ActivePortalProps) {
  const callTime = formatCallTime(startTime);

  return (
    <div className={styles.content}>
      <header className={styles.header}>
        <p className={styles.emoji} aria-hidden="true">
          🌶️
        </p>
        <h1 className={styles.headingLg}>Welcome, {firstName}!</h1>
        <p className={styles.body}>
          {showCity && showDate
            ? `Your prep guide for ${showCity} on ${showDisplayDate || showDate}`
            : "Your prep guide is unlocked. Casting will send your exact show date separately."}
        </p>
        <p className={styles.muted}>
          {showCity && showDate
            ? "Access expires at midnight on show day"
            : "Access stays open while casting finalizes your show date."}
        </p>
      </header>

      <section className={`${styles.section} ${styles.sectionIntro}`}>
        <p className={styles.bodyText}>{PORTAL_INTRO.body}</p>
        <p className={styles.coreLine}>{PORTAL_INTRO.coreLine}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>The Golden Rules</h2>
        <p className={styles.lead}>
          These apply to every contestant, every show. No exceptions.
        </p>
        <ol className={styles.list}>
          {GOLDEN_RULES.map(({ rule, detail }) => (
            <li key={rule}>
              <strong>{rule}</strong> {detail}
            </li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Questions You May Be Asked</h2>
        <p className={styles.lead}>
          Prepare a 30 to 60 second answer for each. The host may go off-script.
        </p>
        <ol className={styles.list}>
          {SAMPLE_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Come Prepared With</h2>
        <p className={styles.lead}>
          Not suggestions. Have all four ready before you arrive.
        </p>
        <ul className={styles.list}>
          {COME_PREPARED_WITH.map(({ prompt, detail }) => (
            <li key={prompt}>
              <strong>{prompt}</strong> {detail}
            </li>
          ))}
        </ul>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{WARDROBE.heading}</h2>
        <p className={styles.bodyText}>{WARDROBE.body}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{DAY_OF.heading}</h2>
        <p className={styles.bodyText}>{DAY_OF.body}</p>
      </section>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>{ARRIVAL_NOTES.heading}</h2>
        <p className={styles.arrivalTime}>
          {callTime
            ? `Call time: ${callTime} sharp.`
            : "Casting will send your exact call time before the show."}
        </p>
        {venueName && <p className={styles.bodyText}>Arrive at {venueName}.</p>}
        {ARRIVAL_NOTES[role].map((line) => (
          <p key={line} className={styles.bodyText}>
            {line}
          </p>
        ))}
      </section>

      <footer className={styles.footer}>
        <p>See you on stage. 🌶️</p>
        <p>
          Questions? Email{" "}
          <a href={SOCIAL_URLS.email} className={styles.link}>
            {PORTAL_CONTACT_EMAIL}
          </a>{" "}
          or DM{" "}
          <a
            href={SOCIAL_URLS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.link}
          >
            @garammasaladating
          </a>
        </p>
      </footer>
    </div>
  );
}
