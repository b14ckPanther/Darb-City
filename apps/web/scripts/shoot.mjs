// Usage: node apps/web/scripts/shoot.mjs /sakhnin /en/sakhnin/beauty ...
// Saves phone and desktop screenshots to apps/web/.screens and reports small targets and overflow.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.env.WEB_URL ?? "http://localhost:3000";
const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error("Usage: node scripts/shoot.mjs <path> [path…]");
const out = fileURLToPath(new URL("../.screens/", import.meta.url));
mkdirSync(out, { recursive: true });

const viewports = [
  ["phone", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
];
const browser = await chromium.launch();
for (const [name, viewport] of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    if (name === "phone" && process.env.STAGE_OPEN === "1")
      await page
        .locator("[data-stage-toggle]")
        .click({ timeout: 10_000 })
        .catch(() => {});
    // The stage loads after idle: wait until it settled, fell back, or is closed on a phone.
    await page
      .waitForFunction(
        () => {
          const d = document.documentElement;
          if (d.getAttribute("data-stage") !== "on") return true;
          const host = document.querySelector("[data-stage-host]");
          const open = innerWidth >= 900 || d.hasAttribute("data-stage-open");
          if (!open) return host !== null;
          return (
            host?.getAttribute("data-stage-state") === "ready" &&
            !host.hasAttribute("data-stage-moving")
          );
        },
        null,
        { timeout: 20_000 },
      )
      .catch(() => console.log(JSON.stringify({ path, stage: "did not settle" })));
    const file = `${out}${name}${path === "/" ? "_home" : path.replaceAll("/", "_")}.png`;
    await page.screenshot({ path: file });
    const report = await page.evaluate(() => {
      const targets = document.querySelectorAll("a[href], button, input, summary, [role='button']");
      const small = [...targets]
        .filter((el) => !el.closest(".visually-hidden, .skip-link, p"))
        .filter((el) => {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (box.width === 0 || style.visibility === "hidden" || style.display === "none")
            return false;
          return box.width < 44 || box.height < 44;
        })
        .map((el) => el.outerHTML.slice(0, 90));
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      return { small, overflow };
    });
    console.log(JSON.stringify({ file, ...report }));
  }
  await context.close();
}
await browser.close();
