import { defineConfig } from "@playwright/test";
import { WEB_API_DOWN } from "./e2e/fixtures";

/** Override with WEB_URL, API_URL and WEB_API_DOWN_URL to run beside other servers on the defaults. */
const WEB = process.env.WEB_URL ?? "http://localhost:3000";
const API = process.env.API_URL ?? "http://localhost:4000";
const port = (url: string) => new URL(url).port;

/**
 * WebGL2 for the map. CI has no GPU, so headless Chromium draws it in software (SwiftShader).
 * Locally the real GPU draws it: forcing SwiftShader there also moves page compositing to the CPU,
 * which breaks the phone LCP budget, and the long-task gate is meant for real GPUs (ruling 8).
 */
const WEBGL = {
  args: [
    ...(process.env.CI ? ["--use-angle=swiftshader"] : []),
    "--enable-unsafe-swiftshader",
    "--ignore-gpu-blocklist",
  ],
};
/** The 1 KB fixture archive (scripts/tiles/make-test-tiles.mjs): CI never downloads tiles. */
const TILES = { MAP_TILES_DIR: "e2e/tiles" };

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
      reuseExistingServer: true,
      timeout: 60_000,
      env: { PORT: port(API), WEB_ORIGIN: WEB },
    },
    {
      command: `pnpm exec next start --port ${port(WEB)}`,
      url: `${WEB}/for-business`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_URL: API, SITE_URL: WEB, ...TILES },
    },
    {
      command: `pnpm exec next start --port ${port(WEB_API_DOWN)}`,
      url: `${WEB_API_DOWN}/for-business`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Port 9 (discard) refuses connections: every API call fails as unreachable.
      env: { API_URL: "http://127.0.0.1:9", SITE_URL: WEB_API_DOWN, ...TILES },
    },
  ],
});
