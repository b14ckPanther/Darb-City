import { defineConfig } from "@playwright/test";
import { WEB_API_DOWN } from "./e2e/fixtures";

/**
 * Dedicated ports, never the dev servers' :3000 and :4000: a dev API may hold real model keys, and
 * e2e must never reuse it. Override with WEB_URL, API_URL and WEB_API_DOWN_URL.
 */
const WEB = process.env.WEB_URL ?? "http://localhost:3100";
const API = process.env.API_URL ?? "http://localhost:4100";
const port = (url: string) => new URL(url).port;
/** Every API e2e starts: recorded intents and offline embeddings, whatever apps/api/.env holds. */
const OFFLINE_PROVIDERS = { INTENT_PROVIDER: "recorded", EMBEDDING_PROVIDER: "hash" };

/**
 * WebGL2 for the map. Locally the real GPU draws it. Without a GPU (CI), Chromium falls back to
 * SwiftShader for WebGL alone (--enable-unsafe-swiftshader) and keeps compositing pages in software
 * as before. Never --use-angle=swiftshader: it moves page compositing onto software GL too, which
 * roughly doubles phone LCP (620–790 ms → 1100–1800 ms in the Playwright Linux image) and failed
 * the 1.5 s budget on CI. The long-task gate is meant for real GPUs (ruling 8).
 */
const WEBGL = { args: ["--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] };
/** The 1 KB fixture archive (scripts/tiles/make-test-tiles.mjs): CI never downloads tiles. */
const TILES = { MAP_TILES_DIR: "e2e/tiles" };
/** The API revalidates the web after admin writes; both sides share this secret. */
const REVALIDATE_SECRET = "e2e-revalidate-secret";
/** Admin e2e signs in with fake tokens (refused in production and off localhost). */
const ADMIN = { ADMIN_FAKE_AUTH: "1", REVALIDATE_SECRET };

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: WEB, trace: "retain-on-failure" },
  projects: [
    {
      name: "phone",
      use: {
        browserName: "chromium",
        viewport: { width: 390, height: 844 },
        isMobile: true,
        hasTouch: true,
        deviceScaleFactor: 2,
        launchOptions: WEBGL,
      },
    },
    {
      name: "desktop",
      use: {
        browserName: "chromium",
        viewport: { width: 1440, height: 900 },
        launchOptions: WEBGL,
      },
    },
  ],
  webServer: [
    {
      command: "pnpm --filter @darb/api start",
      cwd: "../..",
      url: `${API}/health`,
      reuseExistingServer: !process.env.CI,
      timeout: 60_000,
      env: {
        PORT: port(API),
        WEB_ORIGIN: WEB,
        ...OFFLINE_PROVIDERS,
        SEARCH_PROXY_KEY: "e2e-proxy-key",
        SEARCH_RATE_LIMIT: "100000",
        SEARCH_RESULTS_RATE_LIMIT: "100000",
        AUTH_VERIFIER: "fake",
        ADMIN_EMAILS: "e2e-admin@darb.test",
        REVALIDATE_URL: `${WEB}/api/revalidate`,
        REVALIDATE_SECRET,
      },
    },
    {
      command: `pnpm exec next start --port ${port(WEB)}`,
      url: `${WEB}/for-business`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_URL: API, SITE_URL: WEB, SEARCH_PROXY_KEY: "e2e-proxy-key", ...TILES, ...ADMIN },
    },
    {
      command: `pnpm exec next start --port ${port(WEB_API_DOWN)}`,
      url: `${WEB_API_DOWN}/for-business`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Port 9 (discard) refuses connections: every API call fails as unreachable.
      env: {
        API_URL: "http://127.0.0.1:9",
        SITE_URL: WEB_API_DOWN,
        SEARCH_PROXY_KEY: "e2e-proxy-key",
        ...TILES,
        ...ADMIN,
      },
    },
  ],
});
