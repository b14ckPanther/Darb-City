import type { LayerSpecification, SourceSpecification } from "maplibre-gl";
import { heatCollection, hereCollection, pinCollection } from "@darb/stage";
import { colors, mapColors } from "@darb/tokens";

/** The country's faint warmth where businesses are (level 0). */
export const HEAT_SOURCE = "darb-heat";
/** The place a level is about. */
export const HERE_SOURCE = "darb-here";
/** Businesses: a kind's list, a search, or a previewed category. Clustered. */
export const PIN_SOURCE = "darb-pins";
/** The one lifted pin (hovered row, chosen pin, open business), drawn above every cluster. */
export const HOT_SOURCE = "darb-hot";

export const HEAT = "darb-heat";
export const HERE_HALO = "darb-here-halo";
export const HERE_DOT = "darb-here-dot";
export const HERE_LABEL = "darb-here-label";
export const PIN_SHADOW = "darb-pin-shadow";
export const CLUSTER_PIN = "darb-cluster";
export const CLUSTER_TEXT = "darb-cluster-text";
export const PIN_LAYER = "darb-pin";
export const PIN_NUMBER = "darb-pin-number";
export const HOT_RING = "darb-hot-ring";
export const HOT_PIN = "darb-hot-pin";
export const HOT_NUMBER = "darb-hot-number";
export const HOT_NAME = "darb-hot-name";
/** The one self-hosted glyph font (scripts/map/style.mjs MAP_FONT). */
export const MAP_FONT = "noto-sans-regular";

/** Pins closer than this merge into one small "+N" pin (MapLibre clusterRadius, px). */
export const CLUSTER_RADIUS = 36;
/** Past this zoom pins never merge: they are at their own doors. */
export const CLUSTER_MAX_ZOOM = 16;

/** Darb's own sources, empty until a level fills them. */
export function darbSources(): Record<string, SourceSpecification> {
  return {
    [HEAT_SOURCE]: { type: "geojson", data: heatCollection([]) },
    [HERE_SOURCE]: { type: "geojson", data: hereCollection(null) },
    // Pins that would overlap merge into one small "+N" pin until the camera is close enough.
    [PIN_SOURCE]: {
      type: "geojson",
      data: pinCollection([]),
      cluster: true,
      clusterRadius: CLUSTER_RADIUS,
      clusterMaxZoom: CLUSTER_MAX_ZOOM,
    },
    [HOT_SOURCE]: { type: "geojson", data: pinCollection([]) },
  };
}

const CLUSTER = ["has", "point_count"];
const SINGLE = ["!", CLUSTER];
const NUMBERED = [">", ["get", "n"], 0];
/** A numbered pin is big enough to hold its number; a preview's pins are small gold seeds. */
const PIN_RADIUS = ["case", NUMBERED, 11, 6.5];
const SHADOW = "#0b2219";

/**
 * Darb's own layers over the basemap. Nothing here is ever a number to count: the country gets a
 * faint warmth, a place gets a halo and its name, and businesses appear only when someone asks
 * for them (a kind's list, a search, a previewed category), numbered like their list rows. Pins
 * that overlap merge into one small "+N" pin. The lifted pin sits on top of everything.
 */
