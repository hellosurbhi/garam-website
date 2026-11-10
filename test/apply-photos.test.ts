import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import type { AutosaveController } from "@/lib/applyAutosave";

const compress = vi.hoisted(() => vi.fn());
vi.mock("@/utils/compressImage", () => ({ compressImage: compress }));

const { uploadApplicationPhoto, removeApplicationPhoto } =
  await import("@/lib/applyPhotos");

const controller = {
  ensureDraft: vi.fn(async () => "tok-1"),
} as unknown as AutosaveController;

const MB = 1024 * 1024;

function file(name: string, type: string, bytes: number): File {
  return new File([new Uint8Array(bytes)], name, { type });
}

function jsonRes(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

interface Call {
  url: string;
  method: string;
  body: unknown;
}

/** Scriptable network: handlers keyed by endpoint kind, calls recorded. */
function network(handlers: {
  reserve?: () => Response;
  put?: () => Response | Promise<Response>;
  confirm?: () => Response;
  relay?: () => Response;
}) {
  const calls: Call[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, init: RequestInit = {}) => {
      calls.push({ url, method: init.method ?? "GET", body: init.body });
      if (url.startsWith("https://storage.example.com/")) {
        return handlers.put?.() ?? new Response(null, { status: 200 });
      }
      if (url.includes("relay=1")) {
        return (
          handlers.relay?.() ??
          jsonRes(200, { ok: true, path: "photos/d/relay-0.jpg" })
        );
      }
      const action = JSON.parse(String(init.body)).action as string;
      if (action === "reserve") {
        return (
          handlers.reserve?.() ??
          jsonRes(200, {
            ok: true,
            path: "photos/d/1-abcd.jpg",
            uploadUrl: "https://storage.example.com/photos/d/1-abcd.jpg",
            contentType: "image/jpeg",
          })
        );
      }
      return handlers.confirm?.() ?? jsonRes(200, { ok: true });
    }),
  );
  return calls;
}

/** Run an upload to completion with the retry sleeps fast-forwarded. */
async function run(original: File) {
  const settled = uploadApplicationPhoto(controller, original, 0).then(
    (value) => ({ value, error: null as unknown }),
    (error: unknown) => ({ value: null, error }),
  );
  await vi.runAllTimersAsync();
  return settled;
}

