import { safeLocalStorage } from "./safeStorage";
import { z } from "zod";

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

const captureResponseSchema = z.object({
  ok: z.literal(true),
  id: z.string().trim().min(1),
  updateToken: z.string().min(1).optional(),
});
const updateResponseSchema = z.object({ ok: z.literal(true) });

/**
 * Handle returned by captureLead and consumed by updateLeadPhone.
 * updateToken is the signed ownership proof for the step-2 phone update;
 * it is absent while the server has no LEAD_UPDATE_SECRET configured.
 */
export interface LeadCaptureResult {
  id: string;
  updateToken?: string;
}

async function postLead(path: string, payload: object): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 20_000);
  try {
    const response = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    const body: unknown = await response.json();
    if (!response.ok) {
      const error = z.object({ error: z.string() }).safeParse(body);
      throw new Error(
        error.success ? error.data.error : "Could not save your details",
      );
    }
    return body;
  } finally {
    clearTimeout(timer);
  }
}

export async function captureLead(
  payload: LeadSubmissionPayload,
): Promise<LeadCaptureResult> {
  const response = await postLead("/api/capture-lead", payload);
  const parsed = captureResponseSchema.safeParse(response);
  if (!parsed.success)
    throw new Error("Could not confirm your signup. Please try again.");
  const result = parsed.data;

  safeLocalStorage.setItem("gmd-popup-subscribed", "true");

  return {
    id: result.id,
    ...(result.updateToken ? { updateToken: result.updateToken } : {}),
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

  const response = await postLead("/api/update-lead", {
    id: lead.id,
    ...(lead.updateToken ? { token: lead.updateToken } : {}),
    ...fields,
  });
  if (!updateResponseSchema.safeParse(response).success) {
    throw new Error("Could not confirm your update. Please try again.");
  }
}

export async function updateLeadPhone(
  lead: LeadCaptureResult,
  phone: string,
): Promise<void> {
  return updateLeadFields(lead, { phone });
}
