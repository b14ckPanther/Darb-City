import type { LayerSpecification } from "maplibre-gl";
import { colors } from "@darb/tokens";

export const CITY_SOURCE = "darb-city";
export const PIN_SOURCE = "darb-pins";
export const CITY_GLOW = "darb-city-glow";
export const CITY_DOT = "darb-city-dot";
export const CITY_LABEL = "darb-city-label";
export const PIN_LAYER = "darb-pin";
/** The one self-hosted glyph font (scripts/map/style.mjs MAP_FONT). */
export const MAP_FONT = "noto-sans-regular";

const GOLD = (alpha: number) => `rgba(217, 165, 76, ${alpha})`;
/** Places with businesses only: an empty town draws nothing and cannot be tapped. */
const HAS_BUSINESSES = [">", ["get", "count"], 0];

/**
 * Darb's own layers over the basemap, read like a night map rather than a scatter of identical
 * dots. Far out, one density surface shows where business is (weighted by each place's count).
 * Closer in it gives way to proportional points (area ∝ businesses), and names appear by
 * importance: the busiest places first, more as you zoom, never over each other. Pins on top.
 */
export function darbLayers(): LayerSpecification[] {
  return [
    {
      id: CITY_GLOW,
      type: "heatmap",
      source: CITY_SOURCE,
      maxzoom: 11,
      filter: HAS_BUSINESSES as never,
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 0, 0, 1, 0.25, 40, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 6, 0.35, 10, 0.9],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 6, 12, 10, 30],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0,
          GOLD(0),
          0.15,
          GOLD(0.12),
          0.4,
          GOLD(0.32),
          0.7,
          colors.gold,
          1,
          colors.gold100,
        ],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 9, 0.8, 11, 0],
      },
    },
    {
      id: CITY_DOT,
      type: "circle",
      source: CITY_SOURCE,
      minzoom: 9.2,
      filter: HAS_BUSINESSES as never,
      paint: {
        // Proportional symbols: the radius grows with the square root of the count.
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          8,
          ["+", 2, ["*", 0.5, ["sqrt", ["get", "count"]]]],
          13,
          ["+", 4, ["*", 1.6, ["sqrt", ["get", "count"]]]],
        ],
        "circle-color": colors.gold300,
        "circle-opacity": ["interpolate", ["linear"], ["zoom"], 9.2, 0, 10.2, 0.9],
        "circle-stroke-color": colors.night,
        "circle-stroke-width": 1.5,
        "circle-stroke-opacity": ["interpolate", ["linear"], ["zoom"], 9.2, 0, 10.2, 1],
      },
    },
    {
      id: CITY_LABEL,
      type: "symbol",
      source: CITY_SOURCE,
      minzoom: 7,
      // Busier places earn their name sooner: 20+ businesses from zoom 7, any business from 10.
      filter: [
        "all",
        HAS_BUSINESSES,
        [">=", ["get", "count"], ["step", ["zoom"], 20, 8.5, 6, 10, 1]],
      ] as never,
      layout: {
        "text-field": ["get", "name"],
        "text-font": [MAP_FONT],
        "text-size": ["interpolate", ["linear"], ["zoom"], 7, 11, 10, 13, 13, 14],
        // Beside its point where there is room, never over a neighbour's name.
        "text-variable-anchor": ["top", "bottom", "left", "right"],
        "text-radial-offset": 0.8,
        "text-padding": 6,
        "symbol-sort-key": ["-", 0, ["get", "count"]],
      },
      paint: {
        "text-color": colors.ivory,
        "text-halo-color": colors.night,
        "text-halo-width": 1.4,
      },
    },
    {
      id: PIN_LAYER,
      type: "circle",
      source: PIN_SOURCE,
      paint: {
        "circle-radius": ["case", ["get", "active"], 11, 8],
        "circle-color": colors.gold,
        "circle-stroke-color": colors.ivory,
        "circle-stroke-width": ["case", ["get", "active"], 3, 2],
      },
    },
  ];
}
