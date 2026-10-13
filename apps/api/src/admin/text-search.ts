/**
 * Admin text search: the slug, or the name in any language. Name matching ignores case, so
 * "caramel" finds "Caramel Cafe"; Hebrew and Arabic have no case and match as typed.
 */
export const nameOrSlugFilters = (q: string) => [
  { slug: { contains: q.toLowerCase() } },
  ...(["he", "ar", "en"] as const).map((l) => ({
    name: { path: [l], string_contains: q, mode: "insensitive" as const },
  })),
];
