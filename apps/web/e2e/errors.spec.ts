import { rmSync } from "node:fs";
import { expect, test } from "@playwright/test";
import { isPhone, WEB_API_DOWN } from "./fixtures";

test("a misspelt place suggests the real one", async ({ page }) => {
  expect((await page.goto("/sakhnim"))?.status()).toBe(404);
  await expect(page.locator("[data-closest-match]")).toHaveAttribute("href", "/sakhnin");
});

test("a misspelt kind keeps the place", async ({ page }) => {
  expect((await page.goto("/en/sakhnin/beauty/barbershop"))?.status()).toBe(404);
  await expect(page.locator("[data-closest-match]")).toHaveAttribute(
    "href",
    "/en/sakhnin/beauty/barbershops",
  );
});

test("nonsense is a plain 404 inside the city frame", async ({ page }) => {
  expect((await page.goto("/qqqqqqqqqq"))?.status()).toBe(404);
  await expect(page.locator("[data-site-header]")).toBeVisible();
  await expect(page.locator("[data-back-home]")).toHaveAttribute("href", "/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-closest-match]")).toHaveCount(0);
});

test("an uncached level with the API down is the retry view, a 200 that is never cached", async ({
  page,
  request,
}, info) => {
  test.skip(
    isPhone(info),
    "server behaviour: once is enough, and the projects would share the page",
  );
  // A level no other test visits. A previous run's good copy would be served (as it should), so
  // drop it from the shared file-system ISR cache first.
  const path = "/en/tamra/food";
  const cached = new URL(`../.next/server/app${path}`, import.meta.url);
  for (const suffix of [".html", ".rsc", ".meta", ".segments"])
    rmSync(new URL(`${cached.href}${suffix}`), { recursive: true, force: true });
  for (let i = 0; i < 2; i++) {
    const response = await page.goto(`${WEB_API_DOWN}${path}`);
    expect(response?.status()).toBe(200);
    expect(response?.headers()["x-nextjs-cache"]).not.toBe("HIT");
    await expect(page.locator("[data-unreachable]")).toBeVisible();
    await expect(page.locator("[data-site-header]")).toBeVisible();
  }
  // The retry view never reached the shared file-system cache: with the API up, the page is real.
  const live = await request.get(path);
  expect(live.status()).toBe(200);
  expect(await live.text()).not.toContain("data-unreachable");
});
