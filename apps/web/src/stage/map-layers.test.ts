// @vitest-environment node
import { colors } from "@darb/tokens";
import { expect, it } from "vitest";
import { MAP_FONT as STYLE_FONT } from "../../scripts/map/style.mjs";
import {
  CITY_DOT,
  CITY_GLOW,
  CITY_LABEL,
  CITY_SOURCE,
  CLUSTER_COUNT,
  darbLayers,
  MAP_FONT,
  PIN_LAYER,
  PIN_SOURCE,
} from "./map-layers";

it("draws a density surface, proportional points and ivory names, and business pins on top", () => {
  const layers = darbLayers();
  expect(layers.map((l) => l.id)).toEqual([
    CITY_GLOW,
    CLUSTER_COUNT,
    CITY_DOT,
    CITY_LABEL,
    PIN_LAYER,
  ]);
  for (const layer of layers.slice(0, 4)) expect(layer).toMatchObject({ source: CITY_SOURCE });
  expect(layers[4]).toMatchObject({ source: PIN_SOURCE });
  const json = JSON.stringify(layers);
  expect(json).not.toMatch(/icon-/);
  for (const colour of [colors.gold, colors.gold300, colors.ivory, colors.night])
    expect(json).toContain(colour);
  // Bubbles for merged places; single places never drawn when empty.
  expect(JSON.stringify(layers[0])).toContain("point_count");
  expect(JSON.stringify((layers[2] as { filter?: unknown }).filter)).toContain('["get","count"],0');
});

it("labels places with the one self-hosted font", () => {
  expect(MAP_FONT).toBe(STYLE_FONT);
  expect(darbLayers()[3]).toMatchObject({ layout: { "text-font": [MAP_FONT] } });
});
