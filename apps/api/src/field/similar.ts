import { normalize } from "@darb/search-text";

/**
 * Same business? The rules of the seed import's dedupe (packages/seed/scripts/import/dedupe.mjs),
 * on the search's own normalisation: generic words and shared leading words set aside, one name's
 * words all in the other's, or their letters mostly agree.
 */

type Names = Partial<Record<"he" | "ar" | "en", string | null | undefined>>;

/** Hebrew and Arabic vowel letters and Latin vowels: spellings of one name differ most in these. */
const loose = (word: string) =>
  word
    .replace(/[ךםןףץ]/g, (c) => ({ ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" })[c] ?? c)
    .replace(/[הא]$/, "ה")
    .replace(/[אוי]/g, "")
    .replace(/[اويى]/g, "")
    .replace(/[aeiouy]/g, "");

/** Words that say what the place is, not which one: never enough on their own to match. */
const GENERIC = new Set(
  [
    "תחנת",
    "תחנה",
    "דלק",
    "בנק",
    "סניף",
    "מוסך",
    "מספרה",
    "מספרת",
    "station",
    "fuel",
    "bank",
    "branch",
    "garage",
    "salon",
    "shop",
    "store",
    "محل",
    "صالون",
    "مطعم",
    "كراج",
  ].map(normalize),
);

const words = (name: string) =>
  normalize(name)
    .split(" ")
    .filter((w) => w && !GENERIC.has(w));

const bigrams = (s: string) => {
  const out = new Map<string, number>();
  for (let i = 0; i < s.length - 1; i++) {
    const g = s.slice(i, i + 2);
    out.set(g, (out.get(g) ?? 0) + 1);
  }
  return out;
};

/** Dice coefficient over letter pairs, 0 to 1. */
export function dice(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const x = bigrams(a);
  const y = bigrams(b);
  let both = 0;
  for (const [g, n] of x) both += Math.min(n, y.get(g) ?? 0);
  return (2 * both) / (a.length - 1 + (b.length - 1));
}

export function similarNames(a: Names, b: Names): boolean {
  for (const l of ["he", "ar", "en"] as const) {
    let x = words(a[l] ?? "");
    let y = words(b[l] ?? "");
    if (!x.length || !y.length) continue;
    while (x.length && y.length && loose(x[0]!) === loose(y[0]!)) {
      x = x.slice(1);
      y = y.slice(1);
    }
    if (!x.length || !y.length) return true;
    const lx = new Set(x.map(loose));
    const ly = new Set(y.map(loose));
    if ([...lx].every((w) => ly.has(w)) || [...ly].every((w) => lx.has(w))) return true;
    if (dice(x.join(""), y.join("")) >= 0.6) return true;
  }
  return false;
}

/**
 * An Israeli number's national digits ("+972 4-674-1234", "04 6741234" -> "46741234"), the key two
 * spellings of one number share. Null when too short to mean anything.
 */
export function phoneKey(raw: string | null | undefined): string | null {
  let digits = (raw ?? "").replace(/\D/g, "");
  if (digits.startsWith("972")) digits = digits.slice(3);
  digits = digits.replace(/^0+/, "");
  return digits.length >= 8 ? digits : null;
}
