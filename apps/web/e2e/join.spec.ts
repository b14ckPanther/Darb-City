import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { isPhone } from "./fixtures";

const ADMIN = "fake.user_e2e.e2e-admin@darb.test";
/** Abu Snan and upholstery appear in no other spec, so a published card disturbs no other page. */
const PLACE = { slug: "abu-snan", name: "Abu Snan" };

/** e2e runs with the model and OpenStreetMap off: a lookup by name finds nothing, as off. */
async function toCheckStep(page: Page, name: string) {
  await page.goto("/en/join");
  await page.getByLabel("Business name and town, or a link").fill(name);
  await page.getByRole("main").getByRole("button", { name: "Search", exact: true }).click();
  await expect(page.getByRole("heading", { name: "Check your card" })).toBeFocused();
  await expect(page.getByText("Smart search is off right now.")).toBeVisible();
}

async function fillCard(page: Page) {
  const kind = page.getByRole("combobox", { name: "Type of business" });
  await kind.fill("upholst");
  await page.getByRole("option", { name: "Upholstery" }).click();
  await page.getByRole("combobox", { name: "Town" }).fill("abu sn");
  await page.getByRole("option", { name: PLACE.name }).click();
  // The map opens over the town; a tap puts the pin there.
  await page.locator("[data-location-picker]").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-location-picker="map"]')).toBeVisible({ timeout: 20_000 });
  const canvas = page.locator('[data-location-picker="map"] canvas');
  await canvas.scrollIntoViewIfNeeded();
  await canvas.click();
  await expect(page.getByText(/^3\d\.\d{6}, 3\d\.\d{6}$/)).toBeVisible();
  await page.getByLabel("Phone (optional)").fill("04-555-1234");
  await page.getByLabel("Instagram (optional)").fill("@e2e.upholstery");
  await page.getByRole("button", { name: "Sun to Thu 9 to 18, Fri 9 to 14" }).click();
  await page.getByLabel("Your name").fill("E2E Owner");
  await page.getByLabel("Your phone").fill("050-000-0000");
}

test.describe("join", () => {
  test("an owner fills the card by hand, and the admin approves and publishes it", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    test.slow();
    const name = `Join E2E ${test.info().project.name} ${Date.now().toString(36)}`;
    const slug = name.toLowerCase().replace(/\s+/g, "-");
    await toCheckStep(page, name);
    // The typed name is the business's name; the live card shows it.
    await expect(page.getByLabel("Business name", { exact: true })).toHaveValue(name);
    const card = page.getByRole("figure", { name: "How it will look" });
    await expect(card.getByText(name)).toBeVisible();

    // Sending too early names what is missing and puts the focus on the first one.
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByRole("combobox", { name: "Type of business" })).toBeFocused();
    await expect(page.getByText("Pick the type of business.")).toBeVisible();

    await fillCard(page);
    await expect(card.getByText("Upholstery · Abu Snan")).toBeVisible();
    await expect(card.getByRole("listitem")).toHaveText(["Call", "WhatsApp", "Waze", "Instagram"]);
    await page.getByRole("button", { name: "Send for review" }).click();
    await expect(page.getByRole("heading", { name: "Thanks! We got it." })).toBeFocused();

    // A draft is nowhere public until approved (the API's tests check every public list).
    const publicPath = `/en/${PLACE.slug}/home/upholstery/${slug}`;

    await context.addCookies([{ name: "darb_admin_fake", value: ADMIN, url: baseURL! }]);
    await page.goto("/en/admin/join-requests?status=pending");
    await page.getByRole("link", { name }).click();
    await expect(page.getByRole("heading", { name })).toBeVisible();
    await expect(page.getByText("050-000-0000")).toBeVisible();
    await expect(page.getByLabel("Instagram", { exact: true })).toHaveValue(
      "https://www.instagram.com/e2e.upholstery/",
    );
    await page.getByRole("button", { name: "Approve and publish" }).click();
    await expect(page.getByText("Approved", { exact: true })).toBeVisible();
    await expect.poll(async () => (await request.get(publicPath)).status()).toBe(200);
  });

  test("the card step has no WCAG A/AA violations, and its targets fit a finger", async ({
    page,
  }, info) => {
    await toCheckStep(page, "Axe Check");
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    ).toEqual([]);
    if (!isPhone(info)) return;
    const report = await page.evaluate(() => {
      // An input inside its label is tapped through the label, so the label is the target.
      const targetOf = (el: Element) =>
        el.matches("input") && el.closest("label") ? el.closest("label")! : el;
      const small = [
        ...document.querySelectorAll("a[href], button, input, summary, [role='button']"),
      ]
        .filter((el) => !el.closest("p, [aria-hidden='true'], .maplibregl-map"))
        .map(targetOf)
        .filter((el) => {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (box.width === 0 || style.visibility === "hidden" || style.display === "none")
            return false;
          return box.width < 44 || box.height < 44;
        })
        .map((el) => el.outerHTML.slice(0, 90));
      return {
        small: [...new Set(small)],
        overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth,
      };
    });
    expect(report.small).toEqual([]);
    expect(report.overflow).toBe(false);
  });

  test("a kind of business Darb does not list is never offered a card", async ({ page }) => {
    // e2e runs with the model off, so the API's "excluded" answer is played here.
    await page.route("**/api/join/lookup", (route) =>
      route.fulfill({ json: { found: false, reason: "excluded", sources: [], osm: false } }),
    );
    await page.goto("/en/join");
    await page.getByLabel("Business name and town, or a link").fill("A wine bar");
    await page.getByRole("main").getByRole("button", { name: "Search", exact: true }).click();
    await expect(page.getByRole("main").getByRole("alert")).toHaveText(
      "Darb doesn't list this kind of business.",
    );
  });
});
