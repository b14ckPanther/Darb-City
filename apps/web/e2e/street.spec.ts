import { fileURLToPath } from "node:url";
import { expect, test, type BrowserContext, type Page } from "@playwright/test";

/**
 * Add from the street. The API runs with FIELD_AI=fake (playwright.config.ts): the sign always
 * reads as Abu Samir Salon, 04-674-1234, a barbershop. R2 is off, so no photo is stored.
 */
const ADMIN = "fake.user_e2e.e2e-admin@darb.test";
const SIGN = fileURLToPath(new URL("./fixtures-media/sign.jpg", import.meta.url));
/** Inside amqa, the place admin.spec also keeps to itself. */
const HERE = { latitude: 32.979, longitude: 35.1645, accuracy: 9 };

async function standAtTheShop(context: BrowserContext, baseURL: string) {
  await context.addCookies([{ name: "darb_admin_fake", value: ADMIN, url: baseURL }]);
  await context.grantPermissions(["geolocation"], { origin: baseURL });
  await context.setGeolocation(HERE);
}

const unique = (what: string) => `${what} ${test.info().project.name} ${Date.now().toString(36)}`;

/** Saves, and saves as new if this phone number was already captured by an earlier run. */
async function saveAnyway(page: Page) {
  await page.getByRole("button", { name: "Save and next shop" }).click();
  const anyway = page.getByRole("button", { name: "Save as a new shop anyway" });
  const saved = page.getByText("Saved. Ready for the next shop.");
  await expect(anyway.or(saved)).toBeVisible();
  if (await anyway.isVisible()) await anyway.click();
  await expect(saved).toBeVisible();
}

test.describe("add from the street", () => {
  test("photo, sign read, duplicate warning, save; it waits in Join requests", async ({
    page,
    context,
    baseURL,
  }) => {
    test.slow();
    await standAtTheShop(context, baseURL!);
    await page.goto("/en/admin/field");
    await expect(page.getByRole("heading", { name: "Add from the street" })).toBeVisible();
    await expect(page.getByText("Accurate to about 9 m")).toBeVisible();

    await page.getByLabel("Photograph the sign").setInputFiles(SIGN);
    await expect(page.getByAltText("The photo of the sign")).toBeVisible();
    await expect(page.getByText("Filled in from the sign. Check it before saving.")).toBeVisible();
    await expect(page.getByLabel("Name in أ ب ت letters")).toHaveValue("صالون أبو سمير");
    await expect(page.getByLabel("Phone")).toHaveValue("04-674-1234");
    await expect(page.getByLabel("Kind", { exact: true })).toHaveValue("barbershops");

    const first = unique("Abu Samir Salon");
    await page.getByLabel("Name in A B C letters").fill(first);
    await saveAnyway(page);
    // Ready for the next shop: the form is empty again, the camera has the focus.
    await expect(page.getByLabel("Name in A B C letters")).toHaveValue("");
    await expect(page.getByLabel("Photograph the sign")).toBeFocused();
    const mine = page.getByRole("region", { name: "Your shops from the street" });
    await expect(mine.getByRole("link", { name: first })).toBeVisible();
    await expect(page.getByText(/^Added today: [1-9]\d*$/)).toBeVisible();

    // The same phone number again: Darb may already have this shop.
    await page.getByLabel("Name in A B C letters").fill(unique("Second Salon"));
    await page.getByLabel("Phone").fill("04 6741234");
    await page.getByLabel("Kind", { exact: true }).selectOption("barbershops");
    await page.getByRole("button", { name: "Save and next shop" }).click();
    await expect(page.getByRole("heading", { name: "Maybe already on Darb" })).toBeFocused();
    await expect(page.getByText("Same phone number").first()).toBeVisible();
    await page.getByRole("button", { name: "Save as a new shop anyway" }).click();
    await expect(page.getByText("Saved. Ready for the next shop.")).toBeVisible();

    // In the existing queue, marked as from the street; nothing published.
    await mine.getByRole("link", { name: first }).click();
    await expect(page.getByRole("heading", { name: first })).toBeVisible();
    await expect(page.getByText("From the street", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("Waiting", { exact: true }).first()).toBeVisible();
    await expect(page.getByRole("button", { name: "Approve and publish" })).toBeVisible();
    await page.goto("/en/admin/join-requests?status=pending");
    const card = page.locator('[data-list="join-requests"] li').filter({ hasText: first });
    await expect(card.getByText("From the street")).toBeVisible();
  });

  test("with no signal a shop waits on the phone, then goes once the signal is back", async ({
    page,
    context,
    baseURL,
  }) => {
    test.slow();
    await standAtTheShop(context, baseURL!);
    await page.goto("/en/admin/field");
    await expect(page.getByText("Accurate to about 9 m")).toBeVisible();
    await context.setOffline(true);
    await page.getByLabel("Photograph the sign").setInputFiles(SIGN);
    await expect(page.getByText(/No connection, so the sign was not read/)).toBeVisible();
    const name = unique("Offline Bakery");
    await page.getByLabel("Name in A B C letters").fill(name);
    await page.getByLabel("Kind", { exact: true }).selectOption("barbershops");
    await page.getByRole("button", { name: "Save and next shop" }).click();
    const queue = page.getByRole("region", { name: "Waiting to send" });
    await expect(queue.getByText(name)).toBeVisible();
    await expect(queue.getByText("Waiting for a connection")).toBeVisible();

    // A reload offline is not possible; the queue survives in IndexedDB, so going online is enough.
    await context.setOffline(false);
    await expect(queue).toBeHidden({ timeout: 15_000 });
    await expect(
      page.getByRole("region", { name: "Your shops from the street" }).getByRole("link", { name }),
    ).toBeVisible();
  });

  test("the capture screen fits a 360 px phone without sideways scrolling", async ({
    page,
    context,
    baseURL,
  }) => {
    await standAtTheShop(context, baseURL!);
    await page.setViewportSize({ width: 360, height: 760 });
    await page.goto("/admin/field");
    await expect(page.getByRole("heading", { name: "הוספה מהרחוב" })).toBeVisible();
    const wide = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(wide).toBeLessThanOrEqual(0);
  });
});
