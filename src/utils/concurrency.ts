/**
 * Runs `fn` over `items` with at most `limit` calls in flight at once,
 * instead of either fully serial (slow: N items * per-call latency) or
 * fully parallel (risks overwhelming the target API / connection pool).
 * Each `fn` call must handle its own errors: if one throws, the returned
 * promise rejects with that error (the other in-flight calls still finish,
 * but items not yet started are abandoned by the failed worker only), so a
 * caller that wants every item processed regardless catches inside `fn`.
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
