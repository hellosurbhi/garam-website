import type { APIRoute } from "astro";
import { applicationReceived } from "@/data/emails";
import { isAllowedApplyOrigin } from "@/lib/allowedOrigin";
import { alertOpsOnce } from "@/lib/alertDedupe";
import {
  docFieldsFor,
  mergeDraft,
  sanitizeFields,
} from "@/lib/applicationDraft";
import { resolveDraftAuth } from "@/lib/draftAuth";
import { upsertDoc } from "@/lib/draftStore";
import { issueDraftToken, newDraftId } from "@/lib/draftToken";
import { jsonResponse } from "@/lib/http";
import { alertOps } from "@/lib/opsAlert";
import { publicCause } from "@/lib/publicCause";
import { enforceRateLimit, RATE_LIMITS } from "@/lib/rateLimit";
import { sendMail } from "@/lib/zohoMailer";

export const prerender = false;

/**
 * Upsert endpoint behind the apply form's autosave and final submit.
 *
 * The contract: the server never rejects an applicant over what they typed.
 * It accepts any field values (sanitizeFields coerces and clips floods),
 * merges them per field by revision so a delayed request cannot overwrite
 * newer answers, and files the result. The only refusals are about identity
 * (bad origin, token that does not verify) and malformed transport (not JSON).
 */

/**
 * Per-draft text budget in characters. Fails closed without Redis: a human
 * never nears it (a 100k pitch plus every other field is under 110k), a bot
 * looping one draft hits it. Over budget, text writes are dropped and the
 * response says `capped`.
 */
const DRAFT_TEXT_BUDGET = 200_000;

function textSize(doc: Record<string, unknown>): number {
  let total = 0;
  for (const [key, value] of Object.entries(doc)) {
    if (key !== "fieldRevs" && typeof value === "string") total += value.length;
  }
  return total;
}

class DraftFinalizedError extends Error {}

function maxStoredRev(doc: Record<string, unknown>): number {
  const revs = doc.fieldRevs;
  if (!revs || typeof revs !== "object") return 0;
  let max = 0;
  for (const value of Object.values(revs)) {
    if (typeof value === "number" && value > max) max = value;
  }
  return max;
}

function parseRev(value: unknown): number {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.trunc(n) : 0;
}

interface SaveBody {
  token?: unknown;
  rev?: unknown;
  fields?: unknown;
  finalize?: unknown;
  clientVersion?: unknown;
}

