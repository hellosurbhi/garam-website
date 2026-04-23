import { useCallback, useEffect, useState } from "react";
import { WAIVER_VERSION, WAIVER_TEXT } from "@/data/waiver";
import { SOCIAL_URLS } from "@/data/socials";
import {
  PORTAL_CONTACT_EMAIL,
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
  missingRoleError,
  claimErrorMessage,
} from "@/data/contestantPortal";
import { WaiverDocument } from "@/components/WaiverDocument";

type ContestantRole = "female" | "male";

type PortalState =
  | { type: "loading" }
  | { type: "open" }
  | {
      type: "invite";
      inviteId: string;
      showCity: string;
      showDate: string;
      showDisplayDate?: string;
      startTime?: string | null;
      venueName?: string | null;
      role: ContestantRole;
    }
  | {
      type: "show";
      showId: string;
      showCity: string;
      showDate: string;
      showDisplayDate?: string;
      startTime?: string | null;
      venueName?: string | null;
    }
  | {
      type: "active";
      firstName: string;
      role: ContestantRole;
      showCity: string;
      showDate: string;
      showDisplayDate?: string;
      startTime?: string | null;
      venueName?: string | null;
    }
  | { type: "expired" }
  | { type: "no-access" }
  | {
      type: "show-invite";
      showId: string;
      showCity: string;
      showDate: string;
      showDisplayDate: string;
      startTime: string | null;
      venueName: string | null;
      role: string;
    }
  | { type: "error"; message: string };

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

type PortalResponseData = {
  state?: string;
  inviteId?: string;
  showId?: string;
  showCity?: string;
  showDate?: string;
  showDisplayDate?: string;
  startTime?: string | null;
  venueName?: string | null;
  role?: string | null;
  firstName?: string;
  message?: string;
  error?: string;
};

const CLAIM_ERROR_MESSAGE = claimErrorMessage(PORTAL_CONTACT_EMAIL);

function normalizeRole(role?: string | null): ContestantRole | null {
  if (role === "female" || role === "male") {
    return role;
  }
  return null;
}

async function readPortalResponse(
  response: Response,
): Promise<PortalResponseData> {
  const text = await response.text();
  if (!text.trim()) return {};
  try {
    return JSON.parse(text) as PortalResponseData;
  } catch {
    return {};
  }
}

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

async function claimPortal(endpoint: string, body: Record<string, unknown>) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "same-origin",
    body: JSON.stringify(body),
  });
  const data = await readPortalResponse(response);
  if (!response.ok) {
    throw new Error(responseErrorMessage(data, CLAIM_ERROR_MESSAGE));
  }
}

