import { fileURLToPath } from "node:url";
import { expect, test, type Browser, type Page } from "@playwright/test";

/**
 * Darb Helpers, end to end: a friend signs up and applies, the admin approves them, their capture
 * lands in Join requests under their name, the admin publishes it, and the public card names them
 * only while their credit toggle is on. The API runs with FIELD_AI=fake (the sign always reads as
 * Abu Samir Salon, 04-674-1234) and fake sign-in (playwright.config.ts).
 */
const ADMIN = "fake.user_e2e.e2e-admin@darb.test";
const SIGN = fileURLToPath(new URL("./fixtures-media/sign.jpg", import.meta.url));
/** Inside amqa, the place admin.spec and street.spec also keep to themselves. */
const HERE = { latitude: 32.9795, longitude: 35.165, accuracy: 8 };

async function personAt(browser: Browser, baseURL: string, cookie?: string): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  if (cookie) await context.addCookies([{ name: "darb_admin_fake", value: cookie, url: baseURL }]);
  await context.grantPermissions(["geolocation"], { origin: baseURL });
  await context.setGeolocation(HERE);
  return context.newPage();
}

test.describe("darb helpers", () => {
  test("sign up, approval, a capture under their name, and credit only with the toggle on", async ({
    browser,
    baseURL,
  }) => {
    test.slow();
    const run = `${test.info().project.name}${Date.now().toString(36)}`;
    const helperName = `Rami ${run}`;
    const shop = `Helper Salon ${run}`;

    // A friend signs in (sign-up is open) and fills the one-screen form.
    const helper = await personAt(browser, baseURL!);
    await helper.goto("/en/helpers");
    await expect(helper).toHaveURL(/\/en\/helpers\/sign-in$/);
    await helper.getByLabel("Test user (local only)").fill(`user_helper_${run}`);
    await helper.getByLabel("Email").fill(`helper-${run}@darb.test`);
    await helper.getByRole("button", { name: "Sign in" }).click();
    await expect(helper.getByRole("heading", { name: "Become a Darb helper" })).toBeVisible();
    await helper.getByLabel("Your name, as Darb shows it").fill(helperName);
    await helper.getByLabel("Your phone").fill("050-555-1234");
    await helper.getByRole("combobox", { name: "Your home town" }).fill("Amqa");
    await helper.getByRole("option", { name: /Amqa/ }).first().click();
    await helper.getByRole("button", { name: "Send" }).click();
    await expect(
      helper.getByRole("heading", { name: "Thanks, we will let you know" }),
    ).toBeVisible();

    // The admin sees them waiting and approves them.
    const admin = await personAt(browser, baseURL!, ADMIN);
    await admin.goto("/en/admin/helpers");
    const card = admin.locator('[data-list="helpers"] li').filter({ hasText: helperName });
    await expect(card).toBeVisible();
    await card.getByRole("button", { name: "Approve" }).click();
    await expect(card).toBeHidden();
    await admin.goto("/en/admin/helpers?status=approved");
    await expect(
      admin.locator('[data-list="helpers"] li').filter({ hasText: helperName }),
    ).toBeVisible();

    // Back in the helper app, it opens straight into adding.
    await helper.goto("/en/helpers");
    await expect(helper.getByRole("heading", { name: "Add a business" })).toBeVisible();
    await expect(helper.getByText("Accurate to about 8 m")).toBeVisible();
    await helper.getByLabel("Photograph the sign").setInputFiles(SIGN);
    await expect(
      helper.getByText("Filled in from the sign. Check it before saving."),
    ).toBeVisible();
    await helper.getByLabel("Name in A B C letters").fill(shop);
    await helper.getByRole("button", { name: "Save and next shop" }).click();
    // Earlier runs captured the same phone number: a helper must say how this one differs.
    const distinct = helper.getByLabel("How is it a different place?");
    const saved = helper.getByText("Saved. Ready for the next shop.");
    await expect(distinct.or(saved)).toBeVisible();
    if (await distinct.isVisible()) {
      await helper.getByRole("button", { name: "Save as a different place" }).click();
      await expect(helper.getByText("Say how it is a different place.")).toBeVisible();
      await distinct.fill(`Another branch, test run ${run}`);
      await helper.getByRole("button", { name: "Save as a different place" }).click();
    }
    await expect(saved).toBeVisible();

    await helper.getByRole("link", { name: "My additions" }).click();
    await expect(helper.getByText(/^You added 1 · 0 live$/)).toBeVisible();
    const mine = helper.locator("[data-addition]").filter({ hasText: shop });
    await expect(mine.getByText("Waiting for review")).toBeVisible();

    // In the admin's queue, marked as from the field with the helper's name; approve it.
    await admin.goto("/en/admin/join-requests?status=pending");
    const row = admin.locator('[data-list="join-requests"] li').filter({ hasText: shop });
    await expect(row.getByText(`From the field · ${helperName}`)).toBeVisible();
    await row.getByRole("link", { name: shop }).click();
    await admin.getByRole("button", { name: "Approve and publish" }).click();
    await expect(admin.getByText("Approved", { exact: true }).first()).toBeVisible();

    // Live now: the card names no one until the helper turns the credit on.
    await helper.reload();
    await expect(helper.getByText(/^You added 1 · 1 live$/)).toBeVisible();
    const open = mine.getByRole("link", { name: "Open the card" });
    const cardUrl = (await open.getAttribute("href"))!;
    const visitor = await personAt(browser, baseURL!);
    await visitor.goto(cardUrl);
    await expect(visitor.getByRole("heading", { name: shop })).toBeVisible();
    await expect(visitor.locator("[data-added-by]")).toHaveCount(0);

    await helper.getByRole("link", { name: "Profile" }).click();
    await helper.getByLabel(/Show my name on businesses I added/).check();
    await expect(helper.getByText("Saved.")).toBeVisible();
    await expect(async () => {
      await visitor.reload();
      await expect(visitor.locator("[data-added-by]")).toHaveText(
        `Added to Darb by ${helperName}`,
        { timeout: 1000 },
      );
    }).toPass({ timeout: 15_000 });

    await helper.getByLabel(/Show my name on businesses I added/).uncheck();
    await expect(helper.getByText("Saved.")).toBeVisible();
    await expect(async () => {
      await visitor.reload();
      await expect(visitor.locator("[data-added-by]")).toHaveCount(0, { timeout: 1000 });
    }).toPass({ timeout: 15_000 });
  });

  test("the helper app stays out of search engines and installs on its own scope", async ({
    request,
  }) => {
    const res = await request.get("/en/helpers/sign-in");
    expect(res.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(res.headers()["cache-control"]).toBe("no-store");
    const manifest = await (await request.get("/api/helpers/manifest/en")).json();
    expect(manifest).toMatchObject({ start_url: "/en/helpers", scope: "/en/helpers" });
  });
});
