import { ISRAEL_BOX } from "@darb/core";
import { z } from "zod";
import { SlugSchema } from "./schemas.js";
import { LocaleSchema } from "./search.js";

/**
 * Find the place: an address ("שדרות המגינים 68, חיפה"), a Google Maps or Waze link, or a
 * "lat, lng" pair, turned into a point for the admin's pin. Every answer is honest about how
 * precise it is; the admin drags the pin for the last few metres.
 */

/**
 * exact: OpenStreetMap knows that house number. between: placed between two known numbers on
 * the same side of the street. street: only the street is known. link: read from a map link or
 * typed coordinates.
 */
export const LOCATE_PRECISIONS = ["exact", "between", "street", "link"] as const;
export type LocatePrecision = (typeof LOCATE_PRECISIONS)[number];

/** Why nothing was found: not-found, off (no geocoder on this deployment), busy (rate limit). */
export const LOCATE_MISSES = ["not-found", "off", "busy"] as const;

export const LocateQuerySchema = z
  .object({
    query: z.string().trim().min(1).max(500),
    /** The town to search in when the query names none (the business's town). */
    town: z.string().trim().max(80).optional(),
    /** The business's place: its name is the town, its point keeps answers near it. */
    placeSlug: SlugSchema.optional(),
    locale: LocaleSchema,
  })
  .strict();
export type LocateQueryDto = z.infer<typeof LocateQuerySchema>;

const LocatePointSchema = z.object({
  lat: z.number().min(ISRAEL_BOX.lat[0]).max(ISRAEL_BOX.lat[1]),
  lng: z.number().min(ISRAEL_BOX.lng[0]).max(ISRAEL_BOX.lng[1]),
});

export const LocateHitSchema = z.object({
  point: LocatePointSchema,
  precision: z.enum(LOCATE_PRECISIONS),
  /** "שדרות המגינים, חיפה", in the asked language when OpenStreetMap has it. */
  label: z.string().max(300),
  /** For "between": the two known house numbers the point sits between. */
  between: z.tuple([z.string().max(20), z.string().max(20)]).optional(),
  /** For a street part: the known house number nearest to it, to tell the parts apart. */
  near: z.string().max(20).optional(),
});
export type LocateHitDto = z.infer<typeof LocateHitSchema>;

export const LocateResultSchema = z.object({
  found: LocateHitSchema.nullable(),
  /** Other parts of the same street (or the same street in other towns), when there are several. */
  alternatives: z.array(LocateHitSchema).max(5),
  reason: z.enum(LOCATE_MISSES).optional(),
  /** The street and number as read from the query ("שדרות המגינים 68"), to fill the address. */
  address: z.string().max(200).nullable(),
  /** A Google Maps place link from the query, resolved when it was a short one. */
  googleLink: z.string().url().max(2000).nullable(),
});
export type LocateResultDto = z.infer<typeof LocateResultSchema>;
