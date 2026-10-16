import { Protocol } from "pmtiles";
import type { MapLibre } from "./load-maplibre";

let protocol: Protocol | null = null;

/** pmtiles:// for every map on the page, registered once: the city stage and the location picker. */
export function ensurePmtiles(maplibre: MapLibre): void {
  if (protocol) return;
  protocol = new Protocol();
  maplibre.addProtocol("pmtiles", protocol.tile);
}
