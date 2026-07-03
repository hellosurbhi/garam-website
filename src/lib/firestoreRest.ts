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

function baseUrl(): string {
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!projectId) throw new Error("PUBLIC_FIREBASE_PROJECT_ID is required");
  return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents`;
}

/** Read a single document. Returns null if not found. */
export async function fsGet(
  docPath: string,
): Promise<Record<string, unknown> | null> {
  const token = await getFirestoreAccessToken();
  const res = await fetch(`${baseUrl()}/${docPath}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`fsGet ${docPath}: ${res.status}`);
  const doc = (await res.json()) as { fields?: FirestoreFields };
  return doc.fields ? fromFields(doc.fields) : {};
}

/** Update specific fields on an existing document. */
export async function fsPatch(
  docPath: string,
  fields: Record<string, unknown>,
): Promise<void> {
  const token = await getFirestoreAccessToken();
  const fieldNames = Object.keys(fields);
  const mask = fieldNames
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");

  const res = await fetch(`${baseUrl()}/${docPath}?${mask}`, {
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
