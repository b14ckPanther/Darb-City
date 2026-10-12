// The Darb map style, built from Protomaps basemaps (BSD-3-Clause) at build time, one per locale:
// night and forest land, gold roads, ivory labels. No icons (so no sprite), no points of interest
// (OSM POIs include bars and pubs: halal rule), no borders. Glyphs are self-hosted Noto Sans,
// served from a hyphenated folder whose name is also the fontstack (ruling 4: no spaces in URLs).
import { colors } from "@darb/tokens";
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
/** Secondary text on dark surfaces (globals.css --text-muted). */
const SAGE = "#a9b8ad";

export function darbFlavor() {
  const c = colors;
  const casing = c.night;
  return {
    ...namedFlavor("dark"),
    background: c.night,
    earth: c.forest950,
    water: c.night,
    glacier: c.forest950,
    sand: c.forest950,
    beach: c.forest900,
    park_a: c.forest900,
    park_b: c.forest900,
    wood_a: c.forest900,
    wood_b: c.forest900,
    scrub_a: c.forest950,
    scrub_b: c.forest950,
    hospital: c.forest900,
    industrial: c.forest950,
    school: c.forest900,
    pedestrian: c.forest900,
    aerodrome: c.forest950,
    zoo: c.forest900,
    military: c.forest950,
    runway: c.forest800,
    pier: c.forest800,
    buildings: c.forest900,
    highway: c.gold600,
    highway_casing_early: casing,
    highway_casing_late: casing,
    major: c.gold900,
    major_casing_early: casing,
    major_casing_late: casing,
    link: c.gold900,
    link_casing: casing,
    minor_a: c.forest800,
    minor_b: c.forest800,
    minor_casing: casing,
    minor_service: c.forest800,
    minor_service_casing: casing,
    other: c.forest800,
    railway: c.forest600,
    tunnel_highway: c.gold900,
    tunnel_major: c.forest800,
    tunnel_link: c.forest800,
    tunnel_minor: c.forest800,
    tunnel_other: c.forest800,
    tunnel_highway_casing: casing,
    tunnel_major_casing: casing,
    tunnel_link_casing: casing,
    tunnel_minor_casing: casing,
    tunnel_other_casing: casing,
    bridges_highway: c.gold600,
    bridges_major: c.gold900,
    bridges_link: c.gold900,
    bridges_minor: c.forest800,
    bridges_other: c.forest800,
    bridges_highway_casing: casing,
    bridges_major_casing: casing,
    bridges_link_casing: casing,
    bridges_minor_casing: casing,
    bridges_other_casing: casing,
    boundaries: c.forest600,
    roads_label_minor: SAGE,
    roads_label_minor_halo: c.night,
    roads_label_major: c.ivory200,
    roads_label_major_halo: c.night,
    ocean_label: SAGE,
    subplace_label: c.ivory200,
    subplace_label_halo: c.night,
    city_label: c.ivory,
    city_label_halo: c.night,
    state_label: SAGE,
    state_label_halo: c.night,
    country_label: SAGE,
    address_label: SAGE,
    address_label_halo: c.night,
    landcover: {
      grassland: c.forest900,
      barren: c.forest950,
      urban_area: c.forest900,
      farmland: c.forest900,
      glacier: c.forest950,
      scrub: c.forest950,
      forest: c.forest900,
    },
  };
}

/** A MapLibre style for one locale. The client sets the real tiles URL (see map-style.ts). */
export function darbStyle(locale) {
  const kept = layers(PROTOMAPS_SOURCE, darbFlavor(), { lang: locale })
    .filter((layer) => !DROPPED_LAYERS.includes(layer.id))
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
