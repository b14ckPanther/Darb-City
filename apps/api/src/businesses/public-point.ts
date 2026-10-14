import { Prisma } from "../generated/prisma/client.js";

/**
 * "Keep street private" (a home business): its stored pin is the home itself, so no public read
 * ever publishes it. API responses, distances and search use the place's centre instead; only the
 * admin sees the real pin.
 */
export const isAddressHidden = (attributes: unknown): boolean =>
  typeof attributes === "object" &&
  attributes !== null &&
  (attributes as Record<string, unknown>)["addressHidden"] === true;

type Point = { lat: number; lng: number };

export function publicPoint(business: Point & { attributes: unknown }, place: Point): Point {
  return isAddressHidden(business.attributes)
    ? { lat: place.lat, lng: place.lng }
    : { lat: business.lat, lng: business.lng };
}

/** SQL twin of isAddressHidden for a business aliased `b`. */
export const ADDRESS_HIDDEN_SQL = Prisma.sql`b.attributes @> '{"addressHidden": true}'::jsonb`;
