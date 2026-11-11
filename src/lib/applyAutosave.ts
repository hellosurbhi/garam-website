/**
 * Client autosave for the apply form: every field is filed with our server as
 * the person types, so a half-finished form still reaches us.
 *
 * Contract with /api/save-application:
 *  - the first save mints a draft and returns a capability token;
 *  - every request carries a monotonically increasing `rev`, and the server
 *    ignores a field whose stored rev is newer (a delayed request can never
 *    overwrite newer answers);
 *  - requests are serial (one in flight), retried with backoff until the
 *    server acknowledges, and unacknowledged fields survive a reload because
 *    they sit in localStorage (with an in-memory fallback for browsers that
 *    block storage, e.g. some in-app browsers).
 */

export type FieldValue = string | boolean | number | null;
export type FieldMap = Record<string, FieldValue>;

/** A failed request with everything an alert needs to name the real cause. */
export class ApplyRequestError extends Error {
  readonly stage: string;
  readonly status: number | null;
  readonly detail: string;
  constructor(stage: string, status: number | null, detail: string) {
    super(
      status === null
        ? `${stage}: ${detail}`
        : `${stage}: HTTP ${status}: ${detail}`,
    );
    this.stage = stage;
    this.status = status;
    this.detail = detail;
  }
}

const STORAGE_KEY = "apply-draft-v2";
const DEBOUNCE_MS = 800;
const BACKOFF_MS = [1_000, 2_000, 4_000, 8_000, 15_000, 30_000];
const REQUEST_TIMEOUT_MS = 20_000;
/** Browsers cap keepalive request bodies at 64KB. */
const KEEPALIVE_MAX_BYTES = 60_000;
/** Consecutive failures before the controller reports a persistent problem. */
const PERSISTENT_FAILURE_AFTER = 3;

interface Persisted {
  token: string | null;
  draftId: string | null;
  rev: number;
  pending: FieldMap;
  /** Every field value ever set, so a 401 after a reload can rebuild the draft. */
  latest: FieldMap;
}

// WHY try/catch around every storage touch: Safari private mode and several
// in-app browsers throw on localStorage access. Autosave must keep working in
// memory rather than die on the exception.
function readStore(): Persisted | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      token: typeof parsed.token === "string" ? parsed.token : null,
      draftId: typeof parsed.draftId === "string" ? parsed.draftId : null,
      rev: typeof parsed.rev === "number" ? parsed.rev : 0,
      pending:
        parsed.pending && typeof parsed.pending === "object"
          ? (parsed.pending as FieldMap)
          : {},
      latest:
        parsed.latest && typeof parsed.latest === "object"
          ? (parsed.latest as FieldMap)
          : {},
    };
  } catch {
    return null;
  }
}

