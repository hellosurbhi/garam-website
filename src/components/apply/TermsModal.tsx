import { WAIVER_TEXT } from "@/data/waiver";
import { Modal } from "@/components/ui/Modal";
import styles from "./TermsModal.module.css";

interface TermsModalProps {
  onClose: () => void;
  onAgree: () => void;
}

export function TermsModal({ onClose, onAgree }: TermsModalProps) {
  return (
    <Modal
      onClose={onClose}
      ariaLabelledby="terms-modal-title"
      className={styles.dialog}
    >
      <div className={styles.header}>
        <h2 id="terms-modal-title" className={styles.title}>
          Contestant Waiver, Media Release, and Participation Agreement
        </h2>
        <button
          type="button"
          className={styles.closeBtn}
          onClick={onClose}
          aria-label="Close"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      </div>

      <div className={styles.body}>
        <pre className={styles.waiverText}>{WAIVER_TEXT}</pre>
      </div>

      <div className={styles.footer}>
        <button type="button" className={styles.agreeBtn} onClick={onAgree}>
          I Agree
        </button>
        <button type="button" className={styles.dismissBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </Modal>
  );
}
