/**
 * How the apply canary judges the browser's direct photo PUTs to the bucket.
 * Kept free of Playwright imports so vitest can cover it (tests/canary is a
 * Playwright suite that vitest never loads).
 */

/** The slice of Playwright's Request that the judgement needs. */
export interface FailedRequest {
  method(): string;
  url(): string;
  failure(): { errorText: string } | null;
  response(): Promise<{ status(): number } | null>;
}

/** True for the Storage upload host itself, judged by parsed hostname. */
export function isStorageHost(url: string): boolean {
  const host = new URL(url).hostname;
  return (
    host === "storage.googleapis.com" ||
    host.endsWith(".storage.googleapis.com")
  );
}

/**
 * Returns why a failed request was a blocked direct upload, or null when it
 * was not one.
 *
 * WHY the response check: Chromium fires requestfailed with net::ERR_ABORTED
 * for a PUT the bucket already answered 200, because the page never reads the
 * empty answer body and Chromium cancels it. Counting every requestfailed as
 * a block failed android-chrome and instagram-webview in run 43211724370
 * while every photo was filed. A real block (CSP, bucket CORS, dropped
 * connection) never yields an answer the page can see, so a request that got
 * a 2xx answer uploaded. Dropping the check brings the false alarm back;
 * dropping the 2xx condition hides a failed PUT that got an error answer.
 */
export async function blockedStoragePut(
  req: FailedRequest,
): Promise<string | null> {
  if (req.method() !== "PUT" || !isStorageHost(req.url())) return null;
  const res = await req.response();
  const status = res?.status() ?? null;
  if (status !== null && status >= 200 && status < 300) return null;
  const reason = `${req.url()} ${req.failure()?.errorText ?? ""}`;
  return status === null ? reason : `${reason} after HTTP ${status}`;
}

/**
 * Collects every requestfailed event of a page and, once the flow is done,
 * resolves the blocked direct uploads among them.
 *
 * WHY a collector instead of judging inline: request.response() is async, so
 * the canary's handler can only start each judgement. The assertion has to
 * wait for every one of them, including any still pending when the flow
 * finished, or a slow block slips past as an empty list.
 */
export function blockedPutCollector() {
  const checks: Promise<string | null>[] = [];
  return {
    onRequestFailed(req: FailedRequest): void {
      checks.push(blockedStoragePut(req));
    },
    async blocked(): Promise<string[]> {
      const reasons = await Promise.all(checks);
      return reasons.filter((reason): reason is string => reason !== null);
    },
  };
}
