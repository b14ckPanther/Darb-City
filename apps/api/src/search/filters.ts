import type { Locale } from "@darb/core";
import { EMPTY_INTENT, type IntentDto } from "@darb/contracts";
import { STRONG, type Cues, type InstantResult } from "@darb/search-text";
import type { IntentRequest, RawIntent } from "../ai/intent.js";

const LOCALE_INDEX: Record<Locale, number> = { he: 0, ar: 1, en: 2 };

/** Lane-1 words for a whole gluten-free kitchen become the `gluten_free` filter (Task 27b). */
export const dietaryFromCues = (cues: Cues): IntentDto["dietary"] =>
  cues.glutenFree ? ["gluten_free"] : [];

export function intentFromInstant(r: InstantResult): IntentDto {
  const place = r.places[0] && r.places[0].score >= STRONG ? r.places[0] : null;
  const strong = r.kinds.filter(
    (k) => k.score >= STRONG && !(place && k.tokens.some((t) => place.tokens.includes(t))),
  );
  // Kinds tied on the same word ("روضة": daycare and kindergartens) all count, up to three.
  const top = strong[0]?.score ?? 0;
  return {
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
  };
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

export function validateIntent(
  raw: RawIntent,
  allowed: { kinds: ReadonlySet<string>; places: ReadonlySet<string> },
  cues: Cues,
): IntentDto {
  const kinds = [...new Set(raw.kinds)].filter((k) => allowed.kinds.has(k)).slice(0, 3);
  return {
    kinds,
    place: raw.place && allowed.places.has(raw.place) ? raw.place : null,
    nearMe: raw.nearMe || cues.nearMe,
    openNow: raw.openNow || cues.openNow,
    attributes: { delivers: raw.attributes.delivers || cues.delivers },
    // Only lane 1 sets dietary facts: the model is never asked about them.
    dietary: dietaryFromCues(cues),
    freeText: raw.freeText.trim().slice(0, 120),
  };
}
