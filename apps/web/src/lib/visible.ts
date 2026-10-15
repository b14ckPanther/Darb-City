import type { PlaceDto } from "@darb/contracts";
import { sectorTotals, type TaxonomyIndex } from "./taxonomy";

/**
 * Browse pages list only what has something in it. Direct links to an empty place, sector or kind
 * still work, and search still finds all of them.
 */

/** Places with at least one published business beneath them (`counts` is the API's place counts). */
export function withBusinesses<T extends Pick<PlaceDto, "slug">>(
  places: readonly T[],
  counts: Record<string, number>,
): T[] {
  return places.filter((p) => (counts[p.slug] ?? 0) > 0);
}

/**
 * The taxonomy without its empty sectors and kinds. `counts` are kind counts for one place or the
 * whole country; door counts already include sub-kinds.
 */
export function withBusinessesTaxonomy(
  index: TaxonomyIndex,
  counts: Record<string, number>,
): TaxonomyIndex {
  const totals = sectorTotals(index, counts);
  const sectors = index.sectors.filter((s) => (totals.get(s.slug) ?? 0) > 0);
  return {
    ...index,
    sectors,
    doorsBySector: new Map(
      sectors.map((s) => [
        s.id,
        (index.doorsBySector.get(s.id) ?? []).filter((k) => (counts[k.slug] ?? 0) > 0),
      ]),
    ),
  };
}
