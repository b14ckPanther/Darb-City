import { pickText, type Locale } from "@darb/core";
import type { KindDto, SectorDto } from "@darb/contracts";
import { INTL_TAG } from "./locale";
import type { TaxonomyIndex } from "./taxonomy";

/** A kind as a list row: its name in the page language and how many businesses it has here. */
export interface KindRowData {
  slug: string;
  name: string;
  count: number;
}

/** A sector as a group of rows, with its total. */
export interface SectorGroupData {
  sector: SectorDto;
  name: string;
  tagline: string;
  total: number;
  kinds: KindRowData[];
}

/** Most businesses first; a tie by name in the page language's own order. */
export function byCount<T extends { count: number; name: string }>(locale: Locale) {
  const collator = new Intl.Collator(INTL_TAG[locale]);
  return (a: T, b: T) => b.count - a.count || collator.compare(a.name, b.name);
}

/** A sector's kinds as rows, busiest first. Kinds with nothing here are left out. */
export function kindRows(
  locale: Locale,
  kinds: readonly KindDto[],
  counts: Record<string, number>,
): KindRowData[] {
  return kinds
    .map((k) => ({ slug: k.slug, name: pickText(k.name, locale), count: counts[k.slug] ?? 0 }))
    .filter((k) => k.count > 0)
    .sort(byCount(locale));
}

/**
 * Every sector with businesses here as a group of kind rows: the busiest sector first, each
 * group's busiest kind first. Door counts already include sub-kinds (taxonomy.ts).
 */
export function sectorGroups(
  locale: Locale,
  index: TaxonomyIndex,
  counts: Record<string, number>,
): SectorGroupData[] {
  const order = byCount<{ count: number; name: string }>(locale);
  return index.sectors
    .map((sector) => {
      const kinds = kindRows(locale, index.doorsBySector.get(sector.id) ?? [], counts);
      return {
        sector,
        name: pickText(sector.name, locale),
        tagline: pickText(sector.tagline, locale),
        total: kinds.reduce((sum, k) => sum + k.count, 0),
        kinds,
      };
    })
    .filter((g) => g.total > 0)
    .sort((a, b) => order({ count: a.total, name: a.name }, { count: b.total, name: b.name }));
}
