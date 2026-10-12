import { expect, test } from "@playwright/test";
import { LEVELS } from "./fixtures";

test("switching language keeps the path, even inside the sheet", async ({ page }) => {
  await page.goto(LEVELS.business);
  const sheetSwitch = page.locator('[role="dialog"] [data-locale-switch]');
  await sheetSwitch.locator('a[hreflang="en"]').click();
  await expect(page).toHaveURL(`/en${LEVELS.business}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.locator('[role="dialog"] [data-locale-switch] a[hreflang="ar"]').click();
  await expect(page).toHaveURL(`/ar${LEVELS.business}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.locator('[role="dialog"] [data-locale-switch] a[hreflang="he"]').click();
  await expect(page).toHaveURL(LEVELS.business);
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
});

test("the city bar switch keeps the path on list levels", async ({ page }) => {
  await page.goto(LEVELS.sector);
  await page.locator('#city-bar [data-locale-switch] a[hreflang="ar"]').click();
  await expect(page).toHaveURL(`/ar${LEVELS.sector}`);
});

test("Arabic falls back to Hebrew and is never blank", async ({ page }) => {
  await page.goto(`/ar${LEVELS.nationalKind}`);
  const names = await page.locator("[data-business-name]").allTextContents();
  expect(names.length).toBeGreaterThan(0);
  for (const name of names) expect(name.trim()).not.toBe("");
  await page.goto(`/ar${LEVELS.sector}`);
  const doors = await page.locator("[data-door]").allTextContents();
  expect(doors.length).toBeGreaterThan(0);
  for (const label of doors) expect(label.trim()).not.toBe("");
  await page.goto(`/ar${LEVELS.business}`);
  expect((await page.locator("[data-sheet-title]").textContent())?.trim()).not.toBe("");
  // Every seeded name now has Arabic (pickText's Hebrew fallback is unit-tested in @darb/core),
  // so the Arabic page shows the Arabic name, not the Hebrew one it used to fall back to.
  await page.goto("/ar/sakhnin/auto/garages/hagalgal-garage");
  await expect(page.locator("[data-sheet-title]")).toHaveText("كراج العجلة");
});

test("an explicit Hebrew prefix redirects to the unprefixed URL", async ({ page }) => {
  await page.goto(`/he${LEVELS.place}`);
  await expect(page).toHaveURL(LEVELS.place);
});
