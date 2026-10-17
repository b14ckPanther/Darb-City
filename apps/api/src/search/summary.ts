import type { Hours } from "@darb/core";
import type { BusinessSummaryDto, SearchItemDto } from "@darb/contracts";
import { openNow } from "../businesses/business.mapper.js";
import { RANKING } from "./ranking.config.js";
import type { Ranked } from "./ranking.js";

/**
 * The thing on the card that answered the search, when it answered well. A kind's own name is
 * never shown as one: the row already says what the business is.
 */
function matchedOf(c: Ranked): SearchItemDto["matched"] {
  const m = c.matched;
  if (!m || m.source === "kind" || m.score < RANKING.offerings.showMatch) return undefined;
  return m.context ? { label: m.label, context: m.context } : { label: m.label };
}

export function candidateSummary(c: Ranked, now: Date): SearchItemDto {
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
    dietary: row.dietary ?? [],
    logo: (row.logo as BusinessSummaryDto["logo"]) ?? null,
    cardStyle: (row.cardStyle ?? {}) as BusinessSummaryDto["cardStyle"],
    ...(c.km === null ? {} : { distanceKm: c.km }),
    ...(matchedOf(c) ? { matched: matchedOf(c) } : {}),
  } satisfies BusinessSummaryDto;
}
