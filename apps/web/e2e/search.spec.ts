import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BUSINESS_KEY, isPhone, LEVELS, settleStage } from "./fixtures";

const box = (page: Page) => page.getByRole("combobox");
const listbox = (page: Page) => page.locator("[data-search-listbox]");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __DARB_E2E__: true }));
});

test("suggests kind in place as you type and goes straight to its list", async ({ page }) => {
  await page.goto("/en");
  await box(page).click();
  await box(page).fill("barbr haifa");
  await expect(listbox(page)).toBeVisible();
  await expect(listbox(page).locator('[data-option="pair:haifa/barbershops"]')).toBeVisible();
  await box(page).press("ArrowDown");
  await box(page).press("Enter");
  await expect(page).toHaveURL("/en/haifa/beauty/barbershops");
});

test("suggests business names from the API", async ({ page }) => {
  await page.goto("/en/sakhnin");
  await box(page).fill("samer");
  await expect(listbox(page).locator('[data-option^="business:sakhnin/"]').first()).toBeVisible();
});

test("Escape closes, then clears, and never closes the open business sheet (M5)", async ({
  page,
}, info) => {
  // On a phone the sheet is modal: the search behind it is inert, so Escape never reaches the box.
  test.skip(isPhone(info), "the phone sheet is modal");
  await page.goto(LEVELS.business);
  const sheet = page.locator("[data-sheet]");
  await expect(sheet).toBeVisible();
  await box(page).fill("hai");
  await expect(listbox(page)).toBeVisible();
  await box(page).press("Escape");
  await expect(listbox(page)).toBeHidden();
  await box(page).press("Escape");
  await expect(box(page)).toHaveValue("");
  await expect(sheet).toBeVisible();
  await expect(page).toHaveURL(LEVELS.business);
});

test("on a phone the listbox opens above the dock and the Map pill steps aside", async ({
  page,
}, info) => {
  test.skip(!isPhone(info), "phone layout");
  await page.goto("/sakhnin");
  await settleStage(page);
  await box(page).fill("חומוס");
  await expect(listbox(page)).toBeVisible();
  const list = (await listbox(page).boundingBox())!;
  const input = (await box(page).boundingBox())!;
  expect(list.y + list.height).toBeLessThanOrEqual(input.y);
  await expect(page.locator("[data-stage-toggle]")).toBeHidden();
});

test("Ctrl+K focuses the search", async ({ page }, info) => {
  test.skip(isPhone(info), "keyboard shortcut");
  await page.goto("/en/sakhnin");
  await page.keyboard.press("Control+k");
  await expect(box(page)).toBeFocused();
});

test("a recorded sentence gets chips, and removing one re-runs retrieval in place", async ({
  page,
}) => {
  await page.goto("/en/search?q=where+can+I+get+falafel+in+nazareth%3F");
  await expect(page.locator('[data-chip="kind:hummus"]')).toBeVisible();
  await expect(page.locator('[data-chip="place:nazareth"]')).toBeVisible();
  const before = await page.locator("[data-business-list] li").count();
  expect(before).toBeGreaterThan(0);
  await page.getByRole("button", { name: /Remove Nazareth/ }).click();
  await expect(page.locator('[data-chip="place:nazareth"]')).toHaveCount(0);
  await expect
    .poll(() => page.locator("[data-business-list] li").count())
    .toBeGreaterThanOrEqual(before);
  await expect(page).toHaveURL(/\/en\/search\?q=/); // no navigation
});

test("an unrecorded query still gets results from lane 1, with nothing unusual on screen", async ({
  page,
}) => {
  await page.goto("/en/search?q=barbershop+in+sakhnin+for+my+little+brother");
  await expect(page.locator('[data-chip="place:sakhnin"]')).toBeVisible();
  await expect(page.locator(`[data-business="${BUSINESS_KEY}"]`)).toBeVisible();
  await expect(page.locator("[data-search-fallback]")).toHaveCount(0);
});

