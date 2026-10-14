import type { Locale } from "@darb/core";

/** Equal to the installed maplibre-gl (vendor.test.ts checks it); copy-map.mjs serves it here. */
export const MAPLIBRE_VERSION = "6.11.2";
export const VENDOR_DIR = `/map/vendor/maplibre-gl@${MAPLIBRE_VERSION}`;
export const MAPLIBRE_URL = `${VENDOR_DIR}/maplibre-gl.mjs`;
export const MAPLIBRE_CSS_URL = `${VENDOR_DIR}/maplibre-gl.css`;

/**
 * The Israel PMTiles archive: R2 in production (NEXT_PUBLIC_MAP_TILES_URL), the local route in
 * development, e2e and self-hosting (NEXT_PUBLIC_LOCAL_TILES=1). A production build with neither
 * gets null and never boots the stage: the list is the whole city (spec §7). Inlined at build.
 */
export function tilesUrl(
  env: { url: string | undefined; local: string | undefined; nodeEnv: string | undefined } = {
    url: process.env.NEXT_PUBLIC_MAP_TILES_URL,
    local: process.env.NEXT_PUBLIC_LOCAL_TILES,
    nodeEnv: process.env.NODE_ENV,
  },
): string | null {
  if (env.url) return env.url;
  if (env.nodeEnv !== "production" || env.local === "1") return "/api/tiles/israel.pmtiles";
  return null;
}
export const TILES_URL = tilesUrl();

/** The tiles origin for connect-src, when the tiles live on another origin (R2). */
export function tilesOrigin(url: string | null = TILES_URL): string | null {
  return url && /^https?:\/\//.test(url) ? new URL(url).origin : null;
}

/** One Darb style per locale (labels in that language), written by copy-map.mjs. */
export const styleUrl = (locale: Locale): string => `/map/style/${locale}.json`;
