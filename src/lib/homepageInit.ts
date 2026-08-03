import { cleanPhone } from "@/lib/phone";
import { identifyLead, trackLeadEvent } from "@/lib/analytics";
import { buildLeadAttribution } from "@/lib/leadAttribution";
import {
  captureLead,
  updateLeadPhone,
  type LeadCaptureResult,
} from "@/lib/leadSubmission";

export function initHomepagePopup(): void {
  const POPUP_KEY = "gmd-popup-subscribed";
  const POPUP_DISMISS_KEY = "gmd-popup-dismissed";
  const DISMISS_DURATION_MS = 7 * 24 * 60 * 60 * 1000;
  // Popup won't fire until user has been on the page for at least this long,
  // regardless of how quickly they scroll or move the cursor to exit.
  const MIN_SESSION_MS = 15_000;

  const popup = document.getElementById("email-popup") as HTMLDialogElement;

  if (!popup || localStorage.getItem(POPUP_KEY)) return;

  const sessionStart = Date.now();
  let popupShown = false;

  function canShowPopup(): boolean {
    const dismissed = localStorage.getItem(POPUP_DISMISS_KEY);
    if (dismissed && Date.now() - Number(dismissed) < DISMISS_DURATION_MS)
      return false;
    return true;
  }

  function tryShowPopup(): boolean {
    if (popupShown) return false;
    if (!canShowPopup()) return false;
    if (Date.now() - sessionStart < MIN_SESSION_MS) return false;
    if (document.querySelector("dialog[open]")) return false;
    popupShown = true;
    const cityInput = document.getElementById(
      "popup-city",
    ) as HTMLInputElement | null;
    const geoCity = sessionStorage.getItem("gmd-geo-city");
    if (cityInput && geoCity && !cityInput.value) cityInput.value = geoCity;
    trackLeadEvent("popup_opened", {
      source: "popup",
      sourcePage: window.location.pathname,
    });
    popup.showModal();
    return true;
  }

  if (window.matchMedia("(pointer: fine)").matches) {
    function handleExitIntent(e: MouseEvent): void {
      if (e.clientY <= 0) {
        const shown = tryShowPopup();
        if (shown) {
          document.removeEventListener("mouseleave", handleExitIntent);
        }
      }
    }
    document.addEventListener("mouseleave", handleExitIntent);
  }

  function onScrollDepth(): void {
    if (popupShown) {
      window.removeEventListener("scroll", onScrollDepth);
      return;
    }
    const scrolledPct =
      (window.scrollY + window.innerHeight) /
      document.documentElement.scrollHeight;
    if (scrolledPct >= 0.65) {
      tryShowPopup();
      if (popupShown) window.removeEventListener("scroll", onScrollDepth);
    }
  }
  window.addEventListener("scroll", onScrollDepth, { passive: true });

  const close = (): void => {
    if (!localStorage.getItem(POPUP_KEY)) {
      localStorage.setItem(POPUP_DISMISS_KEY, String(Date.now()));
    }
    const inner = popup.querySelector(".popup-inner") as HTMLElement | null;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (!inner || reduced) {
      popup.close();
      return;
    }
    popup.classList.add("closing");
    inner.addEventListener(
      "animationend",
      () => {
        popup.classList.remove("closing");
        popup.close();
      },
      { once: true },
    );
  };

  popup.querySelector(".popup-close")?.addEventListener("click", close);
  popup.querySelector(".popup-dismiss")?.addEventListener("click", close);
  popup.querySelector(".popup-skip")?.addEventListener("click", close);
  popup.addEventListener("click", (e) => {
    if (e.target === popup) close();
  });

  let savedEmail = "";
  let popupDocId: LeadCaptureResult | null = null;

  document
    .getElementById("popup-email-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      savedEmail = (
        document.getElementById("popup-email") as HTMLInputElement
      ).value;
      const popupCity = (
        document.getElementById("popup-city") as HTMLInputElement | null
      )?.value.trim();
      const errorEl = document.getElementById("popup-email-error");
      const submitBtn = (
        e.target as HTMLFormElement
      ).querySelector<HTMLButtonElement>('[type="submit"]');
      const originalBtnText = submitBtn?.textContent ?? "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }
      try {
        const attribution = await buildLeadAttribution({ source: "popup" });
        const captured = await captureLead({
          email: savedEmail,
          ...(popupCity ? { city: popupCity } : {}),
          ...attribution,
        });
        popupDocId = captured.id ? captured : null;
        localStorage.setItem(POPUP_KEY, "true");
        identifyLead(savedEmail, attribution);
        trackLeadEvent("lead_email_submitted", attribution);
        trackLeadEvent("email_signup", attribution);
        if (errorEl) {
          errorEl.textContent = "";
          errorEl.setAttribute("hidden", "");
        }
        document.getElementById("popup-step-1")?.setAttribute("hidden", "");
        document.getElementById("popup-step-2")?.removeAttribute("hidden");
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
    .getElementById("popup-phone-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = (document.getElementById("popup-phone") as HTMLInputElement)
        .value;
      const cleaned = cleanPhone(raw);
      const phoneErrorEl = document.getElementById("popup-phone-error");

      if (!raw.trim()) {
        close();
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
        if (popupDocId) {
          await updateLeadPhone(popupDocId, cleaned);
        } else {
          const attribution = await buildLeadAttribution({
            source: "popup",
          });
          await captureLead({
            email: savedEmail,
            phone: cleaned,
            ...attribution,
          });
        }
        trackLeadEvent("lead_phone_submitted", {
          source: "popup",
          sourcePage: window.location.pathname,
        });
        close();
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
}

export function initScrollReveal(): void {
  const prefersReducedMotion = window.matchMedia(
    "(prefers-reduced-motion: reduce)",
  ).matches;

  if (!("IntersectionObserver" in window) || prefersReducedMotion) return;

  document.documentElement.classList.add("js-reveal");

  const STAGGER_STEP_MS = 60;
  document
    .querySelectorAll<HTMLElement>("[data-reveal-stagger]")
    .forEach((parent) => {
      const children = parent.querySelectorAll<HTMLElement>("[data-reveal]");
      children.forEach((child, i) => {
        child.style.transitionDelay = `${i * STAGGER_STEP_MS}ms`;
      });
    });

  const revealNodes = document.querySelectorAll("[data-reveal]");
  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("revealed");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12 },
  );
  revealNodes.forEach((el) => observer.observe(el));
}
