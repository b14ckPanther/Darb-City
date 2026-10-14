import type { Hours, Localized, Tier } from "@darb/core";
import { normalize } from "@darb/search-text";
import { publicPoint } from "../businesses/public-point.js";

export type SearchEntityName = "place" | "kind" | "business";

export interface DocumentRow {
  entityType: SearchEntityName;
  entityId: string;
  slug: string;
  placePath: string;
  kindIds: string[];
  attributes: Record<string, unknown>;
  tier: Tier | null;
  lat: number | null;
  lng: number | null;
  nameText: string;
  text: string;
  embedText: string;
  completeness: number;
}

type Synonyms = { he: string[]; ar: string[]; en: string[] };
export interface PlaceSource {
  id: string;
  slug: string;
  path: string;
  name: Localized;
  aliases: string[];
  lat: number;
  lng: number;
}
export interface KindSource {
  id: string;
  slug: string;
  name: Localized;
  synonyms: Synonyms;
}
export interface BusinessSource {
  id: string;
  slug: string;
  tier: Tier;
  lat: number;
  lng: number;
  name: Localized;
  tagline: Localized;
  address: Localized;
  phone: string | null;
  whatsapp: string | null;
  website: string | null;
  photos: unknown[];
  hours: Hours;
  attributes: Record<string, unknown>;
  experience: Record<string, unknown>;
  placePath: string;
  placeName: Localized;
  /** The place's centre, used instead of the pin when the street is kept private. */
  placePoint: { lat: number; lng: number };
  kinds: { id: string; name: Localized; synonyms: Synonyms }[];
}

const values = (l: Localized) =>
  [l.he, l.ar, l.en].filter((v): v is string => !!v && v.trim() !== "");
/** Normalized parts, each once ("Sakhnin" and the alias "SAKHNIN" give one "sakhnin"). */
const join = (parts: string[]) => [...new Set(parts.map(normalize).filter(Boolean))].join(" ");
const synonyms = (s: Synonyms) => [...s.he, ...s.ar, ...s.en];

export function completeness(
  b: Pick<
    BusinessSource,
    "tagline" | "address" | "phone" | "whatsapp" | "website" | "photos" | "hours" | "experience"
  >,
): number {
  const items = (b.experience as { items?: unknown[] }).items;
  const checks = [
    values(b.tagline).length > 0,
    values(b.address).length > 0,
    !!(b.phone || b.whatsapp),
    !!b.website,
    b.photos.length > 0,
    Object.values(b.hours.weekly).some((i) => i && i.length > 0),
    Array.isArray(items) && items.length > 0,
  ];
  return checks.filter(Boolean).length / checks.length;
}

export function placeDocument(p: PlaceSource): DocumentRow {
  return {
    entityType: "place",
    entityId: p.id,
    slug: p.slug,
    placePath: p.path,
    kindIds: [],
    attributes: {},
    tier: null,
    lat: p.lat,
    lng: p.lng,
    nameText: join(values(p.name)),
    text: join([...values(p.name), ...p.aliases]),
    embedText: values(p.name).join(" / "),
    completeness: 0,
  };
}

export function kindDocument(k: KindSource): DocumentRow {
  return {
    entityType: "kind",
    entityId: k.id,
    slug: k.slug,
    placePath: "",
    kindIds: [k.id],
    attributes: {},
    tier: null,
    lat: null,
    lng: null,
    nameText: join(values(k.name)),
    text: join([...values(k.name), ...synonyms(k.synonyms)]),
    embedText: [...values(k.name), ...synonyms(k.synonyms)].join(", "),
    completeness: 0,
  };
}

export function businessDocument(b: BusinessSource): DocumentRow {
  const kindWords = b.kinds.flatMap((k) => [...values(k.name), ...synonyms(k.synonyms)]);
  return {
    entityType: "business",
    entityId: b.id,
    slug: b.slug,
    placePath: b.placePath,
    kindIds: b.kinds.map((k) => k.id),
    attributes: b.attributes,
    tier: b.tier,
    // Distances and radius filters use this point: never a private street's pin.
    ...publicPoint(b, b.placePoint),
    nameText: join(values(b.name)),
    text: join([...values(b.name), ...values(b.tagline), ...kindWords, ...values(b.placeName)]),
    embedText: [
      values(b.name).join(" / "),
      values(b.tagline).join(" / "),
      b.kinds.map((k) => values(k.name).join(" / ")).join("; "),
      values(b.placeName).join(" / "),
    ]
      .filter(Boolean)
      .join(" — "),
    completeness: completeness(b),
  };
}
