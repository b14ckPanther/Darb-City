// @vitest-environment node
import { createRequire } from "node:module";
import type { StyleSpecification, SymbolLayerSpecification } from "maplibre-gl";
import { mapColors } from "@darb/tokens";
import { afterEach, describe, expect, it, vi } from "vitest";
import { darbStyle } from "../../scripts/map/style.mjs";
import { CITY_LABEL, darbLayers } from "./map-layers";
import {
  loadServedArea,
  SERVED_LIFT,
  SERVED_SOURCE,
  servedBounds,
  toExpression,
  TOWN_LABEL_M,
  VEIL,
  VEIL_EDGE,
  VEIL_SOURCE,
  veilPolygon,
  withServedArea,
  type ServedArea,
} from "./served-area";

// MapLibre's own style validator and filter evaluator (a dependency of maplibre-gl).
const require = createRequire(import.meta.url);
const spec = createRequire(require.resolve("maplibre-gl/package.json"))(
  "@maplibre/maplibre-gl-style-spec",
) as {
  validateStyleMin: (style: unknown) => { message: string }[];
  featureFilter: (
    filter: unknown,
    rootKey: string,
  ) => {
    filter: (globals: { zoom: number }, feature: unknown) => boolean;
  };
};

const ring: [number, number][] = [
  [35, 32],
  [35.2, 32],
  [35.2, 32.2],
  [35, 32.2],
  [35, 32],
];
const area: ServedArea = {
  type: "Feature",
  bbox: [35, 32, 35.2, 32.2],
  properties: {},
  geometry: { type: "MultiPolygon", coordinates: [[ring]] },
  places: { type: "MultiPoint", coordinates: [[35.1, 32.1]] },
};
const signedArea = (r: number[][]) =>
  r.slice(0, -1).reduce((sum, [x, y], k) => sum + x! * r[k + 1]![1]! - r[k + 1]![0]! * y!, 0);

describe("toExpression", () => {
  const cases: [string, unknown][] = [
    ["==", ["==", "kind", "locality"]],
    ["in", ["in", "kind", "river", "stream", "river"]],
    ["!in", ["!in", "kind", "sea"]],
    ["has", ["all", ["has", "is_bridge"], ["!has", "is_link"], ["==", "kind", "highway"]]],
    ["none", ["none", ["==", "kind", "a"], ["==", "kind", "b"]]],
  ];
  const features = ["locality", "river", "stream", "sea", "highway", "a", "b", "x"].flatMap(
    (kind) => [
      { type: 1, properties: { kind } },
      { type: 1, properties: { kind, is_bridge: true } },
      { type: 1, properties: { kind, is_bridge: true, is_link: true } },
    ],
  );
  for (const [name, legacy] of cases)
    it(`matches the same features as the legacy filter: ${name}`, () => {
      const converted = toExpression(legacy);
      const before = spec.featureFilter(legacy, "layers[0].filter");
      const after = spec.featureFilter(converted, "layers[0].filter");
      for (const feature of features)
        expect(after.filter({ zoom: 10 }, feature), JSON.stringify(feature)).toBe(
          before.filter({ zoom: 10 }, feature),
        );
    });
  it("keeps expressions, and gives up on what it does not know", () => {
    expect(toExpression(undefined)).toBe(true);
    const expression = ["==", ["get", "kind"], "x"];
    expect(toExpression(expression)).toBe(expression);
    expect(toExpression(["all", ["==", "kind", "x"], ["==", ["get", "a"], 1]])).toEqual([
      "all",
      ["==", ["get", "kind"], "x"],
      ["==", ["get", "a"], 1],
    ]);
    expect(toExpression(["mystery", "kind"])).toBeNull();
    expect(toExpression(["all", ["mystery"]])).toBeNull();
  });
});

describe("the veil", () => {
  it("is the world with the served land cut out, holes wound clockwise", () => {
    const veil = veilPolygon(area);
    expect(veil.coordinates).toHaveLength(2);
    expect(signedArea(veil.coordinates[0]!)).toBeGreaterThan(0);
    expect(signedArea(veil.coordinates[1]!)).toBeLessThan(0);
    // The input stays as it was.
    expect(area.geometry.coordinates[0]![0]![1]).toEqual([35.2, 32]);
  });
  it("bounds the pan to the served land and a margin", () => {
    expect(servedBounds(area, 0.5)).toEqual([
      [34.5, 31.5],
      [35.7, 32.7],
    ]);
  });
});

