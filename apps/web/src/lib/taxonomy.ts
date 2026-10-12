import type { KindDto, SectorDto, TaxonomyDto } from "@darb/contracts";

export interface TaxonomyIndex {
  /** Ordered. */
  sectors: TaxonomyDto["sectors"];
  sectorBySlug: Map<string, SectorDto>;
  sectorById: Map<string, SectorDto>;
  kindBySlug: Map<string, KindDto>;
  kindById: Map<string, KindDto>;
  /** Each sector's top-level kinds (no parent), ordered: one door each. */
  doorsBySector: Map<string, KindDto[]>;
}

export function indexTaxonomy(taxonomy: TaxonomyDto): TaxonomyIndex {
  const sectors = [...taxonomy.sectors].sort((a, b) => a.order - b.order);
  const kinds = sectors.flatMap((s) => s.kinds);
  return {
    sectors,
    sectorBySlug: new Map(sectors.map((s) => [s.slug, s])),
    sectorById: new Map(sectors.map((s) => [s.id, s])),
    kindBySlug: new Map(kinds.map((k) => [k.slug, k])),
    kindById: new Map(kinds.map((k) => [k.id, k])),
    doorsBySector: new Map(
      sectors.map((s) => [
        s.id,
        s.kinds.filter((k) => k.parentKindId === null).sort((a, b) => a.order - b.order),
      ]),
    ),
  };
}

/** True when `kindId` is `ancestorId` or one of its sub-kinds. */
export function kindCovers(index: TaxonomyIndex, ancestorId: string, kindId: string): boolean {
  let current = index.kindById.get(kindId);
  for (let depth = 0; current && depth < 16; depth++) {
    if (current.id === ancestorId) return true;
    current = current.parentKindId ? index.kindById.get(current.parentKindId) : undefined;
  }
  return false;
}

/** Businesses behind each sector's doors. Door counts already include sub-kinds. */
export function sectorTotals(
  index: TaxonomyIndex,
  counts: Record<string, number>,
): Map<string, number> {
  return new Map(
    index.sectors.map((s) => [
      s.slug,
      (index.doorsBySector.get(s.id) ?? []).reduce((sum, k) => sum + (counts[k.slug] ?? 0), 0),
    ]),
  );
}