function writeStore(state: Persisted | null): void {
  try {
    if (state) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } else {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch {
    // Memory copy in the controller remains the source of truth.
  }
}

export interface AutosaveOptions {
  /** Called once after repeated failures so the hook can raise an alert. */
  onPersistentFailure?: (error: ApplyRequestError, attempts: number) => void;
  /** Injected in tests. */
  fetchImpl?: typeof fetch;
}

/**
 * The draft this controller was filing to was replaced (token rejected). Not
 * an applicant-facing failure: finalize re-settles photos and tries again.
 */
export class DraftResetError extends Error {
  constructor() {
    super("the draft was reset while finalizing");
  }
}

const MAX_FINALIZE_ROUNDS = 4;

interface SaveResponse {
  ok?: boolean;
  draftId?: string;
  token?: string;
  /** Highest revision the server holds for this draft. */
  maxRev?: number;
  /** Fields the server refused because it holds a newer revision. */
  stale?: string[];
  /** The server dropped text because the draft hit its size budget. */
  capped?: boolean;
  status?: string;
  error?: string;
  reason?: string;
  detail?: string;
  stage?: string;
}

export class AutosaveController {
  private token: string | null = null;
  draftId: string | null = null;
  private rev = 0;
  /** Latest value of every field ever set, to resend on a fresh draft. */
  private latest: FieldMap = {};
  /** Fields not yet acknowledged by the server. */
  private pending: FieldMap = {};
  private timer: ReturnType<typeof setTimeout> | null = null;
  private inFlight: Promise<void> | null = null;
  private queue: Promise<unknown> = Promise.resolve();
  private ensuring: Promise<string> | null = null;
  private failures = 0;
  private reportedFailure = false;
  private finalized = false;
  /** Bumps every time the draft is replaced; photos filed under an older one are stranded. */
  private draftEpoch = 0;
  private resetListeners = new Set<() => void>();
  private readonly fetchImpl: typeof fetch;
  private onPersistentFailure: AutosaveOptions["onPersistentFailure"];

  constructor(options: AutosaveOptions = {}) {
    this.fetchImpl = options.fetchImpl ?? ((...args) => fetch(...args));
    this.onPersistentFailure = options.onPersistentFailure;
    const saved = typeof window === "undefined" ? null : readStore();
    if (saved) {
      this.token = saved.token;
      this.draftId = saved.draftId;
      this.rev = saved.rev;
      this.pending = saved.pending;
      // WHY latest is persisted: restoring it from `pending` alone dropped every
      // already-acknowledged answer, so a 401 after a reload rebuilt the draft
      // with only the unsent fields.
      this.latest = { ...saved.latest, ...saved.pending };
      if (Object.keys(this.pending).length > 0) this.schedule(0);
    }
  }

  get hasDraft(): boolean {
    return this.token !== null;
  }

  /** Current capability token, for the photo uploader. */
  get draftToken(): string | null {
    return this.token;
  }

  get epoch(): number {
    return this.draftEpoch;
  }

  /** Called after a replacement draft exists, so photos can be re-filed to it. */
  onDraftReset(listener: () => void): () => void {
    this.resetListeners.add(listener);
    return () => this.resetListeners.delete(listener);
  }

  /**
   * The server rejected `rejectedToken` (expired, or the signing secret
   * rotated). Start over on a fresh draft with every field resent. A no-op if
   * another request already replaced that token, so several photos failing at
   * once create one replacement draft, not several.
   */
  resetDraft(rejectedToken: string): void {
    if (this.token !== rejectedToken) return;
    this.token = null;
    this.draftId = null;
    this.pending = { ...this.latest };
    this.draftEpoch += 1;
    this.persist();
    this.schedule(0);
    this.emitReset();
  }

  private emitReset(): void {
    this.resetListeners.forEach((listener) => listener());
  }

  /** Record a field change; it is filed shortly after the person pauses. */
  setField(key: string, value: FieldValue): void {
    if (this.finalized) return;
    this.latest[key] = value;
    this.pending[key] = value;
    this.persist();
    this.schedule(DEBOUNCE_MS);
  }

  private persist(): void {
    if (typeof window === "undefined") return;
    writeStore({
      token: this.token,
      draftId: this.draftId,
      rev: this.rev,
      pending: this.pending,
      latest: this.latest,
    });
  }

  private schedule(delayMs: number): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.drain();
    }, delayMs);
  }

  /** Send pending fields now, serially, retrying until acknowledged. */
  private async drain(): Promise<void> {
    if (this.finalized) return;
    if (this.inFlight) {
      await this.inFlight;
      return;
    }
    if (Object.keys(this.pending).length === 0 && this.token) return;
    this.inFlight = this.sendOnce(false)
      .then(() => {
        this.failures = 0;
        if (Object.keys(this.pending).length > 0) this.schedule(0);
      })
      .catch((err: unknown) => {
        this.failures += 1;
        const error =
          err instanceof ApplyRequestError
            ? err
            : new ApplyRequestError(
                "save_draft",
                null,
                err instanceof Error ? err.message : String(err),
              );
        if (
          this.failures >= PERSISTENT_FAILURE_AFTER &&
          !this.reportedFailure
        ) {
          this.reportedFailure = true;
          this.onPersistentFailure?.(error, this.failures);
        }
        this.schedule(
          BACKOFF_MS[Math.min(this.failures - 1, BACKOFF_MS.length - 1)],
        );
      })
      .finally(() => {
        this.inFlight = null;
      });
    await this.inFlight;
  }

  /**
   * One request. Sends a snapshot of `pending`; only the keys whose value is
   * unchanged when the server acknowledges are cleared, so typing during the
   * request is never lost.
   */
  private sendOnce(
    finalize: boolean,
    keepalive = false,
    epochGuard?: number,
  ): Promise<SaveResponse> {
    // WHY a queue: every request must see the token the previous one returned.
    // Concurrent tokenless sends (several photos picked at once, or a typed
    // field racing a photo) each minted their own draft and left empty
    // orphan drafts in the admin list.
    const run = this.queue.then(() =>
      this.sendUnqueued(finalize, keepalive, epochGuard),
    );
    this.queue = run.catch(() => undefined);
    return run;
  }

  private async sendUnqueued(
    finalize: boolean,
    keepalive: boolean,
    epochGuard?: number,
  ): Promise<SaveResponse> {
    // WHY: a finalize must never land on a draft that was replaced after the
    // photos were settled; it would file the application without them.
    if (
      finalize &&
      epochGuard !== undefined &&
      epochGuard !== this.draftEpoch
    ) {
      throw new DraftResetError();
    }
    const snapshot = { ...this.pending };
    const sentToken = this.token;
    this.rev += 1;
    const rev = this.rev;
    // WHY persisted before the send: a lost response or a reload mid-request
    // otherwise restarts the counter below what the server already stored, and
    // the server then refuses every field as stale.
    this.persist();
    const body = JSON.stringify({
      token: this.token ?? undefined,
      rev,
      fields: snapshot,
      finalize: finalize || undefined,
      clientVersion: 2,
    });
    const useKeepalive = keepalive && body.length < KEEPALIVE_MAX_BYTES;

    let res: Response;
    try {
      res = await this.fetchImpl("/api/save-application", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
        keepalive: useKeepalive,
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      });
    } catch (err) {
      throw new ApplyRequestError(
        finalize ? "finalize" : "save_draft",
        null,
        `network error: ${err instanceof Error ? `${err.name}: ${err.message}` : String(err)}`,
      );
    }

    let data: SaveResponse = {};
    try {
      data = (await res.json()) as SaveResponse;
    } catch {
      // Non-JSON body (an HTML error page from a proxy): handled below by status.
    }

    if (res.status === 401 && data.error === "invalid_token") {
      // Token expired or the signing secret rotated: start a fresh draft and
      // re-send every field so nothing the person typed is lost.
      if (this.token === sentToken) {
        this.token = null;
        this.draftId = null;
        this.pending = { ...this.latest };
        this.draftEpoch += 1;
        this.persist();
      }
      // A finalize cannot simply resend: the replacement draft has no photos
      // yet. finalize() re-settles photos against the new draft and retries.
      if (finalize) throw new DraftResetError();
      const replacement = await this.sendUnqueued(finalize, keepalive);
      this.emitReset();
      return replacement;
    }

    if (!res.ok || data.ok !== true) {
      throw new ApplyRequestError(
        data.stage ?? (finalize ? "finalize" : "save_draft"),
        res.status,
        data.detail ?? data.error ?? `unexpected response (${res.statusText})`,
      );
    }

    if (data.token) this.token = data.token;
    if (data.draftId) this.draftId = data.draftId;
    // A second tab or cleared storage can leave this counter below what the
    // server holds; adopt the server's so the next send is never stale.
    if (typeof data.maxRev === "number" && data.maxRev > this.rev) {
      this.rev = data.maxRev;
    }

    if (data.capped) {
      // Text was dropped for size: nothing is acknowledged, so it stays queued
      // and the controller reports the exact cause instead of looking saved.
      this.persist();
      throw new ApplyRequestError(
        finalize ? "finalize" : "save_draft",
        res.status,
        "the draft is over its text size limit, so some text was not stored",
      );
    }

    const stale = new Set(data.stale ?? []);
    for (const [key, sent] of Object.entries(snapshot)) {
      // A stale field was refused for an older revision; it stays queued and
      // is resent with a higher one.
      if (!stale.has(key) && this.pending[key] === sent)
        delete this.pending[key];
    }
    this.persist();
    return data;
  }

  /** Swap the failure handler (React binds it after render, never during). */
  setOnPersistentFailure(
    handler: AutosaveOptions["onPersistentFailure"],
  ): void {
    this.onPersistentFailure = handler;
  }

  /** Make sure a draft exists on the server (photos attach to it). */
  ensureDraft(): Promise<string> {
    if (this.token) return Promise.resolve(this.token);
    // Single flight: concurrent callers share one creation request.
    this.ensuring ??= this.sendWithRetry(false)
      .then(() => {
        if (!this.token) {
          throw new ApplyRequestError(
            "save_draft",
            null,
            "the server did not return a draft token",
          );
        }
        return this.token;
      })
      .finally(() => {
        this.ensuring = null;
      });
    return this.ensuring;
  }

  /** A few quick retries for calls the person is actively waiting on. */
  private async sendWithRetry(
    finalize: boolean,
    epochGuard?: number,
  ): Promise<SaveResponse> {
    if (this.inFlight) await this.inFlight;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.sendOnce(finalize, false, epochGuard);
      } catch (err) {
        // Retrying cannot help: the draft changed, finalize must re-settle.
        if (err instanceof DraftResetError) throw err;
        lastError = err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
        }
      }
    }
    throw lastError;
  }

  /**
   * Save everything now and mark the application finished.
   *
   * `settle` brings photos and fields up to date (the form hook uploads
   * stragglers and queues the final field values). It runs again whenever the
   * draft was replaced mid-way, because a replacement draft starts with no
   * photos and finalizing it as-is would file the application without them.
   */
  async finalize(
    settle: () => Promise<void> = async () => {},
  ): Promise<SaveResponse> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    for (let round = 0; round < MAX_FINALIZE_ROUNDS; round++) {
      const epoch = this.draftEpoch;
      await settle();
      // Files everything queued and proves the token is alive while photos
      // can still be re-filed; a dead token here replaces the draft.
      await this.sendWithRetry(false);
      if (this.draftEpoch !== epoch) continue;
      let data: SaveResponse;
      try {
        data = await this.sendWithRetry(true, epoch);
      } catch (err) {
        if (err instanceof DraftResetError) continue;
        throw err;
      }
      // A field refused as stale was queued again with a higher revision.
      if (data.stale && data.stale.length > 0) continue;
      this.finalized = true;
      this.pending = {};
      this.latest = {};
      this.token = null;
      this.draftId = null;
      writeStore(null);
      return data;
    }
    throw new ApplyRequestError(
      "finalize",
      null,
      "the draft kept being replaced while finalizing",
    );
  }

  /**
   * Fire pending fields on the way out (tab hidden, page closing). keepalive
   * lets the request outlive the page; the persisted queue covers the case
   * where even that is cut short.
   */
  flushOnExit(): void {
    if (this.finalized || Object.keys(this.pending).length === 0) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    void this.sendOnce(false, true).catch(() => {
      // Stays in the persisted queue and is retried on the next visit.
    });
  }
}
