import { getFirestoreAccessToken } from "./firestoreAdmin";

function safePath(path: string): string {
  const segments = path.split("/");
  if (segments.some((s) => s === ".." || s === "." || s === "")) {
    throw new Error(`Unsafe Firestore path segment in: ${path}`);
  }
  return segments.map(encodeURIComponent).join("/");
}

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
  const encoded = safePath(docPath);
  const token = await getFirestoreAccessToken();
  const res = await fetch(`${baseUrl()}/${encoded}`, {
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
  const encoded = safePath(docPath);
  const token = await getFirestoreAccessToken();
  const fieldNames = Object.keys(fields);
  const mask = fieldNames
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");

  const res = await fetch(`${baseUrl()}/${encoded}?${mask}`, {
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
  const encoded = safePath(collectionPath);
  const token = await getFirestoreAccessToken();
  const res = await fetch(`${baseUrl()}/${encoded}`, {
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
  const token = await getFirestoreAccessToken();
  const projectId = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  const queryUrl = `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents:runQuery`;

  const body = {
    structuredQuery: {
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
  };

  const res = await fetch(queryUrl, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`fsQuery ${collectionId}: ${res.status} ${text}`);
  }

  const results = (await res.json()) as Array<{
    document?: { name?: string; fields?: FirestoreFields };
  }>;
  return results
    .filter((r) => r.document?.fields)
    .map((r) => {
      const docName = r.document!.name ?? "";
      const id = docName.split("/").at(-1) ?? "";
      return { id, ...fromFields(r.document!.fields!) };
    });
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
    const url = new URL(`${baseUrl()}/${safePath(collectionId)}`);
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
  const encoded = safePath(docPath);
  const token = await getFirestoreAccessToken();
  const mask = fieldNames
    .map((f) => `updateMask.fieldPaths=${encodeURIComponent(f)}`)
    .join("&");

  // Sending an empty fields object with the updateMask removes those fields
  const res = await fetch(`${baseUrl()}/${encoded}?${mask}`, {
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
