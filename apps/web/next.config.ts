import path from "node:path";
import type { NextConfig } from "next";

const workspaceRoot = path.resolve(process.cwd(), "../..");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
  // The default ISR cache, minus pages rendered while the API was down (see the file).
  cacheHandler: path.resolve(process.cwd(), "cache-handler.mjs"),
};

export default config;
