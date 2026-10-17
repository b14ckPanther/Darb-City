import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Locator } from "@playwright/test";
import { ARRABA, isPhone, LEVELS, localePath, settleStage } from "./fixtures";

/** Whether the element drawn at the centre of `locator` is inside it (nothing stacks over it). */
const onTop = (locator: Locator) =>
  locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && el.contains(hit);
  });

test.describe("with location", () => {
  test.use({ geolocation: ARRABA, permissions: ["geolocation"] });

  test("opens /near around a precise fix kept only in this tab", async ({ page }) => {
    await page.goto("/");
    const named = page.waitForRequest("**/api/near");
    const listed = page.waitForRequest("**/api/near/businesses");
    await page.locator("[data-near-me]").click();
    await expect(page).toHaveURL("/near");
    // The position travels in POST bodies, never in a URL an access log would keep.
    for (const sent of [await named, await listed]) {
      expect(sent.method()).toBe("POST");
      expect(sent.url()).not.toContain("lat=");
    }
    expect(page.url()).not.toContain("32.8");
    const kept = await page.evaluate(() => JSON.parse(sessionStorage.getItem("darb.here")!));
    expect(kept).toMatchObject({ lat: ARRABA.latitude, lng: ARRABA.longitude });
    // The list and its map, closest first, under "Near you · <the place>".
    await expect(page.locator("[data-near-you]")).toHaveAttribute("data-near-you", "ready");
    await expect(page.locator("[data-business-list] [data-business]").first()).toBeVisible();
    const heading = page.locator("#main-heading");
    await expect(heading).toContainText("·");
    const place = (await heading.innerText()).split("·")[1]!.trim();
    // The header button names the place it found, and keeps it after a reload, list and all.
    await expect(page.locator("[data-near-me]")).toContainText(place);
    await page.reload();
    await expect(page.locator("[data-near-me]")).toContainText(place);
    await expect(page.locator("[data-business-list] [data-business]").first()).toBeVisible();
  });

  test("/near on its own asks on a button, never by itself", async ({ page }) => {
    await page.goto("/en/near");
    const ask = page.locator("[data-near-you-locate]");
    await expect(ask).toBeVisible();
    await expect(page.locator("[data-business]")).toHaveCount(0);
    await ask.click();
    await expect(page.locator("[data-business-list] [data-business]").first()).toBeVisible();
    await expect(page).toHaveURL("/en/near");
  });

  test("the listed /near page and its map pass WCAG A/AA and never scroll sideways", async ({
    page,
  }) => {
    await page.goto("/ar");
    await page.locator("[data-near-me]").click();
    await expect(page).toHaveURL("/ar/near");
    await expect(page.locator("[data-business-list] [data-business]").first()).toBeVisible();
    await expect(page.locator("[data-map]")).not.toHaveAttribute("data-map", "waiting", {
      timeout: 30_000,
    });
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
      ),
    ).toBe(false);
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

  test("/near says so plainly and offers the places instead", async ({ page }) => {
    await page.goto("/en/near");
    await page.locator("[data-near-you-locate]").click();
    await expect(page.locator("[data-near-you-denied]")).toBeVisible();
    await expect(page.getByRole("link", { name: "Browse places" })).toHaveAttribute(
      "href",
      "/en/israel",
    );
  });

  test("the message stands above the list column, the stage and the Map pill", async ({
    page,
  }, info) => {
    // The landing page has no stage; the country index is the first city page.
    await page.goto(localePath("en", LEVELS.country));
    await settleStage(page);
    await expect(page.locator("html")).toHaveAttribute("data-stage", "on");
    const pill = page.locator("[data-stage-toggle]");
    if (isPhone(info)) await expect(pill).toBeVisible();
    await page.locator("[data-near-me]").click();
    const message = page.locator("[data-near-me-message]");
    await expect(message).toBeVisible();
    expect(await onTop(message)).toBe(true);
    if (isPhone(info)) {
      // The message opens up from the docked search bar, over the pill.
      const m = (await message.boundingBox())!;
      const p = (await pill.boundingBox())!;
      const x = Math.max(m.x, p.x) + 2;
      const y = Math.max(m.y, p.y) + 2;
      expect(x < Math.min(m.x + m.width, p.x + p.width) && y < m.y + m.height).toBe(true);
      expect(
        await message.evaluate(
          (el, [px, py]) => el.contains(document.elementFromPoint(px!, py!)),
          [x, y],
        ),
      ).toBe(true);
    } else {
      // In English its centre is over the list column, just under the header.
      const list = (await page.locator("[data-city]").boundingBox())!;
      const m = (await message.boundingBox())!;
      expect(m.x + m.width / 2).toBeLessThan(list.x + list.width);
      expect(m.y + m.height).toBeGreaterThan(list.y);
    }
  });
});
