import { createHash } from "node:crypto";
import { getFirestoreAccessToken } from "@/lib/firestoreAdmin";

export type Versioned<T> = { value: T; version: string };
export interface Store {
  get<T>(key: string): Promise<Versioned<T> | null>;
  put<T>(key: string, value: T, version: string | null): Promise<boolean>;
  list<T>(collection: string): Promise<Array<Versioned<T> & { id: string }>>;
}
export const fingerprint = (text: string) =>
  createHash("sha256").update(text).digest("hex");
const root = () => {
  const project = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
  if (!project) throw new Error("Firebase project is not configured");
  return `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents`;
};
async function request(url: string, init: RequestInit = {}) {
  const token = await getFirestoreAccessToken();
  return fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    signal: AbortSignal.timeout(15000),
  });
}
type Document = {
  name: string;
  updateTime: string;
  fields?: { payload?: { stringValue?: string } };
};
function decode<T>(doc: Document): Versioned<T> {
  const payload = doc.fields?.payload?.stringValue;
  if (!payload || !doc.updateTime)
    throw new Error("Invalid email record; repair required");
  // Only this server writes these collections; Firestore client rules deny access.
  const value: T = JSON.parse(payload);
  return { value, version: doc.updateTime };
}
export const store: Store = {
  async get<T>(key: string) {
    const res = await request(`${root()}/${key}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Email storage read failed (${res.status})`);
    return decode<T>(await res.json());
  },
  async put<T>(key: string, value: T, version: string | null) {
    const condition = version
      ? `currentDocument.updateTime=${encodeURIComponent(version)}`
      : "currentDocument.exists=false";
    const res = await request(`${root()}/${key}?${condition}`, {
      method: "PATCH",
      body: JSON.stringify({
        fields: { payload: { stringValue: JSON.stringify(value) } },
      }),
    });
    if ([409, 412].includes(res.status)) return false;
    if (!res.ok) throw new Error(`Email storage write failed (${res.status})`);
    return true;
  },
  async list<T>(collection: string) {
    const rows: Array<Versioned<T> & { id: string }> = [];
    let pageToken = "";
    do {
      const qs = new URLSearchParams({ pageSize: "300" });
      if (pageToken) qs.set("pageToken", pageToken);
      const res = await request(`${root()}/${collection}?${qs}`);
      if (!res.ok) throw new Error(`Email storage list failed (${res.status})`);
      const data: { documents?: Document[]; nextPageToken?: string } =
        await res.json();
      for (const doc of data.documents ?? [])
        rows.push({ ...decode<T>(doc), id: doc.name.split("/").at(-1)! });
      pageToken = data.nextPageToken ?? "";
    } while (pageToken);
    return rows;
  },
};