export function darbLayers(): LayerSpecification[] {
  return [
    {
      id: HEAT,
      type: "heatmap",
      source: HEAT_SOURCE,
      maxzoom: 11,
      paint: {
        "heatmap-weight": ["get", "weight"],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 6, 0.5, 10, 0.9],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 14, 10, 38],
        // Sand to warm gold; never a hard edge, never a number.
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          "rgba(217,165,76,0)",
          0.3,
          "rgba(217,165,76,0.18)",
          0.7,
          "rgba(217,165,76,0.38)",
          1,
          "rgba(185,133,47,0.5)",
        ],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 6, 0.75, 9.5, 0.55, 11, 0],
      },
    },
    {
      id: HERE_HALO,
      type: "circle",
      source: HERE_SOURCE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 9, 28, 14, 84],
        "circle-color": colors.gold,
        "circle-opacity": 0.3,
        "circle-blur": 0.85,
      },
    },
    {
      id: HERE_DOT,
      type: "circle",
      source: HERE_SOURCE,
      paint: {
        "circle-radius": 6,
        "circle-color": colors.gold,
        "circle-stroke-color": mapColors.halo,
        "circle-stroke-width": 3,
      },
    },
    {
      id: HERE_LABEL,
      type: "symbol",
      source: HERE_SOURCE,
      layout: {
        "text-field": ["get", "name"],
        "text-font": [MAP_FONT],
        "text-size": 15,
        "text-anchor": "top",
        "text-offset": [0, 0.9],
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": mapColors.label,
        "text-halo-color": mapColors.halo,
        "text-halo-width": 2,
      },
    },
    {
      // A soft shadow under every pin and merged pin: they sit on the map, not in it.
      id: PIN_SHADOW,
      type: "circle",
      source: PIN_SOURCE,
      paint: {
        "circle-radius": ["case", CLUSTER, 15, ["+", PIN_RADIUS, 2]] as never,
        "circle-color": SHADOW,
        "circle-opacity": 0.2,
        "circle-blur": 0.8,
        "circle-translate": [0, 2],
      },
    },
    {
      id: CLUSTER_PIN,
      type: "circle",
      source: PIN_SOURCE,
      filter: CLUSTER as never,
      paint: {
        "circle-radius": 13,
        "circle-color": mapColors.halo,
        "circle-stroke-color": colors.gold,
        "circle-stroke-width": 2,
      },
    },
    {
      id: CLUSTER_TEXT,
      type: "symbol",
      source: PIN_SOURCE,
      filter: CLUSTER as never,
      layout: {
        // Never a big count: "+N", small, in the pin.
        "text-field": ["concat", "+", ["get", "point_count_abbreviated"]],
        "text-font": [MAP_FONT],
        "text-size": 11,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": mapColors.label },
    },
    {
      id: PIN_LAYER,
      type: "circle",
      source: PIN_SOURCE,
      filter: SINGLE as never,
      paint: {
        "circle-radius": PIN_RADIUS as never,
        "circle-color": colors.gold,
        "circle-stroke-color": mapColors.halo,
        "circle-stroke-width": 2,
      },
    },
    {
      id: PIN_NUMBER,
      type: "symbol",
      source: PIN_SOURCE,
      filter: ["all", SINGLE, NUMBERED] as never,
      layout: {
        "text-field": ["to-string", ["get", "n"]],
        "text-font": [MAP_FONT],
        "text-size": 12,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": mapColors.bubble },
    },
    {
      id: HOT_RING,
      type: "circle",
      source: HOT_SOURCE,
      paint: {
        "circle-radius": ["case", NUMBERED, 23, 17] as never,
        "circle-color": colors.gold,
        "circle-opacity": 0.26,
      },
    },
    {
      id: HOT_PIN,
      type: "circle",
      source: HOT_SOURCE,
      paint: {
        "circle-radius": ["case", NUMBERED, 14, 9] as never,
        "circle-color": mapColors.bubble,
        "circle-stroke-color": colors.gold,
        "circle-stroke-width": 2.5,
      },
    },
    {
      id: HOT_NUMBER,
      type: "symbol",
      source: HOT_SOURCE,
      filter: NUMBERED as never,
      layout: {
        "text-field": ["to-string", ["get", "n"]],
        "text-font": [MAP_FONT],
        "text-size": 13,
        "text-allow-overlap": true,
        "text-ignore-placement": true,
      },
      paint: { "text-color": colors.gold100 },
    },
    {
      id: HOT_NAME,
      type: "symbol",
      source: HOT_SOURCE,
      layout: {
        "text-field": ["get", "name"],
        "text-font": [MAP_FONT],
        "text-size": 13,
        "text-anchor": "top",
        "text-offset": [0, 1.7],
        "text-max-width": 12,
        "text-allow-overlap": true,
      },
      paint: {
        "text-color": mapColors.label,
        "text-halo-color": mapColors.halo,
        "text-halo-width": 2,
      },
    },
  ];
}
