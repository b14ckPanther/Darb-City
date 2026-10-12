import { readFileSync } from "node:fs";
import type {
  SeedBrand,
  SeedBusiness,
  SeedKind,
  SeedPlace,
  SeedScreen,
  SeedSector,
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
export const loadBrands = () => read<SeedBrand[]>("brands.json");
export const loadBusinesses = () => read<SeedBusiness[]>("businesses.json");
