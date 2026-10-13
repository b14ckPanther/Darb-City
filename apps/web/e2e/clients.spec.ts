import { readFileSync } from "node:fs";
import { expect, test } from "@playwright/test";

/** Task 28: Darb's real clients, from packages/seed/data/clients.json (owner answers). */
interface Client {
  slug: string;
  place: string;
  primaryKind: string;
  apps?: { web?: string };
  attributes: Record<string, unknown>;
  hours: { byAppointment?: boolean };
}
const read = <T>(file: string): T =>
  JSON.parse(
    readFileSync(new URL(`../../../packages/seed/data/${file}`, import.meta.url), "utf8"),
  ) as T;
const clients = read<{ businesses: Client[] }>("clients.json");
const kinds = read<{ slug: string; sector: string }[]>("kinds.json");
const pathOf = (b: Client) => {
  const sector = kinds.find((k) => k.slug === b.primaryKind)!.sector;
  return `/en/${b.place}/${sector}/${b.primaryKind}/${b.slug}`;
};

for (const b of clients.businesses) {
  test(`${b.slug} is a real Darb client: its main button, Built by Darb, no example badge`, async ({
    page,
  }) => {
    await page.goto(pathOf(b));
    const main = page.locator("[data-primary-action]");
    if (b.apps?.web) {
      await expect(page.locator(`a[href^="${b.apps.web}"]`).first()).toBeVisible();
      await expect(main).toHaveAttribute("href", new RegExp(`^${b.apps.web}/?$`));
    } else {
      // Paz: its app is for staff only; the main button navigates to the station.
      await expect(main).toHaveAttribute("href", /google\.com\/maps\/dir/);
    }
    await expect(page.locator("[data-example-badge]")).toHaveCount(0);
    const note = page.locator("[data-built-by-darb] a");
    await expect(note).toHaveText("Built by Darb");
    await expect(note).toHaveAttribute("href", "/en/for-business");
    expect(await page.content()).not.toMatch(/paz\.darb\.co\.il/);
    if (b.hours.byAppointment) {
      await expect(page.locator("[data-sheet] [data-appointment]")).toHaveText("By appointment");
      await expect(page.locator("[data-sheet] [data-open]")).toHaveCount(0);
    }
    if (b.attributes.addressHidden)
      await expect(page.locator('[data-sheet] a[href*="google.com/maps"]')).toHaveCount(0);
  });
}

test("Caramel is found by the gluten-free filter and by gluten-free words in three languages", async ({
  page,
}) => {
  await page.goto("/en/akko/food/restaurants?glutenFree=1");
  await expect(page.locator('[data-business="akko/caramel"] [data-gluten-free]')).toBeVisible();
  await expect(page.locator("[data-business-list] li")).toHaveCount(1);
  for (const [locale, q] of [
    ["he", "ללא גלוטן בעכו"],
    ["ar", "خالٍ من الغلوتين"],
    ["en", "celiac"],
  ] as const) {
    await page.goto(`${locale === "he" ? "" : `/${locale}`}/search?q=${encodeURIComponent(q)}`);
    await expect(page.locator('[data-business="akko/caramel"]')).toBeVisible();
    await expect(page.locator('[data-chip="glutenFree"]')).toBeVisible();
  }
});
