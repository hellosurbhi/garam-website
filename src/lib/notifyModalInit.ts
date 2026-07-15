import { cleanPhone } from "@/lib/phone";
import { identifyLead, trackLeadEvent } from "@/lib/analytics";
import { buildLeadAttribution } from "@/lib/leadAttribution";
import {
  captureLead,
  updateLeadPhone,
  type LeadCaptureResult,
  type LeadSubmissionPayload,
} from "@/lib/leadSubmission";
import { ON_SALE_DATE_FORMAT } from "@/utils/eventDate";

export function initNotifyModal(): void {
  const dialog = document.getElementById("notify-modal") as HTMLDialogElement;
  if (!dialog) return;

  const baseSource =
    (dialog as HTMLElement).dataset.source?.trim() || "notify-modal";

  function toCitySlug(value: string): string {
    return value
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-");
  }

  function composeSource(slug: string): string {
    return slug ? `${baseSource}-${slug}` : baseSource;
  }

  let openerEl: HTMLElement | null = null;
  let notifyDocId: LeadCaptureResult | null = null;
  let notifyEmail = "";

  dialog.addEventListener("close", () => {
    openerEl?.focus();
    openerEl = null;
  });

  document
    .querySelectorAll<HTMLElement>("[data-notify-city]")
    .forEach((el) => {
      const open = () => {
        const city = el.dataset.notifyCity ?? "";
        const rawSlug = el.dataset.notifyCitySlug?.trim();
        const citySlug = rawSlug ? toCitySlug(rawSlug) : toCitySlug(city);
        const nameEl = document.getElementById("notify-city-name");
        const cityInput = document.getElementById(
          "notify-city",
        ) as HTMLInputElement;
        const citySlugInput = document.getElementById(
          "notify-city-slug",
        ) as HTMLInputElement;
        if (nameEl) nameEl.textContent = city;
        if (cityInput) cityInput.value = city;
        if (citySlugInput) citySlugInput.value = citySlug;
        const onSaleAt = el.dataset.notifyOnSaleAt ?? "";
        const subtitleDefault = document.getElementById(
          "notify-subtitle-default",
        );
        const subtitlePresale = document.getElementById(
          "notify-subtitle-presale",
        );
        const onSaleDateEl = document.getElementById("notify-on-sale-date");
        if (onSaleAt) {
          const formatted = new Date(onSaleAt).toLocaleString(
            "en-US",
            ON_SALE_DATE_FORMAT,
          );
          if (onSaleDateEl) onSaleDateEl.textContent = formatted;
          subtitleDefault?.setAttribute("hidden", "");
          subtitlePresale?.removeAttribute("hidden");
        } else {
          subtitleDefault?.removeAttribute("hidden");
          subtitlePresale?.setAttribute("hidden", "");
        }
        document
          .getElementById("notify-form-view")
          ?.removeAttribute("hidden");
        document
          .getElementById("notify-phone-view")
          ?.setAttribute("hidden", "");
        document.getElementById("notify-success")?.setAttribute("hidden", "");
        const errorEl = document.getElementById("notify-error");
        if (errorEl) {
          errorEl.textContent = "";
          errorEl.setAttribute("hidden", "");
        }
        notifyDocId = null;
        openerEl = document.activeElement as HTMLElement;
        trackLeadEvent("notify_modal_opened", {
          source: composeSource(citySlug),
          sourceCitySlug: citySlug || undefined,
          sourcePage: window.location.pathname,
          city,
        });
        trackLeadEvent("waitlist_modal_opened", {
          source: composeSource(citySlug),
          sourceCitySlug: citySlug || undefined,
          sourcePage: window.location.pathname,
          city,
        });
        dialog.showModal();
        dialog.focus();
      };
      el.addEventListener("click", open);
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          open();
        }
      });
    });

  dialog
    .querySelector(".modal-close")
    ?.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  document
    .getElementById("notify-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      notifyEmail = (
        document.getElementById("notify-email") as HTMLInputElement
      ).value;
      const city = (
        document.getElementById("notify-city") as HTMLInputElement
      ).value;
      const submitBtn = (
        e.target as HTMLFormElement
      ).querySelector<HTMLButtonElement>('[type="submit"]');
      const errorEl = document.getElementById("notify-error");
      const originalBtnText = submitBtn?.textContent ?? "";
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.textContent = "Sending...";
      }
      try {
        const citySlug = (
          document.getElementById("notify-city-slug") as HTMLInputElement
        ).value;
        const finalSource = composeSource(citySlug);
        const attribution = await buildLeadAttribution({
          source: finalSource,
          sourceCitySlug: citySlug || undefined,
        });
        const data: LeadSubmissionPayload = {
          email: notifyEmail,
          city,
          ...attribution,
        };
        const captured = await captureLead(data);
        notifyDocId = captured.id ? captured : null;
        identifyLead(notifyEmail, { ...attribution, city });
        trackLeadEvent("lead_email_submitted", { ...attribution, city });
        trackLeadEvent("email_signup", { ...attribution, city });
        trackLeadEvent("waitlist_submit", { ...attribution, city });
        if (errorEl) {
          errorEl.textContent = "";
          errorEl.setAttribute("hidden", "");
        }
        document
          .getElementById("notify-form-view")
          ?.setAttribute("hidden", "");
        document
          .getElementById("notify-phone-view")
          ?.removeAttribute("hidden");
        (
          document.getElementById("notify-phone") as HTMLInputElement | null
        )?.focus();
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
    .getElementById("notify-phone-form")
    ?.addEventListener("submit", async (e) => {
      e.preventDefault();
      const raw = (
        document.getElementById("notify-phone") as HTMLInputElement
      ).value;
      const cleaned = cleanPhone(raw);
      const phoneErrorEl = document.getElementById("notify-phone-error");

      if (!raw.trim()) {
        document
          .getElementById("notify-phone-view")
          ?.setAttribute("hidden", "");
        const successEl = document.getElementById(
          "notify-success",
        ) as HTMLElement | null;
        const successText = document.getElementById("notify-success-text");
        if (successText)
          successText.textContent =
            "You're on the list! Check your email when tickets drop.";
        successEl?.removeAttribute("hidden");
        successEl?.focus();
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
        const citySlug = (
          document.getElementById("notify-city-slug") as HTMLInputElement
        ).value;
        const finalSource = composeSource(citySlug);
        if (notifyDocId) {
          await updateLeadPhone(notifyDocId, cleaned);
        } else {
          const attribution = await buildLeadAttribution({
            source: finalSource,
            sourceCitySlug: citySlug || undefined,
          });
          const data: LeadSubmissionPayload = {
            email: notifyEmail,
            city: (document.getElementById("notify-city") as HTMLInputElement)
              .value,
            phone: cleaned,
            ...attribution,
          };
          await captureLead(data);
        }
        trackLeadEvent("lead_phone_submitted", {
          source: finalSource,
          sourceCitySlug: citySlug || undefined,
          sourcePage: window.location.pathname,
        });
        document
          .getElementById("notify-phone-view")
          ?.setAttribute("hidden", "");
        const successEl = document.getElementById(
          "notify-success",
        ) as HTMLElement | null;
        const successText = document.getElementById("notify-success-text");
        if (successText)
          successText.textContent =
            "You're on the list! We'll text you when tickets drop.";
        successEl?.removeAttribute("hidden");
        successEl?.focus();
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

  document.getElementById("notify-skip")?.addEventListener("click", () => {
    const citySlug =
      (document.getElementById("notify-city-slug") as HTMLInputElement)
        ?.value ?? "";
    trackLeadEvent("lead_phone_skipped", {
      source: composeSource(citySlug),
      sourcePage: window.location.pathname,
    });
    document.getElementById("notify-phone-view")?.setAttribute("hidden", "");
    const successEl = document.getElementById(
      "notify-success",
    ) as HTMLElement | null;
    const successText = document.getElementById("notify-success-text");
    if (successText)
      successText.textContent =
        "You're on the list! Check your email when tickets drop.";
    successEl?.removeAttribute("hidden");
    successEl?.focus();
  });
}
