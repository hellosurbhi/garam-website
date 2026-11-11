// @vitest-environment node
import { it, expect, vi } from "vitest";
import { createStore } from "./admin.mjs";
it("guards document deletion with updateTime and verifies absence", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValueOnce(
      new Response("{}", { headers: { date: new Date().toUTCString() } }),
    )
    .mockResolvedValueOnce(new Response(null, { status: 404 }));
  const store = createStore("demo", "demo.appspot.com", "fake", fetcher);
  await store.deleteDoc({
    name: "projects/demo/databases/(default)/documents/leads/test",
    updateTime: "2026-11-11T00:00:00Z",
  });
  expect(fetcher.mock.calls[0][0]).toContain("currentDocument.updateTime=");
  expect(fetcher).toHaveBeenCalledTimes(2);
});
it("refuses objects outside the project and paths outside photos", async () => {
  const fetcher = vi.fn();
  const store = createStore("demo", "demo.appspot.com", "fake", fetcher);
  expect(() =>
    store.getDoc("projects/other/databases/(default)/documents/leads/test"),
  ).toThrow();
  expect(() => store.photo("photos/../customer.jpg")).toThrow();
  expect(fetcher).not.toHaveBeenCalled();
});
it("does not retry deletion after a generation mismatch", async () => {
  const fetcher = vi
    .fn()
    .mockResolvedValue(new Response(null, { status: 412 }));
  const store = createStore("demo", "demo.appspot.com", "fake", fetcher);
  await expect(store.deletePhoto("photos/test.jpg", "123")).rejects.toThrow(
    "412",
  );
  expect(fetcher).toHaveBeenCalledTimes(1);
});
