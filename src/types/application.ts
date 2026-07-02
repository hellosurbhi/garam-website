import type { Timestamp } from "firebase/firestore";

export type ApplicantStatus =
  | "New"
  | "Contacted"
  | "Responded"
  | "Said Not Now"
  | "Cast"
  | "No Response"
  | "Not Interested Anymore"
  | "Not Interested"
  | "Rejected"
  | "Bailed"
  | "Participated";

/** Firestore document shape for a contestant application. */
export interface Application {
  id: string;
  name: string;
  age: number;
  gender: string;
  orientation: string;
  city: string;
  country?: string;
  state?: string;
  email?: string;
  phone?: string;
  height: string;
  instagram: string;
  community: string;
  income: string;
  applicationType: string;
  referrerName?: string;
  nominationConsent?: boolean;
  pitch?: string;
  type?: string;
  seenShowBefore?: boolean;
  marketingConsent?: "yes" | "no";
  termsAgreedAt?: Timestamp;
  photoUrl?: string; // legacy single-photo field — use getApplicantPhotos() to read
  photoUrls?: string[]; // canonical multi-photo array for new applications
  castEventId?: string; // composite key "{isoDate}__{citySlug}" when status = Cast
  deletedAt?: Timestamp | null;
  status: ApplicantStatus;
  notes?: string;
  submittedAt: Timestamp;
}

/** Hex colour for each application status, used in admin UI status badges. */
export const STATUS_COLORS: Record<ApplicantStatus, string> = {
  New: "#D4A843",
  Contacted: "#3B82F6",
  Responded: "#10B981",
  "Said Not Now": "#F59E0B",
  Cast: "#22C55E",
  "No Response": "#94A3B8",
  "Not Interested Anymore": "#A78BFA",
  "Not Interested": "#64748B",
  Rejected: "#9CA3AF",
  Bailed: "#EF4444",
  Participated: "#8B5CF6",
};

/** Pipeline order for admin dashboard sections. Participated and Deleted are handled separately. */
export const STATUS_ORDER: readonly ApplicantStatus[] = [
  "New",
  "Contacted",
  "Responded",
  "Said Not Now",
  "Cast",
  "No Response",
  "Not Interested Anymore",
  "Not Interested",
  "Rejected",
  "Bailed",
];

/** Whether each section starts expanded (true) or collapsed (false). */
export const STATUS_SECTION_DEFAULTS: Record<ApplicantStatus, boolean> = {
  New: true,
  Contacted: true,
  Responded: true,
  "Said Not Now": true,
  Cast: true,
  "No Response": false,
  "Not Interested Anymore": false,
  "Not Interested": false,
  Rejected: false,
  Bailed: false,
  Participated: false,
};

/** Ordered list of South Asian community identifiers shown in the apply form community dropdown. */
export const COMMUNITY_OPTIONS = [
  "Hindu",
  "Muslim",
  "Sikh",
  "Jain",
  "Buddhist",
  "Christian",
  "Parsi",
  "Atheist/Agnostic",
  "Other South Asian",
  "Other",
];

/** Income bracket choices shown in the apply form income dropdown. */
export const INCOME_OPTIONS = [
  "Under $50k",
  "$50k to $100k",
  "$100k to $150k",
  "$150k to $200k",
  "Over $200k",
  "Prefer not to say",
];
