import { afterEach, describe, expect, it, vi } from "vitest";
import type { UploadTask, UploadTaskSnapshot } from "firebase/storage";
import { settlePhotoUploads, waitForPhotoUpload } from "./photoUploads";

function pendingUpload() {
  let progress: (snapshot: UploadTaskSnapshot) => unknown = () => {};
  let complete: () => void = () => {};
  const unsubscribe = vi.fn();
  const cancel = vi.fn(() => true);
  const on: UploadTask["on"] = (_event, next, _error, done) => {
    if (typeof next === "function") progress = next;
    if (done) complete = done;
    return unsubscribe;
  };
  // Only these two UploadTask methods are consumed by the upload watchdog.
  const task = { on, cancel };
  return {
    task,
    cancel,
    unsubscribe,
    progress: (bytesTransferred: number) =>
      progress({ bytesTransferred } as UploadTaskSnapshot),
    complete: () => complete(),
  };
}

afterEach(() => vi.useRealTimers());

describe("photo upload queue", () => {
  it("limits ten photos to two active operations and preserves their order", async () => {
    vi.useFakeTimers();
    let active = 0;
    let maximumActive = 0;
    const files = Array.from(
      { length: 10 },
      (_, i) => new File(["photo"], `${i}.jpg`),
    );
    const result = settlePhotoUploads(files, async (file, index) => {
      active++;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, index % 2 ? 10 : 20));
      active--;
      return `photos/${file.name}`;
    });
    expect(active).toBe(2);
    await vi.runAllTimersAsync();
    expect(maximumActive).toBe(2);
    expect(await result).toEqual(
      files.map((file) => ({
        status: "fulfilled",
        value: `photos/${file.name}`,
      })),
    );
  });

  it("waits for slower siblings and continues queued photos after one fails", async () => {
    vi.useFakeTimers();
    const files = ["bad.jpg", "slow.jpg", "last.jpg"].map(
      (name) => new File(["photo"], name),
    );
    const error = new Error("Storage unavailable");
    const result = settlePhotoUploads(files, async (file, index) => {
      if (index === 0) throw error;
      await new Promise((resolve) =>
        setTimeout(resolve, index === 1 ? 100 : 10),
      );
      return `photos/${file.name}`;
    });
    let settled = false;
    void result.then(() => {
      settled = true;
    });
    await vi.advanceTimersByTimeAsync(50);
    expect(settled).toBe(false);
    await vi.runAllTimersAsync();
    expect(await result).toEqual([
      { status: "rejected", reason: error },
      { status: "fulfilled", value: "photos/slow.jpg" },
      { status: "fulfilled", value: "photos/last.jpg" },
    ]);
  });
});

describe("photo upload watchdog", () => {
  it("allows a progressing photo to finish beyond the former 30 second cutoff", async () => {
    vi.useFakeTimers();
    const upload = pendingUpload();
    const result = waitForPhotoUpload(upload.task);
    await vi.advanceTimersByTimeAsync(20_000);
    upload.progress(256_000);
    await vi.advanceTimersByTimeAsync(20_000);
    upload.progress(512_000);
    await vi.advanceTimersByTimeAsync(20_000);
    upload.complete();
    await expect(result).resolves.toBeUndefined();
    expect(upload.cancel).not.toHaveBeenCalled();
    expect(upload.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("cancels a stalled photo and releases its timers", async () => {
    vi.useFakeTimers();
    const upload = pendingUpload();
    const result = expect(waitForPhotoUpload(upload.task)).rejects.toThrow(
      "stopped making progress",
    );
    await vi.advanceTimersByTimeAsync(20_000);
    upload.progress(0);
    await vi.advanceTimersByTimeAsync(10_000);
    await result;
    expect(upload.cancel).toHaveBeenCalledOnce();
    expect(upload.unsubscribe).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("still bounds the total time when a transfer trickles indefinitely", async () => {
    vi.useFakeTimers();
    const upload = pendingUpload();
    const result = expect(waitForPhotoUpload(upload.task)).rejects.toThrow(
      "exceeded 3 minutes",
    );
    for (let i = 1; i <= 9; i++) {
      await vi.advanceTimersByTimeAsync(20_000);
      if (i < 9) upload.progress(i);
    }
    await result;
    expect(upload.cancel).toHaveBeenCalledOnce();
    expect(vi.getTimerCount()).toBe(0);
  });
});
