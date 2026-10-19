import {
  expect,
  test,
  type APIRequestContext,
  type BrowserContext,
  type Page,
} from "@playwright/test";

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

/** The place picker: typed, then picked from its list (the map follows the pick). */
async function choosePlace(page: Page) {
  await page.getByLabel("Place", { exact: true }).fill(PLACE);
  await page.locator(`[data-place-option="${PLACE}"]`).click();
  await expect(page.locator('input[type="hidden"][name="place"]')).toHaveValue(PLACE);
}

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
    // Installable as its own app: the manifest (allowed by manifest-src 'self') and iOS icon.
    expect(res?.headers()["content-security-policy"]).toMatch(/manifest-src 'self'/);
    await expect(page.locator('link[rel="manifest"]')).toHaveAttribute(
      "href",
      "/api/admin/manifest/he",
    );
    await expect(page.locator('link[rel="apple-touch-icon"]')).toHaveAttribute(
      "href",
      /admin-apple-touch-icon-light\.png$/,
    );
    const manifest = await page.request.get("/api/admin/manifest/he");
    expect(manifest.ok()).toBe(true);
    expect((await manifest.json()).scope).toBe("/admin");
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
    await choosePlace(page);
    await page.getByLabel("Name · A B C").fill("E2E Upholstery");
    await page.getByLabel("Tagline · A B C").fill("Sofas made new");
    await page.getByLabel("Street address · A B C").fill("Main street");
    await page.getByLabel("Kind", { exact: true }).selectOption({ label: "Upholstery" });
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

    await page.getByLabel("Tagline · A B C").fill("Sofas and chairs made new");
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
    await expect(page.locator('[data-save-bar] [role="status"]')).toHaveText(/Saved/);
    await page.reload();
    await expect(pinField(page, "lat")).toHaveValue(dropped);

    // A takedown asks first.
    page.once("dialog", (d) => void d.accept());
    await page.getByRole("button", { name: "Suspend now" }).click();
    await expect(page.getByText("Suspended").first()).toBeVisible();
    // Immediate revalidation: the very next public request renders fresh, and the business is gone.
    await expect
      .poll(async () => (await request.get(PUBLIC(slug))).status(), { timeout: 15_000 })
      .toBe(404);

    await expect(page.getByRole("heading", { name: "History", exact: true })).toBeVisible();
    await expect(page.getByText("Status changed").first()).toBeVisible();
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
    await choosePlace(page);
    await page.getByLabel("Kind", { exact: true }).selectOption({ label: "Upholstery" });
    await page.getByLabel("Name · A B C").fill("Bad");
    await page.getByLabel("Tagline · A B C").fill("x");
    await page.getByLabel("Street address · A B C").fill("x");
    // The numbers, one disclosure under the map, still work for a keyboard or an exact point.
    await pickerMap(page);
    await page.getByText("Edit numbers").click();
    await page.getByLabel("Latitude").fill("32.858");
    await page.getByLabel("Longitude").fill("35.181");
    await expect(pinField(page, "lat")).toHaveValue("32.858");
    await page.getByText("Screen content (advanced)").click();
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

const API = () => process.env.API_URL ?? "http://localhost:4100";
const AUTH = { authorization: `Bearer ${ADMIN}` };
/** A fresh business through the admin API (upholstery in amqa, which no other spec reads). */
async function createBusiness(request: APIRequestContext, slug: string, name: string) {
  const kinds = await (
    await request.get(`${API()}/admin/kinds?q=upholstery`, { headers: AUTH })
  ).json();
  const places = await (
    await request.get(`${API()}/admin/places?q=${PLACE}`, { headers: AUTH })
  ).json();
  const res = await request.post(`${API()}/admin/businesses`, {
    headers: AUTH,
    data: {
      slug,
      placeId: places.items.find((p: { slug: string }) => p.slug === PLACE).id,
      name: { en: name },
      tagline: { en: "Sofas made new" },
      address: { en: "Main street" },
      primaryKindId: kinds.find((k: { slug: string }) => k.slug === "upholstery").id,
      kindIds: [],
      lat: 32.79,
      lng: 35.16,
      phone: "04-6000000",
      whatsapp: null,
      website: null,
      hours: { weekly: {}, exceptions: [] },
      attributes: {},
      experience: {
        brand: { en: "Business name" },
        title: { en: "Welcome" },
        items: [{ label: { en: "First item" } }],
        cta: { en: "Contact us" },
        palette: { bg: "#08241a", surface: "#0e3527", ink: "#fbf7ec", accent: "#d9a54c" },
        font: "Heebo",
      },
      tier: "basic",
      apps: {},
    },
  });
  expect(res.status(), await res.text()).toBe(201);
  return (await res.json()) as { id: string };
}

