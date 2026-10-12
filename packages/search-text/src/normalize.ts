/**
 * Spec §5.1. One function for the browser, the phone and the server, at index and at query time:
 * no DOM and no node APIs.
 */
const HEBREW_FINALS: Record<string, string> = { ך: "כ", ם: "מ", ן: "נ", ף: "פ", ץ: "צ" };
const ARABIC_FOLDS: Record<string, string> = { ة: "ه", ى: "ي", ٱ: "ا" };
/** Hebrew points and cantillation, Arabic tashkeel, superscript alef and tatweel. */
const MARKS = /[֑-ׇً-ٰٟـ]/g;
/** Geresh and gershayim (Hebrew and the ASCII quotes typed for them) join a word, never split it. */
const JOINERS = /['"׳״’]/g;

/** Maqaf, paseq and sof pasuq separate Hebrew words: they become spaces, never marks to drop. */
const HEBREW_SEPARATORS = /[\u05BE\u05C0\u05C3]/g;

export function normalize(text: string): string {
  return text
    .replace(HEBREW_SEPARATORS, " ")
    .replace(MARKS, "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "") // Latin diacritics; also the hamza and madda of أ إ آ ؤ ئ
    .normalize("NFC")
    .toLowerCase()
    .replace(/[ךםןףץ]/g, (c) => HEBREW_FINALS[c] ?? c)
    .replace(/[ةىٱ]/g, (c) => ARABIC_FOLDS[c] ?? c)
    .replace(JOINERS, "")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim();
}

/** Spec §5.1's digits, then the usual Latin spellings of Arabic consonants. */
const ARABIZI: [RegExp, string][] = [
  [/2/g, "ء"],
  [/3/g, "ع"],
  [/5/g, "خ"],
  [/6/g, "ط"],
  [/7/g, "ح"],
  [/9/g, "ق"],
  [/sh/g, "ش"],
  [/kh/g, "خ"],
  [/gh/g, "غ"],
  [/th/g, "ث"],
  [/dh/g, "ذ"],
  [/b/g, "ب"],
  [/t/g, "ت"],
  [/j/g, "ج"],
  [/d/g, "د"],
  [/r/g, "ر"],
  [/z/g, "ز"],
  [/s/g, "س"],
  [/f/g, "ف"],
  [/q/g, "ق"],
  [/k/g, "ك"],
  [/l/g, "ل"],
  [/m/g, "م"],
  [/n/g, "ن"],
  [/h/g, "ه"],
  [/w/g, "و"],
  [/y/g, "ي"],
  [/[aeiou]/g, ""],
];

const collapse = (s: string) => s.replace(/(.)\1+/gu, "$1");

/** The Arabic skeleton of a Latin Arabizi token ("7allaq" → "حلق"); null without a digit. */
export function arabiziKey(token: string): string | null {
  if (!/^[a-z0-9]+$/.test(token) || !/[235679]/.test(token) || !/[a-z]/.test(token)) return null;
  let out = token;
  for (const [from, to] of ARABIZI) out = out.replace(from, to);
  out = collapse(out.replace(/[a-z0-9]/g, ""));
  return out.length >= 2 ? out : null;
}

/** A normalized Arabic token without alef and hamza, doubled letters collapsed ("حلاق" → "حلق"). */
export function arabicSkeleton(token: string): string {
  return collapse(token.replace(/[اء]/g, ""));
}
