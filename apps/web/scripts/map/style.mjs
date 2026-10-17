// The Darb map style, built from Protomaps basemaps (BSD-3-Clause) at build time, one per locale:
// a sunlit atlas: ivory land, sage parks, teal sea, gold main roads, forest labels. No icons (so no sprite), no points of interest
// (OSM POIs include bars and pubs: halal rule), no borders. Glyphs are self-hosted Noto Sans,
// served from a hyphenated folder whose name is also the fontstack (ruling 4: no spaces in URLs).
import { mapColors } from "@darb/tokens";
import { layers, namedFlavor } from "@protomaps/basemaps";
import { FONT } from "./fetch-glyphs.mjs";

export const MAP_FONT = FONT;
export const GLYPHS_URL = "/map/glyphs/{fontstack}/{range}.pbf";
export const PROTOMAPS_SOURCE = "protomaps";
export const ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const DROPPED_LAYERS = [
  "pois",
  "roads_shields",
  "roads_oneway",
  "address_label",
  "boundaries",
  "boundaries_country",
  // Neutral map, focused on towns: no country, territory or region (state/province) labels.
  "places_country",
  "places_region",
  "places_macroregion",
];
export function darbFlavor() {
  const m = mapColors;
  return {
    ...namedFlavor("light"),
    background: m.land,
    earth: m.land,
    water: m.water,
    glacier: m.land,
    sand: m.sand,
    beach: m.sand,
    park_a: m.park,
    park_b: m.wood,
    wood_a: m.park,
    wood_b: m.wood,
    scrub_a: m.meadow,
    scrub_b: m.park,
    hospital: m.urban,
    industrial: m.urban,
    school: m.urban,
    pedestrian: m.urban,
    aerodrome: m.urban,
    zoo: m.park,
    military: m.urban,
    runway: m.road,
    pier: m.road,
    buildings: m.building,
    highway: m.main,
    highway_casing_early: m.mainCasing,
    highway_casing_late: m.mainCasing,
    major: m.major,
    major_casing_early: m.majorCasing,
    major_casing_late: m.majorCasing,
    link: m.main,
    link_casing: m.mainCasing,
    minor_a: m.road,
    minor_b: m.road,
    minor_casing: m.roadCasing,
    minor_service: m.road,
    minor_service_casing: m.roadCasing,
    other: m.road,
    railway: m.rail,
    tunnel_highway: m.tunnel,
    tunnel_major: m.tunnel,
    tunnel_link: m.tunnel,
    tunnel_minor: m.tunnel,
    tunnel_other: m.tunnel,
    tunnel_highway_casing: m.roadCasing,
    tunnel_major_casing: m.roadCasing,
    tunnel_link_casing: m.roadCasing,
    tunnel_minor_casing: m.roadCasing,
    tunnel_other_casing: m.roadCasing,
    bridges_highway: m.main,
    bridges_major: m.major,
    bridges_link: m.main,
    bridges_minor: m.road,
    bridges_other: m.road,
    bridges_highway_casing: m.mainCasing,
    bridges_major_casing: m.majorCasing,
    bridges_link_casing: m.mainCasing,
    bridges_minor_casing: m.roadCasing,
    bridges_other_casing: m.roadCasing,
    boundaries: m.rail,
    roads_label_minor: m.labelSoft,
    roads_label_minor_halo: m.halo,
    roads_label_major: m.labelSoft,
    roads_label_major_halo: m.halo,
    ocean_label: m.waterLabel,
    subplace_label: m.labelSoft,
    subplace_label_halo: m.halo,
    city_label: m.label,
    city_label_halo: m.halo,
    state_label: m.labelSoft,
    state_label_halo: m.halo,
    country_label: m.labelSoft,
    address_label: m.labelSoft,
    address_label_halo: m.halo,
    landcover: {
      grassland: m.meadow,
      barren: m.sand,
      urban_area: m.urban,
      farmland: m.farmland,
      glacier: m.land,
      scrub: m.meadow,
      forest: m.wood,
    },
  };
}

/** Zoom ramps the flavor cannot express: the sea deepens as you pull back, buildings ease in. */
const PAINT = {
  water: {
    "fill-color": [
      "interpolate",
      ["linear"],
      ["zoom"],
      6,
      mapColors.waterDeep,
      12,
      mapColors.water,
    ],
  },
  water_stream: { "line-color": mapColors.waterDeep },
  water_river: { "line-color": mapColors.waterDeep },
  buildings: {
    "fill-color": mapColors.building,
    "fill-outline-color": mapColors.buildingEdge,
    "fill-opacity": ["interpolate", ["linear"], ["zoom"], 13, 0, 15, 0.9],
  },
  // Town names a little heavier on their halo, so they read over parks and gold roads alike.
  places_locality: { "text-halo-width": 1.6 },
  places_subplace: { "text-halo-width": 1.4 },
  water_label_lakes: { "text-halo-color": mapColors.water },
  water_label_ocean: { "text-halo-color": mapColors.water },
  water_waterway_label: { "text-color": mapColors.waterLabel, "text-halo-color": mapColors.halo },
};

/** A MapLibre style for one locale. The client sets the real tiles URL (see map-style.ts). */
export function darbStyle(locale) {
  const kept = layers(PROTOMAPS_SOURCE, darbFlavor(), { lang: locale })
    .filter((layer) => !DROPPED_LAYERS.includes(layer.id))
    .map((layer) =>
      PAINT[layer.id] ? { ...layer, paint: { ...layer.paint, ...PAINT[layer.id] } } : layer,
    )
    .map((layer) => {
      if (!layer.layout) return layer;
      const layout = Object.fromEntries(
        Object.entries(layer.layout).filter(([key]) => !key.startsWith("icon-")),
      );
      // One line, the page language only: page language, then name:en, then the local name.
      if (layout["text-field"] !== undefined)
        layout["text-field"] = [
          "coalesce",
          ["get", `name:${locale}`],
          ["get", "name:en"],
          ["get", "name"],
        ];
      return { ...layer, layout };
    });
  // Every font stack (Medium, Italic, Devanagari…) becomes the one we host.
  const json = JSON.stringify(kept).replace(/"Noto [^"]*"/g, JSON.stringify(MAP_FONT));
  return {
    version: 8,
    name: `Darb (${locale})`,
    glyphs: GLYPHS_URL,
    sources: {
      [PROTOMAPS_SOURCE]: {
        type: "vector",
        url: "pmtiles:///api/tiles/israel.pmtiles",
        attribution: ATTRIBUTION,
      },
    },
    layers: JSON.parse(json),
  };
}
