import { useState, type SyntheticEvent } from "react";
import { X } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { getFirebaseAuth } from "@/lib/firebase";
import { events } from "@/data/events";
import { type Application } from "@/types/application";
import styles from "./ContestantInviteModal.module.css";

type ContestantRole = "female" | "male";

interface ContestantInviteModalProps {
  app: Application;
  onClose: () => void;
  onSuccess: (
    email: string,
    inviteUrl: string,
    emailSent: boolean,
    emailError?: string,
  ) => void;
}

const ROLE_OPTIONS: { value: ContestantRole; label: string }[] = [
  { value: "female", label: "Female Contestant" },
  { value: "male", label: "Male Contestant" },
];

export default function ContestantInviteModal({
  app,
  onClose,
  onSuccess,
}: ContestantInviteModalProps) {
  const [role, setRole] = useState<ContestantRole | "">("");
  const [showId, setShowId] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);
  const [inviteResult, setInviteResult] = useState<{
    inviteUrl: string;
    emailSent: boolean;
    emailError?: string;
  } | null>(null);

  const today = new Date().toLocaleDateString("en-CA");
  const upcomingEvents = events.filter(
    (e) => e.isoDate && e.isoDate > today && !e.hidden,
  );

  async function handleSubmit(e: SyntheticEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!role || !showId) return;

    setSubmitting(true);
    setError("");

    try {
      const idToken = await getFirebaseAuth().currentUser?.getIdToken();
      if (!idToken) {
        setError("Session expired. Please log in again.");
        setSubmitting(false);
        return;
      }

      const res = await fetch("/api/create-invite", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          applicantId: app.id,
          applicantName: app.name,
          applicantEmail: app.email,
          showId,
          role,
        }),
      });

      if (!res.ok) {
        const body = await res
          .json()
          .catch(() => ({ error: "Request failed" }));
        setError(
          (body as { error?: string }).error ?? `Failed (${res.status})`,
        );
        setSubmitting(false);
        return;
      }

      const data = (await res.json()) as {
        inviteUrl?: string;
        emailSent?: boolean;
        emailError?: string;
      };
      if (!data.inviteUrl) {
        setError("Invite created, but no link was returned.");
        return;
      }
      const result = {
        inviteUrl: data.inviteUrl,
        emailSent: data.emailSent === true,
        emailError: data.emailError,
      };
      setInviteResult(result);
      onSuccess(
        app.email ?? app.name,
        result.inviteUrl,
        result.emailSent,
        result.emailError,
      );
    } catch {
      setError("Network error. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function copyInviteLink() {
    if (!inviteResult) return;
    try {
      await navigator.clipboard.writeText(inviteResult.inviteUrl);
      setCopied(true);
    } catch {
      setError("Copy failed. Select and copy the link manually.");
    }
  }

  return (
    <Modal
      onClose={onClose}
      ariaLabelledby="invite-modal-title"
      className={styles.dialog}
    >
      <div className={styles.header}>
        <h2 id="invite-modal-title" className={styles.title}>
          Cast Contestant
        </h2>
        <button
          onClick={onClose}
          className={styles.closeButton}
          aria-label="Close"
        >
          <X size={18} />
        </button>
      </div>

      <div className={styles.body}>
        <div className={styles.applicantInfo}>
          <span className={styles.applicantName}>{app.name}</span>
          {app.email && (
            <span className={styles.applicantEmail}>{app.email}</span>
          )}
        </div>

        {inviteResult ? (
          <div className={styles.resultPanel}>
            <p className={styles.successMsg}>
              Packet link created
              {inviteResult.emailSent && app.email
                ? ` and emailed to ${app.email}`
                : "."}
            </p>
            {!inviteResult.emailSent && (
              <p className={styles.warningMsg} role="alert">
                Email was not sent.{" "}
                {inviteResult.emailError ?? "Share this link manually."}
              </p>
            )}

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="invite-url">
                Packet link
              </label>
              <div className={styles.linkRow}>
                <input
                  id="invite-url"
                  className={styles.linkInput}
                  value={inviteResult.inviteUrl}
                  readOnly
                  onFocus={(e) => e.currentTarget.select()}
                />
                <button
                  type="button"
                  className={styles.copyButton}
                  onClick={copyInviteLink}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>

            {error && (
              <p className={styles.errorMsg} role="alert">
                {error}
              </p>
            )}

            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={onClose}
                className={styles.submitButton}
              >
                Done
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="invite-role">
                Role
              </label>
              <select
                id="invite-role"
                value={role}
                onChange={(e) => setRole(e.target.value as ContestantRole)}
                className={styles.selectInput}
                required
                aria-label="Select contestant role"
              >
                <option value="" disabled>
                  Choose their role...
                </option>
                {ROLE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className={styles.formGroup}>
              <label className={styles.formLabel} htmlFor="invite-show">
                Show
              </label>
              <select
                id="invite-show"
                value={showId}
                onChange={(e) => setShowId(e.target.value)}
                className={styles.selectInput}
                required
                aria-label="Select show"
              >
                <option value="" disabled>
                  Choose their show...
                </option>
                {upcomingEvents.map((event) => {
                  const eventShowId = `${event.citySlug}-${event.isoDate}`;
                  return (
                    <option key={eventShowId} value={eventShowId}>
                      {event.date}: {event.city}
                    </option>
                  );
                })}
              </select>
            </div>

            {error && (
              <p className={styles.errorMsg} role="alert">
                {error}
              </p>
            )}

            <div className={styles.actionRow}>
              <button
                type="button"
                onClick={onClose}
                className={styles.cancelButton}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !role || !showId}
                className={styles.submitButton}
              >
                {submitting ? "Sending..." : "Send Packet"}
              </button>
            </div>
          </form>
        )}
      </div>
    </Modal>
  );
}
