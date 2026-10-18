import { expect, test } from "@playwright/test";
import { BUSINESS_KEY, HAIFA, isPhone, LEVELS, localePath } from "./fixtures";

test("phone keyboard: open from the list, stay trapped, Escape returns focus to the row", async ({
  page,
}, info) => {
  test.skip(!isPhone(info), "phone only: the desktop panel is non-modal (next test)");
  await page.goto(LEVELS.kind);
  const row = page.locator(`[data-business-link="${BUSINESS_KEY}"]`);
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(LEVELS.business);
  await expect(dialog.locator("[data-sheet-close]")).toBeFocused();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(LEVELS.kind);
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("desktop keyboard: Tab leaves the panel after its last control, Escape still closes", async ({
  page,
}, info) => {
  test.skip(isPhone(info), "desktop only");
  await page.goto(LEVELS.kind);
  const row = page.locator(`[data-business-link="${BUSINESS_KEY}"]`);
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("[data-sheet-close]")).toBeFocused();
  const inside = () => dialog.evaluate((d) => d.contains(document.activeElement));
  // Shift+Tab from the first control moves back into the page, not round to the panel's end.
  await page.keyboard.press("Shift+Tab");
  expect(await inside()).toBe(false);
  expect(await page.evaluate(() => document.activeElement !== document.body)).toBe(true);
  // From the panel's last control, Tab moves on out of the panel.
  await dialog.evaluate((d) => {
    const visible = [...d.querySelectorAll<HTMLElement>("a[href], button, input, summary")].filter(
      (el) => el.getClientRects().length > 0,
    );
    visible.at(-1)!.focus();
  });
  expect(await inside()).toBe(true);
  await page.keyboard.press("Tab");
  expect(await inside()).toBe(false);
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(LEVELS.kind);
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("closing a directly loaded sheet also lands on its row", async ({ page }) => {
  await page.goto(LEVELS.business);
  await page.locator("[data-sheet-close]").click();
  await expect(page).toHaveURL(LEVELS.kind);
  await expect(page.locator(`[data-business-link="${BUSINESS_KEY}"]`)).toBeFocused();
});

test("a neighbourhood's row opens over the city's list and closes back to it", async ({ page }) => {
  await page.goto(HAIFA.kind);
  const heading = page.locator("#main-heading");
  await expect(heading).toHaveText("Barbers in Haifa");
  const row = page.locator(`[data-business-link="${HAIFA.subPlaceKey}"]`);
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(HAIFA.subPlaceBusiness);
  expect(new URL(page.url()).pathname.startsWith("/en/haifa/")).toBe(true);
  // The Kiryat Haim business itself, over Haifa's list (not Haifa's twin, not Kiryat Haim's list).
  await expect(dialog).toContainText("· Kiryat Haim");
  await expect(heading).toHaveText("Barbers in Haifa");
  await dialog.locator("[data-sheet-close]").click();
  await expect(page).toHaveURL(HAIFA.kind);
  await expect(dialog).toHaveCount(0);
  await expect(heading).toHaveText("Barbers in Haifa");
  await expect(row).toBeFocused();
});

test("an example business explains itself instead of calling", async ({ page }) => {
  await page.goto(`/en${LEVELS.business}`);
  await page.locator("[data-primary-action]").click();
  await expect(page.locator("[data-sheet-status]")).toHaveText(
    "This is an example. This is what your customers would see",
  );
});

for (const [locale, side] of [
  ["he", "left"],
  ["ar", "left"],
  ["en", "right"],
] as const) {
  test(`desktop: the side panel sits on the ${side} in ${locale}`, async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(localePath(locale, LEVELS.business));
    const box = (await page.getByRole("dialog").boundingBox())!;
    if (side === "left") expect(box.x).toBeLessThan(10);
    else expect(box.x + box.width).toBeGreaterThan(1430);
    expect(box.width).toBeLessThanOrEqual(480);
  });
}

test("phone: the bottom sheet moves between snap points", async ({ page }, info) => {
  test.skip(!isPhone(info), "phone only");
  await page.goto(LEVELS.business);
  const dialog = page.getByRole("dialog");
  // It opens full: the whole card, with its close button to back out.
  await expect(dialog).toHaveAttribute("data-snap", "full");
  await page.locator("[data-sheet-handle]").focus();
  await page.keyboard.press("ArrowDown");
  await expect(dialog).toHaveAttribute("data-snap", "half");
  await page.keyboard.press("ArrowDown");
  await expect(dialog).toHaveAttribute("data-snap", "peek");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the sheet does not fly", async ({ page }) => {
    await page.goto(LEVELS.business);
    const duration = await page
      .getByRole("dialog")
      .evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe("0.001s");
  });
});

test("desktop: the side panel is non-modal and the city behind it stays usable", async ({
  page,
}, info) => {
  test.skip(isPhone(info), "desktop only");
  await page.goto(LEVELS.business);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveAttribute("aria-modal", "true");
  await expect(page.locator("#site-header")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#city-list")).not.toHaveAttribute("inert", "");
  // The path bar's up arrow, behind the panel, still works and closes the sheet.
  await page.locator("[data-path-bar] [data-up]").click();
  await expect(page).toHaveURL(LEVELS.kind);
  await expect(dialog).toHaveCount(0);
});

for (const locale of ["he", "en"] as const) {
  test(`desktop: the side panel stands above the site header (${locale})`, async ({
    page,
  }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(localePath(locale, LEVELS.business));
    await expect(page.locator("html")).toHaveAttribute("data-stage", "on");
    const close = page.locator("[data-sheet-close]");
    const header = (await page.locator("[data-site-header]").boundingBox())!;
    const box = (await close.boundingBox())!;
    // The close button sits in the header's band, and nothing of the header covers it.
    expect(box.y).toBeLessThan(header.y + header.height);
    expect(
      await close.evaluate((el) => {
        const r = el.getBoundingClientRect();
        return el.contains(document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2));
      }),
    ).toBe(true);
  });
}
