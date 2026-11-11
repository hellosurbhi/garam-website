import { randomUUID } from "node:crypto";
import { isSyntheticSubmission } from "../../src/lib/syntheticMonitor.ts";

const HOUR = 3_600_000;
export async function beginAttempt(store, runId, flow, attempt) {
  if (
    !runId ||
    !["application", "lead"].includes(flow) ||
    !Number.isInteger(attempt)
  )
    throw new Error("Invalid monitor attempt");
  const id = randomUUID();
  return store.create({
    id,
    email: `synthetic-monitor+${id}@garammasaladating.com`,
    runId,
    flow,
    attempt,
    photos: [],
    verified: false,
    failures: 0,
  });
}
export function validateLedger(ledger) {
  const d = ledger.data;
  if (
    !d ||
    !isSyntheticSubmission(d.email) ||
    d.email !== `synthetic-monitor+${d.id}@garammasaladating.com` ||
    !ledger.name.endsWith(`/syntheticRuns/${d.id}`) ||
    !["application", "lead"].includes(d.flow) ||
    !Array.isArray(d.photos) ||
    !Number.isFinite(Date.parse(ledger.createdAt))
  )
    throw new Error("Unverified cleanup ledger");
  for (const photo of d.photos)
    if (
      !/^photos\/[A-Za-z0-9._-]+$/.test(photo.path) ||
      typeof photo.owner !== "string" ||
      !photo.owner
    )
      throw new Error("Unverified upload evidence");
}
export function parseUpload(urlString, method, headers, body, bucket) {
  const url = new URL(urlString);
  if (url.hostname !== "firebasestorage.googleapis.com" || method !== "POST")
    return null;
  const protocol = headers["x-goog-upload-protocol"];
  if (headers["x-goog-upload-command"] !== "start" && protocol !== "multipart")
    return null;
  if (url.pathname !== `/v0/b/${bucket}/o`)
    throw new Error("Upload targets an unexpected bucket");
  let metadataBody = body ?? "";
  if (protocol === "multipart") {
    const boundary = headers["content-type"]?.match(
      /^multipart\/related;\s*boundary="?([A-Za-z0-9_-]{1,70})"?$/i,
    )?.[1];
    if (!boundary || !metadataBody.startsWith(`--${boundary}\r\n`))
      throw new Error("Unexpected multipart boundary");
    const separator = metadataBody.indexOf("\r\n\r\n");
    const end = metadataBody.indexOf(`\r\n--${boundary}\r\n`, separator + 4);
    if (
      separator < 0 ||
      end < 0 ||
      end > 65536 ||
      !metadataBody
        .slice(0, separator)
        .toLowerCase()
        .includes("content-type: application/json")
    )
      throw new Error("Unexpected multipart metadata");
    metadataBody = metadataBody.slice(separator + 4, end);
  } else if (protocol !== "resumable")
    throw new Error("Unexpected upload protocol");
  const metadata = JSON.parse(metadataBody);
  const path = metadata.name;
  const owner = metadata.metadata?.owner;
  if (url.searchParams.has("name") && url.searchParams.get("name") !== path)
    throw new Error("Upload path disagrees with metadata");
  if (
    !/^photos\/[A-Za-z0-9._-]+$/.test(path) ||
    typeof owner !== "string" ||
    !owner
  )
    throw new Error("Upload ownership metadata is missing");
  return { path, owner };
}
const journalWrites = new WeakMap();
export async function recordUpload(store, ledger, upload) {
  const previous = journalWrites.get(ledger) ?? Promise.resolve();
  const pending = previous.then(async () => {
    validateLedger(ledger);
    const prior = ledger.data.photos.find(
      (photo) => photo.path === upload.path,
    );
    if (prior && prior.owner !== upload.owner)
      throw new Error("Upload owner changed");
    const next = {
      ...ledger,
      data: {
        ...ledger.data,
        photos: prior
          ? [...ledger.data.photos]
          : [...ledger.data.photos, upload],
      },
    };
    validateLedger(next);
    await store.save(next);
    Object.assign(ledger, next);
  });
  journalWrites.set(ledger, pending);
  try {
    await pending;
  } finally {
    if (journalWrites.get(ledger) === pending) journalWrites.delete(ledger);
  }
}
export async function findAttempt(store, ledger) {
  validateLedger(ledger);
  return store.find(
    ledger.data.flow === "application" ? "applications" : "leads",
    ledger.data.flow === "application" ? "emailNormalized" : "email",
    ledger.data.email,
  );
}
export function validateDocument(doc, ledger, now) {
  validateLedger(ledger);
  const f = doc.fields ?? {};
  const email = (
    ledger.data.flow === "application" ? f.emailNormalized : f.email
  )?.stringValue;
  const created = Date.parse(doc.createTime);
  if (
    email !== ledger.data.email ||
    f.isSynthetic?.booleanValue !== true ||
    !Number.isFinite(created) ||
    created < Date.parse(ledger.createdAt) ||
    created > now + 1000 ||
    !doc.updateTime
  )
    throw new Error("Submission does not match this test attempt");
  if (f.email?.stringValue !== ledger.data.email)
    throw new Error("Submission email disagrees with cleanup identity");
  const paths = (f.photoPaths?.arrayValue?.values ?? []).map(
    (value) => value.stringValue,
  );
  if (
    paths.some(
      (path) => !ledger.data.photos.some((photo) => photo.path === path),
    )
  )
    throw new Error("Submission contains an unrecorded photo");
}
export async function verifyAttempt(store, ledger) {
  const docs = await findAttempt(store, ledger);
  if (!docs.length)
    throw new Error("This test submission has not reached the database");
  for (const doc of docs) validateDocument(doc, ledger, store.now());
  if (
    ledger.data.flow === "application" &&
    (!ledger.data.photos.length ||
      !docs.some((d) => d.fields.photoPaths?.arrayValue?.values?.length))
  )
    throw new Error("Test application did not save its photo");
  ledger.data.verified = true;
  await store.save(ledger);
}
export async function cleanAttempt(store, ledger) {
  validateLedger(ledger);
  const docs = await findAttempt(store, ledger);
  // Validate the entire attempt before making its first deletion.
  for (const doc of docs) validateDocument(doc, ledger, store.now());
  const photos = [];
  for (const evidence of ledger.data.photos) {
    const photo = await store.photo(evidence.path);
    if (!photo) continue;
    if (
      photo.metadata?.owner !== evidence.owner ||
      photo.name !== evidence.path ||
      !photo.generation
    )
      throw new Error("Photo ownership differs from recorded upload");
    photos.push({ path: evidence.path, generation: photo.generation });
  }
  for (const photo of photos)
    await store.deletePhoto(photo.path, photo.generation);
  for (const doc of docs) await store.deleteDoc(doc);
  if ((await findAttempt(store, ledger)).length)
    throw new Error("A late submission remains after cleanup");
  for (const evidence of ledger.data.photos)
    if (await store.photo(evidence.path))
      throw new Error("A late photo remains after cleanup");
  if (!ledger.data.cleanedAt || docs.length || photos.length)
    ledger.data.cleanedAt = store.now();
  ledger.data.failures = 0;
  delete ledger.data.retryAfter;
  await store.save(ledger);
}
export async function sweep(store, runId) {
  const ledgers = await store.ledgers();
  const errors = [];
  for (const ledger of ledgers) {
    try {
      validateLedger(ledger);
      const age = store.now() - Date.parse(ledger.createdAt);
      if (age < 0)
        throw new Error("Cleanup ledger has a future server timestamp");
      const current = ledger.data.runId === runId;
      if (!current && age < HOUR) continue;
      if (!current && (ledger.data.retryAfter ?? 0) > store.now()) {
        errors.push({
          id: ledger.data.id,
          error: "Cleanup quarantined pending daily retry",
        });
        continue;
      }
      await cleanAttempt(store, ledger);
      if (store.now() - ledger.data.cleanedAt >= 7 * 24 * HOUR)
        await store.deleteDoc(ledger);
    } catch (error) {
      let trusted = true;
      try {
        validateLedger(ledger);
      } catch {
        trusted = false;
      }
      const id = trusted
        ? ledger.data.id
        : (ledger.name ?? "unidentified-ledger");
      errors.push({
        id,
        error: error instanceof Error ? error.message : "Cleanup failed",
        escalated: !trusted || (ledger.data.failures ?? 0) + 1 === 3,
      });
      if (!trusted) continue;
      try {
        ledger.data.failures = (ledger.data.failures ?? 0) + 1;
        if (ledger.data.failures >= 3)
          ledger.data.retryAfter = store.now() + 24 * HOUR;
        await store.save(ledger);
      } catch {
        errors.push({
          id,
          error: "Could not persist cleanup failure",
          escalated: true,
        });
      }
    }
  }
  return errors;
}
