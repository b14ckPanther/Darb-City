import type { Locale } from "@darb/core";
import { conditionsOf, EMPTY_INTENT, type IntentDto } from "@darb/contracts";
import { detectCues, normalize, STRONG, type Cues, type InstantResult } from "@darb/search-text";
import type { IntentRequest, RawIntent } from "../ai/intent.js";

const LOCALE_INDEX: Record<Locale, number> = { he: 0, ar: 1, en: 2 };

/** Lane-1 words for a whole gluten-free kitchen become the `gluten_free` filter (Task 27b). */
export const dietaryFromCues = (cues: Cues): IntentDto["dietary"] =>
  cues.glutenFree ? ["gluten_free"] : [];

export const MAX_ITEM = 60;

/**
 * Lane 1's item, as typed: the words that named a kind ("car wash" in "car wash in Haifa for my
 * jeep", "שווארמה" in "שווארמה ללא גלוטן"), else every content word but the place's. Searched
 * inside every card, so a word that is a kind ("shawarma") also finds the restaurant whose menu
 * lists it.
 */
export function itemsFromInstant(
  r: InstantResult,
  placeTokens: readonly number[],
  kindTokens: readonly number[] | null = null,
): string[] {
  const words = r.typed.filter((_, i) =>
    kindTokens ? kindTokens.includes(i) : !placeTokens.includes(i),
  );
  const item = words.join(" ").slice(0, MAX_ITEM).trim();
  return item ? [item] : [];
}

/**
 * The model's items, cleaned: condition words dropped ("gluten free shawarma" is "shawarma"
 * with the gluten-free filter), each once (by its normalized form), at most five.
 */
export function cleanItems(items: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of items) {
    const trimmed = raw.trim();
    const { rest } = detectCues(normalize(trimmed));
    const item = (rest === normalize(trimmed) ? trimmed : rest).slice(0, MAX_ITEM).trim();
    const key = normalize(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    out.push(item);
  }
  return out.slice(0, 5);
}

export function intentFromInstant(r: InstantResult): IntentDto {
  const place = r.places[0] && r.places[0].score >= STRONG ? r.places[0] : null;
  const strong = r.kinds.filter(
    (k) => k.score >= STRONG && !(place && k.tokens.some((t) => place.tokens.includes(t))),
  );
  // Kinds tied on the same word ("روضة": daycare and kindergartens) all count, up to three.
  const top = strong[0]?.score ?? 0;
  const intent: IntentDto = {
    ...EMPTY_INTENT,
    kinds: strong
      .filter((k) => k.score >= top - 0.02)
      .slice(0, 3)
      .map((k) => k.entry.s),
    place: place?.entry.s ?? null,
    nearMe: r.cues.nearMe,
    openNow: r.cues.openNow,
    attributes: { delivers: r.cues.delivers },
    dietary: dietaryFromCues(r.cues),
    freeText: r.unmatched.join(" ").slice(0, 120),
    items: itemsFromInstant(r, place?.tokens ?? [], strong[0]?.tokens ?? null),
  };
  return { ...intent, ...conditionsOf(intent) };
}

export function explainedByInstant(r: InstantResult): boolean {
  const intent = intentFromInstant(r);
  // A dietary ask ("ללא גלוטן") is a whole query on its own, like a kind.
  return (intent.kinds.length > 0 || intent.dietary.length > 0) && r.unmatched.length === 0;
}

export function intentCandidates(r: InstantResult, locale: Locale): IntentRequest["candidates"] {
  const name = (n: [string, string, string]) => n[LOCALE_INDEX[locale]] || n[2] || n[0] || n[1];
  return {
    kinds: r.kinds.map((k) => ({ slug: k.entry.s, name: name(k.entry.n) })),
    places: r.places.map((p) => ({ slug: p.entry.s, name: name(p.entry.n) })),
  };
}

/** A model answer, or a cached intent read back (both are checked against the world again). */
type IntentLike = Omit<RawIntent, "items" | "niceToHave"> & {
  items?: readonly string[];
  niceToHave?: readonly string[];
};
const WISHES = new Set(["openNow", "delivers"] as const);
const isWish = (c: string): c is "openNow" | "delivers" => WISHES.has(c as "openNow");

export function validateIntent(
  raw: IntentLike,
  allowed: { kinds: ReadonlySet<string>; places: ReadonlySet<string> },
  cues: Cues,
): IntentDto {
  const kinds = [...new Set(raw.kinds)].filter((k) => allowed.kinds.has(k)).slice(0, 3);
  const intent: IntentDto = {
    kinds,
    place: raw.place && allowed.places.has(raw.place) ? raw.place : null,
    nearMe: raw.nearMe || cues.nearMe,
    openNow: raw.openNow || cues.openNow,
    attributes: { delivers: raw.attributes.delivers || cues.delivers },
    // Only lane 1 sets dietary facts: the model is never asked about them.
    dietary: dietaryFromCues(cues),
    freeText: raw.freeText.trim().slice(0, 120),
    items: cleanItems(raw.items ?? []),
    mustHave: [],
    niceToHave: [...new Set(raw.niceToHave ?? [])].filter(isWish),
  };
  return { ...intent, ...conditionsOf(intent) };
}
