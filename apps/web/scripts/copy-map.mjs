// Builds public/map (served at /map/*). The lazy city stage imports MapLibre's ES modules from here
// at runtime, so MapLibre never enters a route's first-load JavaScript. Run by `dev` and `build`.
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

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
  return { vendor };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { vendor } = buildMapAssets(fileURLToPath(new URL("../public/map", import.meta.url)));
  console.log(`map: vendor -> ${vendor}`);
}
