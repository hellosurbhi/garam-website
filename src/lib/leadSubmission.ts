export interface LeadSubmissionPayload {
  [key: string]: string | number | undefined;
  email: string;
  phone?: string;
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
  geoLatitude?: number;
  geoLongitude?: number;
  geoTimezone?: string;
}

interface CaptureLeadResponse {
  ok?: boolean;
  id?: string;
  error?: string;
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
): Promise<string> {
  const res = await fetch("/api/capture-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const result = await readJson<CaptureLeadResponse>(res);

  if (!res.ok) {
    throw new Error(result?.error ?? "Failed to save lead");
  }

  return result?.id ?? "";
}

export async function updateLeadPhone(
  id: string,
  phone: string,
): Promise<void> {
  if (!id) throw new Error("Lead id required");

  const res = await fetch("/api/update-lead", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, phone }),
  });
  const result = await readJson<CaptureLeadResponse>(res);

  if (!res.ok) {
    throw new Error(result?.error ?? "Failed to update lead");
  }
}
