/**
 * Tiny request-dedup + short-TTL-cache helper.
 *
 * Motivation (caught by Sentry 2026-04-18): navigating between screens
 * that all use useRelationship + useCircle fires the same Supabase
 * SELECTs 2-3× in parallel (one per mounted hook instance). A
 * transition like Settings → Circle → Settings produced ~6-8
 * duplicate network requests in <500 ms, enough to trigger an
 * "App hanging 2000 ms" warning.
 *
 * This helper wraps a fetch function so concurrent callers share a
 * single in-flight promise, and repeat callers within `ttlMs` reuse
 * the cached result. Cache is invalidatable (needed on auth state
 * change and manual refresh).
 *
 * Zero dependency — no React Query, no SWR — keeps the tree lean.
 * If more caches accumulate later, consider migrating to a proper
 * query library.
 */

type DedupeOptions = {
  /** How long a successful result stays cached. Default 500 ms — short
   *  enough to not feel stale, long enough to cover navigation transitions. */
  ttlMs?: number;
};

export interface DedupedFetch<T> {
  /** Run the dedup-aware fetch. Shares a pending promise with concurrent
   *  callers and reuses the last result within `ttlMs`. */
  (): Promise<T>;
  /** Drop any cached result + in-flight promise. Call on auth change or
   *  any explicit invalidation signal. */
  invalidate: () => void;
  /** Like (), but bypasses any cached result and kicks off a fresh
   *  fetch (any concurrent callers still share it). */
  refresh: () => Promise<T>;
  /** Synchronous peek at the cached value. Returns null if no fresh
   *  cache. Used by hooks to lazy-seed initial state and avoid a
   *  LoadingScreen flash on remount when data is already known.
   *  Honors the same `ttlMs` as the deduped call. */
  peek: () => T | null;
}

export function createDedupedFetch<T>(
  fn: () => Promise<T>,
  { ttlMs = 500 }: DedupeOptions = {},
): DedupedFetch<T> {
  let pending: Promise<T> | null = null;
  let cache: { value: T; at: number } | null = null;

  const runFresh = (): Promise<T> => {
    const promise = fn()
      .then((value) => {
        cache = { value, at: Date.now() };
        pending = null;
        return value;
      })
      .catch((err) => {
        pending = null;
        throw err;
      });
    pending = promise;
    return promise;
  };

  const deduped = (() => {
    const now = Date.now();
    if (cache && now - cache.at < ttlMs) return Promise.resolve(cache.value);
    if (pending) return pending;
    return runFresh();
  }) as DedupedFetch<T>;

  deduped.invalidate = () => {
    cache = null;
    pending = null;
  };

  deduped.refresh = () => {
    cache = null;
    if (pending) return pending;
    return runFresh();
  };

  deduped.peek = () => {
    if (!cache) return null;
    if (Date.now() - cache.at >= ttlMs) return null;
    return cache.value;
  };

  return deduped;
}
