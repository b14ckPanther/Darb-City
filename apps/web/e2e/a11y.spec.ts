import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { EMPTY_KIND, LEVELS, LOCALES, localePath, settleStage } from "./fixtures";

const PAGES = [
  ...Object.values(LEVELS),
  EMPTY_KIND,
  "/for-business",
  "/search?q=barber%20haifa",
  "/search?q=bars",
  "/sakhnin/food/restaurants?open=1",
  // Task 27b/28: the gluten-free filter and the real clients' own palettes.
  "/akko/food/restaurants?glutenFree=1",
  "/akko/food/restaurants/caramel",
  "/nahf/beauty/cosmetics/raghad",
  "/kiryat-motzkin/services/stations/paz-kiryat-motzkin",
];

for (const locale of LOCALES) {
  for (const path of PAGES) {
    test(`${locale} ${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(localePath(locale, path));
      await page.waitForLoadState("networkidle");
      await settleStage(page);
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
      ).toEqual([]);
    });
  }
}
