// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { buildMapAssets, maplibreVersion, VENDOR_FILES } from "../../scripts/copy-map.mjs";
import { MAPLIBRE_CSS_URL, MAPLIBRE_URL, MAPLIBRE_VERSION, styleUrl, TILES_URL } from "./vendor";

it("pins the vendored MapLibre to the installed version", () => {
  expect(MAPLIBRE_VERSION).toBe(maplibreVersion());
  expect(MAPLIBRE_URL).toBe(`/map/vendor/maplibre-gl@${MAPLIBRE_VERSION}/maplibre-gl.mjs`);
  expect(MAPLIBRE_CSS_URL).toBe(`/map/vendor/maplibre-gl@${MAPLIBRE_VERSION}/maplibre-gl.css`);
});

it("serves tiles from the local route unless an R2 URL is configured", () => {
  expect(TILES_URL).toBe("/api/tiles/israel.pmtiles");
  expect(styleUrl("ar")).toBe("/map/style/ar.json");
});

it("copies the MapLibre modules where the stage imports them", () => {
  const target = mkdtempSync(join(tmpdir(), "darb-map-"));
  const { vendor } = buildMapAssets(target);
  expect(vendor).toBe(join(target, "vendor", `maplibre-gl@${MAPLIBRE_VERSION}`));
  for (const file of VENDOR_FILES) expect(existsSync(join(vendor, file)), file).toBe(true);
  // The main module imports its shared half by relative URL, so both must sit side by side.
  expect(readFileSync(join(vendor, "maplibre-gl.mjs"), "utf8")).toContain(
    'from"./maplibre-gl-shared.mjs"',
  );
});

it("ships MapLibre's licence beside the vendored modules", () => {
  const target = mkdtempSync(join(tmpdir(), "darb-map-"));
  const { vendor } = buildMapAssets(target);
  const licence = readFileSync(join(vendor, "LICENSE.txt"), "utf8");
  expect(licence).toContain("Copyright (c) 2023, MapLibre contributors");
  expect(licence).toContain("BSD");
});
