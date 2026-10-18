/**
 * Reading an address as an admin types it, in Hebrew, Arabic or English: "שדרות המגינים 68,
 * חיפה", "עין דור 11", "רח' הרצל 5 נצרת", "شارع الجبل 5 الناصرة", "68 Hameginim Blvd, Haifa".
 * No network, no guessing beyond the words: the town may be missing (the caller then uses the
 * business's own town).
 */

export interface ParsedAddress {
  /** The street as typed, tidied ("רח' הרצל"). */
  street: string;
  /** Spellings worth asking for, best first: abbreviations written out, then without "street". */
  variants: string[];
  /** "68", "68א", "12" (from "12-14"); null when no number was given. */
  number: string | null;
  /** The number's digits alone. */
  numeric: number | null;
  town: string | null;
}

const HE = "א-ת";
const AR = "ء-ي";
const LETTER = `[${HE}${AR}A-Za-z]`;

/** Gershayim, geresh and the quote marks people type for them, as plain ASCII. */
function tidy(raw: string): string {
  return raw
    .normalize("NFKC")
    .replace(/[֑-ׇً-ْ]/g, "") // Hebrew points, Arabic harakat
    .replace(/[״“”„]/g, '"')
    .replace(/[׳‘’`´]/g, "'")
    .replace(/־/g, " ") // maqaf
    .replace(/[‐-―]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
}

/** Words that only say "street" or "boulevard", in front of the name (Hebrew, Arabic). */
const HE_STREET = /^(?:רחוב|רח'|רח\.?|רח)\s+/;
const HE_BOULEVARD = /^(?:שדרות|שדרת|שד'|שד\.|שד|ש"ד|ש'ד)\s+/;
const AR_STREET = /^(?:شارع|ش\.|ش)\s+/;
const EN_STREET = /\s+(?:street|st\.?|road|rd\.?)$/i;

/** The ways to ask a geocoder for a street: written out first, then without "street". */
export function streetVariants(street: string): string[] {
  const out: string[] = [];
  const add = (s: string) => {
    const v = s.replace(/\s+/g, " ").trim();
    if (v.length >= 2 && !out.includes(v)) out.push(v);
  };
  if (HE_BOULEVARD.test(street)) add(street.replace(HE_BOULEVARD, "שדרות "));
  if (HE_STREET.test(street)) add(street.replace(HE_STREET, ""));
  if (AR_STREET.test(street)) {
    add(street.replace(AR_STREET, "شارع "));
    add(street.replace(AR_STREET, ""));
  }
  add(street);
  if (EN_STREET.test(street)) add(street.replace(EN_STREET, ""));
  // A boulevard is sometimes mapped without the word: a last try.
  if (HE_BOULEVARD.test(street)) add(street.replace(HE_BOULEVARD, ""));
  return out.slice(0, 3);
}

/** A house number: 1 to 4 digits and maybe one letter ("68א", "12b"), or a range "12-14". */
const NUMBER = new RegExp(`(?:^|\\s)(\\d{1,4})(?:\\s*-\\s*\\d{1,4})?(${LETTER})?(?=\\s|$|,)`);
const COUNTRY = /^(?:ישראל|israel|إسرائيل|اسرائيل)$/i;
const POSTCODE = /^\d{5,7}$/;

/**
 * Street, number and town from free text. Commas split the town from the street when present;
 * without them, words after the number are the town ("שדרות המגינים 68 חיפה").
 */
export function parseAddress(raw: string): ParsedAddress | null {
  const pieces = tidy(raw)
    .split(/[,،]/)
    .map((p) => p.trim())
    .filter((p) => p && !COUNTRY.test(p) && !POSTCODE.test(p));
  if (!pieces.length) return null;
  const letters = new RegExp(LETTER);
  const at = pieces.findIndex((p) => NUMBER.test(p) && letters.test(p));
  let street: string;
  let number: string | null = null;
  let town: string | null = null;
  if (at >= 0) {
    const piece = pieces[at]!;
    const m = NUMBER.exec(piece)!;
    const start = m.index + (m[0].startsWith(" ") ? 1 : 0);
    const before = piece.slice(0, start).trim();
    const after = piece.slice(m.index + m[0].length).trim();
    number = `${m[1]}${m[2] ?? ""}`;
    if (before) {
      street = before;
      town = after || null;
    } else {
      // "68 Hameginim Blvd": the number first, English style.
      street = after;
    }
    const others = pieces.filter((_, i) => i !== at);
    town = town ?? others[0] ?? null;
  } else {
    street = pieces[0]!;
    town = pieces[1] ?? null;
  }
  street = street.replace(/^[\s.,'"-]+|[\s.,-]+$/g, "").trim();
  if (street.length < 2 || !letters.test(street)) return null;
  const numeric = number ? Number(/\d+/.exec(number)![0]) : null;
  if (numeric !== null && (numeric < 1 || numeric > 2000)) return null;
  return {
    street,
    variants: streetVariants(street),
    number,
    numeric,
    town: town ? town.replace(/^[\s.,-]+|[\s.,-]+$/g, "") || null : null,
  };
}

const FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };

/**
 * A street name's comparison key, so OpenStreetMap's spelling and the admin's meet: no "רחוב",
 * "שדרות", "شارع" or "Street", no quotes or dots, Hebrew final letters as their normal form,
 * Arabic alef, ta marbuta and alef maqsura folded, Latin lower-case.
 */
export function streetKey(name: string): string {
  let s = tidy(name)
    .replace(/["'.,_/-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  for (let i = 0; i < 2; i++) {
    const m = /^(?:רחוב|רח|שדרות|שדרת|שד|סמטת|סמ|شارع|ش|street|st)\s+(?=\S)/i.exec(s);
    if (!m) break;
    s = s.slice(m[0].length);
  }
  s = s.replace(/\s+(?:street|st|road|rd|boulevard|blvd|ave|avenue)$/i, "");
  return s
    .replace(/[ךםןףץ]/g, (c) => FINALS[c]!)
    .replace(/יי+/g, "י")
    .replace(/וו+/g, "ו")
    .replace(/[أإآ]/g, "ا")
    .replace(/ة/g, "ه")
    .replace(/ى/g, "ي")
    .toLowerCase()
    .trim();
}

/** Looser still: no article (ה, ال) at the start of each word, for a second try. */
export function looseStreetKey(name: string): string {
  return streetKey(name)
    .split(" ")
    .map((w) => (w.length > 3 && w.startsWith("ה") ? w.slice(1) : w))
    .map((w) => (w.length > 4 && w.startsWith("ال") ? w.slice(2) : w))
    .map((w) => (w.length > 3 && w.startsWith("ha") ? w.slice(2) : w))
    .join(" ");
}

export const sameStreet = (a: string, b: string): boolean =>
  streetKey(a) === streetKey(b) || looseStreetKey(a) === looseStreetKey(b);

/** One house number from OpenStreetMap's addr:housenumber, which may hold several. */
export interface HouseNumber {
  n: number;
  /** "א", "b", or "". */
  suffix: string;
}

/** "113,115,117" → three; "12-14" → 12 and 14; "12א" → 12 א; "12/3" → 12. */
export function houseNumbers(raw: string): HouseNumber[] {
  const out: HouseNumber[] = [];
  for (const part of tidy(raw).split(/[;,]/)) {
    const range = /^\s*(\d{1,4})\s*-\s*(\d{1,4})\s*$/.exec(part);
    if (range) {
      out.push({ n: Number(range[1]), suffix: "" }, { n: Number(range[2]), suffix: "" });
      continue;
    }
    const m = new RegExp(`^\\s*(\\d{1,4})\\s*(${LETTER})?`).exec(part);
    if (m) out.push({ n: Number(m[1]), suffix: (m[2] ?? "").toLowerCase() });
  }
  return out.filter((h) => h.n > 0);
}

/** The letter after a typed number ("68א" → "א"), lower-case; "" for none. */
export const suffixOf = (number: string): string => number.replace(/^\d+/, "").trim().toLowerCase();