for (const [q, path] of [
  ["bars in haifa", "/en/search"],
  ["בר בחיפה", "/search"],
  ["خمور في حيفا", "/ar/search"],
] as const) {
  test(`a blocked search (${q}) shows one calm sentence and no results`, async ({ page }) => {
    await page.goto(`${path}?q=${encodeURIComponent(q)}`);
    const blocked = page.locator("[data-search-blocked]");
    await expect(blocked).toBeVisible();
    await expect(page.locator("[data-business-list]")).toHaveCount(0);
    expect(await page.locator("body").innerText()).not.toMatch(/halal|حلال|חלאל/i);
  });
}

test("works without JavaScript", async ({ browser }) => {
  const context = await browser.newContext({ javaScriptEnabled: false });
  const page = await context.newPage();
  await page.goto("/en/search?q=barber+haifa");
  await expect(page.locator("[data-business-list] li").first()).toBeVisible();
  await context.close();
});

test("the stage stays mounted and shows the results' pins (M7)", async ({ page }, info) => {
  test.skip(isPhone(info), "desktop split layout");
  await page.goto("/en/sakhnin");
  await settleStage(page);
  await box(page).fill("hummus sakhnin and more");
  await box(page).press("Enter");
  await expect(page).toHaveURL(/\/en\/search\?q=/);
  await expect(page.locator("[data-stage-host]")).toHaveAttribute("data-stage-state", "ready");
  const key = await page.locator("[data-business]").first().getAttribute("data-business");
  await expect
    .poll(() =>
      page.evaluate(
        (k) =>
          (window as unknown as { darbStage: { pointOf(id: string): unknown } }).darbStage.pointOf(
            k!,
          ),
        key,
      ),
    )
    .not.toBeNull();
});

test("the open combobox has no WCAG A/AA violations", async ({ page }) => {
  await page.goto("/en");
  await box(page).fill("haifa");
  await expect(listbox(page)).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
    .analyze();
  expect(violations.map((v) => v.id)).toEqual([]);
});

test.describe("deep search: the thing inside the card", () => {
  test("finds gluten-free shawarma on Caramel's menu and highlights it on the card", async ({
    page,
  }) => {
    await page.goto("/en/search?q=gluten+free+shawarma");
    const first = page.locator("[data-business-list] li").first();
    await expect(first).toHaveAttribute("data-business", "akko/caramel");
    await expect(first.locator("[data-matched]")).toContainText("gluten-free shawarma");
    await expect(first.locator("[data-matched]")).toContainText("Challah and laffa sandwiches");
    // The asked diet is a must: its badge is the highlighted one, on every row.
    const rows = page.locator("[data-business-list] li");
    await expect(rows.locator("[data-gluten-free][data-strict]")).toHaveCount(await rows.count());
    await first.locator("[data-business-link]").click();
    await expect(page).toHaveURL(/\/en\/akko\/food\/restaurants\/caramel\?hl=shawarma$/);
    const marked = page.locator("[data-template] [data-highlight]");
    await expect(marked).toHaveCount(1);
    await expect(marked).toContainText("Meals");
  });

  test("says honestly when the closest match is in another town", async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent("שווארמה ללא גלוטן בכרמיאל")}`);
    const line = page.locator('[data-search-fallback-line="wider"]');
    await expect(line).toBeVisible();
    await expect(line).toContainText("כרמיאל");
    await expect(line).toContainText("קרמל");
    await expect(page.locator("[data-business-list] li").first()).toHaveAttribute(
      "data-business",
      "akko/caramel",
    );
  });

  test("finds a fuel station by the car wash on its card", async ({ page }) => {
    await page.goto(`/search?q=${encodeURIComponent("שטיפת רכב בחיפה")}`);
    const paz = page.locator('[data-business^="haifa/paz-"]').first();
    await expect(paz).toBeVisible();
    await expect(paz.locator("[data-matched]")).toContainText("שטיפת רכב");
  });
});
