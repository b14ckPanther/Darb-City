// @vitest-environment node
import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { prepareStyle } from "./map-style";

const style = {
  version: 8,
  glyphs: "/map/glyphs/{fontstack}/{range}.pbf",
  sources: {
    protomaps: { type: "vector", url: "pmtiles:///api/tiles/israel.pmtiles", attribution: "x" },
  },
  layers: [{ id: "background", type: "background" }],
} as StyleSpecification;
const at = { origin: "http://localhost:3000", tilesUrl: "/api/tiles/israel.pmtiles" };

describe("prepareStyle", () => {
  it("makes the glyph URL absolute without encoding its tokens", () => {
    expect(prepareStyle(style, at).glyphs).toBe(
      "http://localhost:3000/map/glyphs/{fontstack}/{range}.pbf",
    );
  });
  it("points the tiles at the configured archive, local or on R2", () => {
    expect(prepareStyle(style, at).sources.protomaps).toEqual({
      type: "vector",
      url: "pmtiles://http://localhost:3000/api/tiles/israel.pmtiles",
      attribution: "x",
    });
    const r2 = prepareStyle(style, { ...at, tilesUrl: "https://tiles.darb.co.il/israel.pmtiles" });
    expect(r2.sources.protomaps).toMatchObject({
      url: "pmtiles://https://tiles.darb.co.il/israel.pmtiles",
    });
  });
  it("leaves the fetched style untouched", () => {
    const copy = structuredClone(style);
    prepareStyle(style, at).layers.push({ id: "x", type: "background" });
    expect(style).toEqual(copy);
  });
  it("refuses a style without the Protomaps source", () => {
    expect(() => prepareStyle({ ...style, sources: {} }, at)).toThrow(/protomaps/);
  });
});
