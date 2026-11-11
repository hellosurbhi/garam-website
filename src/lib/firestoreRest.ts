import { getFirestoreAccessToken } from "./firestoreAdmin";

type FirestoreValue =
  | { nullValue: null }
  | { booleanValue: boolean }
  | { integerValue: string }
  | { doubleValue: number }
  | { timestampValue: string }
  | { stringValue: string }
  | { arrayValue: { values: FirestoreValue[] } }
  | { mapValue: { fields: FirestoreFields } };

type FirestoreFields = Record<string, FirestoreValue>;

function toValue(v: unknown): FirestoreValue {
  if (v === null || v === undefined) return { nullValue: null };
  if (typeof v === "boolean") return { booleanValue: v };
  if (typeof v === "number") {
    return Number.isInteger(v)
      ? { integerValue: String(v) }
      : { doubleValue: v };
  }
  if (typeof v === "string") return { stringValue: v };
  if (v instanceof Date) return { timestampValue: v.toISOString() };
  if (Array.isArray(v))
    return { arrayValue: { values: v.map((item) => toValue(item)) } };
  if (typeof v === "object")
    return { mapValue: { fields: toFields(v as Record<string, unknown>) } };
  return { stringValue: String(v) };
}

function toFields(obj: Record<string, unknown>): FirestoreFields {
  return Object.fromEntries(
    Object.entries(obj).map(([k, v]) => [k, toValue(v)]),
  );
}

function fromValue(v: FirestoreValue): unknown {
  if ("nullValue" in v) return null;
  if ("booleanValue" in v) return v.booleanValue;
  if ("integerValue" in v) return Number(v.integerValue);
  if ("doubleValue" in v) return v.doubleValue;
  if ("timestampValue" in v) return v.timestampValue;
  if ("stringValue" in v) return v.stringValue;
  if ("arrayValue" in v)
    return (v.arrayValue.values ?? []).map((item) => fromValue(item));
  if ("mapValue" in v) return fromFields(v.mapValue.fields ?? {});
  return null;
}

function fromFields(fields: FirestoreFields): Record<string, unknown> {
  return Object.fromEntries(
    Object.entries(fields).map(([k, v]) => [k, fromValue(v)]),
  );
}

/** The resource name prefix, `projects/{id}/databases/(default)/documents`. */
function documentsRoot(): string {
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("PUBLIC_FIREBASE_PROJECT_ID is required");
  return `projects/${projectId}/databases/(default)/documents`;
}

function baseUrl(): string {
  return `https://firestore.googleapis.com/v1/${documentsRoot()}`;
}

interface RawDocument {
  fields?: FirestoreFields;
  updateTime?: string;
}

