// Records the launch reveal of Darb's installed apps as frames (and a real-time video), for review:
// each app by day and by night on a 390 x 844 phone, with the installed display mode emulated.
// Frames are exact: every animation is paused and set to the frame's time. Frame 0 is also held
// against the iOS launch image of the same screen (the mean difference per channel is printed).
//
//   WEB_URL=http://localhost:3190 node scripts/shoot-splash.mjs [out dir]
/* global window, Node */
import { mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { chromium } from "@playwright/test";
import sharp from "sharp";

const base = process.env.WEB_URL ?? "http://localhost:3190";
const out = process.argv[2] ?? join(process.cwd(), ".screens", "splash");
const require = createRequire(import.meta.url);
const SPLASH = join(
  dirname(require.resolve("@darb/tokens/assets/brand/darb-mark-480.webp")),
  "splash",
);
mkdirSync(out, { recursive: true });

const FRAMES = [0, 150, 300, 450, 600, 750, 900];
const APPS = [
  { app: "darb", path: "/en" },
  { app: "helpers", path: "/helpers" },
  { app: "admin", path: "/ar/admin" },
];

/** Installed: (display-mode: standalone) matches, and the reveal is kept for the camera. */
function emulateInstalled({ hold }) {
  const real = window.matchMedia.bind(window);
  window.matchMedia = (q) =>
    /display-mode:\s*standalone/.test(q) ? real("(min-width: 0px)") : real(q);
  if (hold) {
    const remove = Node.prototype.removeChild;
    Node.prototype.removeChild = function (child) {
      return child && child.id === "darb-splash" ? child : remove.call(this, child);
    };
  }
}

async function meanDiff(a, b) {
  const [x, y] = await Promise.all(
    [a, b].map((i) => sharp(i).removeAlpha().raw().toBuffer({ resolveWithObject: true })),
  );
  if (x.info.width !== y.info.width || x.info.height !== y.info.height) return Infinity;
  let d = 0;
  for (let i = 0; i < x.data.length; i++) d += Math.abs(x.data[i] - y.data[i]);
  return d / x.data.length;
}

const browser = await chromium.launch();
for (const theme of ["light", "dark"]) {
  for (const { app, path } of APPS) {
    const context = await browser.newContext({
      viewport: { width: 390, height: 844 },
      deviceScaleFactor: 3,
      colorScheme: theme,
      isMobile: true,
      hasTouch: true,
    });
    await context.addInitScript(emulateInstalled, { hold: true });
    const page = await context.newPage();
    await page.goto(base + path, { waitUntil: "commit" });
    await page.waitForSelector("#darb-splash", { state: "attached" });
    await page.waitForFunction(
      () => document.getElementById("darb-splash")?.getAnimations({ subtree: true }).length > 0,
    );
    await page.evaluate(() => document.fonts.ready);
    for (const t of FRAMES) {
      await page.evaluate((ms) => {
        for (const a of document.getElementById("darb-splash").getAnimations({ subtree: true })) {
          a.pause();
          a.currentTime = ms;
        }
      }, t);
      const file = join(out, `${app}-${theme}-${String(t).padStart(3, "0")}.png`);
      const shot = await page.screenshot({ path: file });
      if (t === 0) {
        const launch = readFileSync(join(SPLASH, `launch-${theme}-1170x2532.png`));
        console.log(
          `${app} ${theme}: frame 0 vs launch image, mean diff ${(await meanDiff(shot, launch)).toFixed(2)}`,
        );
      }
    }
    await context.close();

    // The same reveal in real time, on video (Playwright records at the viewport's CSS size).
    const video = await browser.newContext({
      viewport: { width: 390, height: 844 },
      colorScheme: theme,
      isMobile: true,
      hasTouch: true,
      recordVideo: { dir: out, size: { width: 390, height: 844 } },
    });
    await video.addInitScript(emulateInstalled, { hold: false });
    const live = await video.newPage();
    await live.goto(base + path, { waitUntil: "load" });
    await live.waitForTimeout(1600);
    await live.close();
    const recorded = await live.video().path();
    await video.close();
    const { renameSync } = await import("node:fs");
    renameSync(recorded, join(out, `${app}-${theme}.webm`));
  }
}
await browser.close();
console.log(`frames -> ${out}`);