test.describe("edit from the public card", () => {
  test("a visitor never sees Edit; an admin edits the phone in place and sees it at once", async ({
    page,
    context,
    baseURL,
    request,
  }) => {
    test.slow();
    const slug = `e2e-quick-${test.info().project.name}-${Date.now().toString(36)}`;
    const { id } = await createBusiness(request, slug, "Quick Upholstery");
    const pub = await request.post(`${API()}/admin/businesses/${id}/status`, {
      headers: AUTH,
      data: { status: "published" },
    });
    expect(pub.status()).toBe(200);
    await expect
      .poll(async () => (await request.get(PUBLIC(slug))).status(), { timeout: 15_000 })
      .toBe(200);

    // A visitor: no Edit button, and no editor code requested.
    const asked: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/admin/")) asked.push(r.url());
    });
    await page.goto(PUBLIC(slug));
    await expect(page.locator("[data-business-card]").first()).toBeVisible();
    await expect(page.locator("[data-admin-edit]")).toHaveCount(0);
    expect(asked).toEqual([]);

    // The admin: signing in leaves the marker, and the card offers Edit.
    await signInAs(context, baseURL!, ADMIN);
    await page.goto("/en/admin");
    await page.goto(PUBLIC(slug));
    await page.locator("[data-admin-edit]").click();
    const panel = page.locator("[data-quick-editor]");
    await expect(panel).toBeVisible();
    const phone = panel.getByLabel("Phone", { exact: true });
    await expect(phone).toHaveValue("04-6000000");
    await phone.fill("04-6111111");
    await panel.getByRole("button", { name: "Save", exact: true }).click();
    await expect(page.locator('[data-business-card] a[href^="tel:"]').first()).toHaveAttribute(
      "href",
      /6111111/,
      {
        timeout: 20_000,
      },
    );
  });
});

