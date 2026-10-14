import { loadBusinesses, loadKinds, loadPlaces, loadSectors } from "@darb/seed";

/**
 * Which rows have a counterpart in packages/seed/data, matched exactly as the seed loader matches
 * them (src/seed/load.ts): places by CBS code or slug, sectors and kinds by slug, businesses by
 * place and slug. "Return to seed data" only makes sense for those: on a row an admin created,
 * clearing editedAt would let the next seed run hide or suspend it (kinds, businesses) or leave it
 * unowned, so the API refuses it (409 no_seed_source) and the admin hides the button.
 */
interface SeedKeys {
  placeSlugs: Set<string>;
  placeCbs: Set<string>;
  sectors: Set<string>;
  kinds: Set<string>;
  businesses: Set<string>;
}

let cached: SeedKeys | null = null;
const keys = (): SeedKeys =>
  (cached ??= (() => {
    const places = loadPlaces();
    return {
      placeSlugs: new Set(places.map((p) => p.slug)),
      placeCbs: new Set(places.flatMap((p) => (p.cbsCode ? [p.cbsCode] : []))),
      sectors: new Set(loadSectors().map((s) => s.slug)),
      kinds: new Set(loadKinds().map((k) => k.slug)),
      businesses: new Set(loadBusinesses().map((b) => `${b.place}/${b.slug}`)),
    };
  })());

export const seedSource = {
  place: (p: { slug: string; cbsCode: string | null }) =>
    (p.cbsCode !== null && keys().placeCbs.has(p.cbsCode)) || keys().placeSlugs.has(p.slug),
  sector: (slug: string) => keys().sectors.has(slug),
  kind: (slug: string) => keys().kinds.has(slug),
  business: (placeSlug: string, slug: string) => keys().businesses.has(`${placeSlug}/${slug}`),
};
