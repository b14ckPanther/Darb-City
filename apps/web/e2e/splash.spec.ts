import { expect, test } from "@playwright/test";
import { SPLASH_DEVICES } from "../src/splash/devices.mjs";

/** An installed app: (display-mode: standalone) matches, as when it opens from the home screen. */
const installed = () => {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q: string) =>
    /display-mode:\s*standalone/.test(q) ? real("(min-width: 0px)") : real(q);
};

test("the public site in a browser tab never shows the launch reveal or loads its stylesheet", async ({
  page,
}) => {
  const sheets: string[] = [];
  page.on("request", (r) => {
    if (r.url().includes("/brand/splash/")) sheets.push(r.url());
  });
  await page.goto("/for-business");
  await expect(page.locator("h1")).toBeVisible();
  await expect(page.locator("#darb-splash")).toHaveCount(0);
  await page.goto("/en/for-business");
  await expect(page.locator("#darb-splash")).toHaveCount(0);
  expect(sheets).toEqual([]);
  // The launch images are linked for iOS to pick up at install, never fetched by a tab.
  await expect(page.locator('link[rel="apple-touch-startup-image"]')).toHaveCount(
    SPLASH_DEVICES.length * 2,
  );
});

test("the installed app plays it once, under a second, then hands off", async ({ page }) => {
  await page.addInitScript(installed);
  await page.goto("/for-business", { waitUntil: "commit" });
  const splash = page.locator("#darb-splash");
  await expect(splash).toBeAttached();
  await expect(splash).toHaveAttribute("aria-hidden", "true");
  await expect(splash).toHaveCount(0, { timeout: 3_000 });
  await expect(page.locator("h1")).toBeVisible();
  await page.reload();
  await expect(page.locator("h1")).toBeVisible();
  await expect(splash).toHaveCount(0);
});

test("a tap skips it", async ({ page }) => {
  await page.addInitScript(installed);
  await page.goto("/for-business", { waitUntil: "commit" });
  const splash = page.locator("#darb-splash");
  await expect(splash).toBeVisible();
  await splash.dispatchEvent("pointerdown");
  await expect(splash).toHaveCount(0, { timeout: 400 });
});
