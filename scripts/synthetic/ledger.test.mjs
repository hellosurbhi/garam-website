// @vitest-environment node
import { describe, it, expect, vi } from "vitest";
import {
  beginAttempt,
  cleanAttempt,
  parseUpload,
  recordUpload,
  sweep,
  verifyAttempt,
} from "./ledger.mjs";

function fixture() {
  const now = Date.parse("2026-11-11T12:00:00Z");
  const id = "01234567-89ab-4cde-8fab-0123456789ab";
  const email = `synthetic-monitor+${id}@garammasaladating.com`;
  const ledger = {
    name: `projects/demo/databases/(default)/documents/syntheticRuns/${id}`,
    createdAt: new Date(now - 7200000).toISOString(),
    updateTime: new Date(now).toISOString(),
    data: {
      id,
      email,
      flow: "application",
      runId: "run",
      photos: [{ path: "photos/test.jpg", owner: "uploader" }],
    },
  };
  let docs = [
    {
      name: "projects/demo/databases/(default)/documents/applications/test",
      createTime: new Date(now - 3600000).toISOString(),
      updateTime: new Date(now).toISOString(),
      fields: {
        email: { stringValue: email },
        emailNormalized: { stringValue: email },
        isSynthetic: { booleanValue: true },
        photoPaths: {
          arrayValue: { values: [{ stringValue: "photos/test.jpg" }] },
        },
      },
    },
  ];
  let photo = {
    name: "photos/test.jpg",
    generation: "123",
    metadata: { owner: "uploader" },
  };
  const store = {
    now: () => now,
    find: vi.fn(async () => docs),
    photo: vi.fn(async () => photo),
    save: vi.fn(async (l) => l),
    deleteDoc: vi.fn(async () => {
      docs = [];
    }),
    deletePhoto: vi.fn(async () => {
      photo = null;
    }),
    ledgers: vi.fn(async () => [ledger]),
    create: vi.fn(async (data) => ({ data })),
  };
  return { store, ledger, docs, photo };
}
describe("durable synthetic cleanup", () => {
  it("gives retries independent identities and ledgers", async () => {
    const { store } = fixture();
    const first = await beginAttempt(store, "run", "lead", 0);
    const second = await beginAttempt(store, "run", "lead", 1);
    expect(first.data.email).not.toBe(second.data.email);
    expect(second.data.attempt).toBe(1);
  });
  it("persists ownership before the caller may forward an upload", async () => {
    const { store, ledger } = fixture();
    store.save.mockRejectedValue(new Error("journal unavailable"));
    await expect(
      recordUpload(store, ledger, {
        path: "photos/second.jpg",
        owner: "uploader",
      }),
    ).rejects.toThrow("journal unavailable");
  });
  it("parses the resumable SDK metadata and fails closed on missing owner", () => {
    const url =
      "https://firebasestorage.googleapis.com/v0/b/demo.appspot.com/o?name=photos/test.jpg";
    const headers = {
      "x-goog-upload-command": "start",
      "x-goog-upload-protocol": "resumable",
    };
    expect(
      parseUpload(
        url,
        "POST",
        headers,
        JSON.stringify({
          name: "photos/test.jpg",
          metadata: { owner: "uploader" },
        }),
        "demo.appspot.com",
      ),
    ).toEqual({ path: "photos/test.jpg", owner: "uploader" });
    expect(() =>
      parseUpload(url, "POST", headers, "{}", "demo.appspot.com"),
    ).toThrow();
  });
  it("does not accept an earlier attempt's document", async () => {
    const { store, ledger, docs } = fixture();
    docs[0].fields.emailNormalized.stringValue =
      "synthetic-monitor@garammasaladating.com";
    await expect(verifyAttempt(store, ledger)).rejects.toThrow(
      "does not match",
    );
    expect(store.save).not.toHaveBeenCalled();
  });
  it("refuses customer flags, unjournaled photos and changed ownership", async () => {
    for (const kind of ["email", "marker", "photo", "owner"]) {
      const { store, ledger, docs, photo } = fixture();
      if (kind === "email")
        docs[0].fields.email.stringValue = "customer@example.com";
      if (kind === "marker") docs[0].fields.isSynthetic.booleanValue = false;
      if (kind === "photo")
        docs[0].fields.photoPaths.arrayValue.values[0].stringValue =
          "photos/customer.jpg";
      if (kind === "owner") photo.metadata.owner = "someone-else";
      await expect(cleanAttempt(store, ledger)).rejects.toThrow();
      expect(store.deleteDoc).not.toHaveBeenCalled();
      expect(store.deletePhoto).not.toHaveBeenCalled();
    }
  });
  it("removes a crash orphan even when no application was written", async () => {
    const { store, ledger } = fixture();
    store.find.mockResolvedValue([]);
    await cleanAttempt(store, ledger);
    expect(store.deletePhoto).toHaveBeenCalledWith("photos/test.jpg", "123");
    expect(store.deleteDoc).not.toHaveBeenCalled();
    expect(ledger.data.cleanedAt).toBe(store.now());
  });
  it("checks absence and catches a late write", async () => {
    const { store, ledger, docs } = fixture();
    store.find.mockResolvedValue(docs);
    await expect(cleanAttempt(store, ledger)).rejects.toThrow(
      "late submission",
    );
    expect(ledger.data.cleanedAt).toBeUndefined();
  });
  it("retries missing objects idempotently", async () => {
    const { store, ledger } = fixture();
    await cleanAttempt(store, ledger);
    await cleanAttempt(store, ledger);
    expect(store.deletePhoto).toHaveBeenCalledTimes(1);
  });
  it("continues other ledgers after a refusal and preserves failed evidence", async () => {
    const { store, ledger } = fixture();
    store.ledgers.mockResolvedValue([
      { ...ledger, data: { ...ledger.data, email: "customer@example.com" } },
      ledger,
    ]);
    const errors = await sweep(store, "run");
    expect(errors.length).toBeGreaterThan(0);
    expect(store.deletePhoto).toHaveBeenCalledTimes(1);
  });
  it("does not expire failed evidence or silently recover quarantined cleanup", async () => {
    const { store, ledger } = fixture();
    ledger.data.failures = 3;
    ledger.data.retryAfter = store.now() + 86400000;
    const errors = await sweep(store, "another-run");
    expect(errors[0].error).toContain("quarantined");
    expect(store.deleteDoc).not.toHaveBeenCalled();
  });
});
