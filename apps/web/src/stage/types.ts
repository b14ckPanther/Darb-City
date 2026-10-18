import type { Locale } from "@darb/core";
import type { Camera, CityDot, StagePin, StagePlace } from "@darb/stage";

/** What the Director needs from the map. CityMap implements it; tests fake it. */
export interface StageMap {
  /**
   * Resolves when the camera arrives (at once for a jump). `insetEnd`: px of the map hidden at the
   * inline end (the desktop sheet), so the subject stays in view beside it; `insetBottom`: px
   * hidden at its foot (a phone's pin card).
   */
  move(camera: Camera, duration: number, insetEnd: number, insetBottom?: number): Promise<void>;
  /** The country's faint warmth where businesses are. */
  setHeat(dots: readonly CityDot[]): void;
  /** The place a level is about (a halo, a dot, its name), or none. */
  setHere(place: StagePlace | null): void;
  /** The businesses on the map: numbered like the list, or a preview's unnumbered pins. */
  setPins(pins: readonly StagePin[], numbered: boolean): void;
  /** The one lifted pin, with its list number (0 for none), or none. */
  setHot(pin: StagePin | null, n: number): void;
  /** Viewport px of a business (key) or a live place (slug): for e2e. */
  pointOf(id: string): [number, number] | null;
  destroy(): void;
}

/** Interface copy for the stage, from t() in the layout. Placeholders are filled on the client. */
export interface StageLabels {
  map: string;
  /** Holds "{place}". */
  plaza: string;
  showMap: string;
  showList: string;
  mapData: string;
  /** Holds "{count}". */
  businessCount: string;
  /** The phone map's way back to the list. */
  backToList: string;
  /** A preview capped below the category's count: "{shown} of {count}". */
  pinsOf: string;
  /** The pin card's button into the business. */
  openBusiness: string;
  close: string;
  openNow: string;
  closed: string;
  byAppointment: string;
  /** Holds "{km}". */
  distanceKm: string;
  /** Holds "{m}". */
  distanceM: string;
  /** While a category's pins are on their way. */
  loadingPins: string;
}

export interface StageProps {
  locale: Locale;
  labels: StageLabels;
  /** The stage could not start (no WebGL2 context, tiles or style failed): the list is the city. */
  onFail: () => void;
}