beforeEach(() => {
  vi.useFakeTimers();
  compress.mockReset();
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("uploadApplicationPhoto: happy path", () => {
  it("reserves, PUTs straight to storage, then confirms", async () => {
    const original = file("a.jpg", "image/jpeg", 100);
    compress.mockResolvedValue(original);
    const calls = network({});
    const { value } = await run(original);
    expect(value).toEqual({
      path: "photos/d/1-abcd.jpg",
      size: 100,
      relayed: false,
    });
    expect(calls.map((c) => c.method)).toEqual(["POST", "PUT", "POST"]);
    expect(JSON.parse(String(calls[2].body))).toMatchObject({
      action: "confirm",
      path: "photos/d/1-abcd.jpg",
    });
  });

  it("sends the compressed copy when compression works", async () => {
    const original = file("big.jpg", "image/jpeg", 9 * MB);
    const small = file("big.jpg", "image/jpeg", 500_000);
    compress.mockResolvedValue(small);
    network({});
    const { value } = await run(original);
    expect(value?.size).toBe(500_000);
  });
});

describe("uploadApplicationPhoto: a photo is never rejected", () => {
  it("uploads the ORIGINAL when compression throws (HEIC the browser cannot decode)", async () => {
    const heic = file("IMG_1.HEIC", "image/heic", 40 * MB);
    compress.mockRejectedValue(new Error("decode failed"));
    const calls = network({
      reserve: () =>
        jsonRes(200, {
          ok: true,
          path: "photos/d/1.heic",
          uploadUrl: "https://storage.example.com/photos/d/1.heic",
          contentType: "image/heic",
        }),
    });
    const { value, error } = await run(heic);
    expect(error).toBeNull();
    expect(value).toMatchObject({ size: 40 * MB, relayed: false });
    expect(JSON.parse(String(calls[0].body))).toMatchObject({
      filename: "IMG_1.HEIC",
      contentType: "image/heic",
    });
  });

  it("falls back to a generic content type for a file with no type", async () => {
    const odd = file("mystery", "", 10);
    compress.mockResolvedValue(odd);
    const calls = network({});
    await run(odd);
    expect(JSON.parse(String(calls[0].body)).contentType).toBe(
      "application/octet-stream",
    );
  });

  it("retries a flaky bucket PUT and succeeds without using the relay", async () => {
    const original = file("a.jpg", "image/jpeg", 100);
    compress.mockResolvedValue(original);
    let puts = 0;
    const calls = network({
      put: () =>
        ++puts < 3
          ? new Response("busy", { status: 503 })
          : new Response(null, { status: 200 }),
    });
    const { value } = await run(original);
    expect(value?.relayed).toBe(false);
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(3);
    expect(calls.some((c) => c.url.includes("relay=1"))).toBe(false);
  });

  it("falls back to the server relay when the bucket never accepts the PUT (blocked CORS)", async () => {
    const original = file("a.jpg", "image/jpeg", 1 * MB);
    compress.mockResolvedValue(original);
    const calls = network({
      put: () => {
        throw new TypeError("Failed to fetch");
      },
    });
    const { value } = await run(original);
    expect(value).toEqual({
      path: "photos/d/relay-0.jpg",
      size: 1 * MB,
      relayed: true,
    });
    expect(calls.filter((c) => c.method === "PUT")).toHaveLength(3);
    expect(calls.at(-1)?.url).toContain("relay=1");
  });

  it("relays the original when the compressed copy grew past 4MB", async () => {
    // A compressor that grows a file must not strand it.
    const original = file("tiny.png", "image/png", 2 * MB);
    const bloated = file("tiny.png", "image/png", 6 * MB);
    compress.mockResolvedValue(bloated);
    const calls = network({
      put: () => new Response("no", { status: 403 }),
    });
    const { value } = await run(original);
    expect(value).toMatchObject({ relayed: true, size: 2 * MB });
    expect(calls.at(-1)?.url).toContain("relay=1");
  });

  it("throws, loudly and with the real cause, when nothing can carry the file", async () => {
    // 40MB original, direct upload dead, too big for the relay: the caller
    // must see an error so the form can retry at submit and alert.
    const original = file("huge.heic", "image/heic", 40 * MB);
    compress.mockResolvedValue(original);
    network({ put: () => new Response("forbidden", { status: 403 }) });
    const { value, error } = await run(original);
    expect(value).toBeNull();
    expect(error).toMatchObject({
      stage: "photo_put",
      status: 403,
    });
    expect(String((error as Error).message)).toContain("forbidden");
  });

  it("surfaces the server's own reason when reserve is refused", async () => {
    const original = file("a.jpg", "image/jpeg", 100);
    compress.mockResolvedValue(original);
    network({
      reserve: () => jsonRes(409, { error: "photo_quota" }),
      relay: () => jsonRes(409, { error: "photo_quota" }),
    });
    const { error } = await run(original);
    expect(error).toMatchObject({ stage: "photo_relay", status: 409 });
    expect(String((error as Error).message)).toContain("photo_quota");
  });

  it("treats a confirm that says the object is missing as a failed attempt, not a success", async () => {
    const original = file("a.jpg", "image/jpeg", 100);
    compress.mockResolvedValue(original);
    let confirms = 0;
    network({
      confirm: () =>
        ++confirms < 2
          ? jsonRes(409, { error: "object_missing" })
          : jsonRes(200, { ok: true }),
    });
    const { value } = await run(original);
    expect(value?.relayed).toBe(false);
    expect(confirms).toBe(2);
  });

  it("describes a dropped connection with the error name, not a canned sentence", async () => {
    const original = file("a.jpg", "image/jpeg", 40 * MB);
    compress.mockResolvedValue(original);
    network({
      put: () => {
        throw new TypeError("Load failed");
      },
    });
    const { error } = await run(original);
    expect(String((error as Error).message)).toContain(
      "network error: TypeError: Load failed",
    );
  });
});

describe("removeApplicationPhoto", () => {
  it("tells the server which path to take off the draft", async () => {
    const calls = network({});
    await removeApplicationPhoto(controller, "photos/d/1.jpg");
    expect(JSON.parse(String(calls[0].body))).toEqual({
      action: "remove",
      path: "photos/d/1.jpg",
    });
  });

  it("throws a staged error when the server refuses", async () => {
    network({ confirm: () => jsonRes(404, { error: "draft_not_found" }) });
    await expect(
      removeApplicationPhoto(controller, "photos/d/1.jpg"),
    ).rejects.toMatchObject({ stage: "photo_remove", status: 404 });
  });
});
