import { expect, test, type Page } from "@playwright/test";

/** Sakhnin's bakery delivers, whatever the hour (open now would depend on the clock). */
const KIND = "/sakhnin/food/bakeries";
const KEY = "sakhnin/shibolet-bakery";

const filteredFetch = (page: Page) =>
  page.waitForRequest(
    (r) =>
      r.method() === "POST" &&
      r.url().endsWith("/api/businesses") &&
      (r.postDataJSON() as { delivers?: boolean }).delivers === true,
  );

test("filters survive opening and closing a business, and a reload", async ({ page }) => {
  await page.goto(KIND);
  const delivers = page.locator('[data-filter="delivers"]');
  const loaded = filteredFetch(page);
  await delivers.click();
  await loaded;
  await expect(page).toHaveURL(`${KIND}?delivers=1`);
  await expect(delivers).toHaveAttribute("aria-pressed", "true");

  await page.locator(`[data-business-link="${KEY}"]`).click();
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page).toHaveURL(`${KIND}/shibolet-bakery?delivers=1`);

  await page.locator("[data-sheet-close]").click();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  await expect(page).toHaveURL(`${KIND}?delivers=1`);
  await expect(delivers).toHaveAttribute("aria-pressed", "true");

  const again = filteredFetch(page);
  await page.reload();
  await again;
  await expect(delivers).toHaveAttribute("aria-pressed", "true");
  await expect(page.locator(`[data-business-link="${KEY}"]`)).toBeVisible();
});
