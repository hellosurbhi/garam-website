export const prerender = false;

import type { APIRoute } from "astro";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { verifyAdminToken } from "@/lib/verifyToken";

function json(data: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function readString(data: Record<string, unknown>, key: string): string {
  const value = data[key];
  return typeof value === "string" ? value : "";
}

function readBoolean(data: Record<string, unknown>, key: string): boolean {
  return data[key] === true;
}

function readCreatedAt(value: unknown): string | { seconds: number } | null {
  if (typeof value === "string") return value;
  if (value instanceof Date) return value.toISOString();
  if (value && typeof value === "object") {
    const maybeTimestamp = value as {
      seconds?: unknown;
      toDate?: () => Date;
    };
    if (typeof maybeTimestamp.seconds === "number") {
      return { seconds: maybeTimestamp.seconds };
    }
    if (typeof maybeTimestamp.toDate === "function") {
      return maybeTimestamp.toDate().toISOString();
    }
  }
  return null;
}

export const GET: APIRoute = async ({ request }) => {
  const authHeader = request.headers.get("authorization") ?? undefined;
  const adminUid = await verifyAdminToken(authHeader);
  if (!adminUid) {
    return json({ error: "Unauthorized" }, 401);
  }

  try {
    const snap = await getAdminFirestore()
      .collection("invites")
      .orderBy("createdAt", "desc")
      .get();

    const invites = snap.docs.map((doc) => {
      const data = doc.data() as Record<string, unknown>;
      return {
        id: doc.id,
        applicantId: readString(data, "applicantId"),
        applicantName: readString(data, "applicantName"),
        applicantEmail: readString(data, "applicantEmail"),
        showId: readString(data, "showId"),
        showDate: readString(data, "showDate"),
        role: readString(data, "role"),
        claimed: readBoolean(data, "claimed"),
        createdAt: readCreatedAt(data.createdAt),
      };
    });

    return json({ invites });
  } catch {
    return json({ error: "Failed to load contestants." }, 500);
  }
};
