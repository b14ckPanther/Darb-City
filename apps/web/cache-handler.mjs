// The default file-system ISR cache, except that it never stores an entry rendered while the API was
// unreachable (tagged by src/lib/unavailable.tsx): the retry view is not served from the cache, and
// a stale good copy of a page is kept rather than replaced. Wired up in next.config.ts.
import fileSystemCache from "next/dist/server/lib/incremental-cache/file-system-cache.js";

const FileSystemCache = fileSystemCache.default ?? fileSystemCache;
export const UNAVAILABLE_TAG = "darb:api-unavailable";

/** Pages carry their tags in a header; fetch and unstable_cache entries in `ctx.tags`. */
export function isUnavailable(data, ctx) {
  const header = String(data?.headers?.["x-next-cache-tags"] ?? "");
  return [...(ctx?.tags ?? []), ...header.split(",")].includes(UNAVAILABLE_TAG);
}

export default class DarbCacheHandler extends FileSystemCache {
  async set(key, data, ctx) {
    if (isUnavailable(data, ctx)) return;
    return super.set(key, data, ctx);
  }
}
