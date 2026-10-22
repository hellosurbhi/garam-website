/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once,
 * instead of either fully serial (slow: N items * per-call latency) or
 * fully parallel (risks overwhelming the target API / connection pool).
 * Each `fn` call is expected to handle its own errors (this never rejects
 * the batch on one item's failure); a throwing `fn` still resolves this
 * function's returned promise, so callers must catch inside `fn` if a
 * failure needs to be observed.
 */
export async function mapWithConcurrency<T>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<void>,
): Promise<void> {
  let index = 0;

  async function worker(): Promise<void> {
    while (index < items.length) {
      const current = items[index];
      index += 1;
      await fn(current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, () =>
    worker(),
  );
  await Promise.all(workers);
}
