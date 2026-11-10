import { randomBytes } from "crypto";
import type { APIRoute } from "astro";
import { isAllowedApplyOrigin } from "@/lib/allowedOrigin";
import { resolveDraftAuth, type DraftAuth } from "@/lib/draftAuth";
import { upsertDoc } from "@/lib/draftStore";
import { jsonResponse } from "@/lib/http";
import { alertOps } from "@/lib/opsAlert";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import {
  headObject,
  isPhotoPathForDraft,
  photoPrefix,
  putObject,
  safeContentType,
  safeExtension,
  signUploadUrl,
} from "@/lib/storageAdmin";
import { fsGet } from "@/lib/firestoreRest";

export const prerender = false;

/**
 * Photo handling for the apply form. Actions (JSON body, token in the
 * `x-draft-token` header):
 *  - reserve: hand back a signed Storage upload URL for a server-chosen path,
 *    so the browser PUTs the raw file straight to the bucket (Vercel's 4.5MB
 *    request limit never applies, and no Storage rules or login are involved);
 *  - confirm: after the PUT, verify the object exists and record its path on
 *    the draft;
 *  - remove: take a path off the draft (the stored file is kept).
 * Plus `?relay=1` (raw file bytes in the body, up to 4MB) as the fallback when
 * the direct PUT is blocked. A photo is never rejected for its type or size.
 */

const MAX_PHOTOS_PER_DRAFT = 10;
/** Reservations may exceed photos kept (retries, removed picks). */
const MAX_RESERVATIONS_PER_DRAFT = 40;
const MAX_TOTAL_BYTES = 100 * 1024 * 1024;
const RELAY_MAX_BYTES = 4 * 1024 * 1024;

type Json = Record<string, unknown>;

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((v): v is string => typeof v === "string")
    : [];
}

function objectName(
  auth: DraftAuth,
  seq: number,
  filename: unknown,
  index: unknown,
): string {
  const ext = safeExtension(filename);
  // Canary photos overwrite one fixed object per slot so the canary never
  // grows the bucket.
  if (auth.canaryKey) {
    const slot = Math.min(Math.max(Math.trunc(Number(index) || 0), 0), 9);
    return `${photoPrefix(auth.draftId)}canary-${slot}.${ext}`;
  }
  return `${photoPrefix(auth.draftId)}${seq}-${randomBytes(4).toString("hex")}.${ext}`;
}

async function recordPhoto(auth: DraftAuth, path: string) {
  return upsertDoc(auth.collection, auth.draftId, (before) => {
    const current = stringArray(before?.photoPaths);
    if (current.includes(path)) return {};
    return { photoPaths: [...current, path], updatedAt: new Date() };
  });
}

