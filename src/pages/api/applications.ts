export const prerender = false;

import type { APIRoute } from "astro";
import { Timestamp } from "firebase-admin/firestore";
import { getAdminFirestore } from "@/lib/firebaseAdmin";
import { jsonResponse, parseJsonRequest } from "@/lib/http";
import { AdminApplicationPatchSchema } from "@/lib/schemas";
import { verifyAdminToken } from "@/lib/verifyToken";

const PAGE_SIZE = 24;

type SerializedTimestamp = { seconds: number; nanoseconds: number };

function unauthorized(): Response {
  return jsonResponse({ error: "Unauthorized" }, 401);
}

async function requireAdmin(request: Request): Promise<string | null> {
  const authHeader = request.headers.get("authorization") ?? undefined;
  return verifyAdminToken(authHeader);
}

function serializeTimestamp(
  value: unknown,
): SerializedTimestamp | string | null | undefined {
  if (value === null || value === undefined) return value;

  if (value instanceof Timestamp) {
    return { seconds: value.seconds, nanoseconds: value.nanoseconds };
  }

  if (value instanceof Date) {
    return { seconds: Math.floor(value.getTime() / 1000), nanoseconds: 0 };
  }

  if (typeof value === "string") return value;

  if (typeof value === "object") {
    const maybeTimestamp = value as {
      seconds?: unknown;
      nanoseconds?: unknown;
      _seconds?: unknown;
      _nanoseconds?: unknown;
      toDate?: () => Date;
    };
    const seconds =
      typeof maybeTimestamp.seconds === "number"
        ? maybeTimestamp.seconds
        : maybeTimestamp._seconds;
    const nanoseconds =
      typeof maybeTimestamp.nanoseconds === "number"
        ? maybeTimestamp.nanoseconds
        : maybeTimestamp._nanoseconds;

    if (typeof seconds === "number") {
      return {
        seconds,
        nanoseconds: typeof nanoseconds === "number" ? nanoseconds : 0,
      };
    }

    if (typeof maybeTimestamp.toDate === "function") {
      const date = maybeTimestamp.toDate();
      return { seconds: Math.floor(date.getTime() / 1000), nanoseconds: 0 };
    }
  }

  return undefined;
}

function serializeApplication(
  id: string,
  data: FirebaseFirestore.DocumentData,
): Record<string, unknown> {
  return {
    id,
    ...data,
    submittedAt: serializeTimestamp(data.submittedAt),
    termsAgreedAt: serializeTimestamp(data.termsAgreedAt),
    deletedAt: serializeTimestamp(data.deletedAt),
  };
}

export const GET: APIRoute = async ({ request }) => {
  const adminUid = await requireAdmin(request);
  if (!adminUid) return unauthorized();

  const cursor = new URL(request.url).searchParams.get("cursor")?.trim();
  const applicationsRef = getAdminFirestore().collection("applications");

  try {
    let appQuery = applicationsRef
      .orderBy("submittedAt", "desc")
      .limit(PAGE_SIZE);

    if (cursor) {
      const cursorDoc = await applicationsRef.doc(cursor).get();
      if (!cursorDoc.exists) {
        return jsonResponse({ error: "Invalid cursor" }, 400);
      }
      appQuery = appQuery.startAfter(cursorDoc);
    }

    const snap = await appQuery.get();
    const applications = snap.docs.map((doc) =>
      serializeApplication(doc.id, doc.data()),
    );
    const lastDoc = snap.docs.at(-1);

    return jsonResponse(
      {
        applications,
        cursor: lastDoc?.id ?? null,
        hasMore: snap.size === PAGE_SIZE,
      },
      200,
      { "Cache-Control": "no-store" },
    );
  } catch {
    return jsonResponse({ error: "Failed to load applications." }, 500);
  }
};

export const PATCH: APIRoute = async ({ request }) => {
  const adminUid = await requireAdmin(request);
  if (!adminUid) return unauthorized();

  const parsed = await parseJsonRequest(request, AdminApplicationPatchSchema);
  if (!parsed.success) return parsed.response;

  const { id, patch } = parsed.data;
  const docRef = getAdminFirestore().collection("applications").doc(id);

  try {
    const snap = await docRef.get();
    if (!snap.exists) {
      return jsonResponse({ error: "Application not found" }, 404);
    }

    const update: Record<string, unknown> = {};
    if (patch.status !== undefined) update.status = patch.status;
    if (patch.notes !== undefined) update.notes = patch.notes;
    if (patch.deletedAt !== undefined) {
      update.deletedAt = patch.deletedAt === "now" ? Timestamp.now() : null;
    }

    await docRef.update(update);
    const updatedSnap = await docRef.get();

    return jsonResponse({
      ok: true,
      application: serializeApplication(id, updatedSnap.data() ?? {}),
    });
  } catch {
    return jsonResponse({ error: "Failed to update application." }, 500);
  }
};
