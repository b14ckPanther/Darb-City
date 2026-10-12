import { test } from "@playwright/test";
import { EMPTY_KIND, LEVELS, localePath } from "./fixtures";

const SHOTS: [string, string][] = [
  ...Object.entries(LEVELS).map(([name, path]) => [name, path] as [string, string]),
  ["empty-kind", EMPTY_KIND],
  ["ar-business", localePath("ar", LEVELS.business)],
  ["en-business", localePath("en", LEVELS.business)],
  ["for-business", "/for-business"],
  ["not-found", "/sakhnim"],
];

test.use({ reducedMotion: "reduce" });

for (const [name, path] of SHOTS) {
  test(`screenshot ${name}`, async ({ page }, info) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  });
}
