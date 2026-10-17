/**
 * The visitor's position, live, for distances on business rows. It never asks: it only watches
 * once the browser already granted Darb the location (an earlier "near me"), and it stops when no
 * row is on screen or the tab is hidden. The point stays in the browser; nothing is sent anywhere.
 */

export interface Position {
  lat: number;
  lng: number;
}

type Listener = () => void;

const listeners = new Set<Listener>();
let current: Position | null = null;
let watch: number | null = null;
let granted = false;
let asked = false;

function emit() {
  for (const l of listeners) l();
}

function start() {
  if (watch !== null || !granted || document.hidden || listeners.size === 0) return;
  if (typeof navigator.geolocation?.watchPosition !== "function") return;
  watch = navigator.geolocation.watchPosition(
    ({ coords }) => {
      current = { lat: coords.latitude, lng: coords.longitude };
      emit();
    },
    // A moment without a fix keeps watching; only a refusal ends it.
    (error) => {
      if (error.code !== error.PERMISSION_DENIED) return;
      granted = false;
      stop();
    },
    { enableHighAccuracy: false, maximumAge: 30_000 },
  );
}

function stop() {
  if (watch !== null) navigator.geolocation?.clearWatch?.(watch);
  watch = null;
}

function onVisibility() {
  if (document.hidden) stop();
  else start();
}

/** Ask the browser once whether location is already granted; never prompts. */
function check() {
  if (asked || typeof navigator === "undefined" || !("geolocation" in navigator)) return;
  asked = true;
  void navigator.permissions
    ?.query({ name: "geolocation" as PermissionName })
    .then((status) => {
      const sync = () => {
        granted = status.state === "granted";
        if (granted) start();
        else stop();
      };
      sync();
      status.addEventListener("change", sync);
    })
    .catch(() => {});
}

/** A "near me" that just succeeded: location is granted, so rows may start showing distances. */
export function positionGranted(at: Position) {
  granted = true;
  current = at;
  emit();
  start();
}

export function subscribe(listener: Listener): () => void {
  listeners.add(listener);
  if (listeners.size === 1) document.addEventListener("visibilitychange", onVisibility);
  check();
  start();
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    }
  };
}

export const snapshot = (): Position | null => current;
export const serverSnapshot = (): Position | null => null;

/** Straight-line kilometres between two points (haversine). */
export function kmBetween(a: Position, b: Position): number {
  const rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad;
  const dLng = (b.lng - a.lng) * rad;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.sqrt(h));
}
