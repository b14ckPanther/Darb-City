import { levenshtein } from "./distance.js";
import { normalize } from "./normalize.js";
import { STOPWORDS, variants } from "./tokens.js";

/**
 * Kinds of business Darb does not list (spec §5.4). A superset of the seed gate
 * (packages/seed/src/validate.test.ts): plurals and more drink, gambling and pork words. The gate's
 * "strip" is left out ("LED strip" is a real search); only strip clubs are blocked.
 */
export const BLOCKED_TERMS: readonly string[] = [
  "bar",
  "bars",
  "pub",
  "pubs",
  "wine",
  "wines",
  "winery",
  "beer",
  "beers",
  "brewery",
  "liquor",
  "alcohol",
  "alcoholic",
  "vodka",
  "whisky",
  "whiskey",
  "arak",
  "casino",
  "casinos",
  "gambling",
  "betting",
  "bet",
  "lottery",
  "poker",
  "pork",
  "bacon",
  "nightclub",
  "nightclubs",
  "night club",
  "tattoo",
  "tattoos",
  "strip club",
  "strip clubs",
  "בר",
  "ברים",
  "פאב",
  "פאבים",
  "יין",
  "יינות",
  "יקב",
  "בירה",
  "בירות",
  "אלכוהול",
  "וודקה",
  "ערק",
  "קזינו",
  "הימורים",
  "הימור",
  "לוטו",
  "פוקר",
  "חזיר",
  "בייקון",
  "מועדון לילה",
  "מועדוני לילה",
  "קעקוע",
  "קעקועים",
  "מועדון חשפנות",
  "خمر",
  "خمور",
  "نبيذ",
  "بيرة",
  "بيره",
  "كحول",
  "كحوليات",
  "كازينو",
  "قمار",
  "مراهنات",
  "يانصيب",
  "خنزير",
  "ملهى ليلي",
  "ملاهي ليلية",
  "بار",
  "بارات",
  "حانة",
  "حانات",
  "وشم",
  "تاتو",
];

/** Phrases that contain a blocked word and are fine ("bar mitzvah", "juice bar"). */
export const ALLOWED_PHRASES: readonly string[] = [
  "bar mitzvah",
  "bat mitzvah",
  "juice bar",
  "salad bar",
  "snack bar",
  "coffee bar",
  "espresso bar",
  "protein bar",
  "bar code",
  // Bar-Ilan, the university (and its city streets): "bar-ilan" normalizes to "bar ilan".
  "bar ilan",
  "mini bar fridge",
  "בר מצווה",
  "בת מצווה",
  "בר מיצים",
  "בר סלטים",
  "בר קפה",
  "כבר",
  "שבר",
  "בר אילן",
  "מקרר מיני בר",
  "عرق سوس",
  "عرق النسا",
  "بار ايلان",
  "كبار",
];

/**
 * Arabic عرق is arak, but also sweat, a vein and a root ("عرق النسا", sciatica). The owner's ruling:
 * it is blocked only on its own or next to a drink word.
 */
const ARAK = normalize("عرق");
const DRINK_WORDS: ReadonlySet<string> = new Set(
  ["زحلاوي", "بلدي", "كاس", "كأس", "مشروب", "مشروبات", "بار", "بارات", "حانة", "خمر", "خمور"].map(
    normalize,
  ),
);

const words = (s: string) => normalize(s).split(" ");
const SINGLE = new Set(BLOCKED_TERMS.filter((t) => !normalize(t).includes(" ")).map(normalize));
const MULTI = BLOCKED_TERMS.map(words).filter((w) => w.length > 1);
const ALLOWED = ALLOWED_PHRASES.map(words).sort((a, b) => b.length - a.length);

const at = (tokens: string[], i: number, phrase: string[]) =>
  phrase.every((w, j) => tokens[i + j] === w);

/** Doubled letters folded ("giyyora" → "giyora", "jann" → "jan"): Latin spellings of one name. */
const fold = (s: string) => s.replace(/(.)\1+/gu, "$1");
/** A later word of a place name, spelled another common way: "giora" for "giyyora". */
const spelledLike = (token: string, w: string) => {
  const [a, b] = [fold(token), fold(w)];
  return a === b || (Math.min(a.length, b.length) >= 4 && levenshtein(a, b, 1) <= 1);
};

const startsAt = (tokens: string[], i: number, name: string[]) =>
  name.every((w, j) => {
    const token = tokens[i + j];
    if (token === undefined) return false;
    if (j === 0) return variants(token).includes(w);
    // The last word may still be being typed ("beer sh").
    return spelledLike(token, w) || (i + j === tokens.length - 1 && w.startsWith(token));
  });

const isArak = (token: string | undefined) => token !== undefined && variants(token).includes(ARAK);
const isDrink = (token: string | undefined) =>
  token !== undefined && variants(token).some((v) => DRINK_WORDS.has(v));

/**
 * True when the query asks for a kind of business Darb does not list. `names` are known place and
 * kind names of two or more normalized words that contain a blocked word ("beer sheva", "bet
 * shemesh", "בר גיורא"): a query word inside one of them names that place, not a business.
 */
export function isBlocked(text: string, names: readonly string[][] = []): boolean {
  const tokens = normalize(text).split(" ").filter(Boolean);
  const kept: string[] = [];
  for (let i = 0; i < tokens.length;) {
    const allowed =
      ALLOWED.find((p) => at(tokens, i, p)) ?? names.find((n) => startsAt(tokens, i, n));
    if (allowed) {
      kept.push("·"); // a gap, so phrases never join across an allowed phrase
      i += allowed.length;
    } else kept.push(tokens[i++] as string);
  }
  const content = kept.filter((t) => t !== "·" && !STOPWORDS.has(t));
  for (let i = 0; i < kept.length; i++) {
    if (MULTI.some((p) => at(kept, i, p))) return true;
    if (variants(kept[i] as string).some((v) => SINGLE.has(v))) return true;
    if (isArak(kept[i]) && (content.length === 1 || isDrink(kept[i - 1]) || isDrink(kept[i + 1])))
      return true;
  }
  return false;
}

/**
 * The normalized terms of two or more words that `isBlocked` would catch: place and kind names to
 * pass back to `isBlocked`, longest first.
 */
export function blockedNames(terms: readonly string[]): string[][] {
  return [...new Set(terms)]
    .filter((t) => t.includes(" ") && isBlocked(t))
    .map((t) => t.split(" "))
    .sort((a, b) => b.length - a.length);
}
