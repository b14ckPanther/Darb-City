import { expect, test } from "@playwright/test";

// Task 27b: the gluten-free filter means a whole gluten-free kitchen (safe for celiac disease).
const RESTAURANTS = "/en/akko/food/restaurants";

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __DARB_E2E__: true }));
});

test("the gluten-free chip filters in place, badges every row and is shareable", async ({
  page,
}) => {
  await page.goto(RESTAURANTS);
  const chip = page.locator('[data-filter="gluten-free"]');
  await expect(chip).toHaveText("Gluten-free");
  const filtered = page.waitForResponse(
    (r) => r.request().method() === "POST" && r.url().endsWith("/api/businesses"),
  );
  await chip.click();
  await filtered;
  await expect(chip).toHaveAttribute("aria-pressed", "true");
  await expect(page).toHaveURL(`${RESTAURANTS}?glutenFree=1`);
  // Caramel (Task 28) is Akko's fully gluten-free restaurant; every row shows the badge.
  const rows = page.locator("[data-business-list] li");
  await expect(page.locator('[data-business="akko/caramel"]')).toBeVisible();
  await expect(rows.locator("[data-gluten-free]")).toHaveCount(await rows.count());
  await page.reload();
  await expect(page.locator('[data-filter="gluten-free"]')).toHaveAttribute("aria-pressed", "true");
});

test("the chip is only offered for food, and reads in Hebrew and Arabic", async ({ page }) => {
  await page.goto("/akko/food/restaurants");
  await expect(page.locator('[data-filter="gluten-free"]')).toHaveText("ללא גלוטן");
  await page.goto("/ar/akko/food/restaurants");
  await expect(page.locator('[data-filter="gluten-free"]')).toHaveText("خالٍ من الغلوتين");
  await page.goto("/en/akko/beauty/barbershops");
  await expect(page.locator('[data-filter="gluten-free"]')).toHaveCount(0);
});
