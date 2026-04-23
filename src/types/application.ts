import type { Timestamp } from "firebase/firestore";

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
  height: string;
  instagram: string;
  community: string;
  income: string;
  applicationType: string;
  referrerName?: string;
  pitch?: string;
  type?: string;
  seenShowBefore?: boolean;
  marketingConsent?: "yes" | "no";
  termsAgreedAt?: Timestamp;
  photoUrl: string;
  deletedAt?: Timestamp | null;
  status: "New" | "Contacted" | "Cast" | "Rejected";
  notes?: string;
  submittedAt: Timestamp;
}

/** Hex colour for each application status, used in admin UI status badges. */
export const STATUS_COLORS: Record<Application["status"], string> = {
  New: "#D4A843",
  Contacted: "#3B82F6",
  Cast: "#22C55E",
  Rejected: "#9CA3AF",
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