describe("withServedArea", () => {
  const base = darbStyle("he") as StyleSpecification;
  base.sources["darb-city"] = {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  };
  base.sources["darb-pins"] = {
    type: "geojson",
    data: { type: "FeatureCollection", features: [] },
  };
  base.layers.push(...darbLayers());
  const style = withServedArea(base, area);
  const ids = style.layers.map((l) => l.id);

  it("is a valid MapLibre style", () => {
    expect(spec.validateStyleMin(style).map((e) => e.message)).toEqual([]);
    // The filters MapLibre would build from it.
    style.layers.forEach((layer, k) => {
      if ("filter" in layer && layer.filter)
        spec.featureFilter(layer.filter, `layers[${k}].filter`);
    });
  });
  it("adds the veil over the basemap, under its labels and Darb's own layers", () => {
    expect(style.sources[VEIL_SOURCE]).toMatchObject({ type: "geojson" });
    expect(style.sources[SERVED_SOURCE]).toMatchObject({ type: "geojson" });
    const firstLabel = ids.findIndex(
      (id) => style.layers.find((l) => l.id === id)!.type === "symbol",
    );
    expect(ids.indexOf(VEIL)).toBeLessThan(firstLabel);
    expect(ids.indexOf(VEIL)).toBeGreaterThan(ids.indexOf("roads_highway"));
    expect(ids.indexOf(VEIL_EDGE)).toBeLessThan(ids.indexOf(CITY_LABEL));
    expect(ids.indexOf(SERVED_LIFT)).toBeLessThan(ids.indexOf("water"));
    expect(ids.indexOf(SERVED_LIFT)).toBeGreaterThan(ids.indexOf("earth"));
    const veil = style.layers.find((l) => l.id === VEIL)!;
    // A warm mist, never black: the land outside is quiet, not dark.
    expect(veil.paint).toMatchObject({ "fill-color": mapColors.mist, "fill-opacity": 0.82 });
  });
  it("names only Darb's towns, and labels nothing outside the served land", () => {
    const labels = style.layers.filter(
      (l): l is SymbolLayerSpecification => l.type === "symbol" && l.source === "protomaps",
    );
    expect(labels.length).toBeGreaterThan(3);
    for (const layer of labels) {
      const filter = layer.filter as unknown[];
      expect(filter[0], layer.id).toBe("all");
      const where = filter.at(-1);
      if (layer.id === "places_locality")
        expect(where).toEqual(["<", ["distance", area.places], TOWN_LABEL_M]);
      else expect(where, layer.id).toEqual(["within", area.geometry]);
    }
    // Darb's own labels are untouched.
    expect(style.layers.find((l) => l.id === CITY_LABEL)).toEqual(
      darbLayers().find((l) => l.id === CITY_LABEL),
    );
  });
  it("leaves the style alone without an area", () => {
    expect(withServedArea(base, null)).toBe(base);
  });
});

describe("loadServedArea", () => {
  afterEach(() => vi.unstubAllGlobals());

  it("fetches once and shares the answer", async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify(area)));
    vi.stubGlobal("fetch", fetch);
    const [a, b] = await Promise.all([loadServedArea(), loadServedArea()]);
    expect(a).toEqual(area);
    expect(b).toBe(a);
    expect(await loadServedArea()).toBe(a);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
});

describe("loadServedArea after a failure", () => {
  it("gives null, and tries again next time", async () => {
    vi.resetModules();
    const { loadServedArea: load } = await import("./served-area");
    const fetch = vi.fn(async () => new Response("", { status: 404 }));
    vi.stubGlobal("fetch", fetch);
    expect(await load()).toBeNull();
    expect(await load()).toBeNull();
    expect(fetch).toHaveBeenCalledTimes(2);
    // Anything but an outline (a proxy's HTML, another JSON) is no outline either.
    vi.stubGlobal("fetch", async () => Response.json({ version: 8, layers: [] }));
    expect(await load()).toBeNull();
    vi.unstubAllGlobals();
  });
});
