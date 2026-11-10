import { compressImage } from "@/utils/compressImage";
import {
  ApplyRequestError,
  type AutosaveController,
} from "@/lib/applyAutosave";

/**
 * Photo upload for the apply form. A photo is saved the moment it is picked
 * and is never rejected for its type or size: if anything about the optimized
 * copy goes wrong, the ORIGINAL file is what gets uploaded.
 *
 * Path: ask the server for a signed Storage URL (reserve), PUT the file
 * straight to the bucket, tell the server it landed (confirm). If the direct
 * PUT cannot work (blocked CORS, flaky network), a copy up to 4MB goes through
 * the server as raw bytes (relay).
 */

const PUT_TIMEOUT_MS = 90_000;
const RELAY_MAX_BYTES = 4 * 1024 * 1024;
const ATTEMPTS = 3;

export interface PhotoUploadResult {
  path: string;
  /** Bytes actually sent (compressed copy or original). */
  size: number;
  /** True when the server relay was used instead of the direct PUT. */
  relayed: boolean;
}

interface ServerReply {
  ok?: boolean;
  path?: string;
  uploadUrl?: string;
  contentType?: string;
  error?: string;
  detail?: string;
}

async function callPhotoApi(
  controller: AutosaveController,
  stage: string,
  body: Record<string, unknown>,
): Promise<ServerReply> {
  const token = await controller.ensureDraft();
  let res: Response;
  try {
    res = await fetch("/api/upload-application-photo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-draft-token": token,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
    });
  } catch (err) {
    throw new ApplyRequestError(
      stage,
      null,
      `network error: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
    );
  }
  let data: ServerReply = {};
  try {
    data = (await res.json()) as ServerReply;
  } catch {
    // Non-JSON error body; status below carries the cause.
  }
  if (!res.ok || data.ok !== true) {
    throw new ApplyRequestError(
      stage,
      res.status,
      data.detail ?? data.error ?? res.statusText,
    );
  }
  return data;
}

async function optimizedCopy(file: File): Promise<File> {
  try {
    return await compressImage(file);
  } catch {
    // WHY: compression is an optimization only. Any failure uploads the
    // original, so a photo is never lost to a decode problem.
    return file;
  }
}

async function putToStorage(
  uploadUrl: string,
  contentType: string,
  file: File,
): Promise<void> {
  let res: Response;
  try {
    res = await fetch(uploadUrl, {
      method: "PUT",
      headers: { "Content-Type": contentType },
      body: file,
      signal: AbortSignal.timeout(PUT_TIMEOUT_MS),
    });
  } catch (err) {
    throw new ApplyRequestError(
      "photo_put",
      null,
      `network error: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)} (the browser could not complete the upload to the storage host: blocked by the site security policy, a bucket CORS rule, or a dropped connection)`,
    );
  }
  if (!res.ok) {
    throw new ApplyRequestError(
      "photo_put",
      res.status,
      (await res.text().catch(() => "")).slice(0, 300) || res.statusText,
    );
  }
}

async function relay(
  controller: AutosaveController,
  file: File,
  index: number,
): Promise<string> {
  const token = await controller.ensureDraft();
  const res = await fetch("/api/upload-application-photo?relay=1", {
    method: "POST",
    headers: {
      "Content-Type": file.type || "application/octet-stream",
      "x-draft-token": token,
      "x-photo-filename": file.name.slice(0, 120),
      "x-photo-index": String(index),
    },
    body: file,
    signal: AbortSignal.timeout(60_000),
  });
  const data = (await res.json().catch(() => ({}))) as ServerReply;
  if (!res.ok || data.ok !== true || !data.path) {
    throw new ApplyRequestError(
      "photo_relay",
      res.status,
      data.detail ?? data.error ?? res.statusText,
    );
  }
  return data.path;
}

/** Take a photo off the draft (the stored file is kept server-side). */
export async function removeApplicationPhoto(
  controller: AutosaveController,
  path: string,
): Promise<void> {
  await callPhotoApi(controller, "photo_remove", { action: "remove", path });
}

export async function uploadApplicationPhoto(
  controller: AutosaveController,
  original: File,
  index: number,
): Promise<PhotoUploadResult> {
  const copy = await optimizedCopy(original);
  let lastError: unknown;

  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    try {
      const reserved = await callPhotoApi(controller, "photo_reserve", {
        action: "reserve",
        filename: copy.name,
        contentType: copy.type || "application/octet-stream",
        index,
      });
      if (!reserved.uploadUrl || !reserved.path) {
        throw new ApplyRequestError(
          "photo_reserve",
          null,
          "server returned no upload URL",
        );
      }
      await putToStorage(
        reserved.uploadUrl,
        reserved.contentType ?? (copy.type || "application/octet-stream"),
        copy,
      );
      await callPhotoApi(controller, "photo_confirm", {
        action: "confirm",
        path: reserved.path,
      });
      return { path: reserved.path, size: copy.size, relayed: false };
    } catch (err) {
      lastError = err;
      await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
    }
  }

  // Direct upload kept failing: fall back to the server relay with whichever
  // copy fits under the request-body limit.
  const relayable = [copy, original].find((f) => f.size <= RELAY_MAX_BYTES);
  if (relayable) {
    try {
      const path = await relay(controller, relayable, index);
      return { path, size: relayable.size, relayed: true };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new ApplyRequestError("photo_upload", null, String(lastError));
}
