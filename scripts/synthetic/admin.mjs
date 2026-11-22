import { getServiceAccountToken } from "../lib/google-access-token.mjs";

/** Secrets pasted with a trailing newline or a literal "\n" still work. */
export const trimmed = (value) => value?.trim().replace(/\\n$/, "");
export async function createAdmin(env = process.env, fetchImpl = fetch) {
  const project = trimmed(env.FIREBASE_PROJECT_ID);
  const bucket = trimmed(env.FIREBASE_STORAGE_BUCKET);
  const email = trimmed(env.FIREBASE_ADMIN_CLIENT_EMAIL);
  const key = env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!project || !bucket || !email || !key)
    throw new Error("Monitor administrator configuration is incomplete");
  if (!/^[a-z0-9-]+$/.test(project) || !/^[a-z0-9.-]+$/.test(bucket))
    throw new Error("Invalid monitor project or bucket");
  const token = await getServiceAccountToken({
    email,
    privateKey: key,
    scopes: [
      "https://www.googleapis.com/auth/datastore",
      "https://www.googleapis.com/auth/devstorage.read_write",
    ],
    label: "Monitor",
    fetchImpl,
  });
  return createStore(project, bucket, token, fetchImpl);
}

export function createStore(project, bucket, token, fetchImpl) {
  const root = `projects/${project}/databases/(default)/documents`;
  const base = `https://firestore.googleapis.com/v1/${root}`;
  let serverNow = 0;
  async function request(url, init = {}, missing = false) {
    const response = await fetchImpl(url, {
      ...init,
      redirect: "error",
      signal: AbortSignal.timeout(10_000),
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const date = Date.parse(response.headers.get("date") ?? "");
    if (Number.isFinite(date)) serverNow = date;
    if (missing && response.status === 404) return null;
    if (!response.ok)
      throw new Error(`Monitor storage request failed (${response.status})`);
    return response.status === 204 ? null : response.json();
  }
  function documentUrl(name) {
    if (
      !name.startsWith(`${root}/`) ||
      name.includes("..") ||
      name.split("/").length !== 7
    )
      throw new Error("Document is outside the monitor project");
    return `https://firestore.googleapis.com/v1/${name}`;
  }
  const store = {
    bucket,
    root,
    now() {
      if (!serverNow) throw new Error("Server time unavailable");
      return serverNow;
    },
    async create(data) {
      const name = `${root}/syntheticRuns/${data.id}`;
      const result = await request(`${base}:commit`, {
        method: "POST",
        body: JSON.stringify({
          writes: [
            {
              update: {
                name,
                fields: { data: { stringValue: JSON.stringify(data) } },
              },
              currentDocument: { exists: false },
              updateTransforms: [
                { fieldPath: "createdAt", setToServerValue: "REQUEST_TIME" },
              ],
            },
          ],
        }),
      });
      return {
        name,
        updateTime: result.writeResults[0].updateTime,
        createdAt: result.commitTime,
        data,
      };
    },
    async save(ledger) {
      const result = await request(`${base}:commit`, {
        method: "POST",
        body: JSON.stringify({
          writes: [
            {
              update: {
                name: ledger.name,
                fields: { data: { stringValue: JSON.stringify(ledger.data) } },
              },
              updateMask: { fieldPaths: ["data"] },
              currentDocument: { updateTime: ledger.updateTime },
            },
          ],
        }),
      });
      ledger.updateTime = result.writeResults[0].updateTime;
      return ledger;
    },
    async ledgers() {
      const result = [];
      let pageToken;
      for (let page = 0; page < 20; page++) {
        const query = new URLSearchParams({ pageSize: "100" });
        if (pageToken) query.set("pageToken", pageToken);
        const data = await request(`${base}/syntheticRuns?${query}`);
        for (const doc of data.documents ?? []) {
          let value = null;
          try {
            value = JSON.parse(doc.fields?.data?.stringValue ?? "null");
          } catch {
            /* Invalid evidence is returned for isolated refusal, never deleted. */
          }
          result.push({
            name: doc.name,
            updateTime: doc.updateTime,
            createdAt: doc.fields?.createdAt?.timestampValue,
            data: value,
          });
        }
        pageToken = data.nextPageToken;
        if (!pageToken) return result;
      }
      throw new Error(
        "Cleanup ledger page limit reached; investigation required",
      );
    },
    async find(collection, field, email) {
      if (
        !["applications", "leads"].includes(collection) ||
        !["emailNormalized", "email"].includes(field)
      )
        throw new Error("Invalid synthetic query");
      const docs = [];
      let cursor;
      for (let page = 0; page < 20; page++) {
        const structuredQuery = {
          from: [{ collectionId: collection }],
          where: {
            fieldFilter: {
              field: { fieldPath: field },
              op: "EQUAL",
              value: { stringValue: email },
            },
          },
          orderBy: [
            { field: { fieldPath: "__name__" }, direction: "ASCENDING" },
          ],
          limit: 100,
          ...(cursor
            ? {
                startAt: {
                  values: [{ referenceValue: cursor }],
                  before: false,
                },
              }
            : {}),
        };
        const rows = await request(`${base}:runQuery`, {
          method: "POST",
          body: JSON.stringify({ structuredQuery }),
        });
        const batch = rows.flatMap((row) =>
          row.document ? [row.document] : [],
        );
        docs.push(...batch);
        if (batch.length < 100) return docs;
        cursor = batch.at(-1).name;
      }
      throw new Error("Synthetic query page limit reached");
    },
    getDoc(name) {
      return request(documentUrl(name), {}, true);
    },
    async deleteDoc(doc) {
      await request(
        `${documentUrl(doc.name)}?${new URLSearchParams({ "currentDocument.updateTime": doc.updateTime })}`,
        { method: "DELETE" },
        true,
      );
      if (await store.getDoc(doc.name))
        throw new Error("Document remains after cleanup");
    },
    photo(path) {
      if (!/^photos\/[A-Za-z0-9._-]+$/.test(path))
        throw new Error("Unsafe photo path");
      return request(
        `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}`,
        {},
        true,
      );
    },
    async deletePhoto(path, generation) {
      if (!/^photos\/[A-Za-z0-9._-]+$/.test(path) || !/^\d+$/.test(generation))
        throw new Error("Unsafe photo deletion");
      // WHY: administrator OAuth uses the GCS JSON API, not Firebase's client API.
      await request(
        `https://storage.googleapis.com/storage/v1/b/${bucket}/o/${encodeURIComponent(path)}?ifGenerationMatch=${generation}`,
        { method: "DELETE" },
        true,
      );
      if (await store.photo(path))
        throw new Error("Photo remains after cleanup");
    },
  };
  return store;
}
