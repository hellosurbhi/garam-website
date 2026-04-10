/**
 * React base modal component.
 * Astro counterpart: Modal.astro — keep behavior identical.
 * Design tokens: modal-tokens.css — change values there, not here.
 *
 * Usage:
 *   <Modal onClose={onClose} ariaLabelledby="my-title-id" className={styles.dialog}>
 *     <div>content</div>
 *   </Modal>
 *
 * Mount/unmount is controlled by the parent:
 *   {isOpen && <Modal onClose={...}>...</Modal>}
 */
import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
import styles from "./Modal.module.css";

interface ModalProps {
  onClose: () => void;
  ariaLabelledby?: string;
  className?: string;
  children: ReactNode;
}

export function Modal({
  onClose,
  ariaLabelledby,
  className,
  children,
}: ModalProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);

  // Keep onClose ref current to avoid stale closures in event listeners
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Open dialog and focus container (not first child) to prevent close-button focus ring
  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || dialog.open || typeof dialog.showModal !== "function")
      return;
    dialog.showModal();
    dialog.focus(); // focus container — matches Modal.astro behavior
    return () => {
      if (dialog.open) dialog.close();
    };
  }, []);

  // Escape key → onClose (via native cancel event)
  useEffect(() => {
    const dialog = dialogRef.current;
    function handleCancel(e: Event) {
      e.preventDefault();
      onCloseRef.current();
    }
    dialog?.addEventListener("cancel", handleCancel);
    return () => dialog?.removeEventListener("cancel", handleCancel);
  }, []);

  function handleBackdropClick(e: React.MouseEvent<HTMLDialogElement>) {
    if (e.target === e.currentTarget) onCloseRef.current();
  }

  return (
    <dialog
      ref={dialogRef}
      tabIndex={-1}
      className={[styles.dialog, className].filter(Boolean).join(" ")}
      role="dialog"
      aria-modal="true"
      aria-labelledby={ariaLabelledby}
      onClick={handleBackdropClick}
    >
      {children}
    </dialog>
  );
}
