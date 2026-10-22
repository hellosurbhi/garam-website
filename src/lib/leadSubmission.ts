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

export async function captureLead(
  payload: LeadSubmissionPayload,
): Promise<LeadCaptureResult> {
  const res = await fetch("/api/capture-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await readJson<CaptureLeadResponse>(res);

  if (!res.ok) {
    throw new Error(result?.error ?? "Failed to save lead");
  }

  safeLocalStorage.setItem("gmd-popup-subscribed", "true");

  return {
    id: result?.id ?? "",
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

  const res = await fetch("/api/update-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: lead.id,
      ...(lead.updateToken ? { token: lead.updateToken } : {}),
      ...fields,
    }),
  });
  const result = await readJson<CaptureLeadResponse>(res);

  if (!res.ok) {
    throw new Error(result?.error ?? "Failed to update lead");
  }
}

export async function updateLeadPhone(
  lead: LeadCaptureResult,
  phone: string,
): Promise<void> {
  return updateLeadFields(lead, { phone });
}
