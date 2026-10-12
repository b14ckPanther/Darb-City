// One-off: downloads the Noto Sans Regular glyph ranges the map needs (Latin, Cyrillic, Hebrew,
// Arabic and its presentation forms, punctuation) from protomaps/basemaps-assets at a pinned
// commit, into apps/web/map-assets/glyphs (committed). Fonts: SIL Open Font License 1.1 (OFL.txt).
// The folder (and so the style's fontstack) is hyphenated: no spaces in served URLs (ruling 4).
// Usage: node apps/web/scripts/map/fetch-glyphs.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const GLYPHS_COMMIT = "028c18f713baecad011301ff7a69acc39bcc2ae7";
/** The font's name upstream (protomaps/basemaps-assets/fonts/<name>). */
export const SOURCE_FONT = "Noto Sans Regular";
/** Our folder and fontstack name for it. */
export const FONT = "noto-sans-regular";
export const RANGES = [
  "0-255",
  "256-511",
  "768-1023",
  "1024-1279",
  "1280-1535",
  "1536-1791",
  "1792-2047",
  "2048-2303",
  "8192-8447",
  "64256-64511",
  "64512-64767",
  "64768-65023",
  "65024-65279",
];
export const GLYPHS_DIR = fileURLToPath(new URL("../../map-assets/glyphs/", import.meta.url));
const BASE = `https://raw.githubusercontent.com/protomaps/basemaps-assets/${GLYPHS_COMMIT}/fonts`;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(join(GLYPHS_DIR, FONT), { recursive: true });
  writeFileSync(join(GLYPHS_DIR, "OFL.txt"), await download(`${BASE}/OFL.txt`));
  let total = 0;
  for (const range of RANGES) {
    const bytes = await download(`${BASE}/${encodeURIComponent(SOURCE_FONT)}/${range}.pbf`);
    writeFileSync(join(GLYPHS_DIR, FONT, `${range}.pbf`), bytes);
    total += bytes.length;
  }
  console.log(`glyphs: ${RANGES.length} ranges, ${(total / 1e6).toFixed(2)} MB -> ${GLYPHS_DIR}`);
}
