import { isOpenAt, type Hours, type Localized } from "@darb/core";
import type { BusinessDetailDto, BusinessSummaryDto } from "@darb/contracts";
import type { Business } from "../generated/prisma/client.js";

type Photo = { key: string; alt: Localized };

export function openNow(hours: Hours, now: Date): boolean | null {
  const hasAny =
    Object.values(hours.weekly).some((i) => i && i.length > 0) || hours.exceptions.length > 0;
  return hasAny ? isOpenAt(hours, now) : null;
}

export function toBusinessSummary(row: Business, placeSlug: string, now: Date): BusinessSummaryDto {
  const photos = row.photos as Photo[];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name as Localized,
    tagline: row.tagline as Localized,
    tier: row.tier,
    primaryKindId: row.primaryKindId,
    placeId: row.placeId,
    placeSlug,
    lat: row.lat,
    lng: row.lng,
    photo: photos[0]?.key ?? null,
    openNow: openNow(row.hours as unknown as Hours, now),
    hours: row.hours as unknown as BusinessSummaryDto["hours"],
  };
}

export function toBusinessDetail(
  row: Business & { kinds: { kindId: string }[] },
  placeSlug: string,
  now: Date,
): BusinessDetailDto {
  return {
    ...toBusinessSummary(row, placeSlug, now),
    kindIds: row.kinds.map((k) => k.kindId),
    address: row.address as Localized,
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    photos: row.photos as Photo[],
    hours: row.hours as unknown as BusinessDetailDto["hours"],
    attributes: row.attributes as BusinessDetailDto["attributes"],
    experience: row.experience as BusinessDetailDto["experience"],
    apps: row.apps as BusinessDetailDto["apps"],
    brandId: row.brandId,
  };
}
