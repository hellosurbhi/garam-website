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

interface SaveResponse {
  ok?: boolean;
  draftId?: string;
  token?: string;
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
  private failures = 0;
  private reportedFailure = false;
  private finalized = false;
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
      this.latest = { ...saved.pending };
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
  private async sendOnce(
    finalize: boolean,
    keepalive = false,
  ): Promise<SaveResponse> {
    const snapshot = { ...this.pending };
    this.rev += 1;
    const rev = this.rev;
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
      this.token = null;
      this.draftId = null;
      this.pending = { ...this.latest };
      this.persist();
      return this.sendOnce(finalize, keepalive);
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
    for (const [key, sent] of Object.entries(snapshot)) {
      if (this.pending[key] === sent) delete this.pending[key];
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
  async ensureDraft(): Promise<string> {
    if (!this.token) {
      await this.sendWithRetry(false);
    }
    if (!this.token) {
      throw new ApplyRequestError(
        "save_draft",
        null,
        "the server did not return a draft token",
      );
    }
    return this.token;
  }

  /** A few quick retries for calls the person is actively waiting on. */
  private async sendWithRetry(finalize: boolean): Promise<SaveResponse> {
    if (this.inFlight) await this.inFlight;
    let lastError: unknown;
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        return await this.sendOnce(finalize);
      } catch (err) {
        lastError = err;
        if (attempt < 2) {
          await new Promise((r) => setTimeout(r, 1_000 * 2 ** attempt));
        }
      }
    }
    throw lastError;
  }

  /** Save everything now and mark the application finished. */
  async finalize(): Promise<SaveResponse> {
    if (this.timer) clearTimeout(this.timer);
    this.timer = null;
    const data = await this.sendWithRetry(true);
    this.finalized = true;
    this.pending = {};
    this.latest = {};
    this.token = null;
    this.draftId = null;
    writeStore(null);
    return data;
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
