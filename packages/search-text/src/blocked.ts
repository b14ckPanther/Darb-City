import { normalize } from "./normalize.js";
import { variants } from "./tokens.js";

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
  "عرق",
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
  "בר מצווה",
  "בת מצווה",
  "בר מיצים",
  "בר סלטים",
  "בר קפה",
  "כבר",
  "שבר",
  "عرق سوس",
  "كبار",
];

const words = (s: string) => normalize(s).split(" ");
const SINGLE = new Set(BLOCKED_TERMS.filter((t) => !normalize(t).includes(" ")).map(normalize));
const MULTI = BLOCKED_TERMS.map(words).filter((w) => w.length > 1);
const ALLOWED = ALLOWED_PHRASES.map(words).sort((a, b) => b.length - a.length);

const at = (tokens: string[], i: number, phrase: string[]) =>
  phrase.every((w, j) => tokens[i + j] === w);

const startsAt = (tokens: string[], i: number, name: string[]) =>
  name.every((w, j) => {
    const token = tokens[i + j];
    if (token === undefined) return false;
    if (j === 0) return variants(token).includes(w);
    // The last word may still be being typed ("beer sh").
    return token === w || (i + j === tokens.length - 1 && w.startsWith(token));
  });

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
  for (let i = 0; i < kept.length; i++) {
    if (MULTI.some((p) => at(kept, i, p))) return true;
    if (variants(kept[i] as string).some((v) => SINGLE.has(v))) return true;
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
