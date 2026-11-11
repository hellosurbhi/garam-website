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
  deleteObject,
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
type QuotaRefusal = "photos" | "bytes" | "reservations";

/**
 * WHY every cap is decided inside the conditional write, not from the draft
 * read at the top of the request: requests for one draft run concurrently, so
 * N of them all read "room left" and all passed (11+ photos, more than 100MB,
 * more than 40 reservations). upsertDoc re-reads and re-runs the callback after
 * a lost write race, so a check made on `before` here is the authority; the
 * early checks in the handler are only a cheap exit. The canary reuses one
 * document forever and is exempt.
 */
async function recordPhoto(
  auth: DraftAuth,
  path: string,
  size: number,
  reservation = false,
): Promise<{ refusal: QuotaRefusal | null; kept: number }> {
  let refused: QuotaRefusal | null = null;
  const outcome = await upsertDoc(auth.collection, auth.draftId, (before) => {
    refused = null;
    const current = stringArray(before?.photoPaths);
    if (current.includes(path)) return {};
    if (!auth.canaryKey) {
      if (current.length >= MAX_PHOTOS_PER_DRAFT) refused = "photos";
      else if ((Number(before?.photoBytes) || 0) + size > MAX_TOTAL_BYTES)
        refused = "bytes";
      else if (
        reservation &&
        (Number(before?.photoReservations) || 0) >= MAX_RESERVATIONS_PER_DRAFT
      )
        refused = "reservations";
      if (refused) return {};
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
  // `kept` is counted from the document the decision was made on, not from the
  // top-of-request read.
  return {
    refusal: refused,
    kept: stringArray(outcome.after.photoPaths).length,
  };
}

/** The 409 the client already understands, for whichever cap was hit. */
function quotaResponse(refusal: QuotaRefusal, kept: number): Response {
  return jsonResponse(
    refusal === "bytes"
      ? { error: "photo_quota", reason: "bytes" }
      : { error: "photo_quota", kept },
    409,
  );
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
      // The caps above are only an early exit; this write is the authority
      // (see recordPhoto). The sequence number comes from the same write so
      // racing reserves never share an object name.
      let seq = 0;
      let refusal: QuotaRefusal | null = null;
      const claimed = await upsertDoc(
        auth.collection,
        auth.draftId,
        (before) => {
          refusal = null;
          const taken = Number(before?.photoReservations) || 0;
          if (!auth.canaryKey) {
            if (stringArray(before?.photoPaths).length >= MAX_PHOTOS_PER_DRAFT)
              refusal = "photos";
            else if (taken >= MAX_RESERVATIONS_PER_DRAFT)
              refusal = "reservations";
            if (refusal) return {};
          }
          seq = taken + 1;
          return { photoReservations: seq };
        },
      );
      if (refusal) {
        return quotaResponse(
          refusal,
          stringArray(claimed.after.photoPaths).length,
        );
      }
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
      // No early byte check: recordPhoto is the only authority. A pre-read
      // check refused a retried confirm whose original had just committed, and
      // the client then burned a reservation re-uploading a kept photo.
      const { refusal, kept: keptNow } = await recordPhoto(
        auth,
        path as string,
        stored.size,
      );
      if (refusal) return quotaResponse(refusal, keptNow);
      return jsonResponse({ ok: true, path, size: stored.size });
    }

    if (action === "remove") {
      const path = body.path;
      stage = "remove";
      // WHY the bytes come back off: the byte quota counts kept photos, so an
      // applicant swapping large photos must not run into it with removed ones.
      // Sized unconditionally, not only when the pre-read lists the path: a
      // confirm of this path racing the remove commits between the two reads,
      // and a skipped size left its bytes counted forever. The callback below
      // still subtracts only if the path really was kept.
      const removedSize = isPhotoPathForDraft(path, auth.draftId)
        ? ((await headObject(path as string))?.size ?? 0)
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
      if (!auth.canaryKey) {
        if (
          (Number(draft.photoBytes) || 0) + bytes.byteLength >
          MAX_TOTAL_BYTES
        ) {
          return quotaResponse("bytes", kept.length);
        }
        if (
          kept.length >= MAX_PHOTOS_PER_DRAFT ||
          (Number(draft.photoReservations) || 0) >= MAX_RESERVATIONS_PER_DRAFT
        ) {
          return quotaResponse("photos", kept.length);
        }
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
      // The object was stored before the authoritative check ran. Remove it on
      // a refusal or a failed write so the relay never leaves an unmetered file
      // in the bucket.
      let recorded: Awaited<ReturnType<typeof recordPhoto>>;
      try {
        recorded = await recordPhoto(auth, name, bytes.byteLength, true);
      } catch (err) {
        await deleteObject(name).catch(() => {});
        throw err;
      }
      if (recorded.refusal) {
        await deleteObject(name).catch(() => {});
        return quotaResponse(recorded.refusal, recorded.kept);
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
