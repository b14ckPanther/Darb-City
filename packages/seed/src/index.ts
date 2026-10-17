import { readdirSync, readFileSync } from "node:fs";
import type {
  SeedBrand,
  SeedBusiness,
  SeedBusinessRecord,
  SeedKind,
  SeedPlace,
  SeedPlan,
  SeedScreen,
  SeedSector,
  SeedText,
} from "./types.js";

export * from "./types.js";
export { SCREEN_SCHEMA } from "./screen-schema.js";

const read = <T>(file: string): T =>
  JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8")) as T;

export const loadSectors = () => read<SeedSector[]>("sectors.json");
export const loadKinds = () => read<SeedKind[]>("kinds.json");
export const loadScreens = (): Record<string, SeedScreen> => ({
  ...read<Record<string, SeedScreen>>("screens.json"),
  ...read<Record<string, SeedScreen>>("extra-screens.json"),
});
export const loadPlaces = () => read<SeedPlace[]>("places.json");
/** The pricing page: plans, and its copy by key. */
export const loadPlans = () => read<SeedPlan[]>("plans.json");
export const loadTexts = () => read<SeedText[]>("texts.json");
/** Darb's real clients (spec §11): darb tier, own experience screens, owner-supplied details. */
export const loadClients = (): { brands: SeedBrand[]; businesses: SeedBusiness[] } =>
  read<{ brands: SeedBrand[]; businesses: SeedBusiness[] }>("clients.json");
export const loadBrands = (): SeedBrand[] => [
  ...read<SeedBrand[]>("brands.json"),
  ...loadClients().brands,
];
/** The showroom examples, each with its kind's screen attached. */
export const loadShowroom = (): SeedBusiness[] => {
  const screens = loadScreens();
  return read<SeedBusinessRecord[]>("businesses.json").map((b) => {
    const experience = screens[b.primaryKind];
    if (!experience) throw new Error(`No screen for kind ${b.primaryKind} (${b.place}/${b.slug})`);
    return { ...b, experience };
  });
};
/**
 * Real businesses from public open data: every file in data/listings/ (one per source, its source
 * recorded in the file). Basic listings, never examples, so they load with or without the showroom.
 */
export const loadListings = (): SeedBusiness[] =>
  readdirSync(new URL("../data/listings/", import.meta.url))
    .filter((file) => file.endsWith(".json"))
    .sort()
    .flatMap((file) => read<{ businesses: SeedBusiness[] }>(`listings/${file}`).businesses);
/** Every real business: Darb's clients and the open-data listings. */
export const loadReal = (): SeedBusiness[] => [...loadClients().businesses, ...loadListings()];
/** Showroom examples plus every real business. */
export const loadBusinesses = (): SeedBusiness[] => [...loadShowroom(), ...loadReal()];
export const loadWeekend = () => read<{ arabDruze: string[]; christian: string[] }>("weekend.json");
export { toArabDruzeWeek, toChristianWeek } from "./showroom.js";
