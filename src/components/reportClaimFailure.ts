import { reportFailure } from "@/lib/failureAlert";
import { trackError } from "@/lib/analytics";

export type PortalSignupData = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  waiverAgreed: boolean;
  signature: string;
  waiverVersion: string;
  mailingListOptIn: boolean;
};

// A failed claim is a contestant blocked from signing their waiver before a
// show; page the producer with their contact fields so they can be walked
// through it (the UI error alone leaves recovery to chance).
export function reportClaimFailure(err: unknown, data: PortalSignupData): void {
  reportFailure({
    flow: "portal",
    stage: "claim",
    errorMessage: err instanceof Error ? err.message : String(err),
    contact: {
      name: `${data.firstName} ${data.lastName}`.trim(),
      email: data.email,
      phone: data.phone,
    },
  });
  trackError({
    error_message: err instanceof Error ? err.message : String(err),
    error_type: "api_error",
    component: "ContestantPortal",
    email: data.email,
  });
}
