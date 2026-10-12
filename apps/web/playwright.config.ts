import { defineConfig } from "@playwright/test";
import { WEB_API_DOWN } from "./e2e/fixtures";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";

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
      },
    },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: "pnpm --filter @darb/api start",
      cwd: "../..",
      url: "http://localhost:4000/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "pnpm start",
      url: `${WEB}/for-business`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_URL: "http://localhost:4000", SITE_URL: WEB },
    },
    {
      command: "pnpm exec next start --port 3001",
      url: `${WEB_API_DOWN}/for-business`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      // Port 9 (discard) refuses connections: every API call fails as unreachable.
      env: { API_URL: "http://127.0.0.1:9", SITE_URL: WEB_API_DOWN },
    },
  ],
});
