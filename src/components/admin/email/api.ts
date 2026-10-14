import { getFirebaseAuth } from "@/lib/firebase";
import type {
  Show,
  Settings,
  Templates,
  Milestone,
} from "@/lib/outreach/model";
export type EmailDashboardData = {
  shows: Array<{ id: string; value: Show; version: string }>;
  settings: { value: Settings; version: string | null };
  contactCount: number;
  accounts: string[];
  health: {
    checkedAt: number;
    paused: boolean;
    failedAccounts?: string[];
  } | null;
  sync: { refreshedAt: number } | null;
  catalog: Array<
    Pick<
      Show,
      "id" | "city" | "date" | "time" | "timezone" | "venue" | "tickets"
    >
  >;
  progress: Array<{
    id: string;
    showId: string;
    milestone: Milestone;
    total: number;
    sent: number;
    attention: number;
    excluded: number;
  }>;
};
export async function emailApi<T>(body?: unknown, path = ""): Promise<T> {
  const token = await (await getFirebaseAuth()).currentUser?.getIdToken();
  if (!token) throw new Error("Please sign in again");
  const response = await fetch(`/api/admin/email${path}`, {
    method: body ? "POST" : "GET",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(60000),
  });
  const data = await response.json();
  if (!response.ok)
    throw new Error(
      typeof data.error === "string"
        ? data.error
        : "Something went wrong. Please try again.",
    );
  return data as T;
}
export const emptyShow = (
  templates: Templates,
): Omit<Show, "createdAt" | "updatedAt"> => ({
  id: "",
  city: "",
  date: "",
  time: "19:00",
  timezone: "America/New_York",
  venue: "",
  tickets: "",
  audience: "all",
  enabled: true,
  published: true,
  templates,
});
