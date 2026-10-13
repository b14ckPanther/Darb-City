import path from "node:path";
import type { NextConfig } from "next";
import { writeSearchIndex } from "./scripts/build-search-index.mjs";

const workspaceRoot = path.resolve(process.cwd(), "../..");
/** Built from @darb/seed on every config load (dev, build, start): same seed, same hashed file. */
const searchIndex = writeSearchIndex(path.resolve(process.cwd(), "public"));

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  env: { NEXT_PUBLIC_SEARCH_INDEX_URL: searchIndex.url },
  // app/global-not-found.tsx: URLs that match no route at all (the root layout is [locale]).
  experimental: { globalNotFound: true },
  // /map/vendor paths carry the MapLibre version and /search-index files their content hash, so
  // they never change; glyphs change rarely.
  headers: async () => [
    {
      source: "/map/vendor/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/map/glyphs/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
    },
    {
      source: "/search-index/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
  ],
};

// Self-hosting only: the default ISR cache, minus pages rendered while the API was down. The handler
// (cache-handler.mjs) imports a private Next internal (next/dist/.../file-system-cache), is pinned to
// next 16.3.6 and must be re-verified on every Next upgrade. On Vercel it would displace the
// platform cache, so it is left out there.
if (!process.env.VERCEL) config.cacheHandler = path.resolve(process.cwd(), "cache-handler.mjs");

export default config;
