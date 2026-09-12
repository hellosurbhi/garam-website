import { buildLeadAttribution } from "./leadAttribution";
import { captureLead } from "./leadSubmission";
import { identifyLead, trackLeadEvent, capture } from "./analytics";
import { reportFailure } from "./failureAlert";
import { safeLocalStorage } from "./safeStorage";
import { validateEmail } from "@/utils/validateEmail";
import { MIXER_STORAGE_KEY } from "@/data/mixers";

/**
 * Shared submit flow for the two mixer RSVP forms (/cuffing-season and
 * /singles-mixers). Lives here, not in the pages' <script> tags, for two
 * reasons: the two handlers were near-duplicates, and TypeScript syntax
 * inside .astro <script> 500s on the dev server (see the BUGS.md entry
 * "Dev server cannot transform TypeScript in astro component scripts");
 * the proven fix pattern is a .ts module imported by a TS-free script.
 */

export type MixerSource = "cuffing-season" | "singles-mixers";

export interface MixerRsvpFormElements {
  form: HTMLFormElement;
  nameInput: HTMLInputElement;
  emailInput: HTMLInputElement;
  errorEl: HTMLElement;
  submitBtn: HTMLButtonElement;
}

export interface MixerRsvpFormConfig {
  formId: string;
  nameInputId: string;
  emailInputId: string;
  errorElId: string;
  source: MixerSource;
  copy: {
    /** Inline message when the name field is empty. */
    nameError: string;
    /** Fallback shown only when a failure keeps the user on the page. */
    errorMessage: string;
    /** Button label while the submit request is in flight. */
    submittingLabel: string;
  };
  /** Owns the page's success UI or navigation. The lead is saved. */
  onCaptureSuccess: (els: MixerRsvpFormElements) => void;
  /**
   * Owns the page's recovery step when saving failed on valid input. The
   * owner has already been paged with the person's contact via
   * reportFailure. Return true when navigating away (the invite matters
   * more than the error); return false to stay, and the form shows
   * copy.errorMessage and re-enables itself.
   */
  onCaptureFailure: (els: MixerRsvpFormElements) => boolean;
}

export function initMixerRsvpForm(config: MixerRsvpFormConfig): void {
  const form = document.getElementById(config.formId);
  const nameInput = document.getElementById(config.nameInputId);
  const emailInput = document.getElementById(config.emailInputId);
  const errorEl = document.getElementById(config.errorElId);
  if (
    !(form instanceof HTMLFormElement) ||
    !(nameInput instanceof HTMLInputElement) ||
    !(emailInput instanceof HTMLInputElement) ||
    !errorEl
  ) {
    return;
  }
  const submitBtn = form.querySelector<HTMLButtonElement>('[type="submit"]');
  if (!submitBtn) return;

  const els: MixerRsvpFormElements = {
    form,
    nameInput,
    emailInput,
    errorEl,
    submitBtn,
  };
  const defaultLabel = submitBtn.textContent;

  const nameError = () =>
    nameInput.value.trim() ? undefined : config.copy.nameError;
  const emailError = () => validateEmail(emailInput.value);

  // A field only reports its error after the person has left it once (or
  // typed in it and left); flagging "Email is required" on first paint
  // would scold people for a form they have not started.
  const touched = { name: false, email: false };
  let submitting = false;

  // Arrow consts, not function declarations, on purpose: hoisted function
  // declarations lose the null-narrowing of the element consts above
  // (astro check ts18047), while closures created after the guards keep it.
  const showError = (message: string): void => {
    errorEl.textContent = message;
    errorEl.removeAttribute("hidden");
  };

  const hideError = (): void => {
    errorEl.textContent = "";
    errorEl.setAttribute("hidden", "");
  };

  const refresh = (): void => {
    const nameErr = nameError();
    const emailErr = emailError();
    submitBtn.disabled = submitting || Boolean(nameErr || emailErr);

    const visibleNameErr = touched.name ? nameErr : undefined;
    const visibleEmailErr = touched.email ? emailErr : undefined;
    nameInput.setAttribute("aria-invalid", visibleNameErr ? "true" : "false");
    emailInput.setAttribute("aria-invalid", visibleEmailErr ? "true" : "false");
    const message = visibleNameErr ?? visibleEmailErr;
    if (message) {
      showError(message);
    } else {
      hideError();
    }
  };

  for (const [input, key] of [
    [nameInput, "name"],
    [emailInput, "email"],
  ] as const) {
    input.addEventListener("input", refresh);
    input.addEventListener("change", refresh);
    input.addEventListener("blur", () => {
      touched[key] = true;
      refresh();
    });
  }
  refresh();

  const handleSubmit = async (): Promise<void> => {
    // The button is disabled while invalid, but re-check in case a browser
    // extension or Enter-key path submits the form anyway.
    touched.name = true;
    touched.email = true;
    refresh();
    if (submitting || nameError() || emailError()) return;

    const name = nameInput.value.trim();
    const email = emailInput.value.trim();

    submitting = true;
    hideError();
    submitBtn.disabled = true;
    submitBtn.textContent = config.copy.submittingLabel;

    // Only the calls that decide whether the lead was saved live inside
    // this boundary. Everything after it is post-save bookkeeping; letting
    // an analytics throw fall into this catch would run the failure path
    // on a lead that DID save and invite a duplicate resubmit.
    try {
      const attribution = await buildLeadAttribution({ source: config.source });
      await captureLead({ name, email, ...attribution });
    } catch (err) {
      // keepalive on the underlying fetch lets this survive an immediate
      // navigation to Partiful in onCaptureFailure.
      reportFailure({
        flow: "lead",
        stage: "mixer_rsvp",
        errorMessage: err instanceof Error ? err.message : String(err),
        contact: { name, email },
      });

      const navigatedAway = config.onCaptureFailure(els);
      if (!navigatedAway) {
        submitting = false;
        submitBtn.textContent = defaultLabel;
        // refresh() first, showError() second: refresh hides whatever the
        // error element holds when the fields are valid, so the server
        // failure message must land after it (and a later edit clears it).
        refresh();
        showError(config.copy.errorMessage);
      }
      return;
    }

    try {
      safeLocalStorage.setItem(MIXER_STORAGE_KEY, "true");
    } catch {
      /* returning-visitor state is a convenience, not a requirement */
    }

    fetch("/api/notify-mixer-rsvp", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      keepalive: true,
      body: JSON.stringify({ name, email, source: config.source }),
    }).catch(() => {
      /* owner alert is best effort; the lead is already saved */
    });

    try {
      identifyLead(email, { name });
      trackLeadEvent("lead_email_submitted", { source: config.source });
      trackLeadEvent("email_signup", { source: config.source });
      capture("mixer_rsvp_submitted", { source: config.source });
    } catch {
      /* analytics must never turn a saved lead into an error state */
    }

    config.onCaptureSuccess(els);
  };

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    void handleSubmit();
  });
}
