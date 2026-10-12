// The e2e map fixture: a ~1 KB PMTiles archive covering the Galilee and Haifa (zooms 0–12), so CI
// never downloads real tiles. `node scripts/tiles/make-test-tiles.mjs` writes it; `--check` fails
// when the committed file differs from what the writer produces.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildArchive } from "./pmtiles-writer.mjs";

export const FIXTURE = fileURLToPath(new URL("../../e2e/tiles/israel.pmtiles", import.meta.url));
export const FIXTURE_OPTIONS = { bbox: [34.9, 32.5, 35.7, 33.2], minZoom: 0, maxZoom: 12 };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const archive = buildArchive(FIXTURE_OPTIONS);
  if (process.argv.includes("--check")) {
    const same = readFileSync(FIXTURE).equals(archive);
    console.log(same ? "test tiles: up to date" : "test tiles: out of date, run tiles:test");
    process.exit(same ? 0 : 1);
  }
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, archive);
  console.log(`test tiles: ${archive.length} bytes -> ${FIXTURE}`);
}
