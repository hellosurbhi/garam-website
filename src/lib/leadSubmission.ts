import { safeLocalStorage } from "./safeStorage";

export interface LeadSubmissionPayload {
  [key: string]: string | number | undefined;
  email: string;
  phone?: string;
  name?: string;
  instagram?: string;
  city?: string;
  source?: string;
  sourcePage?: string;
  landingPage?: string;
  referrerHost?: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  gclid?: string;
  posthogDistinctId?: string;
  sourceCitySlug?: string;
  geoCity?: string;
  geoRegion?: string;
  geoCountry?: string;
  geoTimezone?: string;
}

interface CaptureLeadResponse {
  ok?: boolean;
  id?: string;
  updateToken?: string;
  error?: string;
}

/**
 * Handle returned by captureLead and consumed by updateLeadPhone.
 * updateToken is the signed ownership proof for the step-2 phone update;
 * it is absent while the server has no LEAD_UPDATE_SECRET configured.
 */
export interface LeadCaptureResult {
  id: string;
  updateToken?: string;
}

async function readJson<T>(response: Response): Promise<T | null> {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
}

async function postLeadJson(
  endpoint: string,
  payload:
    LeadSubmissionPayload | (LeadUpdateFields & { id: string; token?: string }),
): Promise<CaptureLeadResponse> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const result = await readJson<CaptureLeadResponse>(response);
    if (controller.signal.aborted) {
      throw new Error("The connection timed out. Please try again.");
    }
    if (!response.ok || result?.ok !== true) {
      throw new Error(
        result?.error ?? "Could not confirm your signup. Please try again.",
      );
    }
    return result;
  } catch (error) {
    if (controller.signal.aborted) {
      throw new Error("The connection timed out. Please try again.", {
        cause: error,
      });
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}

export async function captureLead(
  payload: LeadSubmissionPayload,
): Promise<LeadCaptureResult> {
  const result = await postLeadJson("/api/capture-lead", payload);
  if (typeof result.id !== "string" || !result.id.trim()) {
    throw new Error("Could not confirm your signup. Please try again.");
  }

  safeLocalStorage.setItem("gmd-popup-subscribed", "true");

  return {
    id: result.id,
    ...(result?.updateToken ? { updateToken: result.updateToken } : {}),
  };
}

/** Contact fields the step-2 lead update path accepts (bounded by firestore.rules validLeadContactUpdate). */
export interface LeadUpdateFields {
  phone?: string;
  instagram?: string;
  name?: string;
  source?: string;
}

export async function updateLeadFields(
  lead: LeadCaptureResult,
  fields: LeadUpdateFields,
): Promise<void> {
  if (!lead.id) throw new Error("Lead id required");

  await postLeadJson("/api/update-lead", {
    id: lead.id,
    ...(lead.updateToken ? { token: lead.updateToken } : {}),
    ...fields,
  });
}

export async function updateLeadPhone(
  lead: LeadCaptureResult,
  phone: string,
): Promise<void> {
  return updateLeadFields(lead, { phone });
}
