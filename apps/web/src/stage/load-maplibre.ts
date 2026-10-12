import { MAPLIBRE_CSS_URL, MAPLIBRE_URL } from "./vendor";

export type MapLibre = typeof import("maplibre-gl");

let loading: Promise<MapLibre> | null = null;

/**
 * MapLibre's ES modules from /map/vendor (copied by scripts/copy-map.mjs), imported at runtime so
 * the bundler never pulls them into a chunk. Its module worker finds itself from import.meta.url.
 */
export function loadMapLibre(): Promise<MapLibre> {
  loading ??= (async () => {
    if (!document.querySelector("link[data-maplibre-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = MAPLIBRE_CSS_URL;
      link.setAttribute("data-maplibre-css", "");
      document.head.append(link);
    }
    return (await import(
      /* webpackIgnore: true */ /* turbopackIgnore: true */ MAPLIBRE_URL
    )) as MapLibre;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
