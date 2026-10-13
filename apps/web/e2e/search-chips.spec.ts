import { expect, test, type Page } from "@playwright/test";

const chips = (page: Page) =>
  page.locator("[data-chip]").evaluateAll((els) => els.map((el) => el.getAttribute("data-chip")));
const results = (page: Page) =>
  page
    .locator("[data-search-results] [data-business-link]")
    .evaluateAll((els) => els.map((el) => el.getAttribute("data-business-link")));

test("a removed chip lives in the URL: a reload brings back the same chips and results", async ({
  page,
}) => {
  await page.goto("/en/search?q=bakery%20haifa");
  await expect.poll(() => chips(page)).toEqual(["place:haifa", "kind:bakeries"]);
  const edited = page.waitForResponse((r) => r.url().endsWith("/api/search/results"));
  await page.getByRole("button", { name: "Remove Haifa" }).click();
  await edited;
  await expect(page).toHaveURL("/en/search?q=bakery+haifa&chips=kind:bakeries");
  await expect.poll(() => chips(page)).toEqual(["kind:bakeries"]);
  const before = await results(page);
  expect(before.length).toBeGreaterThan(0);

  await page.reload();
  await expect.poll(() => chips(page)).toEqual(["kind:bakeries"]);
  expect(await results(page)).toEqual(before);
  await expect(page.locator("#q")).toHaveValue("bakery haifa");
});

test("a new query from the header box replaces the results list", async ({ page }) => {
  await page.goto("/en/search?q=bakery%20haifa");
  await expect.poll(() => chips(page)).toEqual(["place:haifa", "kind:bakeries"]);
  await page.locator("#q").fill("barber sakhnin");
  await page.locator("[data-search-bar] button[type=submit]").click();
  await expect(page).toHaveURL("/en/search?q=barber+sakhnin");
  await expect.poll(() => chips(page)).toEqual(["place:sakhnin", "kind:barbershops"]);
});