export const POST: APIRoute = async ({ request }) => {
  const limited = await enforceRateLimit(request, RATE_LIMITS.saveApplication);
  if (limited) return limited;

  if (!isAllowedApplyOrigin(request.headers.get("origin"))) {
    return jsonResponse({ error: "forbidden", reason: "origin" }, 403);
  }

  let body: SaveBody;
  try {
    const parsed: unknown = await request.json();
    body =
      parsed && typeof parsed === "object" && !Array.isArray(parsed)
        ? (parsed as SaveBody)
        : {};
  } catch {
    return jsonResponse({ error: "bad_request", reason: "not_json" }, 400);
  }

  const resolved = resolveDraftAuth(request, body.token);
  let draftId: string;
  let collection: "applications" | "_canary" = "applications";
  let canary = false;
  let issueToken: boolean;
  if (resolved.ok) {
    draftId = resolved.auth.draftId;
    collection = resolved.auth.collection;
    canary = resolved.auth.canaryKey !== null;
    // WHY: the browser needs a token back from its first save or it treats
    // the draft as never created and cannot reserve photos. A canary request
    // authenticates by signature, so the token is only a hand-back.
    issueToken = canary && !body.token;
  } else if (resolved.reason === "no_token") {
    const tooMany = await enforceRateLimit(
      request,
      RATE_LIMITS.newApplicationDraft,
    );
    if (tooMany) return tooMany;
    draftId = newDraftId();
    issueToken = true;
  } else {
    // A token we cannot verify (expired, or the signing secret rotated). The
    // client starts a fresh draft and re-sends every field, so nothing is lost.
    return jsonResponse(
      { error: "invalid_token", reason: resolved.reason },
      401,
    );
  }

  const incoming = sanitizeFields(body.fields);
  const rev = parseRev(body.rev);
  const finalize = body.finalize === true;
  const now = new Date();
  let capped = false;
  let sendWelcome = false;
  let stale: string[] = [];
  let storedMaxRev = 0;

  try {
    const outcome = await upsertDoc(collection, draftId, (before) => {
      const existing = before ?? {};
      storedMaxRev = maxStoredRev(existing);
      // WHY: upsertDoc re-runs this callback after a lost write race. State
      // from the losing attempt (a claimed welcome email, stale keys) must not
      // leak into an attempt that returns early, or the email sends twice.
      sendWelcome = false;
      capped = false;
      stale = [];
      // WHY: finalize() wipes the applicant's token, so no real client writes
      // to a finished application. A leaked token (30-day life) must not be
      // able to rewrite one. A repeated finalize is the exception: a lost
      // response makes the client retry it, so it succeeds without writing.
      // The canary reuses one doc every run and is exempt.
      if (!canary && existing.finalizedAt) {
        if (!finalize) throw new DraftFinalizedError();
        return { updatedAt: now };
      }
      const merged = mergeDraft(existing, incoming, rev);
      stale = merged.stale;
      const patch: Record<string, unknown> = { ...merged.patch };

      // termsAgreed is a boolean from the client; the document stores WHEN.
      if ("termsAgreed" in patch) {
        const agreed = patch.termsAgreed === true;
        delete patch.termsAgreed;
        if (agreed && !existing.termsAgreedAt) patch.termsAgreedAt = now;
        if (!agreed) patch.termsAgreedAt = null;
      }

      capped = false;
      const projected = { ...existing, ...patch };
      if (textSize(projected) > DRAFT_TEXT_BUDGET) {
        capped = true;
        const dropped = new Set<string>();
        for (const key of Object.keys(patch)) {
          if (typeof patch[key] === "string") {
            delete patch[key];
            dropped.add(key);
          }
        }
        // WHY: advancing a dropped field's revision made the server treat the
        // value as stored, so the client could never resend it as newer.
        for (const key of merged.applied) {
          if (docFieldsFor(key).some((f) => dropped.has(f))) {
            delete patch[`fieldRevs.${key}`];
          }
        }
      }

      sendWelcome = false;
      // WHY: finalizing while fields are refused as stale would lock the draft
      // (see the finalized guard above) with those answers missing; the client
      // resends them with a higher revision and finalizes then. The same holds
      // for text dropped over the size budget.
      if (finalize && merged.stale.length === 0 && !capped) {
        if (!before || before.status === "Draft") patch.status = "New";
        // WHY the canary restamps: its one document is reused every run, so a
        // first-run-only timestamp let the read-back mistake an old run's
        // finalize for this run's (scripts/canary-verify.mjs checks it).
        if (canary || !existing.finalizedAt) patch.finalizedAt = now;
        const email =
          typeof projected.email === "string" ? projected.email : "";
        if (!canary && email && !existing.welcomeSentAt) {
          // Claimed in the same conditional write that finalizes, so two
          // racing finalizes cannot both send the welcome email.
          patch.welcomeSentAt = now;
          sendWelcome = true;
        }
      }

      if (!before) {
        return {
          status: "Draft",
          submittedAt: now,
          notes: "",
          photoPaths: [],
          clientVersion:
            typeof body.clientVersion === "number" ? body.clientVersion : 2,
          ...(canary ? { isCanary: true } : {}),
          ...patch,
          updatedAt: now,
        };
      }
      return { ...patch, updatedAt: now };
    });

    if (sendWelcome) {
      const after = outcome.after;
      const email = typeof after.email === "string" ? after.email : "";
      const name = typeof after.name === "string" ? after.name : "";
      const city = typeof after.city === "string" ? after.city : "";
      try {
        await sendMail({ to: email, ...applicationReceived(name, city) });
      } catch (err) {
        // The application IS saved; only the applicant's confirmation failed.
        await alertOps({
          flow: "apply",
          stage: "welcome_email",
          errorMessage: err instanceof Error ? err.message : String(err),
          context: { draftId, email, name },
        });
      }
    }

    const status =
      typeof outcome.after.status === "string" ? outcome.after.status : "Draft";
    return jsonResponse({
      ok: true,
      draftId,
      ...(issueToken ? { token: issueDraftToken(draftId) } : {}),
      rev,
      // The highest revision the server holds. A client whose counter fell
      // behind (second tab, cleared storage) adopts it and resends.
      maxRev: Math.max(storedMaxRev, rev),
      status,
      stale,
      capped,
    });
  } catch (err) {
    if (err instanceof DraftFinalizedError) {
      return jsonResponse(
        { error: "finalized", reason: "already_submitted" },
        409,
      );
    }
    const message = err instanceof Error ? err.message : String(err);
    await alertOpsOnce({
      flow: "apply",
      stage: finalize ? "finalize" : "save_draft",
      errorMessage: message,
      context: {
        draftId,
        collection,
        fieldsSent: incoming.keys.join(", "),
      },
    });
    return jsonResponse(
      {
        error: "save_failed",
        stage: finalize ? "finalize" : "save_draft",
        detail: publicCause(err),
      },
      500,
    );
  }
};