test.describe("admin redesign", () => {
  test.beforeEach(async ({ context, baseURL }) => {
    await signInAs(context, baseURL!, ADMIN);
  });

  test("the overview shows real numbers and opens the matching list", async ({ page }) => {
    await page.goto("/en/admin");
    const published = page.locator('[data-stat="statPublished"]');
    await expect(published).toContainText(/\d/);
    await expect(page.getByRole("heading", { name: "Needs attention" })).toBeVisible();
    await expect(page.getByRole("heading", { name: "Recent activity" })).toBeVisible();
    await published.click();
    await expect(page).toHaveURL(/\/en\/admin\/businesses\?status=published$/);
    await expect(page.getByRole("button", { name: /Status: Published/ })).toBeVisible();
  });

  test("the sidebar marks the page it moved to", async ({ page }, info) => {
    test.skip(info.project.name === "phone", "the sidebar is the desktop's");
    await page.goto("/en/admin");
    const current = page.locator('nav [aria-current="page"]:visible');
    await expect(current).toHaveAttribute("data-nav", "/");
    await page.locator('[data-nav="/sectors"]:visible').click();
    await expect(page).toHaveURL(/\/en\/admin\/sectors$/);
    await expect(current).toHaveAttribute("data-nav", "/sectors");
    await page.locator('[data-nav="/businesses"]:visible').click();
    await expect(current).toHaveAttribute("data-nav", "/businesses");
  });

  test("the palette jumps to a screen and finds a place by name", async ({ page }) => {
    await page.goto("/en/admin");
    await page.locator("[data-open-palette]:visible").first().click();
    const input = page.getByRole("combobox", { name: "Search and go anywhere" });
    await expect(input).toBeFocused();
    await input.fill("kinds");
    await page.keyboard.press("Enter");
    await expect(page).toHaveURL(/\/en\/admin\/kinds$/);
    await page.keyboard.press("ControlOrMeta+k");
    await page.getByRole("combobox", { name: "Search and go anywhere" }).fill("sakhnin");
    await page.locator('[data-palette-option^="p-"]').first().click();
    await expect(page).toHaveURL(/\/en\/admin\/places\/[0-9a-f-]{36}$/);
    await expect(page.getByRole("heading", { name: "Sakhnin" })).toBeVisible();
  });

  test("lists search as you type, filter by chips, and page with a total", async ({ page }) => {
    await page.goto("/en/admin/businesses");
    await expect(page.getByText(/^1 to 50 of [\d,]+$/)).toBeVisible();
    await page.getByRole("searchbox", { name: "Search" }).fill("paz");
    await expect(page).toHaveURL(/q=paz/);
    await page.locator('[data-filter="status"]').click();
    await page.locator('[data-option="published"]').click();
    await expect(page).toHaveURL(/q=paz&status=published|status=published&q=paz/);
    await expect(page.locator('[data-list="businesses"] tbody tr').first()).toBeVisible();
    await page.locator('[data-filter-clear="status"]').click();
    await expect(page).not.toHaveURL(/status=/);
  });

  test("bulk: publish two drafts at once, with a confirmation and a toast", async ({
    page,
    request,
  }) => {
    test.slow();
    // Two fresh drafts through the API the admin uses, so other specs are untouched.
    const api = process.env.API_URL ?? "http://localhost:4100";
    const auth = { authorization: `Bearer ${ADMIN}` };
    const kinds = await (
      await request.get(`${api}/admin/kinds?q=upholstery`, { headers: auth })
    ).json();
    const places = await (
      await request.get(`${api}/admin/places?q=${PLACE}`, { headers: auth })
    ).json();
    const tag = `e2e-bulk-${test.info().project.name}-${Date.now().toString(36)}`;
    for (const n of [1, 2]) {
      const res = await request.post(`${api}/admin/businesses`, {
        headers: auth,
        data: {
          slug: `${tag}-${n}`,
          placeId: places.items.find((p: { slug: string }) => p.slug === PLACE).id,
          name: { en: `${tag} ${n}` },
          tagline: { en: "Bulk" },
          address: { en: "Main street" },
          primaryKindId: kinds[0].id,
          kindIds: [],
          lat: 32.79,
          lng: 35.16,
          phone: null,
          whatsapp: null,
          website: null,
          hours: { weekly: {}, exceptions: [] },
          attributes: {},
          experience: {
            brand: { en: "Business name" },
            title: { en: "Welcome" },
            items: [{ label: { en: "First item" } }],
            cta: { en: "Contact us" },
            palette: { bg: "#08241a", surface: "#0e3527", ink: "#fbf7ec", accent: "#d9a54c" },
            font: "Heebo",
          },
          tier: "basic",
          apps: {},
        },
      });
      expect(res.status(), await res.text()).toBe(201);
    }
    await page.goto(`/en/admin/businesses?q=${tag}&status=draft`);
    // The page's "all" box is in the table head, which phones fold away: pick each row there.
    if (test.info().project.name === "phone")
      for (const box of await page.locator('input[name="pick"]').all()) await box.check();
    else await page.getByRole("checkbox", { name: "Select every row on this page" }).check();
    await expect(page.locator("[data-bulk-bar]")).toContainText("2 selected");
    await page.locator('[data-bulk="publish"]').click();
    await page.locator("[data-bulk-confirm]").click();
    await expect(page.locator("[data-toasts]")).toContainText("2 changed.");
    await page.goto(`/en/admin/businesses?q=${tag}&status=published`);
    await expect(page.locator('[data-list="businesses"] tbody tr')).toHaveCount(2);
  });

  test("the editor says when something changed, and Ctrl+S saves it", async ({ page }) => {
    await page.goto("/en/admin/businesses?q=samer&examples=1");
    await page.locator("table tbody tr a").first().click();
    const bar = page.locator("[data-save-bar]");
    await expect(bar).toContainText("Everything is saved");
    // Beside the form on wide screens; a tab away on phones.
    const card = page.locator("[data-live-card]");
    if (!(await card.isVisible())) {
      await page.locator("[data-preview-tab]").click();
      await expect(card).toBeVisible();
      await page.getByRole("button", { name: "Edit", exact: true }).click();
    }
    const tagline = page.getByLabel("Tagline · A B C");
    const before = await tagline.inputValue();
    await tagline.fill(`${before} `);
    await expect(bar).toContainText("Unsaved changes");
    await tagline.fill(before);
    await expect(bar).toContainText("Everything is saved");
    await page.getByLabel("Name · A B C").fill("Samer Grill");
    await expect(card).toContainText("Samer Grill");
    await page.keyboard.press("ControlOrMeta+s");
    await expect(bar.getByRole("status")).toHaveText(/Saved/);
  });

  test("phones get a bottom bar with More", async ({ page }) => {
    test.skip(test.info().project.name !== "phone", "phone layout");
    await page.goto("/en/admin");
    const tabs = page.getByRole("navigation", { name: "Main screens" });
    await expect(tabs.getByRole("link", { name: "Overview" })).toHaveAttribute(
      "aria-current",
      "page",
    );
    await tabs.getByRole("button", { name: "More" }).click();
    await page
      .getByRole("dialog", { name: "More" })
      .getByRole("link", { name: "Categories" })
      .click();
    await expect(page).toHaveURL(/\/en\/admin\/sectors$/);
    const width = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(width).toBeLessThanOrEqual(390);
  });
});
