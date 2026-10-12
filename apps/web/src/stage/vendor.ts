import type { Locale } from "@darb/core";

/** Equal to the installed maplibre-gl (vendor.test.ts checks it); copy-map.mjs serves it here. */
export const MAPLIBRE_VERSION = "6.11.2";
export const VENDOR_DIR = `/map/vendor/maplibre-gl@${MAPLIBRE_VERSION}`;
export const MAPLIBRE_URL = `${VENDOR_DIR}/maplibre-gl.mjs`;
export const MAPLIBRE_CSS_URL = `${VENDOR_DIR}/maplibre-gl.css`;

/**
 * The Israel PMTiles archive: the local route in development and self-hosting, an R2 URL in
 * production (Plan 4). Inlined at build time.
 */
export const TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL || "/api/tiles/israel.pmtiles";

/** One Darb style per locale (labels in that language), written by copy-map.mjs. */
export const styleUrl = (locale: Locale): string => `/map/style/${locale}.json`;