export default function ContestantPortal() {
  const [state, setState] = useState<PortalState>({ type: "loading" });
  const [formPhase, setFormPhase] = useState<FormPhase>("form");
  const [formError, setFormError] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const invite = params.get("invite");
    const show = params.get("show");
    let url = "/api/portal-state";
    if (invite) {
      url += `?invite=${encodeURIComponent(invite)}`;
    } else if (show) {
      url += `?show=${encodeURIComponent(show)}`;
      window.history.replaceState(null, "", "/contestant-portal");
    }

    fetch(url, { credentials: "same-origin" })
      .then(async (response) => {
        const data = await readPortalResponse(response);
        if (!response.ok) {
          throw new Error(
            responseErrorMessage(
              data,
              "Could not load portal. Please try again.",
            ),
          );
        }
        return data;
      })
      .then((data) => {
        if (data.state === "open") {
          setState({ type: "open" });
        } else if (data.state === "invite") {
          const role = normalizeRole(data.role);
          if (!role) {
            setState({
              type: "error",
              message: missingRoleError(PORTAL_CONTACT_EMAIL),
            });
            return;
          }
          setState({
            type: "invite",
            inviteId: data.inviteId ?? "",
            showCity: data.showCity ?? "",
            showDate: data.showDate ?? "",
            showDisplayDate: data.showDisplayDate ?? undefined,
            startTime: data.startTime ?? null,
            venueName: data.venueName ?? null,
            role,
          });
        } else if (data.state === "show") {
          setState({
            type: "show",
            showId: data.showId ?? "",
            showCity: data.showCity ?? "",
            showDate: data.showDate ?? "",
            showDisplayDate: data.showDisplayDate ?? undefined,
            startTime: data.startTime ?? null,
            venueName: data.venueName ?? null,
          });
        } else if (data.state === "active") {
          const role = normalizeRole(data.role);
          if (!role) {
            setState({
              type: "open",
            });
            return;
          }
          setState({
            type: "active",
            firstName: data.firstName ?? "",
            role,
            showCity: data.showCity ?? "",
            showDate: data.showDate ?? "",
            showDisplayDate: data.showDisplayDate ?? undefined,
            startTime: data.startTime ?? null,
            venueName: data.venueName ?? null,
          });
        } else if (data.state === "error") {
          setState({ type: "error", message: data.message ?? "" });
        } else if (data.state === "no-access") {
          setState({ type: "open" });
        } else if (data.state === "expired") {
          setState({ type: "expired" });
        } else {
          setState({
            type: "error",
            message: "Could not load portal. Please try again.",
          });
        }
      })
      .catch((err) =>
        setState({
          type: "error",
          message:
            err instanceof Error
              ? err.message
              : "Could not load portal. Please try again.",
        }),
      );
  }, []);

  if (state.type === "loading") {
    return <div className="portal-loading">Loading...</div>;
  }
  if (state.type === "error") return <ErrorView message={state.message} />;
  if (state.type === "no-access") return <NoAccessView />;
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
            window.history.replaceState(null, "", "/contestant-portal");
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
              err instanceof Error ? err.message : CLAIM_ERROR_MESSAGE,
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
            window.history.replaceState(null, "", "/contestant-portal");
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
              err instanceof Error ? err.message : CLAIM_ERROR_MESSAGE,
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
            window.history.replaceState(null, "", "/contestant-portal");
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
              err instanceof Error ? err.message : CLAIM_ERROR_MESSAGE,
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

function ErrorView({ message }: { message: string }) {
  return (
    <div className="portal-center">
      <h1 className="portal-heading">{ERROR_VIEW.heading}</h1>
      <p className="portal-body">{message}</p>
      <p className="portal-muted">
        {ERROR_VIEW.supportLabel}{" "}
        <a href={SOCIAL_URLS.email} className="portal-link">
          {PORTAL_CONTACT_EMAIL}
        </a>
      </p>
    </div>
  );
}

function NoAccessView() {
  return (
    <div className="portal-center">
      <p className="portal-emoji">🌶️</p>
      <h1 className="portal-heading">Contestant Portal</h1>
      <p className="portal-body">
        This page is for selected contestants only. You need an invite link from
        your host to access it.
      </p>
      <p className="portal-muted">
        Questions? Email{" "}
        <a href="mailto:contact@garammasaladating.com" className="portal-link">
          contact@garammasaladating.com
        </a>
      </p>
    </div>
  );
}

