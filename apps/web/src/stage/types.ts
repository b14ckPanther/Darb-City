import type { Locale } from "@darb/core";
import type { Camera, CityDot, StagePin } from "@darb/stage";

/** What the Director needs from the map. CityMap implements it; tests fake it. */
export interface StageMap {
  /**
   * Resolves when the camera arrives (at once for a jump). `insetEnd`: px of the map hidden at the
   * inline end (the desktop sheet), so the subject stays in view beside it.
   */
  move(camera: Camera, duration: number, insetEnd: number): Promise<void>;
  setDots(dots: readonly CityDot[]): void;
  setPins(pins: readonly StagePin[], activeHref: string | null): void;
  /** Viewport px of a live place (slug) or a business (key): for e2e. */
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
}

export interface StageProps {
  locale: Locale;
  labels: StageLabels;
  /** The stage could not start (no WebGL2 context, tiles or style failed): the list is the city. */
  onFail: () => void;
}
