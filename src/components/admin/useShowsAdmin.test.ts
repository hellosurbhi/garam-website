import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { utcTodayIso } from "@/utils/date";
import { useShowsAdmin } from "./useShowsAdmin";
import { showsRequest } from "./showsApi";

vi.mock("./showsApi", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./showsApi")>()),
  // The deployed version matches live and no rebuild lock is set, so neither
  // the version poll nor the lock countdown is running.
  showsRequest: vi.fn(async () => ({
    ok: true,
    status: 200,
    data: {
      live: {
        version: 3,
        snapshot: {},
        publishedAt: "2026-11-01T00:00:00Z",
        rebuild: null,
      },
      draft: null,
    },
  })),
  fetchSiteVersion: vi.fn(async () => 3),
}));

const today = (now: number) => utcTodayIso(new Date(now));

async function mountIdle() {
  const hook = renderHook(() => useShowsAdmin());
  await act(async () => {
    await vi.advanceTimersByTimeAsync(0);
  });
  expect(hook.result.current.load.kind).toBe("ready");
  expect(hook.result.current.siteVersion).toBe(3);
  return hook;
}

describe("useShowsAdmin clock", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T23:30:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("moves to the next UTC day at midnight with nothing else running", async () => {
    const { result } = await mountIdle();
    expect(today(result.current.now)).toBe("2026-11-20");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31 * 60_000);
    });
    expect(today(result.current.now)).toBe("2026-11-21");
  });

  it("re-arms after midnight so the day after moves too", async () => {
    const { result } = await mountIdle();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(3_600_000);
    });
    expect(today(result.current.now)).toBe("2026-11-21");
    await act(async () => {
      await vi.advanceTimersByTimeAsync(24 * 3_600_000);
    });
    expect(today(result.current.now)).toBe("2026-11-22");
  });

  it("refreshes when the tab becomes visible again and on focus", async () => {
    const { result } = await mountIdle();
    // A sleeping laptop pauses timers, so the clock jumps without one firing.
    vi.setSystemTime(new Date("2026-11-22T08:00:00Z"));
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });
    expect(today(result.current.now)).toBe("2026-11-22");
    vi.setSystemTime(new Date("2026-11-23T08:00:00Z"));
    act(() => {
      window.dispatchEvent(new Event("focus"));
    });
    expect(today(result.current.now)).toBe("2026-11-23");
  });

  // WHY: the server computes the Notify Me selection against its own date at
  // load time, so a new day must refetch it, not only move `now`.
  const loads = () => vi.mocked(showsRequest).mock.calls.length;

  it("reloads the show data when UTC midnight passes", async () => {
    const { result } = await mountIdle();
    const before = loads();
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31 * 60_000);
    });
    expect(loads()).toBe(before + 1);
    expect(result.current.load.kind).toBe("ready");
  });

  it("reloads on return to the tab only when the day changed", async () => {
    await mountIdle();
    const before = loads();
    await act(async () => {
      window.dispatchEvent(new Event("focus"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(loads()).toBe(before);
    vi.setSystemTime(new Date("2026-11-22T08:00:00Z"));
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await vi.advanceTimersByTimeAsync(0);
    });
    expect(loads()).toBe(before + 1);
  });

  it("keeps the shown list when the reload on a new day fails", async () => {
    const { result } = await mountIdle();
    vi.mocked(showsRequest).mockResolvedValueOnce({
      ok: false,
      status: 500,
      error: "down",
    } as never);
    await act(async () => {
      await vi.advanceTimersByTimeAsync(31 * 60_000);
    });
    expect(result.current.load.kind).toBe("ready");
  });

  it("stops its timer and listeners on unmount", async () => {
    const { unmount } = await mountIdle();
    unmount();
    expect(vi.getTimerCount()).toBe(0);
  });
});