function ExpiredView() {
  return (
    <div className="portal-center">
      <p className="portal-emoji">🌶️</p>
      <h1 className="portal-heading">{EXPIRED_VIEW.heading}</h1>
      <p className="portal-body">
        {EXPIRED_VIEW.body}{" "}
        <a href={SOCIAL_URLS.email} className="portal-link">
          {PORTAL_CONTACT_EMAIL}
        </a>{" "}
        {EXPIRED_VIEW.bodyTail}
      </p>
      <div className="portal-btn-row">
        <a href="/" className="portal-btn-outline">
          Home
        </a>
        <a href="/tickets" className="portal-btn-outline">
          Upcoming Shows
        </a>
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
  // Callback ref: set waiverScrolled immediately if no scroll is needed.
  const waiverRef = useCallback((el: HTMLDivElement | null) => {
    if (!el) return;
    if (el.scrollHeight <= el.clientHeight + 4) {
      setWaiverScrolled(true);
    }
  }, []);
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

  function handleWaiverScroll(el: HTMLDivElement) {
    const canScroll = el.scrollHeight > el.clientHeight + 4;
    const reachedBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 8;
    if (canScroll && reachedBottom) {
      setWaiverScrolled(true);
    }
  }

  return (
    <div className="portal-form-wrap">
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
        className="portal-form"
      >
        <div className="portal-packet-hero">
          <p className="portal-emoji">🌶️</p>
          <p className="portal-kicker">{PACKET_HERO.kicker}</p>
          <h1 className="portal-heading-lg">{PACKET_HERO.heading}</h1>
          <p className="portal-body">{PACKET_HERO.body}</p>
          <p className="portal-muted">
            {showCity && showDate
              ? `${showCity} · ${showDisplayDate || showDate}`
              : "Casting will send your exact show date separately."}
          </p>
        </div>

        {role ? (
          <div className="portal-role-locked">
            <span className="portal-label">Casting track</span>
            <strong>
              {role === "female" ? "Women contestants" : "Men contestants"}
            </strong>
            {callTime && (
              <span className="portal-role-detail">
                Call time: {callTime} sharp
              </span>
            )}
          </div>
        ) : (
          <fieldset className="portal-role-select">
            <legend>{ROLE_SELECT.legend}</legend>
            <p>{ROLE_SELECT.description}</p>
            <div className="portal-role-options">
              <label className="portal-role-option">
                <input
                  type="radio"
                  name="contestant-role"
                  value="female"
                  checked={selectedRole === "female"}
                  onChange={() => setSelectedRole("female")}
                />
                <span>Female contestant</span>
              </label>
              <label className="portal-role-option">
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

        <div className="portal-field-row">
          <input
            type="text"
            placeholder="Legal first name"
            required
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            className="portal-input"
            aria-label="Legal first name"
          />
          <input
            type="text"
            placeholder="Legal last name"
            required
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            className="portal-input"
            aria-label="Legal last name"
          />
        </div>
        <input
          type="email"
          placeholder="Email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="portal-input"
          aria-label="Email"
        />
        <input
          type="tel"
          placeholder="Phone (555) 123-4567"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="portal-input"
          aria-label="Phone number"
        />
        <div
          ref={waiverRef}
          className="portal-waiver-scroll"
          aria-label="Waiver text"
          role="region"
          tabIndex={0}
          onScroll={(e) => handleWaiverScroll(e.currentTarget)}
        >
          <WaiverDocument text={WAIVER_TEXT} />
        </div>
        <div>
          <label className="portal-label" htmlFor="portal-signature">
            Type your full legal name as your signature
          </label>
          <input
            id="portal-signature"
            type="text"
            placeholder="First Last"
            required
            value={signature}
            onChange={(e) => setSignature(e.target.value)}
            className="portal-input portal-input-sig"
            aria-label="Signature"
            aria-describedby={
              signature.trim() && !signatureValid
                ? "portal-signature-error"
                : undefined
            }
          />
          {signature.trim() && !signatureValid && (
            <p
              id="portal-signature-error"
              role="alert"
              className="portal-error-inline"
            >
              Signature must match your legal name above.
            </p>
          )}
        </div>
        <label className="portal-checkbox">
          <input
            type="checkbox"
            checked={agreed}
            disabled={!waiverScrolled}
            onChange={(e) => setAgreed(e.target.checked)}
          />
          <span>
            I have read and agree to the waiver. I understand the typed legal
            signature above is my electronic signature.
          </span>
        </label>
        {!waiverScrolled && (
          <p className="portal-checkbox-muted">
            Scroll through the full waiver to enable agreement.
          </p>
        )}
        <p className="portal-muted">{MAILING_LIST_DISCLOSURE}</p>
        {formError && (
          <p role="alert" className="portal-error">
            {formError}
          </p>
        )}
        <button type="submit" disabled={!canSubmit} className="portal-submit">
          {formPhase === "submitting"
            ? "Completing..."
            : "Complete Packet & Open Prep"}
        </button>
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
    <div className="portal-content">
      <header className="portal-header">
        <p className="portal-emoji">🌶️</p>
        <h1 className="portal-heading-lg">Welcome, {firstName}!</h1>
        <p className="portal-body">
          {showCity && showDate
            ? `Your prep guide for ${showCity} on ${showDisplayDate || showDate}`
            : "Your prep guide is unlocked. Casting will send your exact show date separately."}
        </p>
        <p className="portal-muted">
          {showCity && showDate
            ? "Access expires at midnight on show day"
            : "Access stays open while casting finalizes your show date."}
        </p>
      </header>

      <section className="portal-section portal-section-intro">
        <p className="portal-body-text">{PORTAL_INTRO.body}</p>
        <p className="portal-core-line">{PORTAL_INTRO.coreLine}</p>
      </section>

      <section className="portal-section">
        <h2 className="portal-section-title">The Golden Rules</h2>
        <p className="portal-lead">
          These apply to every contestant, every show. No exceptions.
        </p>
        <ol className="portal-list">
          {GOLDEN_RULES.map(({ rule, detail }) => (
            <li key={rule}>
              <strong>{rule}</strong> {detail}
            </li>
          ))}
        </ol>
      </section>

      <section className="portal-section">
        <h2 className="portal-section-title">Questions You May Be Asked</h2>
        <p className="portal-lead">
          Prepare a 30 to 60 second answer for each. The host may go off-script.
        </p>
        <ol className="portal-list">
          {SAMPLE_QUESTIONS.map((q) => (
            <li key={q}>{q}</li>
          ))}
        </ol>
      </section>

      <section className="portal-section">
        <h2 className="portal-section-title">Come Prepared With</h2>
        <p className="portal-lead">
          Not suggestions. Have all four ready before you arrive.
        </p>
        <ul className="portal-list">
          {COME_PREPARED_WITH.map(({ prompt, detail }) => (
            <li key={prompt}>
              <strong>{prompt}</strong> {detail}
            </li>
          ))}
        </ul>
      </section>

      <section className="portal-section">
        <h2 className="portal-section-title">{WARDROBE.heading}</h2>
        <p className="portal-body-text">{WARDROBE.body}</p>
      </section>

      <section className="portal-section">
        <h2 className="portal-section-title">{DAY_OF.heading}</h2>
        <p className="portal-body-text">{DAY_OF.body}</p>
      </section>

      <section className="portal-section">
        <h2 className="portal-section-title">{ARRIVAL_NOTES.heading}</h2>
        <p className="portal-arrival-time">
          {callTime
            ? `Call time: ${callTime} sharp.`
            : "Casting will send your exact call time before the show."}
        </p>
        {venueName && (
          <p className="portal-body-text">Arrive at {venueName}.</p>
        )}
        {ARRIVAL_NOTES[role].map((line) => (
          <p key={line} className="portal-body-text">
            {line}
          </p>
        ))}
      </section>

      <footer className="portal-footer">
        <p>See you on stage. 🌶️</p>
        <p>
          Questions? Email{" "}
          <a href={SOCIAL_URLS.email} className="portal-link">
            {PORTAL_CONTACT_EMAIL}
          </a>{" "}
          or DM{" "}
          <a
            href={SOCIAL_URLS.instagram}
            target="_blank"
            rel="noopener noreferrer"
            className="portal-link"
          >
            @garammasaladating
          </a>
        </p>
      </footer>
    </div>
  );
}
