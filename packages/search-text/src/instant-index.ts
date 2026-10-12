import type { Localized, PlaceType } from "@darb/core";
import { arabicSkeleton, normalize } from "./normalize.js";

export interface IndexPlace {
  slug: string;
  type: PlaceType;
  status: "live" | "soon";
  parent: string | null;
  name: Localized;
  aliases: string[];
}
export interface IndexKind {
  slug: string;
  sector: string;
  parent: string | null;
  status: "active" | "hidden";
  name: Localized;
  synonyms: { he: string[]; ar: string[]; en: string[] };
}
export interface InstantEntry {
  s: string;
  n: [string, string, string];
  t: string[];
  k: string[];
  w: number;
  p: string;
}
export interface InstantIndex {
  v: 1;
  places: InstantEntry[];
  kinds: InstantEntry[];
}

const names = (n: Localized): [string, string, string] => [n.he ?? "", n.ar ?? "", n.en ?? ""];

function terms(raw: string[]): { t: string[]; k: string[] } {
  const t = [...new Set(raw.map(normalize).filter(Boolean))];
  const k = [
    ...new Set(
      t
        .filter((x) => /\p{Script=Arabic}/u.test(x))
        .map((x) => x.split(" ").map(arabicSkeleton).join(" ")),
    ),
  ];
  return { t, k };
}

const SETTLEMENT: readonly PlaceType[] = ["city", "town", "village"];

function placeWeight(p: IndexPlace): number {
  if (p.status !== "live") return 1;
  if (p.type === "city") return 3;
  return SETTLEMENT.includes(p.type) || p.type === "neighbourhood" ? 2 : 1;
}

/** First words that many place names share: never a short form on their own. */
const PLACE_PREFIXES = new Set(
  [
    "kiryat",
    "qiryat",
    "kfar",
    "kefar",
    "kafr",
    "beit",
    "beth",
    "givat",
    "ramat",
    "neve",
    "nahal",
    "umm",
    "mitzpe",
    "maale",
    "bnei",
    "kerem",
    "mishmar",
    "ganei",
    "shaar",
    "ramot",
    "even",
    "קרית",
    "קריית",
    "כפר",
    "בית",
    "גבעת",
    "רמת",
    "נווה",
    "מצפה",
    "מעלה",
    "בני",
    "כרם",
    "משמר",
    "גני",
    "שער",
    "רמות",
    "كريات",
    "كفار",
    "كفر",
    "بيت",
    "رمات",
    "جفعات",
    "مشمار",
    "متسبي",
  ].map(normalize),
);

/**
 * Short forms of compound place names: the first word ("Ma'alot" of "Ma'alot-Tarshiha") and each
 * hyphenated part. Kept only when no other place shares it and it is not a common prefix, so
 * "Kiryat", "Kfar" or "Beit" alone never point at one place.
 */
function shortForms(p: IndexPlace): string[] {
  const out = new Set<string>();
  for (const name of [...names(p.name), ...p.aliases]) {
    const parts = [name.split(/[\s-]+/)[0] ?? "", ...(name.includes("-") ? name.split("-") : [])];
    for (const part of parts) {
      const n = normalize(part);
      if (n.length >= 4 && n !== normalize(name) && !PLACE_PREFIXES.has(n)) out.add(n);
    }
  }
  return [...out];
}

/** Spec §5.2: every place and active kind, already normalized, for matching with no network. */
export function buildInstantIndex(input: {
  places: IndexPlace[];
  kinds: IndexKind[];
}): InstantIndex {
  const shorts = input.places.map(shortForms);
  const seen = new Map<string, number>();
  for (const list of shorts) for (const s of list) seen.set(s, (seen.get(s) ?? 0) + 1);
  return {
    v: 1,
    places: input.places.map((p, i) => ({
      s: p.slug,
      n: names(p.name),
      ...terms([
        ...names(p.name),
        ...p.aliases,
        ...(shorts[i] ?? []).filter((s) => seen.get(s) === 1),
      ]),
      w: placeWeight(p),
      p: p.parent ?? "",
    })),
    kinds: input.kinds
      .filter((k) => k.status === "active")
      .map((k) => ({
        s: k.slug,
        n: names(k.name),
        ...terms([...names(k.name), ...k.synonyms.he, ...k.synonyms.ar, ...k.synonyms.en]),
        w: k.parent ? 2 : 3,
        p: k.sector,
      })),
  };
}
