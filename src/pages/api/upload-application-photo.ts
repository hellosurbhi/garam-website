import { randomBytes } from "crypto";
import type { APIRoute } from "astro";
import { isAllowedApplyOrigin } from "@/lib/allowedOrigin";
import { resolveDraftAuth, type DraftAuth } from "@/lib/draftAuth";
import { upsertDoc } from "@/lib/draftStore";
import { jsonResponse } from "@/lib/http";
import { publicCause } from "@/lib/publicCause";
import { alertOpsOnce } from "@/lib/alertDedupe";
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

/** The relay sends the filename percent-encoded; a malformed value is ignored. */
function decodeFilenameHeader(value: string | null): string | null {
  if (value === null) return null;
  try {
    return decodeURIComponent(value);
  } catch {
    return null;
  }
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

/**
 * Attach a stored photo to the draft and count its bytes in ONE conditional
 * write. WHY: bytes were added in a second write decided from a snapshot read
 * before either write, so two confirms of the same path (a retried request)
 * both saw "not kept yet" and counted the file twice. Here the path check and
 * the count read the same `before`, and upsertDoc re-runs on a lost race.
 * `reservation` also takes a reservation slot (the relay has no reserve step).
 */
async function recordPhoto(
  auth: DraftAuth,
  path: string,
  size: number,
  reservation = false,
): Promise<boolean> {
  let refused = false;
  await upsertDoc(auth.collection, auth.draftId, (before) => {
    refused = false;
    const current = stringArray(before?.photoPaths);
    if (current.includes(path)) return {};
    // WHY the cap is checked inside the write: reserve and confirm are
    // separate requests, so a holder could reserve many before any confirm
    // lands. Checking against the stored list here is race-safe because
    // upsertDoc retries this callback after a lost write race. The canary
    // reuses one document forever and is exempt.
    if (!auth.canaryKey && current.length >= MAX_PHOTOS_PER_DRAFT) {
      refused = true;
      return {};
    }
    return {
      photoPaths: [...current, path],
      photoBytes: (Number(before?.photoBytes) || 0) + size,
      ...(reservation
        ? { photoReservations: (Number(before?.photoReservations) || 0) + 1 }
        : {}),
      updatedAt: new Date(),
    };
  });
  return !refused;
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
    // WHY: a finished application is closed to a leaked token; the real
    // client settles every photo before it finalizes. The canary reuses one
    // document every run and is exempt.
    if (!auth.canaryKey && draft.finalizedAt) {
      return jsonResponse(
        { error: "finalized", reason: "already_submitted" },
        409,
      );
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
      // A retried confirm of a photo already kept is a no-op, never a refusal.
      if (
        !kept.includes(path as string) &&
        total + stored.size > MAX_TOTAL_BYTES &&
        !auth.canaryKey
      ) {
        return jsonResponse({ error: "photo_quota", reason: "bytes" }, 409);
      }
      if (!(await recordPhoto(auth, path as string, stored.size))) {
        return jsonResponse({ error: "photo_quota", kept: kept.length }, 409);
      }
      return jsonResponse({ ok: true, path, size: stored.size });
    }

    if (action === "remove") {
      const path = body.path;
      stage = "remove";
      // WHY the bytes come back off: the byte quota counts kept photos, so an
      // applicant swapping large photos must not run into it with removed ones.
      const removedSize =
        typeof path === "string" && kept.includes(path)
          ? ((await headObject(path))?.size ?? 0)
          : 0;
      await upsertDoc(auth.collection, auth.draftId, (before) => {
        const current = stringArray(before?.photoPaths);
        const had = current.includes(path as string);
        return {
          photoPaths: current.filter((p) => p !== path),
          ...(had
            ? {
                photoBytes: Math.max(
                  0,
                  (Number(before?.photoBytes) || 0) - removedSize,
                ),
              }
            : {}),
          updatedAt: new Date(),
        };
      });
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
      // The relay obeys the same caps as reserve and confirm, or it would be
      // an unmetered way to fill the bucket.
      if (
        !auth.canaryKey &&
        (kept.length >= MAX_PHOTOS_PER_DRAFT ||
          (Number(draft.photoReservations) || 0) >=
            MAX_RESERVATIONS_PER_DRAFT ||
          (Number(draft.photoBytes) || 0) + bytes.byteLength > MAX_TOTAL_BYTES)
      ) {
        return jsonResponse({ error: "photo_quota", kept: kept.length }, 409);
      }
      const name = objectName(
        auth,
        (Number(draft.photoReservations) || 0) + 1,
        decodeFilenameHeader(request.headers.get("x-photo-filename")),
        request.headers.get("x-photo-index"),
      );
      await putObject(
        name,
        bytes,
        safeContentType(request.headers.get("content-type")),
      );
      if (!(await recordPhoto(auth, name, bytes.byteLength, true))) {
        return jsonResponse({ error: "photo_quota", kept: kept.length }, 409);
      }
      return jsonResponse({ ok: true, path: name, size: bytes.byteLength });
    }

    return jsonResponse(
      { error: "bad_request", reason: "unknown_action" },
      400,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await alertOpsOnce({
      flow: "apply",
      stage: `photo_${stage}`,
      errorMessage: message,
      context: { draftId: auth.draftId, collection: auth.collection },
    });
    return jsonResponse(
      {
        error: "photo_failed",
        stage: `photo_${stage}`,
        detail: publicCause(err),
      },
      500,
    );
  }
};
