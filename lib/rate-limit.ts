const buckets = new Map<string, number[]>();

/**
 * Minimal fixed-window rate limiter, keyed per device route + box.
 * Returns true when the request is allowed.
 */
export function rateLimit(
  key: string,
  limit: number,
  windowMs: number
): boolean {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= limit) {
    buckets.set(key, hits);
    return false;
  }
  hits.push(now);
  buckets.set(key, hits);
  return true;
}
