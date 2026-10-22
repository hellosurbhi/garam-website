import { describe, it, expect, vi, afterEach } from "vitest";
import { compressImage } from "./compressImage";

function makeFile(
  size: number,
  name = "photo.heic",
  type = "image/heic",
): File {
  return new File([new ArrayBuffer(size)], name, { type });
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("compressImage", () => {
  it("returns small files untouched (already cheap to upload)", async () => {
    const file = makeFile(100 * 1024);
    await expect(compressImage(file)).resolves.toBe(file);
  });

  it("falls back to the original file when decoding fails", async () => {
    // jsdom has no createImageBitmap; this is exactly the "browser can't
    // decode this format" path, which must never lose the submission.
    const file = makeFile(5 * 1024 * 1024);
    await expect(compressImage(file)).resolves.toBe(file);
  });

  it("falls back to the original when the encoder returns nothing", async () => {
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close: vi.fn() }),
    );
    const toBlob = vi
      .fn()
      .mockImplementation((cb: (b: Blob | null) => void) => cb(null));
    vi.spyOn(document, "createElement").mockReturnValue({
      getContext: () => ({ drawImage: vi.fn() }),
      toBlob,
      width: 0,
      height: 0,
    } as unknown as HTMLCanvasElement);

    const file = makeFile(5 * 1024 * 1024);
    await expect(compressImage(file)).resolves.toBe(file);
    expect(toBlob).toHaveBeenCalledWith(
      expect.any(Function),
      "image/jpeg",
      0.85,
    );
    vi.restoreAllMocks();
  });

  it("returns a resized jpeg File when encoding succeeds", async () => {
    const close = vi.fn();
    vi.stubGlobal(
      "createImageBitmap",
      vi.fn().mockResolvedValue({ width: 4000, height: 3000, close }),
    );
    const drawImage = vi.fn();
    const compressed = new Blob([new ArrayBuffer(200 * 1024)], {
      type: "image/jpeg",
    });
    const canvas = {
      width: 0,
      height: 0,
      getContext: () => ({ drawImage }),
      toBlob: (cb: (b: Blob | null) => void) => cb(compressed),
    };
    vi.spyOn(document, "createElement").mockReturnValue(
      canvas as unknown as HTMLCanvasElement,
    );

    const result = await compressImage(makeFile(5 * 1024 * 1024));
    // 4000x3000 capped at 2048 long edge keeps aspect ratio
    expect(canvas.width).toBe(2048);
    expect(canvas.height).toBe(1536);
    expect(drawImage).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(result.type).toBe("image/jpeg");
    expect(result.name).toBe("photo.jpg");
    expect(result.size).toBe(compressed.size);
    vi.restoreAllMocks();
  });
});
