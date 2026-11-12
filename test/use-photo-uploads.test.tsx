import { describe, it, expect, vi, beforeEach } from "vitest";
import { act, renderHook } from "@testing-library/react";
import type { ChangeEvent } from "react";
import type { AutosaveController } from "@/lib/applyAutosave";

const upload = vi.hoisted(() => vi.fn());
const remove = vi.hoisted(() => vi.fn());
vi.mock("@/lib/applyPhotos", () => ({
  uploadApplicationPhoto: upload,
  removeApplicationPhoto: remove,
}));

import { usePhotoUploads } from "@/components/apply/usePhotoUploads";

const controller = {
  epoch: 1,
  onDraftReset: () => () => {},
} as unknown as AutosaveController;

function pick(file: File): ChangeEvent<HTMLInputElement> {
  return {
    target: { files: [file], value: "x" },
  } as unknown as ChangeEvent<HTMLInputElement>;
}

beforeEach(() => {
  vi.clearAllMocks();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  upload.mockResolvedValue({ path: "photos/d/1.jpg", epoch: 1 });
});

async function withSavedPhoto() {
  const hook = renderHook(() => usePhotoUploads(controller, vi.fn()));
  await act(async () => {
    hook.result.current.addPhotos(pick(new File(["a"], "a.jpg")));
  });
  await act(async () => {
    await hook.result.current.settleForSubmit();
  });
  expect(hook.result.current.items[0].status).toBe("saved");
  return hook;
}

describe("usePhotoUploads: removed photos", () => {
  it("a removal that failed is retried at submit and the submit goes on", async () => {
    const { result } = await withSavedPhoto();
    remove.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      result.current.removePhoto(result.current.items[0].id);
    });
    remove.mockResolvedValue(undefined);
    await act(async () => {
      await result.current.settleForSubmit();
    });
    expect(remove).toHaveBeenCalledTimes(2);
    expect(remove).toHaveBeenLastCalledWith(controller, "photos/d/1.jpg");
  });

  it("a removal that still fails at submit stops the submit instead of filing the photo", async () => {
    const { result } = await withSavedPhoto();
    remove.mockRejectedValue(new Error("offline"));
    await act(async () => {
      result.current.removePhoto(result.current.items[0].id);
    });
    await expect(
      act(async () => {
        await result.current.settleForSubmit();
      }),
    ).rejects.toThrow(/could not be taken off/);
  });

  it("a removal owed to a replaced draft is dropped, not retried", async () => {
    const { result } = await withSavedPhoto();
    remove.mockRejectedValueOnce(new Error("offline"));
    await act(async () => {
      result.current.removePhoto(result.current.items[0].id);
    });
    (controller as unknown as { epoch: number }).epoch = 2;
    try {
      await act(async () => {
        await result.current.settleForSubmit();
      });
      expect(remove).toHaveBeenCalledTimes(1);
    } finally {
      (controller as unknown as { epoch: number }).epoch = 1;
    }
  });

  it("a photo removed mid-upload whose cleanup fails is retried at submit", async () => {
    let finish: (v: { path: string; epoch: number }) => void = () => {};
    upload.mockReturnValue(new Promise((r) => (finish = r)));
    remove.mockRejectedValueOnce(new Error("offline"));
    const { result } = renderHook(() => usePhotoUploads(controller, vi.fn()));
    await act(async () => {
      result.current.addPhotos(pick(new File(["a"], "a.jpg")));
    });
    await act(async () => {
      result.current.removePhoto(result.current.items[0].id);
    });
    remove.mockResolvedValue(undefined);
    await act(async () => {
      finish({ path: "photos/d/9.jpg", epoch: 1 });
      await result.current.settleForSubmit();
    });
    expect(remove).toHaveBeenCalledTimes(2);
  });
});