/** GET one document; null on 404. `label` names the caller in errors. */
async function getRawDocument(
  label: string,
  docPath: string,
  headers: Record<string, string>,
  signal?: AbortSignal,
): Promise<RawDocument | null> {
  signal?.throwIfAborted();
  const res = await fetch(`${baseUrl()}/${docPath}`, { signal, headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`${label} ${docPath}: ${res.status}`);
  return (await res.json()) as RawDocument;
}

/** A document's decoded fields plus its `updateTime`, the optimistic-lock token. */
export interface FsDocument {
  fields: Record<string, unknown>;
  updateTime: string;
}

function toFsDocument(label: string, docPath: string, raw: RawDocument) {
  if (!raw.updateTime) {
    throw new Error(`${label} ${docPath}: response has no updateTime`);
  }
  return {
    fields: raw.fields ? fromFields(raw.fields) : {},
    updateTime: raw.updateTime,
  } satisfies FsDocument;
}

/** Read a single document. Returns null if not found. */
export async function fsGet(
  docPath: string,
  signal?: AbortSignal,
): Promise<Record<string, unknown> | null> {
  const token = await getFirestoreAccessToken(signal);
  const doc = await getRawDocument(
    "fsGet",
    docPath,
    { Authorization: `Bearer ${token}` },
    signal,
  );
  if (!doc) return null;
  return doc.fields ? fromFields(doc.fields) : {};
}

/**
 * Read a document with its `updateTime`, for a later `fsCommit` precondition
 * (read, validate, then write only if nobody changed it in between).
 */
export async function fsGetDocument(
  docPath: string,
  signal?: AbortSignal,
): Promise<FsDocument | null> {
  const token = await getFirestoreAccessToken(signal);
  const doc = await getRawDocument(
    "fsGetDocument",
    docPath,
    { Authorization: `Bearer ${token}` },
    signal,
  );
  return doc ? toFsDocument("fsGetDocument", docPath, doc) : null;
}

/**
 * Read a publicly readable document with no credentials.
 *
 * WHY no service-account token: the runtime show list must keep working when
 * the admin credentials are missing or the token exchange is down, and the
 * rules already make `eventsPublished` public (plan section 3). Use it only
 * for collections whose rules say `allow read: if true`; anything else gets
 * a 403 here. The caller owns the deadline through `signal`.
 */
export async function fsGetPublic(
  docPath: string,
  signal?: AbortSignal,
): Promise<FsDocument | null> {
  const doc = await getRawDocument("fsGetPublic", docPath, {}, signal);
  return doc ? toFsDocument("fsGetPublic", docPath, doc) : null;
}

/** Commit precondition: the document must (not) exist, or be unchanged since `updateTime`. */
export type FsPrecondition = { exists: boolean } | { updateTime: string };

export interface FsWrite {
  docPath: string;
  fields: Record<string, unknown>;
  /** true: change only the given fields (PATCH). Omitted: replace the document. */
  merge?: boolean;
  precondition?: FsPrecondition;
}

/**
 * A commit refused because a precondition no longer held: someone else wrote
 * first. The caller should reload and retry, never overwrite.
 */
export class CommitConflictError extends Error {
  constructor(
    readonly status: string,
    message: string,
  ) {
    super(message);
    this.name = "CommitConflictError";
  }
}

// WHY classify by the canonical `error.status` string, not the HTTP code:
// Firestore reports a failed `exists:false` or `updateTime` precondition with
// different HTTP codes depending on the case and the API surface (400, 409,
// 412), while the canonical status is stable (plan R9). ABORTED is a
// contention abort, the same "someone else wrote first" situation.
const CONFLICT_STATUSES = new Set([
  "FAILED_PRECONDITION",
  "ALREADY_EXISTS",
  "ABORTED",
]);

function canonicalStatus(body: string): string | undefined {
  // WHY the try: a proxy or outage can answer with HTML instead of the JSON
  // error envelope. That is not a conflict, so it falls through to the
  // generic error below, which carries the raw body for diagnosis.
  try {
    const parsed: unknown = JSON.parse(body);
    if (typeof parsed !== "object" || parsed === null) return undefined;
    const error: unknown = (parsed as { error?: unknown }).error;
    if (typeof error !== "object" || error === null) return undefined;
    const status: unknown = (error as { status?: unknown }).status;
    return typeof status === "string" ? status : undefined;
  } catch {
    return undefined;
  }
}

/** Map a failed commit response to a CommitConflictError or a plain Error. */
export function commitFailure(httpStatus: number, body: string): Error {
  const status = canonicalStatus(body);
  const message = `fsCommit: ${httpStatus} ${body}`;
  return status && CONFLICT_STATUSES.has(status)
    ? new CommitConflictError(status, message)
    : new Error(message);
}

/**
 * Apply several writes atomically: all of them land or none do. Each write
 * can carry a precondition, which is how a publish swaps the live pointer
 * only if it is still the version that was read. Throws CommitConflictError
 * when a precondition fails.
 */
export async function fsCommit(
  writes: FsWrite[],
  signal?: AbortSignal,
): Promise<void> {
  const token = await getFirestoreAccessToken(signal);
  const root = documentsRoot();
  const body = {
    writes: writes.map((w) => ({
      update: { name: `${root}/${w.docPath}`, fields: toFields(w.fields) },
      ...(w.merge ? { updateMask: { fieldPaths: Object.keys(w.fields) } } : {}),
      ...(w.precondition ? { currentDocument: w.precondition } : {}),
    })),
  };
  signal?.throwIfAborted();
  const res = await fetch(`${baseUrl()}:commit`, {
    signal,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw commitFailure(res.status, await res.text());
}

/**
 * POSTs one structured query to :runQuery and returns each matched
 * document's id and raw fields (undefined when Firestore sent none).
 * Shared by fsQuery and fsQueryOrdered so auth, errors and parsing live in
 * one place.
 */
async function runQuery(
  structuredQuery: Record<string, unknown>,
  label: string,
  signal?: AbortSignal,
): Promise<Array<{ id: string; fields?: FirestoreFields }>> {
  const token = await getFirestoreAccessToken(signal);
  signal?.throwIfAborted();
  const res = await fetch(`${baseUrl()}:runQuery`, {
    signal,
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ structuredQuery }),
  });
  if (!res.ok) throw new Error(`${label}: ${res.status} ${await res.text()}`);
  const rows = (await res.json()) as Array<{
    document?: { name?: string; fields?: FirestoreFields };
  }>;
  return rows.flatMap(({ document }) =>
    document
      ? [
          {
            id: document.name?.split("/").at(-1) ?? "",
            fields: document.fields,
          },
        ]
      : [],
  );
}

export interface FsOrderedQuery {
  collectionId: string;
  orderBy: string;
  direction: "ASCENDING" | "DESCENDING";
  limit: number;
  /** Return only these fields (a projection), e.g. to skip a large blob. */
  select?: string[];
}

/**
 * The first `limit` documents of a collection in `orderBy` order, each with
 * its id. Unlike fsQuery it needs no equality filter, so it serves "latest N"
 * listings such as the Shows history.
 */
export async function fsQueryOrdered(
  query: FsOrderedQuery,
  signal?: AbortSignal,
): Promise<Array<{ id: string; fields: Record<string, unknown> }>> {
  const rows = await runQuery(
    {
      from: [{ collectionId: query.collectionId }],
      orderBy: [
        { field: { fieldPath: query.orderBy }, direction: query.direction },
      ],
      limit: query.limit,
      ...(query.select
        ? {
            select: {
              fields: query.select.map((fieldPath) => ({ fieldPath })),
            },
          }
        : {}),
    },
    `fsQueryOrdered ${query.collectionId}`,
    signal,
  );
  return rows.map(({ id, fields }) => ({
    id,
    fields: fromFields(fields ?? {}),
  }));
}

/** Update specific fields on an existing document. */
export async function fsPatch(
  docPath: string,
  fields: Record<string, unknown>,
  signal?: AbortSignal,
): Promise<void> {
  const token = await getFirestoreAccessToken(signal);
  const fieldNames = Object.keys(fields);
  const mask = fieldNames
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");

  signal?.throwIfAborted();
  const res = await fetch(`${baseUrl()}/${docPath}?${mask}`, {
    signal,
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFields(fields) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fsPatch ${docPath}: ${res.status} ${body}`);
  }
}

/** Add a new document to a collection. Returns the generated document ID. */
export async function fsAdd(
  collectionPath: string,
  fields: Record<string, unknown>,
): Promise<string> {
  const token = await getFirestoreAccessToken();
  const res = await fetch(`${baseUrl()}/${collectionPath}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: toFields(fields) }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fsAdd ${collectionPath}: ${res.status} ${body}`);
  }
  const doc = (await res.json()) as { name?: string };
  const name = doc.name ?? "";
  return name.split("/").at(-1) ?? "";
}

/**
 * Query a collection for documents where a field equals a value.
 * Returns an array of { id, ...fields } objects, ordered by `orderField` descending.
 */
export async function fsQuery(
  collectionId: string,
  filterField: string,
  filterValue: unknown,
  orderField = "submittedAt",
): Promise<Array<Record<string, unknown>>> {
  const rows = await runQuery(
    {
      from: [{ collectionId }],
      where: {
        fieldFilter: {
          field: { fieldPath: filterField },
          op: "EQUAL",
          value: toValue(filterValue),
        },
      },
      orderBy: [
        {
          field: { fieldPath: orderField },
          direction: "DESCENDING",
        },
      ],
    },
    `fsQuery ${collectionId}`,
  );
  return rows.flatMap(({ id, fields }) =>
    fields ? [{ id, ...fromFields(fields) }] : [],
  );
}

/**
 * Delete specific fields from a document using the PATCH + updateMask trick
 * with a DELETE_FIELD sentinel in the request body.
 * Pass `null` for each field you want to delete — this maps to
 * Firestore's `__delete__` transform via the updateMask approach.
 */
/**
 * List all documents in a collection, handling Firestore pagination automatically.
 * Returns up to ~10,000 documents in practice (300 per page).
 */
export async function fsListAll(
  collectionId: string,
): Promise<Array<Record<string, unknown>>> {
  const token = await getFirestoreAccessToken();
  const results: Array<Record<string, unknown>> = [];
  let pageToken: string | undefined;

  do {
    const url = new URL(`${baseUrl()}/${collectionId}`);
    url.searchParams.set("pageSize", "300");
    if (pageToken) url.searchParams.set("pageToken", pageToken);

    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`fsListAll ${collectionId}: ${res.status} ${text}`);
    }

    const data = (await res.json()) as {
      documents?: Array<{ name?: string; fields?: FirestoreFields }>;
      nextPageToken?: string;
    };

    for (const doc of data.documents ?? []) {
      if (!doc.fields) continue;
      const docName = doc.name ?? "";
      const id = docName.split("/").at(-1) ?? "";
      results.push({ id, ...fromFields(doc.fields) });
    }

    pageToken = data.nextPageToken;
  } while (pageToken);

  return results;
}

export async function fsDeleteFields(
  docPath: string,
  fieldNames: string[],
): Promise<void> {
  const token = await getFirestoreAccessToken();
  const mask = fieldNames
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");

  // Sending an empty fields object with the updateMask removes those fields
  const res = await fetch(`${baseUrl()}/${docPath}?${mask}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields: {} }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`fsDeleteFields ${docPath}: ${res.status} ${body}`);
  }
}
