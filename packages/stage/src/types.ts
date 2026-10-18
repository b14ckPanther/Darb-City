/**
 * The Zoomable City as plain data. Nothing here touches the DOM, so the Expo app can draw the same
 * levels and plaza with Skia. The web renderer lives in apps/web/src/stage.
 */
export type LngLat = [lng: number, lat: number];

export interface StagePlace {
  slug: string;
  /** Already in the page language. */
  name: string;
  lat: number;
  lng: number;
}

/** A door: a sector at level 1, a kind at level 2. `href` equals the list door's href. */
export interface StageDoor {
  slug: string;
  href: string;
  label: string;
  count: number;
  /** The sector accent, a warm desaturated hex. */
  accent: string;
}

export interface StageSector {
  slug: string;
  name: string;
  accent: string;
}

/** A business at level 3. `href` equals its list row's href (listed place first). */
export interface StagePin {
  key: string;
  href: string;
  name: string;
  lat: number;
  lng: number;
}

/** A live place and its business count: the country map's faint warmth (never a number). */
export interface CityDot {
  slug: string;
  lat: number;
  lng: number;
  count: number;
}

/**
 * Depth follows the URL levels: 0 the country, 1 a place (its sectors), 2 a sector (its kinds),
 * 3 a kind in a place (its businesses; the business sheet opens over it). A soon place is depth 3
 * with no pins: the map at that place.
 */
export type StageLevel =
  | { depth: 0 }
  | { depth: 1; place: StagePlace; doors: StageDoor[] }
  | { depth: 2; place: StagePlace; sector: StageSector; doors: StageDoor[] }
  | {
      depth: 3;
      place: StagePlace;
      pins: StagePin[];
      /** What the pins are, for the phone map's header ("Garages in Haifa"). */
      title?: string;
      /** How many businesses the list holds in all (more than its pins while it pages). */
      count?: number;
    };

export type PlazaLevel = Extract<StageLevel, { depth: 1 | 2 }>;

export type StageView = "map" | "plaza";

export type Camera =
  { center: LngLat; zoom: number } | { bounds: [LngLat, LngLat]; maxZoom: number };

export interface Fade {
  /**
   * cross: two layers swap; through: one layer (the plaza, or the map under reduced motion) fades
   * or zooms out, changes scene, and comes back in.
   */
  kind: "cross" | "through";
  duration: number;
  outScale: number;
  inScale: number;
}

export interface Transition {
  view: StageView;
  camera: Camera;
  motion: "fly" | "jump";
  /** Camera move duration in ms (0 for a jump). */
  duration: number;
  fade: Fade | null;
  direction: "in" | "out" | "none";
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isPlace = (v: unknown) =>
  isObject(v) &&
  typeof v.slug === "string" &&
  typeof v.lat === "number" &&
  typeof v.lng === "number";

/** A shallow shape check for levels that crossed a serialization boundary. */
export function isStageLevel(value: unknown): value is StageLevel {
  if (!isObject(value)) return false;
  switch (value.depth) {
    case 0:
      return true;
    case 1:
      return isPlace(value.place) && Array.isArray(value.doors);
    case 2:
      return isPlace(value.place) && isObject(value.sector) && Array.isArray(value.doors);
    case 3:
      return isPlace(value.place) && Array.isArray(value.pins);
    default:
      return false;
  }
}
