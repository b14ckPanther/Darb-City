import { test } from "@playwright/test";
import { EMPTY_KIND, LEVELS, localePath, settleStage } from "./fixtures";

const SHOTS: [string, string][] = [
  ...Object.entries(LEVELS).map(([name, path]) => [name, path] as [string, string]),
  ["empty-kind", EMPTY_KIND],
  ["ar-business", localePath("ar", LEVELS.business)],
  ["en-business", localePath("en", LEVELS.business)],
  ["landing", "/"],
  ["showroom", "/showroom"],
  ["pricing", "/pricing"],
  ["for-business", "/for-business"],
  ["not-found", "/sakhnim"],
];
/** The stage open on phones too (VC11–VC15). */
const STAGE_SHOTS: [string, string][] = [
  ["stage-place", LEVELS.place],
  ["stage-ar-sector", localePath("ar", LEVELS.sector)],
  ["stage-en-place", localePath("en", LEVELS.place)],
];

test.use({ reducedMotion: "reduce" });

for (const [name, path] of SHOTS) {
  test(`screenshot ${name}`, async ({ page }, info) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await settleStage(page);
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  });
}

for (const [name, path] of STAGE_SHOTS) {
  test(`screenshot ${name} with the stage open`, async ({ page }, info) => {
    test.setTimeout(60_000);
    await page.goto(path);
    if (info.project.name === "phone")
      await page.locator("[data-stage-toggle]").click({ timeout: 30_000 });
    await settleStage(page);
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  });
}
