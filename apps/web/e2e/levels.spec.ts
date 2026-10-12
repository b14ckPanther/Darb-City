import { expect, test } from "@playwright/test";
import { BUSINESS_KEY, EMPTY_KIND, LEVELS, OTHER_PLACE_BUSINESS } from "./fixtures";

test("level 0 links every live place and every kind", async ({ page }) => {
  expect((await page.goto(LEVELS.country))?.status()).toBe(200);
  await expect(page.locator('#places a[href="/sakhnin"]')).toHaveCount(1);
  await expect(page.locator('#kinds a[href="/k/barbershops"]')).toHaveCount(1);
});

test("level 1 shows one door per sector with live counts", async ({ page }) => {
  await page.goto(LEVELS.place);
  await expect(page.locator("[data-door]")).toHaveCount(18);
  const beauty = Number(await page.locator('[data-door="beauty"]').getAttribute("data-count"));
  expect(beauty).toBeGreaterThan(0);
});

test("level 2 keeps empty doors visible", async ({ page }) => {
  await page.goto("/arraba/beauty");
  await expect(page.locator('[data-door="barbershops"]')).toHaveAttribute("data-count", "1");
  await expect(page.locator('[data-door="nails"]')).toHaveAttribute("data-count", "0");
});

test("level 3 lists businesses that open the sheet", async ({ page }) => {
  await page.goto(LEVELS.kind);
  await expect(page.locator(`[data-business-link="${BUSINESS_KEY}"]`)).toHaveAttribute(
    "href",
    LEVELS.business,
  );
});

test("an empty kind is a 200 that names the nearest places that have it", async ({ page }) => {
  expect((await page.goto(EMPTY_KIND))?.status()).toBe(200);
  await expect(page.locator("[data-none-yet]")).toBeVisible();
  await expect(page.locator("[data-nearest-place]").first()).toHaveAttribute(
    "data-nearest-place",
    "sakhnin",
  );
  await expect(page.locator("[data-nearest-place]").first()).toHaveAttribute(
    "href",
    "/sakhnin/beauty/nails",
  );
});

test("neighbourhood chips filter Haifa's list without adding depth", async ({ page }) => {
  await page.goto("/haifa/beauty/barbershops");
  await expect(page.locator('[data-chip="haifa"]')).toHaveAttribute("aria-current", "page");
  await page.locator('[data-chip="kiryat-haim"]').click();
  await expect(page).toHaveURL("/kiryat-haim/beauty/barbershops");
  await expect(page.locator('[data-chip="kiryat-haim"]')).toHaveAttribute("aria-current", "page");
});

test("the national kind pages through every place", async ({ page }) => {
  await page.goto(LEVELS.nationalKind);
  await expect(page.locator("[data-business]")).toHaveCount(30);
  await page.locator("[data-show-more]").click();
  await expect(page.locator("[data-business]")).toHaveCount(60);
});

test("the place shortcut lands on the canonical kind URL", async ({ page }) => {
  await page.goto("/sakhnin/k/barbershops");
  await expect(page).toHaveURL(LEVELS.kind);
});

test("a business from another place is a 404, not that place's business", async ({ page }) => {
  expect((await page.goto(OTHER_PLACE_BUSINESS))?.status()).toBe(404);
  await expect(page.locator("[data-not-found]")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("level 4 opens the sheet over the list", async ({ page }) => {
  expect((await page.goto(LEVELS.business))?.status()).toBe(200);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(`[data-business-link="${BUSINESS_KEY}"]`)).toBeAttached();
});
