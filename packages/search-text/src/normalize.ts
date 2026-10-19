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

const isArabizi = (token: string) =>
  /^[a-z0-9]+$/.test(token) && /[235679]/.test(token) && /[a-z]/.test(token);

function arabiziSpell(token: string): string | null {
  let out = token;
  for (const [from, to] of ARABIZI) out = out.replace(from, to);
  out = collapse(out.replace(/[a-z0-9]/g, ""));
  return out.length >= 2 ? out : null;
}

/** The Arabic skeleton of a Latin Arabizi token ("7allaq" → "حلق"); null without a digit. */
export function arabiziKey(token: string): string | null {
  return isArabizi(token) ? arabiziSpell(token) : null;
}

/** Prepositions and the article Arabizi glues to a word ("b3akka", "bil7aifa", "el7allaq"). */
const ARABIZI_PREFIXES = ["bil", "bel", "fil", "lil", "il", "el", "al", "bi", "b", "l", "w", "f"];

/**
 * Every Arabic skeleton an Arabizi token may spell: as written, with 2 read as ق (Palestinian
 * and Levantine speech says ق as a hamza, so "7ala2" is حلاق), and without a glued preposition
 * ("b3akka" is بعكا, "in Akko").
 */
export function arabiziKeys(token: string): string[] {
  if (!isArabizi(token)) return [];
  const bodies = [token];
  for (const p of ARABIZI_PREFIXES) {
    const rest = token.slice(p.length);
    if (token.startsWith(p) && rest.length >= 3 && isArabizi(rest) && !bodies.includes(rest))
      bodies.push(rest);
  }
  const out: string[] = [];
  for (const body of bodies)
    for (const form of body.includes("2") ? [body, body.replace(/2/g, "q")] : [body]) {
      const key = arabiziSpell(form);
      if (key && !out.includes(key)) out.push(key);
    }
  return out;
}

/**
 * A sound-alike form for typo tolerance across scripts: letters people confuse when they spell
 * by ear fold together (Hebrew ט/ת, כ/ח/ק, ס/ש, א/ע; Arabic ص/س/ث, ط/ت, ض/د, ذ/ظ/ز, ح/ه, alef
 * and hamza dropped; Latin c/k/q, z/s, ph/f, y/i and inner vowels dropped), doubled letters
 * collapsed. "burgr" and "burger", "שוורמה" and "שווארמה", "شاورما" and "شورما" meet here.
 * Takes a normalized token.
 */
export function phonetic(token: string): string {
  if (/\p{Script=Hebrew}/u.test(token))
    return collapse(
      token.replace(/ט/g, "ת").replace(/[חק]/g, "כ").replace(/ס/g, "ש").replace(/ע/g, "א"),
    );
  if (/\p{Script=Arabic}/u.test(token))
    return collapse(
      token
        .replace(/[صث]/g, "س")
        .replace(/ط/g, "ت")
        .replace(/ض/g, "د")
        .replace(/[ذظ]/g, "ز")
        .replace(/ح/g, "ه")
        .replace(/ق/g, "ك")
        .replace(/[اءى]/g, "")
        .replace(/ه$/u, ""),
    );
  if (/^[a-z]+$/.test(token))
    return collapse(
      token
        .replace(/ph/g, "f")
        .replace(/ck/g, "k")
        .replace(/c(?=[eiy])/g, "s")
        .replace(/[cq]/g, "k")
        .replace(/z/g, "s")
        .replace(/x/g, "ks")
        .replace(/y/g, "i")
        .replace(/(?<=.)[aeiou]/g, "")
        .replace(/(?<=.)h/g, ""),
    );
  return token;
}

/** A normalized Arabic token without alef and hamza, doubled letters collapsed ("حلاق" → "حلق"). */
export function arabicSkeleton(token: string): string {
  return collapse(token.replace(/[اء]/g, ""));
}
