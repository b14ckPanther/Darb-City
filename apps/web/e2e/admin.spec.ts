import { expect, test, type BrowserContext } from "@playwright/test";

const ADMIN = "fake.user_e2e.e2e-admin@darb.test";
const signInAs = (context: BrowserContext, baseURL: string, value: string) =>
  context.addCookies([{ name: "darb_admin_fake", value, url: baseURL }]);

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
    await page.getByLabel("Latitude").fill("32.858");
    await page.getByLabel("Longitude").fill("35.181");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/businesses\/[0-9a-f-]{36}$/);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published").first()).toBeVisible();
    await expect
      .poll(async () => (await request.get(PUBLIC(slug))).status(), { timeout: 15_000 })
      .toBe(200);

    await page.getByLabel("Tagline · English").fill("Sofas and chairs made new");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.locator('form [role="alert"]')).toHaveText(/Saved/);

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
    await page.getByLabel("Latitude").fill("32.858");
    await page.getByLabel("Longitude").fill("35.181");
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
