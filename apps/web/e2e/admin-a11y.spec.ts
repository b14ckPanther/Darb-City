import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCALES } from "./fixtures";

const SCREENS = [
  "",
  "/places",
  "/sectors",
  "/kinds",
  "/businesses",
  "/businesses/new",
  "/places/new",
  "/kinds/new",
  "/report",
  "/sign-in",
];
const prefix = (l: string) => (l === "he" ? "" : `/${l}`);

for (const locale of LOCALES) {
  for (const screen of SCREENS) {
    test(`${locale} admin${screen || "/"} has no WCAG A/AA violations`, async ({
      page,
      context,
      baseURL,
    }) => {
      await context.addCookies([
        { name: "darb_admin_fake", value: "fake.user_e2e.e2e-admin@darb.test", url: baseURL! },
      ]);
      await page.goto(`${prefix(locale)}/admin${screen}`);
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
for (const [list, name] of [
  ["/admin/places?q=sakhnin", "place editor"],
  ["/admin/businesses?q=samer", "business editor"],
] as const) {
  test(`en ${name} has no WCAG A/AA violations`, async ({ page, context, baseURL }) => {
    await context.addCookies([
      { name: "darb_admin_fake", value: "fake.user_e2e.e2e-admin@darb.test", url: baseURL! },
    ]);
    await page.goto(`/en${list}`);
    await page.locator("table tbody tr a").first().click();
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
}
