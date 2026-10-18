import type { Hours } from "@darb/core";
import type { StagePin } from "@darb/stage";
import type { BusinessRowData } from "./rows";

/** What a phone's bottom card says about a pin: no second request when a pin is tapped. */
export interface PinCard {
  /** The business's short line ("Licensed garage"). */
  tagline: string;
  openNow: boolean | null;
  hours: Hours | null;
  byAppointment: boolean;
  /** Set when the business is in another place than the one listed (a neighbourhood). */
  placeName: string | null;
  accent: string;
}

/** A pin on the web map: the stage's pin plus its card. */
export type MapPin = StagePin & { card?: PinCard };

/** A previewed category puts at most this many businesses on the map. */
export const PREVIEW_CAP = 200;

/** A pin per row, with the row's own href: the map and the list always open the same sheet. */
export const pinFromRow = (r: BusinessRowData): MapPin => ({
  key: r.key,
  href: r.href,
  name: r.name,
  lat: r.lat,
  lng: r.lng,
  card: {
    tagline: r.tagline,
    openNow: r.openNow,
    hours: r.hours,
    byAppointment: r.byAppointment,
    placeName: r.placeName,
    accent: r.accent,
  },
});

export const pinsFromRows = (rows: readonly BusinessRowData[]): MapPin[] => rows.map(pinFromRow);

/** The card of a pin that crossed a serialization boundary, if it has one. */
export const cardOf = (pin: StagePin): PinCard | null => (pin as MapPin).card ?? null;
