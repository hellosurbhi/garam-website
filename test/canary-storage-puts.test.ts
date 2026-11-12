import { describe, it, expect } from "vitest";
import { blockedStoragePut, isStorageHost } from "../tests/canary/storagePuts";

const SIGNED =
  "https://storage.googleapis.com/bucket.firebasestorage.app/photos/x/canary-1.jpg?X-Goog-Signature=abc";

function failedRequest(opts: {
  method?: string;
  url?: string;
  errorText?: string;
  status?: number | null;
}) {
  const { method = "PUT", url = SIGNED, errorText = "net::ERR_FAILED" } = opts;
  const status = opts.status === undefined ? null : opts.status;
  return {
    method: () => method,
    url: () => url,
    failure: () => ({ errorText }),
    response: async () => (status === null ? null : { status: () => status }),
  };
}

/**
 * Chromium reports a PUT whose 2xx answer body was never read as a failed
 * request (net::ERR_ABORTED) even though the upload landed. Run 43211724370
 * failed android-chrome and instagram-webview on exactly that while every
 * photo was filed. A real block (CSP, bucket CORS, dropped connection) never
 * gets an answer, so the answer is what separates the two.
 */
describe("blockedStoragePut", () => {
  it("ignores a body cancel after the bucket answered 200", async () => {
    expect(
      await blockedStoragePut(
        failedRequest({ errorText: "net::ERR_ABORTED", status: 200 }),
      ),
    ).toBeNull();
  });

  it("reports a PUT that never got an answer", async () => {
    expect(
      await blockedStoragePut(failedRequest({ errorText: "net::ERR_FAILED" })),
    ).toBe(`${SIGNED} net::ERR_FAILED`);
  });

  it("reports an aborted PUT that never got an answer", async () => {
    expect(
      await blockedStoragePut(failedRequest({ errorText: "net::ERR_ABORTED" })),
    ).toBe(`${SIGNED} net::ERR_ABORTED`);
  });

  it("reports a failed PUT whose answer was an error status", async () => {
    expect(
      await blockedStoragePut(
        failedRequest({ errorText: "net::ERR_ABORTED", status: 403 }),
      ),
    ).toBe(`${SIGNED} net::ERR_ABORTED after HTTP 403`);
  });

  it("ignores requests that are not PUTs to the storage host", async () => {
    expect(
      await blockedStoragePut(failedRequest({ method: "GET" })),
    ).toBeNull();
    expect(
      await blockedStoragePut(
        failedRequest({ url: "https://garammasaladating.com/api/x" }),
      ),
    ).toBeNull();
  });
});

describe("isStorageHost", () => {
  it("matches the bucket host by parsed hostname only", () => {
    expect(isStorageHost(SIGNED)).toBe(true);
    expect(isStorageHost("https://b.storage.googleapis.com/o")).toBe(true);
    expect(isStorageHost("https://storage.googleapis.com.evil.example/o")).toBe(
      false,
    );
  });
});
