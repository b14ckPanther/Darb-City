// Paints the iOS launch images (apple-touch-startup-image) for Darb's installed apps, day and night,
// at every current iPhone and iPad size, into packages/tokens/assets/brand/splash (served at
// /brand/splash). Each one is the first frame of the in-app reveal (src/splash): the same ground,
// halo and mark at the same place (src/splash/geometry.mjs), so the hand-off from the system's
// launch image to the page is seamless. The frame carries no words, so the three apps (Darb, Darb
// helpers, Darb admin) and the three languages share it; each app's name rises in the reveal.
// Deterministic: the same sharp and mark give the same bytes, so `--check` (and the test) can
// prove the committed images are this script's output.
//
//   node scripts/make-splash.mjs          write every launch image
//   node scripts/make-splash.mjs --check  render in memory, exit 1 if any committed file differs
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { GROUND, HALO, MARK, layout } from "../src/splash/geometry.mjs";
import { SPLASH_DEVICES, SPLASH_THEMES, splashFile } from "../src/splash/devices.mjs";

const require = createRequire(import.meta.url);
const BRAND = dirname(require.resolve("@darb/tokens/assets/brand/darb-mark-480.webp"));
export const SPLASH_DIR = join(BRAND, "splash");
// Tests write and check a throwaway copy (SPLASH_OUT, SPLASH_JSON), never the committed files.
const OUT = process.env.SPLASH_OUT ?? SPLASH_DIR;
const SRC = fileURLToPath(new URL("../src/splash/", import.meta.url));
/** Where the page learns the reveal stylesheet's published name (src/splash/boot.ts imports it). */
export const STYLESHEET_JSON = join(SRC, "stylesheet.json");
const JSON_OUT = process.env.SPLASH_JSON ?? STYLESHEET_JSON;

/** Palette PNG: 256 colours hold the mark's gradients and the halo, at about two thirds the bytes. */
const PNG = { compressionLevel: 9, adaptiveFiltering: false, palette: true, effort: 10 };

const markCache = new Map();
/** The mark at `width` device pixels, whole (its transparent margin kept, like the CSS box). */
async function mark(width, height) {
  const key = `${width}x${height}`;
  if (!markCache.has(key))
    markCache.set(
      key,
      await sharp(join(BRAND, "darb-mark-480.webp"))
        .resize(width, height, { kernel: "lanczos3", fit: "fill" })
        .png()
        .toBuffer(),
    );
  return markCache.get(key);
}

/** The ground and its halo, as SVG. */
function groundSvg(theme, w, h, halo) {
  const { color, opacity } = HALO[theme];
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}">
  <defs>
    <radialGradient id="halo" gradientUnits="userSpaceOnUse" cx="${halo.cx}" cy="${halo.cy}" r="${halo.r}">
      <stop offset="0" stop-color="${color}" stop-opacity="${opacity}"/>
      <stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="${w}" height="${h}" fill="${GROUND[theme]}"/>
  <rect width="${w}" height="${h}" fill="url(#halo)"/>
</svg>`);
}

/** One launch image: the reveal's first frame on a `device`, by day or by night. */
export async function renderSplash(theme, device) {
  const { width: cw, height: ch, dpr } = device;
  const w = cw * dpr;
  const h = ch * dpr;
  const at = layout(cw, ch);
  const s = (v) => v * dpr;
  const mw = Math.round(s(at.mark.width));
  const mh = Math.round((mw * MARK.height) / MARK.width);
  const halo = { cx: s(at.halo.cx), cy: s(at.halo.cy), r: s(at.halo.r) };
  return sharp(groundSvg(theme, w, h, halo))
    .composite([
      {
        input: await mark(mw, mh),
        left: Math.round((w - mw) / 2),
        top: Math.round(s(at.mark.top + at.mark.height / 2) - mh / 2),
      },
    ])
    .png(PNG)
    .toBuffer();
}

/** Comments out, whitespace folded: the reveal's CSS has no strings but the mark's data URL. */
function minify(css) {
  return css
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\s+/g, " ")
    .replace(/\s*([{}:;,>])\s*/g, "$1")
    .replace(/;}/g, "}")
    .trim();
}

/**
 * The reveal's stylesheet (src/splash/reveal.css) with the mark inlined, so the first frame paints
 * whole from one request, named by its content hash so it can be cached for good.
 */
export function renderStylesheet() {
  const mark = readFileSync(join(BRAND, "darb-mark-480.webp")).toString("base64");
  const source = readFileSync(join(SRC, "reveal.css"), "utf8");
  if (!source.includes("__MARK__")) throw new Error("reveal.css has no __MARK__");
  const css = Buffer.from(minify(source).replace("__MARK__", `data:image/webp;base64,${mark}`));
  const hash = createHash("sha256").update(css).digest("hex").slice(0, 10);
  const file = `reveal.${hash}.css`;
  return {
    file,
    css,
    json: `${JSON.stringify({ href: `/brand/splash/${file}` }, null, 2)}\n`,
  };
}

/** Every launch image and the reveal's stylesheet, as { file name: bytes }. */
export async function renderSplashes() {
  /** @type {Record<string, Buffer>} */
  const files = {};
  const sheet = renderStylesheet();
  files[sheet.file] = sheet.css;
  for (const theme of SPLASH_THEMES)
    for (const device of SPLASH_DEVICES)
      files[splashFile(theme, device)] = await renderSplash(theme, device);
  return files;
}

async function main() {
  const check = process.argv.includes("--check");
  const files = await renderSplashes();
  const { json } = renderStylesheet();
  const stale = [];
  if (check) {
    if (!existsSync(JSON_OUT) || readFileSync(JSON_OUT, "utf8") !== json)
      stale.push("src/splash/stylesheet.json");
    for (const [file, data] of Object.entries(files)) {
      const path = join(OUT, file);
      if (!existsSync(path) || !readFileSync(path).equals(data)) stale.push(file);
    }
    const extra = existsSync(OUT) ? readdirSync(OUT).filter((f) => !(f in files)) : [];
    stale.push(...extra.map((f) => `${f} (not drawn any more)`));
  } else {
    rmSync(OUT, { recursive: true, force: true });
    mkdirSync(OUT, { recursive: true });
    for (const [file, data] of Object.entries(files)) writeFileSync(join(OUT, file), data);
    writeFileSync(JSON_OUT, json);
  }
  if (check && stale.length) {
    console.error(
      `launch images out of date (run pnpm --filter @darb/web splash): ${stale.join(", ")}`,
    );
    process.exit(1);
  }
  const bytes = Object.values(files).reduce((n, b) => n + b.length, 0);
  console.log(
    `splash: ${Object.keys(files).length} files, ${(bytes / 1024 / 1024).toFixed(2)} MB ${check ? "match" : "->"} ${OUT}`,
  );
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
