// Bounds how many failed Purchase CAPI deliveries an order gets before the
// retry pass gives up on it for good. Without a cap, an order failing for a
// persistent reason unrelated to its source event (an expired access token, a
// malformed payload) retries forever and crowds real pending orders out of
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
 * WHY `terminal` short-circuits the cap: a 4xx from Meta (bad payload, event
 * older than Meta's accepted window) fails identically on every retry, so
 * spending the remaining attempts on it only delays the inevitable and holds
 * a query slot. A timeout, 5xx or 429 is transient and keeps its full budget,
 * so a multi-day Meta outage does not permanently drop the pending purchases.
 */
export function nextCapiFailureState(
  attemptsSoFar: number,
  terminal: boolean,
): CapiFailureState {
  const attempts = attemptsSoFar + 1;
  return {
    attempts,
    unrecoverable: terminal || attempts >= MAX_CAPI_ATTEMPTS,
  };
}
