import path from "node:path";
import type { NextConfig } from "next";

const workspaceRoot = path.resolve(process.cwd(), "../..");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

// Self-hosting only: the default ISR cache, minus pages rendered while the API was down. The handler
// (cache-handler.mjs) imports a private Next internal (next/dist/.../file-system-cache), is pinned to
// next 16.3.6 and must be re-verified on every Next upgrade. On Vercel it would displace the
// platform cache, so it is left out there.
if (!process.env.VERCEL) config.cacheHandler = path.resolve(process.cwd(), "cache-handler.mjs");

export default config;
