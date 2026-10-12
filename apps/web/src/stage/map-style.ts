import type { StyleSpecification } from "maplibre-gl";

export const PROTOMAPS_SOURCE = "protomaps";

/**
 * The fetched Darb style, ready for MapLibre: glyphs as an absolute same-origin URL (the worker
 * resolves URLs against its own location) and the vector source on the configured PMTiles archive.
 */
export function prepareStyle(
  style: StyleSpecification,
  at: { origin: string; tilesUrl: string },
): StyleSpecification {
  const source = style.sources[PROTOMAPS_SOURCE];
  if (!source || source.type !== "vector")
    throw new Error("The Darb style has no protomaps vector source");
  const tiles = new URL(at.tilesUrl, at.origin).href;
  return {
    ...style,
    glyphs: style.glyphs?.startsWith("/") ? `${at.origin}${style.glyphs}` : style.glyphs,
    sources: { ...style.sources, [PROTOMAPS_SOURCE]: { ...source, url: `pmtiles://${tiles}` } },
    layers: [...style.layers],
  };
}
