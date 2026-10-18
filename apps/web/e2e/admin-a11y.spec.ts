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
  "/field",
  "/join-requests",
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
  ["/admin/businesses?q=samer&examples=1", "business editor"],
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

test("a takedown the web did not confirm warns accessibly, and Retry clears it", async ({
  page,
  context,
  baseURL,
}) => {
  await context.addCookies([
    { name: "darb_admin_fake", value: "fake.user_e2e.e2e-admin@darb.test", url: baseURL! },
  ]);
  await page.goto("/en/admin/businesses?q=samer&examples=1");
  await page.locator("table tbody tr a").first().click();
  await page.waitForLoadState("networkidle");
  // The flag the admin lands on when the API answers revalidated: false.
  await page.goto(`${page.url()}?stale=1`);
  const warning = page.locator("[data-takedown-stale]");
  await expect(warning).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
  // Here the web is up, so the retry is confirmed and the page comes back without the warning.
  await warning.getByRole("button", { name: "Try again" }).click();
  await expect(page).not.toHaveURL(/stale=/);
  await expect(page.locator("[data-takedown-stale]")).toHaveCount(0);
});
