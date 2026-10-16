import { expect, test, type BrowserContext, type Page } from "@playwright/test";

const ADMIN = "fake.user_e2e.e2e-admin@darb.test";
const signInAs = (context: BrowserContext, baseURL: string, value: string) =>
  context.addCookies([{ name: "darb_admin_fake", value, url: baseURL }]);

/** The location picker's map, once it has drawn (it falls back to the numbers if it cannot). */
async function pickerMap(page: Page) {
  // It loads as it scrolls into view, as a person would reach it.
  await page.locator("[data-location-picker]").scrollIntoViewIfNeeded();
  await expect(page.locator('[data-location-picker="map"]')).toBeVisible({ timeout: 20_000 });
  return page.locator('[data-location-picker="map"] canvas');
}
const pinField = (page: Page, name: "lat" | "lng") =>
  page.locator(`input[type="hidden"][name="${name}"]`);

/** amqa and upholstery appear in no other spec, so this business never disturbs their pages. */
const PLACE = "amqa";
const PUBLIC = (slug: string) => `/en/${PLACE}/home/upholstery/${slug}`;

test.describe("admin", () => {
  test("signed out goes to sign-in; a signed-in non-admin is refused", async ({
    page,
    context,
    baseURL,
  }) => {
    await page.goto("/en/admin/places");
    await expect(page).toHaveURL(/\/en\/admin\/sign-in$/);
    await signInAs(context, baseURL!, "fake.user_nobody.nobody@darb.test");
    await page.goto("/en/admin");
    await expect(page.getByText("This account is not a Darb admin")).toBeVisible();
  });

  test("the local sign-in form signs an admin in", async ({ page }) => {
    await page.goto("/en/admin/sign-in");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("admin pages are noindex, uncached and nonce-protected", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL!, ADMIN);
    const res = await page.goto("/admin");
    expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(res?.headers()["cache-control"]).toContain("no-store");
    expect(res?.headers()["content-security-policy"]).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
  });

  test("the location map draws under the admin CSP, and the arrow keys move the pin", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL!, ADMIN);
    const refused: string[] = [];
    page.on("console", (m) => {
      if (/Content Security Policy|Refused to/i.test(m.text())) refused.push(m.text());
    });
    await page.goto("/en/admin/businesses/new");
    const canvas = await pickerMap(page);
    await canvas.scrollIntoViewIfNeeded();
    await canvas.click();
    const lat = Number(await pinField(page, "lat").inputValue());
    await page.getByRole("button", { name: "Business pin. The arrow keys move it." }).focus();
    await page.keyboard.press("ArrowUp");
    await expect
      .poll(async () => Number(await pinField(page, "lat").inputValue()))
      .toBeGreaterThan(lat);
    await expect(page.getByText(/^3\d\.\d{6}, 3\d\.\d{6}$/)).toBeVisible();
    expect(refused).toEqual([]);
  });

  test("lists search places and kinds", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, ADMIN);
    await page.goto("/en/admin/places?q=sakhnin");
    await expect(page.getByRole("link", { name: "Sakhnin", exact: true })).toBeVisible();
    await page.goto("/en/admin/kinds?q=barber&status=active");
    await expect(page.getByRole("link", { name: "Barbers" })).toBeVisible();
  });

  test("create, publish, edit and suspend a business; the public city follows at once", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    test.slow();
    await signInAs(context, baseURL!, ADMIN);
    // Phone and desktop run at once: each project gets its own address.
    const slug = `e2e-${test.info().project.name}-${Date.now().toString(36)}`;
    await page.goto("/en/admin/businesses/new");
    await page.getByLabel("Web address (slug)").fill(slug);
    await page.getByLabel("Place", { exact: true }).fill(PLACE);
    await page.getByLabel("Name · English").fill("E2E Upholstery");
    await page.getByLabel("Tagline · English").fill("Sofas made new");
    await page.getByLabel("Street address · English").fill("Main street");
    const kindId = await page
      .locator('select[name="primaryKindId"] option', { hasText: "(upholstery)" })
      .getAttribute("value");
    await page.getByLabel("Kind", { exact: true }).selectOption(kindId!);
    // No numbers typed: the map opens over amqa (the place typed above) and a tap places the pin.
    const canvas = await pickerMap(page);
    await expect(pinField(page, "lat")).toHaveValue("");
    await canvas.scrollIntoViewIfNeeded();
    await canvas.click();
    await expect(pinField(page, "lat")).toHaveValue(/^3[23]\.\d+$/);
    await expect(pinField(page, "lng")).toHaveValue(/^35\.\d+$/);
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/businesses\/[0-9a-f-]{36}$/);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published").first()).toBeVisible();
    await expect
      .poll(async () => (await request.get(PUBLIC(slug))).status(), { timeout: 15_000 })
      .toBe(200);

    await page.getByLabel("Tagline · English").fill("Sofas and chairs made new");
    // Drag the pin a little; the saved point is where it was dropped.
    await pickerMap(page);
    const before = Number(await pinField(page, "lat").inputValue());
    const pin = page.getByRole("button", { name: "Business pin. The arrow keys move it." });
    await pin.scrollIntoViewIfNeeded();
    const box = (await pin.boundingBox())!;
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
    await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 30, { steps: 6 });
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2 - 60, { steps: 6 });
    await page.mouse.up();
    await expect
      .poll(async () => Number(await pinField(page, "lat").inputValue()))
      .toBeGreaterThan(before);
    const dropped = await pinField(page, "lat").inputValue();
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator('form [role="alert"]')).toHaveText(/Saved/);
    await page.reload();
    await expect(pinField(page, "lat")).toHaveValue(dropped);

    await page.getByRole("button", { name: "Suspend now" }).click();
    await expect(page.getByText("Suspended").first()).toBeVisible();
    // Immediate revalidation: the very next public request renders fresh, and the business is gone.
    await expect
      .poll(async () => (await request.get(PUBLIC(slug))).status(), { timeout: 15_000 })
      .toBe(404);

    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(page.getByText(/· status/).first()).toBeVisible();
  });

  test("an invalid experience is refused with the reason, and nothing is saved", async ({
    page,
    context,
    baseURL,
  }) => {
    await signInAs(context, baseURL!, ADMIN);
    await page.goto("/en/admin/businesses/new");
    await page
      .getByLabel("Web address (slug)")
      .fill(`e2e-bad-${test.info().project.name}-${Date.now().toString(36)}`);
    await page.getByLabel("Place", { exact: true }).fill(PLACE);
    await page.getByLabel("Name · English").fill("Bad");
    await page.getByLabel("Tagline · English").fill("x");
    await page.getByLabel("Street address · English").fill("x");
    // The numbers, one disclosure under the map, still work for a keyboard or an exact point.
    await pickerMap(page);
    await page.getByText("Edit numbers").click();
    await page.getByLabel("Latitude").fill("32.858");
    await page.getByLabel("Longitude").fill("35.181");
    await expect(pinField(page, "lat")).toHaveValue("32.858");
    await page.getByLabel("Experience content (JSON)").fill('{"items": []}');
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.locator('form [role="alert"]')).toContainText("experience");
    await expect(page).toHaveURL(/\/businesses\/new$/);
  });

  test("the Missing report warns that terms are private", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, ADMIN);
    await page.goto("/ar/admin/report");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("note")).toContainText("عاملها كمعلومات خاصة");
  });
});
