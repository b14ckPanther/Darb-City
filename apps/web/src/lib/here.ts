/**
 * Where the visitor stood when they last tapped "near me", for the /near page. It lives only in
 * this tab's sessionStorage: never in a URL, a cookie or a request other than the rounded list call.
 */

export interface Here {
  lat: number;
  lng: number;
  /** Metres, as the device reported them (the map's accuracy ring). */
  accuracy?: number;
  /** When the fix was taken (ms since epoch). */
  at: number;
}

export const HERE_KEY = "darb.here";
/** A new fix: the /near page, if open, follows it. */
export const HERE_EVENT = "darb:here";
/** Older than this, the page asks again instead of listing around a stale point. */
export const HERE_FRESH_FOR = 10 * 60 * 1000;

/** The kept point, if there is one and it is still fresh. */
export function readHere(now = Date.now()): Here | null {
  try {
    const kept = JSON.parse(sessionStorage.getItem(HERE_KEY) ?? "null") as Partial<Here> | null;
    if (!kept || typeof kept.lat !== "number" || typeof kept.lng !== "number") return null;
    if (typeof kept.at !== "number" || now - kept.at > HERE_FRESH_FOR) return null;
    return {
      lat: kept.lat,
      lng: kept.lng,
      at: kept.at,
      ...(typeof kept.accuracy === "number" ? { accuracy: kept.accuracy } : {}),
    };
  } catch {
    return null;
  }
}

export function keepHere(here: Here): void {
  try {
    sessionStorage.setItem(HERE_KEY, JSON.stringify(here));
  } catch {
    // Storage off: the page asks for the location on its own button instead.
  }
  window.dispatchEvent(new CustomEvent<Here>(HERE_EVENT, { detail: here }));
}

/** A precise fix from the device, asked for only after a tap. */
export const PRECISE: PositionOptions = {
  enableHighAccuracy: true,
  maximumAge: 15_000,
  timeout: 15_000,
};

export function hereFrom(position: GeolocationPosition): Here {
  const { latitude, longitude, accuracy } = position.coords;
  return {
    lat: latitude,
    lng: longitude,
    at: Date.now(),
    ...(Number.isFinite(accuracy) ? { accuracy } : {}),
  };
}
