// @vitest-environment node
import { colors } from "@darb/tokens";
import { expect, it } from "vitest";
import { MAP_FONT as STYLE_FONT } from "../../scripts/map/style.mjs";
import {
  CITY_DOT,
  CITY_GLOW,
  CITY_LABEL,
  CITY_SOURCE,
  darbLayers,
  MAP_FONT,
  PIN_LAYER,
  PIN_SOURCE,
} from "./map-layers";

it("draws live places as gold glows and dots with ivory names, and business pins on top", () => {
  const layers = darbLayers();
  expect(layers.map((l) => l.id)).toEqual([CITY_GLOW, CITY_DOT, CITY_LABEL, PIN_LAYER]);
  for (const layer of layers.slice(0, 3)) expect(layer).toMatchObject({ source: CITY_SOURCE });
  expect(layers[3]).toMatchObject({ source: PIN_SOURCE });
  const json = JSON.stringify(layers);
  expect(json).not.toMatch(/icon-/);
  for (const colour of [colors.gold, colors.gold300, colors.ivory, colors.night])
    expect(json).toContain(colour);
});

it("labels places with the one self-hosted font", () => {
  expect(MAP_FONT).toBe(STYLE_FONT);
  expect(darbLayers()[2]).toMatchObject({ layout: { "text-font": [MAP_FONT] } });
});
