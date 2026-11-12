/**
 * Best-effort bot check: verifies the token when there is one and ALWAYS lets
 * the submission through. The real gates are the per-IP rate limiter and the
 * signed draft token; a widget hiccup must never block a real applicant.
 * Returns once the one-time token has been spent so the caller can reset it.
 */
export async function verifyTurnstileBestEffort(token: string): Promise<void> {
  const ctrl = new AbortController();
  const timerId = setTimeout(() => ctrl.abort(), 8_000);
  try {
    await fetch("/api/verify-turnstile", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
      signal: ctrl.signal,
    });
  } catch {
    // Network error or timeout: allow the submission through.
  } finally {
    clearTimeout(timerId);
  }
}
