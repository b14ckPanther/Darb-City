import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { EMPTY_KIND, LEVELS, LOCALES, localePath } from "./fixtures";

const PAGES = [...Object.values(LEVELS), EMPTY_KIND, "/for-business"];

for (const locale of LOCALES) {
  for (const path of PAGES) {
    test(`${locale} ${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(localePath(locale, path));
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(
        violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
      ).toEqual([]);
    });
  }
}
