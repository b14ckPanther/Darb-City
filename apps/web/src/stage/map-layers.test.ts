// @vitest-environment node
import { colors, mapColors } from "@darb/tokens";
import { expect, it } from "vitest";
import { MAP_FONT as STYLE_FONT } from "../../scripts/map/style.mjs";
import {
  CLUSTER_MAX_ZOOM,
  CLUSTER_PIN,
  CLUSTER_RADIUS,
  CLUSTER_TEXT,
  darbLayers,
  HEAT,
  HEAT_SOURCE,
  HERE_DOT,
  HERE_HALO,
  HERE_LABEL,
  HERE_SOURCE,
  HOT_NAME,
  HOT_NUMBER,
  HOT_PIN,
  HOT_RING,
  HOT_SOURCE,
  MAP_FONT,
  PIN_LAYER,
  PIN_NUMBER,
  PIN_SHADOW,
  PIN_SOURCE,
} from "./map-layers";

const layers = darbLayers();
const byId = (id: string) => layers.find((l) => l.id === id)!;

it("draws the warmth, the place, the pins, and the lifted pin on top, in that order", () => {
  expect(layers.map((l) => l.id)).toEqual([
    HEAT,
    HERE_HALO,
    HERE_DOT,
    HERE_LABEL,
    PIN_SHADOW,
    CLUSTER_PIN,
    CLUSTER_TEXT,
    PIN_LAYER,
    PIN_NUMBER,
    HOT_RING,
    HOT_PIN,
    HOT_NUMBER,
    HOT_NAME,
  ]);
  const source = (id: string) => (byId(id) as { source: string }).source;
  expect(source(HEAT)).toBe(HEAT_SOURCE);
  for (const id of [HERE_HALO, HERE_DOT, HERE_LABEL]) expect(source(id)).toBe(HERE_SOURCE);
  for (const id of [PIN_SHADOW, CLUSTER_PIN, CLUSTER_TEXT, PIN_LAYER, PIN_NUMBER])
    expect(source(id)).toBe(PIN_SOURCE);
  for (const id of [HOT_RING, HOT_PIN, HOT_NUMBER, HOT_NAME]) expect(source(id)).toBe(HOT_SOURCE);
});

it("never puts a count on the map: the warmth has no text and merged pins say only +N", () => {
  expect(byId(HEAT).type).toBe("heatmap");
  // The warmth fades out before a place's own map.
  expect(byId(HEAT).maxzoom).toBeLessThanOrEqual(11);
  const symbols = layers.filter((l) => l.type === "symbol");
  for (const layer of symbols)
    expect(JSON.stringify((layer as { layout: object }).layout)).not.toContain('"count"');
  expect(JSON.stringify(byId(CLUSTER_TEXT))).toContain(
    '["concat","+",["get","point_count_abbreviated"]]',
  );
  // Clusters are small (a 13 px pin), never sized by how many they hold.
  expect(byId(CLUSTER_PIN)).toMatchObject({ paint: { "circle-radius": 13 } });
  expect(CLUSTER_RADIUS).toBeGreaterThanOrEqual(32);
  expect(CLUSTER_RADIUS).toBeLessThanOrEqual(40);
  expect(CLUSTER_MAX_ZOOM).toBeGreaterThan(14);
});

it("numbers pins only when they mirror a list", () => {
  expect(JSON.stringify(byId(PIN_NUMBER))).toContain('[">",["get","n"],0]');
  expect(JSON.stringify(byId(HOT_NUMBER))).toContain('[">",["get","n"],0]');
});

it("uses the Darb palette made for the daylight map", () => {
  const json = JSON.stringify(layers);
  expect(json).not.toMatch(/icon-/);
  for (const colour of [colors.gold, mapColors.halo, mapColors.bubble, mapColors.label])
    expect(json).toContain(colour);
  expect(json).not.toContain(colors.night);
});

it("writes with the one self-hosted font", () => {
  expect(MAP_FONT).toBe(STYLE_FONT);
  for (const layer of layers.filter((l) => l.type === "symbol"))
    expect(layer).toMatchObject({ layout: { "text-font": [MAP_FONT] } });
});
