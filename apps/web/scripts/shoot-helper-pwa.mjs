// The screenshots Android shows on the helper app's install sheet: per locale, the quick add and
// My additions on a phone (1080 x 2340), by day, saved as WebP into
// packages/tokens/assets/brand/screens (served at /brand/screens, listed in src/helpers/manifest.ts).
// Needs a local web server with fake sign-in (ADMIN_FAKE_AUTH=1) and an approved helper's token:
//
//   WEB_URL=http://localhost:3170 HELPER_TOKEN=fake.user_x.x@darb.test node scripts/shoot-helper-pwa.mjs
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const base = process.env.WEB_URL ?? "http://localhost:3000";
const token = process.env.HELPER_TOKEN;
if (!token) throw new Error("Set HELPER_TOKEN to an approved helper's fake sign-in token");
const require = createRequire(import.meta.url);
const out = join(
  dirname(require.resolve("@darb/tokens/assets/brand/darb-mark-480.webp")),
  "screens",
);
mkdirSync(out, { recursive: true });

const prefix = { he: "", ar: "/ar", en: "/en" };
const shots = [
  { name: "capture", path: "" },
  { name: "mine", path: "/mine" },
];

const browser = await chromium.launch();
for (const locale of ["he", "ar", "en"]) {
  const context = await browser.newContext({
    viewport: { width: 360, height: 780 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    colorScheme: "light",
    reducedMotion: "reduce",
  });
  await context.addCookies([{ name: "darb_admin_fake", value: token, url: base }]);
  const page = await context.newPage();
  for (const shot of shots) {
    await page.goto(`${base}${prefix[locale]}/helpers${shot.path}`, { waitUntil: "networkidle" });
    const png = await page.screenshot();
    const file = join(out, `helper-${shot.name}-${locale}-narrow.webp`);
    await sharp(png).webp({ quality: 82, effort: 6 }).toFile(file);
    console.log(file);
  }
  await context.close();
}
await browser.close();
