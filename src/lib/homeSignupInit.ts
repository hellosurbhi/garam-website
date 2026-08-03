import { cleanPhone } from "@/lib/phone";
import { identifyLead, trackLeadEvent } from "@/lib/analytics";
import { buildLeadAttribution } from "@/lib/leadAttribution";
import {
  captureLead,
  updateLeadPhone,
  type LeadCaptureResult,
} from "@/lib/leadSubmission";

export function initHomeSignup(): void {
  if (localStorage.getItem("gmd-popup-subscribed")) {
    const altCta = document.getElementById("nl-already-subscribed");
    const step1 = document.getElementById("nl-step-1");
    if (altCta && step1) {
      step1.setAttribute("hidden", "");
      altCta.removeAttribute("hidden");
    }
  }

  let savedEmail = "";
  let nlDocId: LeadCaptureResult | null = null;

  const leadSource =
    document.querySelector<HTMLElement>(".spicelist[data-lead-source]")?.dataset
      .leadSource ?? "spice-list";

  // Prefill the optional city from IP geo once it resolves. The geo fetch is
  // fired on page load; poll briefly so the value appears without the user
  // typing. Never overwrites a value the user has entered.
  const nlCityInput = document.getElementById(
    "nl-city",
  ) as HTMLInputElement | null;
  if (nlCityInput) {
    const prefillCity = () => {
      const geoCity = sessionStorage.getItem("gmd-geo-city");
      if (geoCity && !nlCityInput.value) nlCityInput.value = geoCity;
      return Boolean(geoCity);
    };
    if (!prefillCity()) {
      let tries = 0;
      const timer = setInterval(() => {
        if (prefillCity() || ++tries >= 5) clearInterval(timer);
      }, 1000);
    }
  }

  document
    .getElementById("nl-email-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      savedEmail = (document.getElementById("nl-email") as HTMLInputElement)
        .value;
      const nlCity = (
        document.getElementById("nl-city") as HTMLInputElement | null
      )?.value.trim();
      const errorEl = document.getElementById("nl-email-error");
      const submitBtn = (
        e.target as HTMLFormElement
      ).querySelector<HTMLButtonElement>('[type="submit"]');
      const originalBtnText = submitBtn?.textContent ?? "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }
      try {
        const attribution = await buildLeadAttribution({ source: leadSource });
        const captured = await captureLead({
          email: savedEmail,
          ...(nlCity ? { city: nlCity } : {}),
          ...attribution,
        });
        nlDocId = captured.id ? captured : null;
        localStorage.setItem("gmd-popup-subscribed", "true");
        identifyLead(savedEmail, attribution);
        trackLeadEvent("lead_email_submitted", attribution);
        trackLeadEvent("email_signup", attribution);
        if (errorEl) {
          errorEl.textContent = "";
          errorEl.setAttribute("hidden", "");
        }
        document.getElementById("nl-step-1")?.setAttribute("hidden", "");
        document.getElementById("nl-step-2")?.removeAttribute("hidden");
      } catch {
        if (errorEl) {
          errorEl.textContent = "Something went wrong. Please try again.";
          errorEl.removeAttribute("hidden");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });

  document
    .getElementById("nl-phone-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = (document.getElementById("nl-phone") as HTMLInputElement)
        .value;
      const cleaned = cleanPhone(raw);
      const phoneErrorEl = document.getElementById("nl-phone-error");

      if (!raw.trim()) {
        document.getElementById("nl-step-2")?.setAttribute("hidden", "");
        const successEl = document.getElementById("nl-success");
        const doneText = successEl?.querySelector(".nl-done-text");
        if (doneText)
          doneText.textContent =
            "You're on the list! Check your email for discount codes.";
        successEl?.removeAttribute("hidden");
        return;
      }

      if (!cleaned) {
        if (phoneErrorEl) {
          phoneErrorEl.textContent = "Please enter a valid phone number.";
          phoneErrorEl.removeAttribute("hidden");
        }
        return;
      }

      const submitBtn = (
        e.target as HTMLFormElement
      ).querySelector<HTMLButtonElement>('[type="submit"]');
      const originalBtnText = submitBtn?.textContent ?? "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }
      try {
        if (nlDocId) {
          await updateLeadPhone(nlDocId, cleaned);
        } else {
          const attribution = await buildLeadAttribution({
            source: leadSource,
          });
          await captureLead({
            email: savedEmail,
            phone: cleaned,
            ...attribution,
          });
        }
        trackLeadEvent("lead_phone_submitted", {
          source: leadSource,
          sourcePage: window.location.pathname,
        });
        document.getElementById("nl-step-2")?.setAttribute("hidden", "");
        const successEl = document.getElementById("nl-success");
        const doneText = successEl?.querySelector(".nl-done-text");
        if (doneText)
          doneText.textContent =
            "You're on the list! We'll text you exclusive ticket drops.";
        successEl?.removeAttribute("hidden");
      } catch {
        if (phoneErrorEl) {
          phoneErrorEl.textContent =
            "Something went wrong. Please try again or skip.";
          phoneErrorEl.removeAttribute("hidden");
        }
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = originalBtnText;
        }
      }
    });

  document.getElementById("nl-skip")?.addEventListener("click", () => {
    trackLeadEvent("lead_phone_skipped", {
      source: leadSource,
      sourcePage: window.location.pathname,
    });
    document.getElementById("nl-step-2")?.setAttribute("hidden", "");
    const successEl = document.getElementById("nl-success");
    const doneText = successEl?.querySelector(".nl-done-text");
    if (doneText)
      doneText.textContent =
        "You're on the list! Check your email for discount codes.";
    successEl?.removeAttribute("hidden");
  });
}
