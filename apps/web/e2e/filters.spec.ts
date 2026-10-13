import { expect, test } from "@playwright/test";
import { isPhone, settleStage } from "./fixtures";

const RESTAURANTS = "/en/sakhnin/food/restaurants";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __DARB_E2E__: true }));
});

test("open now filters in place and is shareable", async ({ page }) => {
  await page.goto(RESTAURANTS);
  const open = page.locator('[data-filter="open"]');
  await open.click();
  await expect(open).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(`${RESTAURANTS}?open=1`);
  // Real clock: either every row is open, or the calm empty line shows.
  const rows = page.locator("[data-business-list] li");
  if ((await rows.count()) > 0) await expect(rows.locator('[data-open="false"]')).toHaveCount(0);
  else await expect(page.locator("[data-filter-empty]")).toBeVisible();
  await page.reload();
  await expect(page.locator('[data-filter="open"]')).toHaveAttribute("aria-pressed", "true");
});

test("Delivers shows only where the kind has it", async ({ page }) => {
  await page.goto(RESTAURANTS);
  await expect(page.locator('[data-filter="delivers"]')).toBeVisible();
  await page.goto("/en/sakhnin/beauty/barbershops");
  await expect(page.locator('[data-filter="delivers"]')).toHaveCount(0);
});

test.describe("near me", () => {
  test.use({
    geolocation: { latitude: 32.8641, longitude: 35.3031 },
    permissions: ["geolocation"],
  });
  test("sorts by distance and shows it, and keeps the point out of the URL", async ({ page }) => {
    await page.goto("/en/haifa/beauty/barbershops");
    await page.locator('[data-filter="near"]').click();
    await expect(page.locator("[data-distance]").first()).toHaveText(/km/);
    expect(page.url()).not.toMatch(/32\.86|35\.30|lat|lng/);
  });
});

test("filters and Show more move the map's pins (M6)", async ({ page }, info) => {
  test.skip(isPhone(info), "desktop split layout");
  // Haifa's bakeries (with Kiryat Haim's) all deliver, so the filtered list is never empty,
  // whatever the hour (open now would depend on the clock).
  const kind = "/en/haifa/food/bakeries";
  await page.goto(kind);
  await settleStage(page);
  const keys = () =>
    page
      .locator("[data-business]")
      .evaluateAll((els) => els.map((e) => e.getAttribute("data-business")!));
  const pinned = (k: string) =>
    page.evaluate(
      (key) =>
        (window as unknown as { darbStage: { pointOf(id: string): unknown } }).darbStage.pointOf(
          key,
        ) !== null,
      k,
    );
  // The seed's lists fit in one page today; this runs once a list has a second page.
  const more = page.locator("[data-show-more]");
  if (await more.count()) {
    await more.click();
    const all = await keys();
    await expect.poll(() => pinned(all.at(-1)!)).toBe(true);
  }
  const filtered = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/api/businesses"),
  );
  await page.locator('[data-filter="delivers"]').click();
  await filtered;
  await expect(page).toHaveURL(`${kind}?delivers=1`);
  const shown = await keys();
  expect(shown.length).toBeGreaterThan(0);
  for (const k of shown) await expect.poll(() => pinned(k)).toBe(true);
});
