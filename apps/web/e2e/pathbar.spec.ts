import { expect, test } from "@playwright/test";
import { LEVELS, localePath } from "./fixtures";

test("shows the path, marks where you are and goes up one level", async ({ page }) => {
  await page.goto(LEVELS.kind);
  const bar = page.locator("[data-path-bar]");
  await expect(bar.locator("li")).toHaveCount(4); // Israel ▸ Sakhnin ▸ Beauty ▸ Barbershops
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(1);
  await bar.locator("[data-up]").click();
  await expect(page).toHaveURL(LEVELS.sector);
  await page.locator("[data-path-bar] li a").nth(1).click();
  await expect(page).toHaveURL(LEVELS.place);
});

for (const [locale, mirrored] of [
  ["he", true],
  ["ar", true],
  ["en", false],
] as const) {
  test(`mirrors its arrows in ${locale}`, async ({ page }) => {
    await page.goto(localePath(locale, LEVELS.kind));
    const transform = (selector: string) =>
      page
        .locator(selector)
        .first()
        .evaluate((el) => getComputedStyle(el).transform);
    const flipped = "matrix(-1, 0, 0, 1, 0, 0)";
    expect(await transform("[data-up] svg")).toBe(mirrored ? flipped : "none");
    expect(await transform("[data-path-bar] li svg")).toBe(mirrored ? flipped : "none");
  });
}
