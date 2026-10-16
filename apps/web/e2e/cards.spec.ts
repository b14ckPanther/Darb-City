import { expect, test } from "@playwright/test";
import { isPhone, LEVELS, localePath } from "./fixtures";

/** The designed business card (level 4's sheet) and the rows that lead to it. */

test("the card names each round button, drives there in Waze, and says today in words", async ({
  page,
}) => {
  await page.goto(localePath("en", LEVELS.business));
  const card = page.locator("[data-sheet] [data-business-card]");
  const row = card.getByRole("list", { name: "Ways to reach them" });
  await expect(row.getByRole("link", { name: "Waze" })).toHaveAttribute(
    "href",
    /^https:\/\/waze\.com\/ul\?ll=3\d\.\d+,3\d\.\d+&navigate=yes$/,
  );
  await expect(row.getByRole("link", { name: "Maps" })).toHaveAttribute(
    "href",
    /^https:\/\/www\.google\.com\/maps\/dir\//,
  );
  await expect(row.getByRole("button", { name: "Share" })).toBeVisible();
  await expect(card.locator("[data-today-state]")).toHaveText(
    /^(Open until|Opens at|Opens tomorrow at|Closed today|Open 24 hours)/,
  );
  // The week stays a table: a row a day, today said to screen readers.
  const week = card.getByRole("table", { name: "Opening hours" });
  await expect(week.getByRole("rowheader")).toHaveCount(7);
  await expect(week.getByRole("rowheader", { name: /\(Today\)$/ })).toHaveCount(1);
});

test("the band's ink reads on the accent (at least 4.5:1)", async ({ page }) => {
  await page.goto(localePath("ar", LEVELS.business));
  const band = page.locator("[data-sheet] [data-business-card] header");
  const ratio = await band.evaluate((el) => {
    const rgb = (c: string) =>
      c
        .match(/\d+(\.\d+)?/g)!
        .slice(0, 3)
        .map(Number);
    const lum = (c: number[]) => {
      const [r, g, b] = c.map((v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
      }) as [number, number, number];
      return 0.2126 * r + 0.7152 * g + 0.0722 * b;
    };
    const style = getComputedStyle(el);
    const [a, b] = [lum(rgb(style.backgroundColor)), lum(rgb(style.color))].sort((x, y) => y - x);
    return (a! + 0.05) / (b! + 0.05);
  });
  expect(ratio).toBeGreaterThanOrEqual(4.5);
});

test("a home business shows no street and no way to it", async ({ page }) => {
  await page.goto("/en/nahf/beauty/cosmetics/raghad");
  const card = page.locator("[data-sheet] [data-business-card]");
  await expect(card.locator("[data-appointment]")).toHaveText("By appointment");
  await expect(card.locator('a[href*="waze.com"], a[href*="google.com/maps"]')).toHaveCount(0);
  await expect(card.locator("[data-address]")).toHaveCount(0);
});

test("list rows wear the card's accent", async ({ page }, info) => {
  test.skip(!isPhone(info), "one viewport is enough");
  await page.goto(LEVELS.kind);
  const link = page.locator("[data-business-link]").first();
  await expect(link).toHaveAttribute("style", /--row-accent:\s*#[0-9a-f]{6}/);
});
