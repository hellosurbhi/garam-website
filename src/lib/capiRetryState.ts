// Bounds how many failed Purchase CAPI deliveries an order gets before the
// retry pass gives up on it for good. Without a cap, an order failing for a
// persistent reason unrelated to its source event (a malformed payload,
// repeated unclassified rejections) retries forever and crowds real pending orders out of
// findPendingPurchaseOrders's 100-row limit.
export const MAX_CAPI_ATTEMPTS = 5;

export interface CapiFailureState {
  attempts: number;
  unrecoverable: boolean;
}

/**
 * The attempt count and give-up flag an order should carry after one more
 * failed Purchase delivery. Shared by the per-event loop and the retry pass
 * so both apply the same rule.
 *
 * WHY `terminal` short-circuits the cap: an invalid-parameter rejection from Meta
 * (bad payload, event older than Meta's accepted window) fails identically on every retry, so
 * spending the remaining attempts on it only delays the inevitable and holds
 * a query slot. A timeout, 5xx or 429 is transient and keeps its full budget,
 * so a multi-day Meta outage does not permanently drop the pending purchases.
 *
 * WHY `credential` leaves the budget untouched: a bad Meta token fails every
 * order the same way, so counting it would exhaust all pending orders after
 * MAX_CAPI_ATTEMPTS daily runs and forfeit them even though replacing the
 * token fixes them all. The failure is still reported through syncErrors.
 */
export function nextCapiFailureState(
  attemptsSoFar: number,
  terminal: boolean,
  credential = false,
): CapiFailureState {
  if (credential) return { attempts: attemptsSoFar, unrecoverable: false };
  const attempts = attemptsSoFar + 1;
  return {
    attempts,
    unrecoverable: terminal || attempts >= MAX_CAPI_ATTEMPTS,
  };
}
