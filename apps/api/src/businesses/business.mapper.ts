import { isByAppointment, isOpenAt, type Hours, type Localized } from "@darb/core";
import type { BusinessDetailDto, BusinessSummaryDto } from "@darb/contracts";
import type { Business } from "../generated/prisma/client.js";
import { publicPoint } from "./public-point.js";

type Photo = { key: string; alt: Localized };
/** The business's own place: its slug, and its centre for a business that keeps its street private. */
export type PlaceRef = { slug: string; lat: number; lng: number };

/** Null when there is nothing to say: no hours at all, or visits by appointment only. */
export function openNow(hours: Hours, now: Date): boolean | null {
  if (isByAppointment(hours)) return null;
  const hasAny =
    Object.values(hours.weekly).some((i) => i && i.length > 0) || hours.exceptions.length > 0;
  return hasAny ? isOpenAt(hours, now) : null;
}

export function toBusinessSummary(row: Business, place: PlaceRef, now: Date): BusinessSummaryDto {
  const photos = row.photos as Photo[];
  const point = publicPoint(row, place);
  return {
    id: row.id,
    slug: row.slug,
    name: row.name as Localized,
    tagline: row.tagline as Localized,
    tier: row.tier,
    primaryKindId: row.primaryKindId,
    placeId: row.placeId,
    placeSlug: place.slug,
    lat: point.lat,
    lng: point.lng,
    photo: photos[0]?.key ?? null,
    openNow: openNow(row.hours as unknown as Hours, now),
    hours: row.hours as unknown as BusinessSummaryDto["hours"],
    dietary: row.dietary,
    logo: (row.logo as BusinessSummaryDto["logo"]) ?? null,
    cardStyle: (row.cardStyle ?? {}) as BusinessSummaryDto["cardStyle"],
  };
}

export function toBusinessDetail(
  row: Business & { kinds: { kindId: string }[]; brand?: { slug: string } | null },
  place: PlaceRef,
  now: Date,
): BusinessDetailDto {
  return {
    ...toBusinessSummary(row, place, now),
    kindIds: row.kinds.map((k) => k.kindId),
    address: row.address as Localized,
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    photos: row.photos as Photo[],
    logo: (row.logo as BusinessDetailDto["logo"]) ?? null,
    links: row.links as BusinessDetailDto["links"],
    cardStyle: row.cardStyle as BusinessDetailDto["cardStyle"],
    hours: row.hours as unknown as BusinessDetailDto["hours"],
    attributes: row.attributes as BusinessDetailDto["attributes"],
    experience: row.experience as BusinessDetailDto["experience"],
    apps: row.apps as BusinessDetailDto["apps"],
    brandId: row.brandId,
    brandSlug: row.brand?.slug ?? null,
  };
}
