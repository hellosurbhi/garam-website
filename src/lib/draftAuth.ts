import { timingSafeEqual } from "crypto";
import { getSecret, verifyDraftToken } from "@/lib/draftToken";
import {
  canaryDraftId,
  canarySignature,
  isCanaryKey,
  type CanaryKey,
} from "@/lib/draftSecret";

/**
 * Who is allowed to touch which draft, shared by the save and photo endpoints.
 *
 * Two kinds of caller:
 *  - an applicant, holding the capability token issued when the draft was
 *    created (can touch that one draft in `applications`);
 *  - the production canary, proving it knows the server secret with an HMAC
 *    header (can touch one fixed draft per browser in `_canary`, never a real
 *    application). The canary drives the real page in a real browser and a
 *    Playwright route adds the headers, so the whole real code path runs.
 */
export interface DraftAuth {
  draftId: string;
  collection: "applications" | "_canary";
  canaryKey: CanaryKey | null;
}

export type DraftAuthResult =
  | { ok: true; auth: DraftAuth }
  | {
      ok: false;
      reason: "no_token" | "malformed" | "bad_signature" | "expired";
    };

function canaryFromHeaders(request: Request): CanaryKey | null {
  const key = request.headers.get("x-canary-key");
  const sig = request.headers.get("x-canary-sig");
  if (!key || !sig || !isCanaryKey(key)) return null;
  try {
    const expected = Buffer.from(canarySignature(getSecret(), key), "hex");
    const given = Buffer.from(sig, "hex");
    if (expected.length !== given.length) return null;
    return timingSafeEqual(expected, given) ? key : null;
  } catch {
    return null;
  }
}

/**
 * Resolve the draft a request is entitled to. `token` is absent on a brand
 * new draft; callers decide whether that is allowed (save creates one, the
 * photo endpoint needs an existing one).
 */
export function resolveDraftAuth(
  request: Request,
  token: unknown,
): DraftAuthResult {
  const canaryKey = canaryFromHeaders(request);
  if (canaryKey) {
    return {
      ok: true,
      auth: {
        draftId: canaryDraftId(canaryKey),
        collection: "_canary",
        canaryKey,
      },
    };
  }
  if (token === undefined || token === null || token === "") {
    return { ok: false, reason: "no_token" };
  }
  const verified = verifyDraftToken(token);
  if (!verified.ok) return { ok: false, reason: verified.reason };
  return {
    ok: true,
    auth: {
      draftId: verified.draftId,
      collection: "applications",
      canaryKey: null,
    },
  };
}
