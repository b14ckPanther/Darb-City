/** Israel, generously: v1 has no other country (spec §13). Every saved point lies inside. */
export const ISRAEL_BOX = { lat: [29, 33.6], lng: [34, 36] } as const;

export interface LatLng {
  lat: number;
  lng: number;
}

export function inIsrael(p: LatLng): boolean {
  return (
    Number.isFinite(p.lat) &&
    Number.isFinite(p.lng) &&
    p.lat >= ISRAEL_BOX.lat[0] &&
    p.lat <= ISRAEL_BOX.lat[1] &&
    p.lng >= ISRAEL_BOX.lng[0] &&
    p.lng <= ISRAEL_BOX.lng[1]
  );
}
