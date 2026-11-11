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
  epoch: 0,
  onDraftReset: () => () => {},
} as unknown as AutosaveController;

function pick(name: string) {
  return {
    target: {
      files: [new File(["x"], name, { type: "image/jpeg" })],
      value: "x",
    },
  } as unknown as ChangeEvent<HTMLInputElement>;
}

beforeEach(() => {
  upload.mockReset();
  remove.mockReset();
  remove.mockResolvedValue(undefined);
  vi.stubGlobal("URL", {
    ...URL,
    createObjectURL: () => "blob:x",
    revokeObjectURL: () => {},
  });
});

describe("usePhotoUploads: removing while an upload is in flight", () => {
  it("takes the photo off the draft once the upload lands", async () => {
    let finish!: (v: { path: string; epoch: number }) => void;
    upload.mockReturnValue(new Promise((r) => (finish = r)));
    const { result } = renderHook(() => usePhotoUploads(controller, vi.fn()));
    act(() => result.current.addPhotos(pick("a.jpg")));
    const id = result.current.items[0].id;
    act(() => result.current.removePhoto(id));
    expect(result.current.items).toHaveLength(0);
    expect(remove).not.toHaveBeenCalled();
    await act(async () => finish({ path: "photos/d/1-a.jpg", epoch: 0 }));
    expect(remove).toHaveBeenCalledWith(controller, "photos/d/1-a.jpg");
  });

  it("does not report a failed upload of a photo the applicant removed", async () => {
    let fail!: (e: Error) => void;
    upload.mockReturnValue(new Promise((_, rej) => (fail = rej)));
    const onFailed = vi.fn();
    const { result } = renderHook(() => usePhotoUploads(controller, onFailed));
    act(() => result.current.addPhotos(pick("a.jpg")));
    act(() => result.current.removePhoto(result.current.items[0].id));
    await act(async () => fail(new Error("boom")));
    expect(onFailed).not.toHaveBeenCalled();
  });

  it("settleForSubmit waits for the removal so a quick submit cannot file the photo", async () => {
    let finish!: (v: { path: string; epoch: number }) => void;
    upload.mockReturnValue(new Promise((r) => (finish = r)));
    let finishRemove!: () => void;
    remove.mockReturnValue(new Promise<void>((r) => (finishRemove = r)));
    const { result } = renderHook(() => usePhotoUploads(controller, vi.fn()));
    act(() => result.current.addPhotos(pick("a.jpg")));
    act(() => result.current.removePhoto(result.current.items[0].id));
    await act(async () => finish({ path: "photos/d/1-a.jpg", epoch: 0 }));
    let settled = false;
    const done = result.current.settleForSubmit().then(() => (settled = true));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(settled).toBe(false);
    await act(async () => {
      finishRemove();
      await done;
    });
    expect(settled).toBe(true);
  });

  it("settleForSubmit also waits for the removal of an already saved photo", async () => {
    upload.mockResolvedValue({ path: "photos/d/1-a.jpg", epoch: 0 });
    let finishRemove!: () => void;
    remove.mockReturnValue(new Promise<void>((r) => (finishRemove = r)));
    const { result } = renderHook(() => usePhotoUploads(controller, vi.fn()));
    await act(async () => result.current.addPhotos(pick("a.jpg")));
    act(() => result.current.removePhoto(result.current.items[0].id));
    let settled = false;
    const done = result.current.settleForSubmit().then(() => (settled = true));
    await act(async () => {
      await new Promise((r) => setTimeout(r, 20));
    });
    expect(settled).toBe(false);
    await act(async () => {
      finishRemove();
      await done;
    });
    expect(settled).toBe(true);
  });

  it("removes a saved photo straight away", async () => {
    upload.mockResolvedValue({ path: "photos/d/1-a.jpg", epoch: 0 });
    const { result } = renderHook(() => usePhotoUploads(controller, vi.fn()));
    await act(async () => result.current.addPhotos(pick("a.jpg")));
    expect(result.current.items[0].status).toBe("saved");
    act(() => result.current.removePhoto(result.current.items[0].id));
    expect(remove).toHaveBeenCalledWith(controller, "photos/d/1-a.jpg");
  });
});
