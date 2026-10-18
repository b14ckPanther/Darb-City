// The screenshots Android shows on Darb's install sheet: per locale, the landing page and a business
// card on a phone (1080 x 1920) and the landing page wide (1920 x 1080), by day, saved as WebP into
// packages/tokens/assets/brand/screens (served at /brand/screens, listed in src/lib/pwa.ts).
//
//   WEB_URL=http://localhost:3195 node scripts/shoot-pwa.mjs /akko/food/restaurants/caramel
import { mkdirSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const base = process.env.WEB_URL ?? "http://localhost:3000";
const business = process.argv[2];
if (!business) throw new Error("Usage: node scripts/shoot-pwa.mjs <business path, Hebrew URL>");
const require = createRequire(import.meta.url);
const out = join(
  dirname(require.resolve("@darb/tokens/assets/brand/darb-mark-480.webp")),
  "screens",
);
mkdirSync(out, { recursive: true });

const prefix = { he: "", ar: "/ar", en: "/en" };
const shots = [
  { name: "landing", form: "narrow", path: "/", viewport: { width: 360, height: 640 }, scale: 3 },
  {
    name: "business",
    form: "narrow",
    path: business,
    viewport: { width: 360, height: 640 },
    scale: 3,
  },
  { name: "landing", form: "wide", path: "/", viewport: { width: 1280, height: 720 }, scale: 1.5 },
];

const browser = await chromium.launch();
for (const [locale, pre] of Object.entries(prefix)) {
  for (const shot of shots) {
    const context = await browser.newContext({
      viewport: shot.viewport,
      deviceScaleFactor: shot.scale,
      colorScheme: "light",
      reducedMotion: "reduce",
      isMobile: shot.form === "narrow",
      hasTouch: shot.form === "narrow",
    });
    const page = await context.newPage();
    const path = shot.path === "/" ? pre || "/" : `${pre}${shot.path}`;
    await page.goto(base + path, { waitUntil: "networkidle" });
    await page.evaluate(() => document.fonts.ready);
    // Let entrance animations (already reduced) and lazy images settle.
    await page.waitForTimeout(800);
    const png = await page.screenshot();
    const file = join(out, `${shot.name}-${locale}-${shot.form}.webp`);
    await sharp(png).webp({ quality: 82, effort: 6 }).toFile(file);
    console.log(file);
    await context.close();
  }
}
await browser.close();
