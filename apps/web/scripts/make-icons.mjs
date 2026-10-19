// Draws Darb's app icons, by day and by night, from the brand mark (darb-mark-480.webp) into
// packages/tokens/assets/brand/icons. Deterministic: the same sharp and the same mark give the same
// bytes, so `--check` (and the test) can prove the committed icons are this script's output.
//
//   node scripts/make-icons.mjs          write every icon
//   node scripts/make-icons.mjs --check  render in memory, exit 1 if any committed file differs
import { mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const require = createRequire(import.meta.url);
const BRAND = dirname(require.resolve("@darb/tokens/assets/brand/darb-mark-480.webp"));
export const ICON_DIR = join(BRAND, "icons");

/** The two tiles. Colours are the site's own: the night forest and the day paper. */
export const TILES = {
  dark: { top: "#0f241b", bottom: "#07110c" },
  light: { top: "#f7f1e4", bottom: "#efe4cd" },
};
const TAB_NIGHT = { top: "#173b2c", bottom: "#0c2118" };
const FOREST = "#14281f";
const GOLD = "#d9a54c";
const GOLD_DEEP = "#b9852f";
const IVORY = "#fbf7ec";

/** The mark's drawn area inside the 480 x 559 webp (its transparent margin trimmed). */
const MARK_BOX = { left: 26, top: 26, width: 428, height: 507 };

/** Every file this script writes, by name. */
export const FAVICON_SIZES = [16, 32, 48];
export const SHORTCUTS = ["near", "search", "map", "join"];
export const HELPER_SHORTCUTS = ["add", "mine"];

const PNG = { compressionLevel: 9, adaptiveFiltering: false, palette: false, effort: 10 };

let markCache;
async function markSource() {
  markCache ??= await sharp(join(BRAND, "darb-mark-480.webp")).extract(MARK_BOX).png().toBuffer();
  return markCache;
}

/** The mark scaled to `height` px. */
async function mark(height) {
  const width = Math.round((height * MARK_BOX.width) / MARK_BOX.height);
  const img = sharp(await markSource()).resize(width, height, { kernel: "lanczos3" });
  // Tab sizes lose the arch's edges to the resize; a light sharpen brings them back.
  if (height <= 48) img.sharpen({ sigma: 0.5 });
  return img.png().toBuffer({ resolveWithObject: true });
}

/** A solid-coloured copy of an RGBA image's silhouette, at `opacity`, blurred by `sigma`. */
async function silhouette(buf, { color, opacity, sigma, pad }) {
  const { data, info } = await sharp(buf).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const [r, g, b] = hex(color);
  const w = info.width + pad * 2;
  const h = info.height + pad * 2;
  const out = Buffer.alloc(w * h * 4);
  for (let y = 0; y < info.height; y++)
    for (let x = 0; x < info.width; x++) {
      const i = (y * info.width + x) * 4;
      const o = ((y + pad) * w + x + pad) * 4;
      out[o] = r;
      out[o + 1] = g;
      out[o + 2] = b;
      out[o + 3] = Math.round(data[i + 3] * opacity);
    }
  for (let p = 0; p < w * h; p++) {
    if (out[p * 4 + 3] === 0) {
      out[p * 4] = r;
      out[p * 4 + 1] = g;
      out[p * 4 + 2] = b;
    }
  }
  return sharp(out, { raw: { width: w, height: h, channels: 4 } })
    .blur(sigma)
    .png()
    .toBuffer({ resolveWithObject: true });
}

function hex(c) {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** A small deterministic random source (mulberry32), for the paper grain. */
function random(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** A barely there paper grain for the day tile: warm specks, never a pattern. */
function grain(size, strength) {
  const next = random(0xda4b);
  const out = Buffer.alloc(size * size * 4);
  for (let p = 0; p < size * size; p++) {
    const v = next();
    const light = v > 0.5;
    out[p * 4] = light ? 255 : 120;
    out[p * 4 + 1] = light ? 252 : 96;
    out[p * 4 + 2] = light ? 240 : 52;
    out[p * 4 + 3] = Math.round(Math.abs(v - 0.5) * 2 * strength * 255);
  }
  return sharp(out, { raw: { width: size, height: size, channels: 4 } })
    .png()
    .toBuffer();
}

/** The tile behind the mark, as SVG: the gradient, the light it catches, the edge. */
function tileSvg(theme, size, { radius = 0 } = {}) {
  // A tab icon at night sits on dark browser chrome: its tile lifts a step so the edge still shows.
  const t = theme === "dark" && size <= 48 ? TAB_NIGHT : TILES[theme];
  const r = radius * size;
  const shape = (attrs) => `<rect width="${size}" height="${size}" rx="${r}" ry="${r}" ${attrs}/>`;
  const night = `
    <radialGradient id="glow" cx="0.56" cy="0.5" r="0.5">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.26"/>
      <stop offset="0.45" stop-color="${GOLD}" stop-opacity="0.09"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sky" cx="0.3" cy="0" r="0.9">
      <stop offset="0" stop-color="#1d5a43" stop-opacity="0.32"/>
      <stop offset="1" stop-color="#1d5a43" stop-opacity="0"/>
    </radialGradient>`;
  const day = `
    <radialGradient id="glow" cx="0.5" cy="0.42" r="0.6">
      <stop offset="0" stop-color="#ffffff" stop-opacity="0.7"/>
      <stop offset="1" stop-color="#ffffff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sky" cx="0.5" cy="1.1" r="0.75">
      <stop offset="0" stop-color="${GOLD}" stop-opacity="0.12"/>
      <stop offset="1" stop-color="${GOLD}" stop-opacity="0"/>
    </radialGradient>`;
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" stop-color="${t.top}"/>
      <stop offset="1" stop-color="${t.bottom}"/>
    </linearGradient>
    ${theme === "dark" ? night : day}
  </defs>
  ${shape('fill="url(#bg)"')}
  ${shape('fill="url(#sky)"')}
  ${shape('fill="url(#glow)"')}
</svg>`);
}

/**
 * The mark on its tile. `fill` is the mark's height as a share of the tile; `radius` rounds the
 * tile's corners (0: full bleed, for iOS and maskable icons, which the system shapes itself).
 */
async function markTile(theme, size, { fill, radius = 0, lift = 0.012 }) {
  const m = await mark(Math.round(size * fill));
  const left = Math.round((size - m.info.width) / 2);
  // Optically centred: the mark's heavy block sits low, so it rises a touch.
  const top = Math.round((size - m.info.height) / 2 - size * lift);
  const layers = [];
  if (size >= 96 && theme === "light") {
    const pad = Math.round(size * 0.08);
    const soft = await silhouette(m.data, {
      color: "#3c341e",
      opacity: 0.22,
      sigma: Math.max(1, size * 0.028),
      pad,
    });
    layers.push({ input: soft.data, left: left - pad, top: top - pad + Math.round(size * 0.022) });
    const contact = await silhouette(m.data, {
      color: "#3c341e",
      opacity: 0.16,
      sigma: Math.max(0.6, size * 0.006),
      pad,
    });
    layers.push({
      input: contact.data,
      left: left - pad,
      top: top - pad + Math.round(size * 0.005),
    });
  }
  if (theme === "dark") {
    // The forest block on a forest tile needs light behind it; a tab icon needs more of it.
    const small = size < 96;
    const pad = Math.round(size * 0.12);
    const halo = await silhouette(m.data, {
      color: small ? "#e7bd6e" : GOLD,
      opacity: small ? 0.5 : 0.2,
      sigma: Math.max(0.8, size * (small ? 0.045 : 0.05)),
      pad,
    });
    layers.push({ input: halo.data, left: left - pad, top: top - pad });
  }
  layers.push({ input: m.data, left, top });
  const placed = await Promise.all(layers.map((l) => place(size, l.input, l.left, l.top)));
  let img = sharp(tileSvg(theme, size, { radius })).composite(placed.map((input) => ({ input })));
  if (theme === "light" && size >= 128) {
    const base = await img.png().toBuffer();
    img = sharp(base).composite([{ input: await grain(size, 0.035) }]);
  }
  let out = await img.png().toBuffer();
  if (radius > 0) out = await clip(out, size, radius);
  return sharp(out).png(PNG).toBuffer();
}

/** `input` drawn at (left, top) on a transparent size x size canvas, cropped to it. */
async function place(size, input, left, top) {
  const meta = await sharp(input).metadata();
  const p = Math.max(meta.width, meta.height);
  const canvas = await sharp({
    create: { width: size + 2 * p, height: size + 2 * p, channels: 4, background: "#0000" },
  })
    .composite([{ input, left: left + p, top: top + p }])
    .png()
    .toBuffer();
  return sharp(canvas).extract({ left: p, top: p, width: size, height: size }).png().toBuffer();
}

/** Rounds a square image's corners (transparent outside). */
async function clip(buf, size, radius) {
  const r = radius * size;
  const maskSvg = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}"><rect width="${size}" height="${size}" rx="${r}" ry="${r}" fill="#fff"/></svg>`,
  );
  return sharp(buf)
    .composite([{ input: maskSvg, blend: "dest-in" }])
    .png()
    .toBuffer();
}

/**
 * Android's themed icon: one colour, drawn by alpha alone. The block stays solid, the ivory arch is
 * cut out of it
 * and the gold inside is a half tone, so the doorway still reads in a single colour.
 */
async function monochrome(size) {
  const m = await mark(Math.round(size * 0.6));
  const { data, info } = await sharp(m.data).raw().toBuffer({ resolveWithObject: true });
  const out = Buffer.alloc(info.width * info.height * 4);
  for (let p = 0; p < info.width * info.height; p++) {
    const [r, g, b, a] = data.subarray(p * 4, p * 4 + 4);
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    const sat = max === 0 ? 0 : (max - min) / max;
    // The ivory arch is the one pale, light surface: forest is dark and gold is saturated.
    const cut = (1 - smooth(0.1, 0.26, sat)) * smooth(0.15, 0.35, lum);
    // Gold (light but saturated) stays as a half tone, so the doorway's depth still shows.
    const gold = smooth(0.26, 0.42, lum) * (1 - cut);
    const cover = 1 - cut - 0.5 * gold;
    out[p * 4] = 255;
    out[p * 4 + 1] = 255;
    out[p * 4 + 2] = 255;
    out[p * 4 + 3] = Math.round(a * Math.max(0, Math.min(1, cover)));
  }
  const glyph = await sharp(out, { raw: { width: info.width, height: info.height, channels: 4 } })
    .png()
    .toBuffer();
  return sharp({
    create: { width: size, height: size, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .composite([
      {
        input: glyph,
        left: Math.round((size - info.width) / 2),
        top: Math.round((size - info.height) / 2 - size * 0.012),
      },
    ])
    .png(PNG)
    .toBuffer();
}

function smooth(e0, e1, x) {
  const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
  return t * t * (3 - 2 * t);
}

/**
 * The shortcut glyphs, in a 96 box, inside the circle a launcher may crop to. Simple shapes in the
 * brand's forest and gold: a pin, a lens, a folded map, a plus. Never the arch (that is the logo).
 */
function glyphSvg(name, theme) {
  const ink = theme === "dark" ? IVORY : FOREST;
  const gold = theme === "dark" ? GOLD : GOLD_DEEP;
  const fillGold = GOLD;
  const sw = 5;
  const line = `fill="none" stroke="${ink}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"`;
  switch (name) {
    case "near":
      return `<path d="M48 74C48 74 30 57.5 30 44.5C30 34.3 38.1 26 48 26S66 34.3 66 44.5C66 57.5 48 74 48 74Z" ${line}/>
        <circle cx="48" cy="44.5" r="6.5" fill="${fillGold}"/>`;
    case "search":
      return `<circle cx="44" cy="44" r="15" fill="${fillGold}" fill-opacity="0.28"/>
        <circle cx="44" cy="44" r="15" ${line}/>
        <path d="M55 55L67 67" ${line}/>`;
    case "map":
      return `<path d="M28 33L41 28L55 33L68 28V63L55 68L41 63L28 68Z" ${line}/>
        <path d="M41 28V63M55 33V68" fill="none" stroke="${ink}" stroke-width="3" stroke-opacity="0.45"/>
        <path d="M33 58C38 50 44 54 48 46S58 40 63 37" fill="none" stroke="${gold}" stroke-width="3.5" stroke-linecap="round" stroke-dasharray="0.1 6.5"/>`;
    case "join":
      return `<circle cx="48" cy="48" r="21" fill="${fillGold}"/>
        <path d="M48 38V58M38 48H58" fill="none" stroke="${FOREST}" stroke-width="${sw}" stroke-linecap="round"/>`;
    // The helper app's shortcuts: a camera with a gold lens (add a business), a list of cards.
    case "helper-add":
      return `<path d="M30 36H38L42 30H54L58 36H66A4 4 0 0 1 70 40V62A4 4 0 0 1 66 66H30A4 4 0 0 1 26 62V40A4 4 0 0 1 30 36Z" ${line}/>
        <circle cx="48" cy="51" r="9.5" fill="${fillGold}"/>
        <path d="M48 46.5V55.5M43.5 51H52.5" fill="none" stroke="${FOREST}" stroke-width="3.2" stroke-linecap="round"/>`;
    case "helper-mine":
      return `<rect x="28" y="28" width="40" height="40" rx="7" ${line}/>
        <circle cx="38" cy="40" r="3.5" fill="${fillGold}"/>
        <circle cx="38" cy="56" r="3.5" fill="${fillGold}"/>
        <path d="M46 40H59M46 56H59" ${line}/>`;
    default:
      throw new Error(`no glyph ${name}`);
  }
}

async function shortcut(name, theme) {
  const size = 96;
  const glyph = Buffer.from(
    `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 96 96">${glyphSvg(name, theme)}</svg>`,
  );
  return sharp(tileSvg(theme, size))
    .composite([{ input: glyph }])
    .png(PNG)
    .toBuffer();
}

/**
 * The helper app's badge: the join shortcut's gold disc and plus, on a ring of the tile's own colour
 * so it reads apart from the mark it overlaps. `at` and `r` are shares of the tile.
 */
function badgeSvg(theme, size, { at, r }) {
  const cx = size * at;
  const ring = theme === "dark" ? TILES.dark.bottom : TILES.light.top;
  const arm = r * size * 0.48;
  const stroke = Math.max(1.5, r * size * 0.24);
  return Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}">
  <circle cx="${cx}" cy="${cx}" r="${r * size * 1.22}" fill="${ring}"/>
  <circle cx="${cx}" cy="${cx}" r="${r * size}" fill="${GOLD}"/>
  <path d="M${cx} ${cx - arm}V${cx + arm}M${cx - arm} ${cx}H${cx + arm}" fill="none" stroke="${FOREST}" stroke-width="${stroke}" stroke-linecap="round"/>
</svg>`);
}

/** The Darb mark's tile with the helper badge on its lower corner (the helper app's icon). */
async function helperTile(theme, size, tile, badge) {
  const base = await markTile(theme, size, tile);
  return sharp(base)
    .composite([{ input: badgeSvg(theme, size, badge) }])
    .png(PNG)
    .toBuffer();
}

/** A .ico holding PNG images (Vista and later read PNG entries). */
function ico(images) {
  const head = Buffer.alloc(6);
  head.writeUInt16LE(0, 0);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(images.length, 4);
  const dir = Buffer.alloc(16 * images.length);
  let offset = 6 + dir.length;
  images.forEach(({ size, data }, i) => {
    const o = i * 16;
    dir.writeUInt8(size >= 256 ? 0 : size, o);
    dir.writeUInt8(size >= 256 ? 0 : size, o + 1);
    dir.writeUInt8(0, o + 2);
    dir.writeUInt8(0, o + 3);
    dir.writeUInt16LE(1, o + 4);
    dir.writeUInt16LE(32, o + 6);
    dir.writeUInt32LE(data.length, o + 8);
    dir.writeUInt32LE(offset, o + 12);
    offset += data.length;
  });
  return Buffer.concat([head, dir, ...images.map((i) => i.data)]);
}

/** Every icon, as { file name: bytes }. */
export async function renderIcons() {
  /** @type {Record<string, Buffer>} */
  const files = {};
  for (const theme of ["light", "dark"]) {
    for (const size of FAVICON_SIZES)
      // Tab icons are tiny: the mark fills more of the tile so it still reads.
      files[`favicon-${theme}-${size}.png`] = await markTile(theme, size, {
        fill: size <= 16 ? 0.9 : 0.82,
        radius: 0.22,
        lift: 0,
      });
    files[`apple-touch-icon-${theme}.png`] = await markTile(theme, 180, { fill: 0.62 });
    files[`icon-${theme}-192.png`] = await markTile(theme, 192, { fill: 0.64, radius: 0.22 });
    files[`icon-${theme}-512.png`] = await markTile(theme, 512, { fill: 0.64, radius: 0.22 });
    // Maskable: the launcher crops to any shape inside the centre circle (radius 40%). The mark's
    // corners reach 0.5 x its diagonal; at 0.6 of the tile they stay inside that circle.
    files[`maskable-${theme}-512.png`] = await markTile(theme, 512, { fill: 0.58 });
    for (const name of SHORTCUTS)
      files[`shortcut-${name}-${theme}.png`] = await shortcut(name, theme);
  }
  files["monochrome-512.png"] = await monochrome(512);
  // The helper app (/helpers): the same tiles with a badge. Maskable keeps it inside the safe circle.
  const corner = { at: 0.74, r: 0.13 };
  for (const theme of ["light", "dark"]) {
    files[`helper-favicon-${theme}-32.png`] = await helperTile(
      theme,
      32,
      { fill: 0.82, radius: 0.22, lift: 0 },
      { at: 0.72, r: 0.2 },
    );
    files[`helper-apple-touch-icon-${theme}.png`] = await helperTile(
      theme,
      180,
      { fill: 0.62 },
      corner,
    );
    for (const size of [192, 512])
      files[`helper-icon-${theme}-${size}.png`] = await helperTile(
        theme,
        size,
        { fill: 0.64, radius: 0.22 },
        corner,
      );
    for (const name of HELPER_SHORTCUTS)
      files[`helper-shortcut-${name}-${theme}.png`] = await shortcut(`helper-${name}`, theme);
    files[`helper-maskable-${theme}-512.png`] = await helperTile(
      theme,
      512,
      { fill: 0.58 },
      { at: 0.68, r: 0.12 },
    );
  }
  const icoImages = [];
  for (const size of FAVICON_SIZES)
    icoImages.push({ size, data: files[`favicon-light-${size}.png`] });
  files["favicon.ico"] = ico(icoImages);
  return files;
}

async function main() {
  const check = process.argv.includes("--check");
  const files = await renderIcons();
  const stale = [];
  if (!check) mkdirSync(ICON_DIR, { recursive: true });
  for (const [name, data] of Object.entries(files)) {
    const path = join(ICON_DIR, name);
    if (check) {
      if (!existsSync(path) || !readFileSync(path).equals(data)) stale.push(name);
    } else writeFileSync(path, data);
  }
  if (check && stale.length) {
    console.error(`icons out of date (run pnpm --filter @darb/web icons): ${stale.join(", ")}`);
    process.exit(1);
  }
  console.log(`icons: ${Object.keys(files).length} files ${check ? "match" : "->"} ${ICON_DIR}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) await main();
