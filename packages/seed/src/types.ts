import type { Dietary, Hours, Localized, PlaceStatus, PlaceType, Template, Tier } from "@darb/core";

export interface SeedSector {
  slug: string;
  name: Localized;
  tagline: Localized;
  accent: string;
  order: number;
}
export interface SeedKind {
  slug: string;
  sector: string;
  parent: string | null;
  name: Localized;
  synonyms: { he: string[]; ar: string[]; en: string[] };
  template: Template;
  attributes: string[];
  icon: string | null;
  order: number;
  status: "active" | "hidden";
}
export interface SeedScreen {
  brand: Localized;
  title: Localized;
  subtitle?: Localized;
  tags?: Localized[];
  items: { label: Localized; meta?: Localized }[];
  cta: Localized;
  palette: { bg: string; surface: string; ink: string; accent: string };
  font: string;
}
export interface SeedPlace {
  slug: string;
  cbsCode: string | null;
  type: PlaceType;
  parent: string | null;
  name: Localized;
  aliases: string[];
  lat: number;
  lng: number;
  status: PlaceStatus;
}
export interface SeedBrand {
  slug: string;
  name: Localized;
}
export interface SeedBusiness {
  slug: string;
  place: string;
  brand: string | null;
  primaryKind: string;
  kinds: string[];
  name: Localized;
  tagline: Localized;
  address: Localized;
  lat: number;
  lng: number;
  hours: Hours;
  attributes: Record<string, boolean | string | number>;
  /** Whole-business dietary facts; gluten_free is a fully gluten-free kitchen (Task 27b). */
  dietary?: Dietary[];
  experience: SeedScreen;
  tier: Tier;
}

/** Stored shape in businesses.json: the screen is attached by loadBusinesses(). */
export type SeedBusinessRecord = Omit<SeedBusiness, "experience">;
