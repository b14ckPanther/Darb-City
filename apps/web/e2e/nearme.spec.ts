import { expect, test } from "@playwright/test";
import { ARRABA } from "./fixtures";

test.describe("with location", () => {
  test.use({ geolocation: ARRABA, permissions: ["geolocation"] });

  test("jumps to the nearest live place", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-near-me]").click();
    await expect(page).toHaveURL("/arraba");
  });

  test("on a national kind page, jumps to the nearest place that has it", async ({ page }) => {
    await page.goto("/k/nails");
    await page.locator("[data-near-me-kind]").click();
    await expect(page).toHaveURL("/sakhnin/beauty/nails");
  });
});

test.describe("without location", () => {
  test.use({ permissions: [] });

  test("explains in one line and stays put", async ({ page }) => {
    await page.goto("/en");
    await page.locator("[data-near-me]").click();
    await expect(page.locator("[data-near-me-message]")).toHaveText(
      "Location is off. Pick a place from the list instead.",
    );
    await expect(page).toHaveURL("/en");
  });
});
