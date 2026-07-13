const MAX_LONG_EDGE = 2048;
const SKIP_UNDER_BYTES = 400 * 1024;
const JPEG_QUALITY = 0.85;

/**
 * Compress a photo client-side before upload.
 *
 * Applicants upload multiple iPhone photos at up to tens of MB each; on
 * cellular that blows the 30s upload timeout and loses the submission
 * ("Upload timed out" failures in production). Casting photos are judged on
 * the admin dashboard, so 2048px high-quality JPEG keeps full visual
 * fidelity for that purpose at ~10x less data.
 *
 * WHY the fallbacks: compression must never be the reason a submission
 * fails. Any decode/encode problem (exotic format, canvas limits, HEIC on a
 * non-Safari browser) returns the ORIGINAL file, which the 15 MB validation
 * already accepted. Same if the "compressed" result comes out larger.
 */
export async function compressImage(file: File): Promise<File> {
  if (file.size < SKIP_UNDER_BYTES) return file;

  try {
    // from-image bakes EXIF orientation in, so portrait iPhone photos don't
    // arrive sideways after the canvas round-trip.
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    });
    try {
      const scale = Math.min(
        1,
        MAX_LONG_EDGE / Math.max(bitmap.width, bitmap.height),
      );
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));

      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) return file;
      ctx.drawImage(bitmap, 0, 0, width, height);

      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
      );
      if (!blob || blob.size >= file.size) return file;

      const base = file.name.replace(/\.[^.]+$/, "");
      return new File([blob], `${base}.jpg`, { type: "image/jpeg" });
    } finally {
      bitmap.close();
    }
  } catch {
    return file;
  }
}
