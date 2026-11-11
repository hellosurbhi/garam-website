import { z } from "zod";
import { fsGet, fsPatch } from "./firestoreRest";
import { getFirestoreAccessToken } from "./firestoreAdmin";
import { rankWaitlistCities, type CityWaitlistCount } from "./waitlistRanking";

const CACHE_PATH = "systemConfig/ticketWaitlistRanking";
const DAY_MS = 86_400_000;
const cacheSchema = z.object({
  updatedAt: z.number(),
  counts: z.array(
    z.object({ citySlug: z.string(), count: z.number().int().positive() }),
  ),
});
let pending: Promise<CityWaitlistCount[]> | undefined;
let lastGood: CityWaitlistCount[] | undefined;

/** Read the daily aggregate or refresh it from selected lead fields. Retain a valid old aggregate if refreshing fails. */
async function refresh(signal: AbortSignal): Promise<CityWaitlistCount[]> {
  const parsed = cacheSchema.safeParse(await fsGet(CACHE_PATH, signal));
  const cached = parsed.success ? parsed.data : undefined;
  signal.throwIfAborted();
  if (cached) lastGood = cached.counts;
  if (cached && Date.now() - cached.updatedAt < DAY_MS) return cached.counts;
  try {
    const token = await getFirestoreAccessToken(signal);
    signal.throwIfAborted();
    const project = import.meta.env.PUBLIC_FIREBASE_PROJECT_ID;
    if (!project) throw new Error("PUBLIC_FIREBASE_PROJECT_ID is required");
    const response = await fetch(
      `https://firestore.googleapis.com/v1/projects/${project}/databases/(default)/documents:runQuery`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        signal: AbortSignal.any([signal, AbortSignal.timeout(10_000)]),
        body: JSON.stringify({
          structuredQuery: {
            from: [{ collectionId: "leads" }],
            select: {
              fields: ["email", "city", "sourceCitySlug", "source"].map(
                (fieldPath) => ({ fieldPath }),
              ),
            },
          },
        }),
      },
    );
    if (!response.ok)
      throw new Error(`Waitlist query failed: ${response.status}`);
    const rows = z
      .array(
        z
          .object({
            document: z
              .object({
                fields: z
                  .record(
                    z.string(),
                    z
                      .object({ stringValue: z.string().optional() })
                      .passthrough(),
                  )
                  .optional(),
              })
              .optional(),
          })
          .passthrough(),
      )
      .parse(await response.json());
    const leads = rows
      .filter((row) => row.document)
      .map((row) =>
        Object.fromEntries(
          Object.entries(row.document?.fields ?? {}).map(([key, value]) => [
            key,
            value.stringValue ?? "",
          ]),
        ),
      );
    const counts = rankWaitlistCities(leads);
    signal.throwIfAborted();
    await fsPatch(CACHE_PATH, { updatedAt: Date.now(), counts }, signal);
    signal.throwIfAborted();
    lastGood = counts;
    return counts;
  } catch (error) {
    if (!cached) throw error;
    console.error(
      "[waitlist-ranking] Refresh failed; retaining last successful ranking",
      error instanceof Error ? error.message : "Unknown error",
    );
    return cached.counts;
  }
}

/** Share one bounded ranking lookup across concurrent requests and release it on settlement or deadline. */
export function getWaitlistRanking(): Promise<CityWaitlistCount[]> {
  if (pending) return pending;
  const controller = new AbortController();
  const work = refresh(controller.signal);
  let timer: ReturnType<typeof setTimeout>;
  const deadline = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      const error = new Error("Timeout: waitlist ranking (15000ms)");
      controller.abort(error);
      release();
      reject(error);
    }, 15_000);
  });
  const result = Promise.race([work, deadline]).catch((error: unknown) => {
    if (lastGood) {
      console.error(
        "[waitlist-ranking] Lookup failed; retaining cached ranking",
        error instanceof Error ? error.message : "Unknown error",
      );
      return lastGood;
    }
    throw error;
  });
  pending = result;
  // Release only this operation, so late settlement cannot unlock a newer refresh.
  const release = () => {
    clearTimeout(timer);
    if (pending === result) pending = undefined;
  };
  void work.then(release, release);
  return result;
}
