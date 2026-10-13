import type { Hours } from "@darb/core";
import type { BusinessSummaryDto } from "@darb/contracts";
import { openNow } from "../businesses/business.mapper.js";
import type { Ranked } from "./ranking.js";

export function candidateSummary(c: Ranked, now: Date): BusinessSummaryDto {
  const { row } = c;
  const photos = (row.photos ?? []) as { key: string }[];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name,
    tagline: row.tagline,
    tier: row.tier,
    primaryKindId: row.primaryKindId,
    placeId: row.placeId,
    placeSlug: row.placeSlug,
    lat: row.lat,
    lng: row.lng,
    photo: photos[0]?.key ?? null,
    openNow: openNow(row.hours as Hours, now),
    hours: row.hours as BusinessSummaryDto["hours"],
    ...(c.km === null ? {} : { distanceKm: c.km }),
  };
}
