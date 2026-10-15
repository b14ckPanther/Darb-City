/**
 * The web cache tags (apps/web/src/lib/api.ts `tags`) an entity's change touches. "businesses"
 * covers every list, count and detail, including a business opened under a parent place.
 */
export const webTags = {
  place: (slug: string) => ["places", `place:${slug}`],
  sector: () => ["taxonomy"],
  kind: () => ["taxonomy", "businesses"],
  business: (placeSlug: string, slug: string) => [
    "businesses",
    `business:${placeSlug}/${slug}`,
    `place:${placeSlug}`,
  ],
  plan: () => ["pricing"],
  /** Every site text is on the pricing page today. */
  text: () => ["pricing"],
};
