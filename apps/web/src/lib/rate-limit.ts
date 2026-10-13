/**
 * A per-process fixed-window limiter. On Vercel each function instance counts on its own, so this
 * is a soft guard against one visitor hammering suggest; the API limits direct callers itself.
 */
export function createLimiter(limit: number, windowMs = 60_000) {
  const hits = new Map<string, { window: number; count: number }>();
  return (key: string, now: number = Date.now()): boolean => {
    const window = Math.floor(now / windowMs);
    const entry = hits.get(key);
    if (!entry || entry.window !== window) {
      if (hits.size > 50_000) hits.clear();
      hits.set(key, { window, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}
