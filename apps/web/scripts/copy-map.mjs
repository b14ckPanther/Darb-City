// Builds public/map (served at /map/*): the vendored MapLibre modules, the self-hosted glyphs and
// one Darb style per locale. The lazy city stage imports MapLibre from here at runtime, so it never
// enters a route's first-load JavaScript. Run by `dev` and `build`; needs no network.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GLYPHS_DIR } from "./map/fetch-glyphs.mjs";
import { darbStyle } from "./map/style.mjs";

const require = createRequire(import.meta.url);
const LOCALES = ["he", "ar", "en"];

/** The main thread loads the first two, the worker the third (and the shared module from cache). */
export const VENDOR_FILES = [
  "maplibre-gl.mjs",
  "maplibre-gl-shared.mjs",
  "maplibre-gl-worker.mjs",
  "maplibre-gl.css",
];

export function maplibreVersion() {
  return JSON.parse(readFileSync(require.resolve("maplibre-gl/package.json"), "utf8")).version;
}

export function buildMapAssets(target) {
  rmSync(target, { recursive: true, force: true });
  const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
  const vendor = join(target, "vendor", `maplibre-gl@${maplibreVersion()}`);
  mkdirSync(vendor, { recursive: true });
  for (const file of VENDOR_FILES) cpSync(join(dist, file), join(vendor, file));
  const glyphs = join(target, "glyphs");
  cpSync(GLYPHS_DIR, glyphs, { recursive: true });
  mkdirSync(join(target, "style"), { recursive: true });
  const styles = LOCALES.map((locale) => {
    const file = join(target, "style", `${locale}.json`);
    writeFileSync(file, JSON.stringify(darbStyle(locale)));
    return file;
  });
  return { vendor, glyphs, styles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { vendor, styles } = buildMapAssets(
    fileURLToPath(new URL("../public/map", import.meta.url)),
  );
  console.log(`map: vendor -> ${vendor}; glyphs; ${styles.length} styles`);
}
