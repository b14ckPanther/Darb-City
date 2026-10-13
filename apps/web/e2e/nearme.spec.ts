import { expect, test, type Locator } from "@playwright/test";
import { ARRABA, isPhone, settleStage } from "./fixtures";

/** Whether the element drawn at the centre of `locator` is inside it (nothing stacks over it). */
const onTop = (locator: Locator) =>
  locator.evaluate((el) => {
    const box = el.getBoundingClientRect();
    const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
    return hit !== null && el.contains(hit);
  });

test.describe("with location", () => {
  test.use({ geolocation: ARRABA, permissions: ["geolocation"] });

  test("jumps to the nearest live place", async ({ page }) => {
    await page.goto("/");
    const request = page.waitForRequest("**/api/near");
    await page.locator("[data-near-me]").click();
    const sent = await request;
    // The position travels in a POST body, never in a URL an access log would keep.
    expect(sent.method()).toBe("POST");
    expect(sent.url()).not.toContain("lat=");
    await expect(page).toHaveURL("/arraba");
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

  test("the message stands above the list column, the stage and the Map pill", async ({
    page,
  }, info) => {
    await page.goto("/en");
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