export const POST: APIRoute = async ({ request, url }) => {
  const limited = await enforceRateLimit(
    request,
    RATE_LIMITS.uploadApplicationPhoto,
  );
  if (limited) return limited;

  if (!isAllowedApplyOrigin(request.headers.get("origin"))) {
    return jsonResponse({ error: "forbidden", reason: "origin" }, 403);
  }

  const resolved = resolveDraftAuth(
    request,
    request.headers.get("x-draft-token"),
  );
  if (!resolved.ok) {
    return jsonResponse(
      { error: "invalid_token", reason: resolved.reason },
      401,
    );
  }
  const auth = resolved.auth;
  const relay = url.searchParams.get("relay") === "1";

  let action = "relay";
  let body: Json = {};
  if (!relay) {
    try {
      const parsed: unknown = await request.json();
      body =
        parsed && typeof parsed === "object" && !Array.isArray(parsed)
          ? (parsed as Json)
          : {};
    } catch {
      return jsonResponse({ error: "bad_request", reason: "not_json" }, 400);
    }
    action = typeof body.action === "string" ? body.action : "";
  }

  let stage: string = action || "unknown";
  try {
    const draft = await fsGet(`${auth.collection}/${auth.draftId}`);
    if (!draft) {
      // Photos can only attach to a saved draft; the client saves first.
      return jsonResponse({ error: "draft_not_found" }, 404);
    }
    const kept = stringArray(draft.photoPaths);

    if (action === "reserve") {
      const reservations = Number(draft.photoReservations) || 0;
      // WHY the canary is exempt from both caps: its document is reused
      // forever, so a lifetime reservation cap ran out within a day and the
      // canary silently fell back to the relay while staying green.
      if (
        !auth.canaryKey &&
        (kept.length >= MAX_PHOTOS_PER_DRAFT ||
          reservations >= MAX_RESERVATIONS_PER_DRAFT)
      ) {
        return jsonResponse({ error: "photo_quota", kept: kept.length }, 409);
      }
      const seq = reservations + 1;
      await upsertDoc(auth.collection, auth.draftId, (before) => ({
        photoReservations: (Number(before?.photoReservations) || 0) + 1,
      }));
      const contentType = safeContentType(body.contentType);
      const name = objectName(auth, seq, body.filename, body.index);
      const signed = signUploadUrl(name, contentType);
      return jsonResponse({
        ok: true,
        path: name,
        uploadUrl: signed.url,
        contentType: signed.contentType,
      });
    }

    if (action === "confirm") {
      const path = body.path;
      if (!isPhotoPathForDraft(path, auth.draftId)) {
        return jsonResponse({ error: "bad_path" }, 400);
      }
      const stored = await headObject(path as string);
      if (!stored) {
        return jsonResponse({ error: "object_missing", path }, 409);
      }
      const total = Number(draft.photoBytes) || 0;
      if (total + stored.size > MAX_TOTAL_BYTES && !auth.canaryKey) {
        return jsonResponse({ error: "photo_quota", reason: "bytes" }, 409);
      }
      await recordPhoto(auth, path as string);
      await upsertDoc(auth.collection, auth.draftId, (before) =>
        kept.includes(path as string)
          ? {}
          : { photoBytes: (Number(before?.photoBytes) || 0) + stored.size },
      );
      return jsonResponse({ ok: true, path, size: stored.size });
    }

    if (action === "remove") {
      const path = body.path;
      stage = "remove";
      await upsertDoc(auth.collection, auth.draftId, (before) => ({
        photoPaths: stringArray(before?.photoPaths).filter((p) => p !== path),
        updatedAt: new Date(),
      }));
      return jsonResponse({ ok: true });
    }

    if (relay) {
      const declared = Number(request.headers.get("content-length") ?? 0);
      if (declared > RELAY_MAX_BYTES) {
        return jsonResponse(
          { error: "relay_too_large", limit: RELAY_MAX_BYTES },
          413,
        );
      }
      const bytes = await request.arrayBuffer();
      if (bytes.byteLength > RELAY_MAX_BYTES) {
        return jsonResponse(
          { error: "relay_too_large", limit: RELAY_MAX_BYTES },
          413,
        );
      }
      if (!auth.canaryKey && kept.length >= MAX_PHOTOS_PER_DRAFT) {
        return jsonResponse({ error: "photo_quota", kept: kept.length }, 409);
      }
      const name = objectName(
        auth,
        (Number(draft.photoReservations) || 0) + 1,
        request.headers.get("x-photo-filename"),
        request.headers.get("x-photo-index"),
      );
      await putObject(
        name,
        bytes,
        safeContentType(request.headers.get("content-type")),
      );
      await recordPhoto(auth, name);
      return jsonResponse({ ok: true, path: name, size: bytes.byteLength });
    }

    return jsonResponse(
      { error: "bad_request", reason: "unknown_action" },
      400,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertOps({
      flow: "apply",
      stage: `photo_${stage}`,
      errorMessage: message,
      context: { draftId: auth.draftId, collection: auth.collection },
    });
    return jsonResponse(
      {
        error: "photo_failed",
        stage: `photo_${stage}`,
        detail: message.slice(0, 500),
      },
      500,
    );
  }
};
