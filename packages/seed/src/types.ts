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
  /** Real clients only (clients.json); showroom examples have none. */
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  apps?: { web?: string; ios?: string; android?: string };
  /** The business's own pages (Instagram, Facebook, TikTok, a Waze link). */
  links?: Record<string, string>;
  /** The card's look: one of CARD_ACCENTS, and line or solid icons. */
  cardStyle?: { accent?: string; icons?: "line" | "solid" };
  /**
   * Ledger note, never written to the database: the pin is the town's centre because the exact
   * spot was not given yet. The owner moves it in /admin (Task 28).
   */
}

/** Stored shape in businesses.json: the screen is attached by loadShowroom(). */
export type SeedBusinessRecord = Omit<SeedBusiness, "experience">;
/** A pricing plan (/pricing). Whole shekels; monthly null is a custom quote, 0 is free. */
export interface SeedPlan {
  slug: string;
  order: number;
  status: "live" | "hidden";
  name: Localized;
  tagline: Localized;
  monthly: number | null;
  setup: number | null;
  priceNote: Localized;
  features: { he: string[]; ar: string[]; en: string[] };
  highlighted: boolean;
  ctaLabel: Localized;
  ctaHref: string;
  finePrint: Localized;
}
/** Page copy by key ("pricing.title"). */
export interface SeedText {
  key: string;
  value: Localized;
}
