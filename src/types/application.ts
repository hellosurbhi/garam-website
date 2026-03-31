import type { Timestamp } from "firebase/firestore";

export interface Application {
  id: string;
  name: string;
  age: number;
  gender: string;
  orientation: string;
  city: string;
  country?: string;
  state?: string;
  height: string;
  instagram: string;
  community: string;
  income: string;
  applicationType: string;
  referrerName?: string;
  pitch?: string;
  photoUrl: string;
  deletedAt?: Timestamp | null;
  status: "New" | "Contacted" | "Cast" | "Rejected";
  notes?: string;
  submittedAt: Timestamp;
}

export const STATUS_COLORS: Record<Application["status"], string> = {
  New: "#D4A843",
  Contacted: "#3B82F6",
  Cast: "#22C55E",
  Rejected: "#9CA3AF",
};

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

export const INCOME_OPTIONS = [
  "Under $50k",
  "$50k–$100k",
  "$100k–$200k",
  "Over $200k",
  "Prefer not to say",
];
