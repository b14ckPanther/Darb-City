import { blockedNames, isBlocked } from "./blocked.js";
import { detectCues, type Cues } from "./cues.js";
import { levenshtein } from "./distance.js";
import type { InstantEntry, InstantIndex } from "./instant-index.js";
import { arabiziKeys, normalize, phonetic } from "./normalize.js";
import { STOPWORDS, tokenize, variants } from "./tokens.js";

export interface PreparedEntry {
  entry: InstantEntry;
  terms: string[][];
  /** Each term word's sound-alike form (typo tolerance). */
  phon: string[][];
  skeletons: string[][];
}
export interface Prepared {
  places: PreparedEntry[];
  kinds: PreparedEntry[];
  /** Place and kind names that contain a blocked word ("beer sheva"): never blocked. */
  names: string[][];
}
export interface InstantMatch {
  entry: InstantEntry;
  score: number;
  tokens: number[];
}
export interface InstantResult {
  normalized: string;
  blocked: boolean;
  cues: Cues;
  sentence: boolean;
  places: InstantMatch[];
  kinds: InstantMatch[];
  unmatched: string[];
  /**
   * The query's content words (cues and stopwords left out), normalized; match tokens index
   * into it. `typed` holds each as the person typed it ("שווארמה", not the folded form), for
   * showing it back.
   */
  content: string[];
  typed: string[];
}

export const STRONG = 0.75;
const dedupe = (s: string) => s.replace(/(.)\1+/gu, "$1");
const HEBREW = /\p{Script=Hebrew}/u;
/** Arabizi writes خ غ ظ as 7' 3' 6'; normalize drops the apostrophe, so the dot is lost. */
const DOTLESS: Record<string, string> = { خ: "ح", غ: "ع", ظ: "ط" };
/** Arabizi spells one Latin letter for each pair: s for س and ص, t for ت and ط, d for د and ض. */
const EMPHATIC: Record<string, string> = { ص: "س", ث: "س", ط: "ت", ض: "د", ذ: "ز" };
/**
 * How an Arabizi skeleton meets an Arabic one: dots dropped, emphatics folded, ي و dropped
 * because Arabizi writes those long vowels as i and u ("7aifa" for حيفا), and a final ه
 * (a ة) dropped because Arabizi writes it as a vowel ("nasra" for ناصرة).
 */
const arabiziForm = (s: string) =>
  s
    .replace(/[خغظ]/g, (c) => DOTLESS[c] ?? c)
    .replace(/[صثطضذ]/g, (c) => EMPHATIC[c] ?? c)
    .replace(/[يو]/g, "")
    .replace(/(.)\1+/gu, "$1")
    .replace(/(?<=..)ه$/u, "");

const split = (e: InstantEntry): PreparedEntry => ({
  entry: e,
  terms: e.t.map((t) => t.split(" ")),
  phon: e.t.map((t) => t.split(" ").map(phonetic)),
  skeletons: e.k.map((k) => k.split(" ").map(arabiziForm)),
});

export function prepare(index: InstantIndex): Prepared {
  return {
    places: index.places.map(split),
    kinds: index.kinds.map(split),
    names: blockedNames([...index.places, ...index.kinds].flatMap((e) => e.t)),
  };
}

/**
 * One query word against one term word: 1 exact, 0.85 sound-alike ("burgr", "שוורמה"), up to 0.9
 * prefix, 0.8 plural or one typo in a long word, 0.7 a typo in a short one. For a place name a
 * prefix counts only as much as it covers: "زيت" (oil) is the start of "زيتان" (Zeitan) and
 * "kid" of Kidmat Tzvi, never a strong match, where "barber" is most of "barbershops".
 */
export function tokenScore(
  query: string,
  term: string,
  queryPhonetic = phonetic(query),
  termPhonetic = phonetic(term),
  place = false,
): number {
  if (query === term) return 1;
  // Latin sound-alikes drop vowels, too loose for place names ("knafe" is not Kanaf).
  const soundAlike = !place || !/^[a-z]+$/.test(query);
  if (
    soundAlike &&
    query.length >= 4 &&
    queryPhonetic.length >= 3 &&
    queryPhonetic === termPhonetic
  )
    return 0.85;
  // A doubled or undoubled letter ("piza", "hummus" for "humus").
  // (Collapsing keeps the first letter, so a different one can't match: checked first, it's cheap.)
  if (query.length >= 4 && query[0] === term[0] && dedupe(query) === dedupe(term)) return 0.85;
  if (query.length >= 2 && term.startsWith(query))
    return place
      ? 0.4 + 0.45 * (query.length / term.length)
      : query.length < 3
        ? // Two letters ("לי", me) start too many words to name a kind on their own.
          Math.min(0.6 + 0.3 * (query.length / term.length), 0.7)
        : 0.6 + 0.3 * (query.length / term.length);
  if (term.length >= 4 && query.startsWith(term) && query.length - term.length <= 2) return 0.8;
  if (query.length >= 3 && term.length === query.length + 1 && HEBREW.test(term)) {
    // Hebrew is often written without a yod or vav ("חפה" for "חיפה"): one missing, not two.
    const at = [...term].findIndex((c, i) => c !== query[i]);
    if (at > 0 && "יו".includes(term[at]!) && term.slice(0, at) + term.slice(at + 1) === query)
      return 0.8;
  }
  if (query.length >= 4) {
    const max = query.length >= 8 ? 2 : 1;
    const edits = levenshtein(query, term, max);
    // One slip is still that word ("hifa", "مطام", "حلاغ"), but not when the first letter
    // differs: in Hebrew and Arabic that is often another word ("הולדת", birth, is not
    // "מולדת", Moledet).
    // A place name needs five letters for that: shorter ones meet look-alikes ("אפיה" in
    // "מאפיה", a bakery, is one letter from Afik).
    if (edits <= max)
      return edits === 1 && query[0] === term[0] && (!place || query.length >= 5) ? 0.8 : 0.7;
  }
  return 0;
}

interface Word {
  forms: string[];
  phon: string[];
  skeletons: string[];
}

/** The best way an entry's term covers some query words; every term word must be covered. */
function scoreEntry(
  p: PreparedEntry,
  words: Word[],
  place: boolean,
): { score: number; tokens: number[] } {
  let best = { score: 0, tokens: [] as number[] };
  const tryTerm = (term: string[], phon: string[] | null) => {
    const useSkeleton = phon === null;
    const used: number[] = [];
    let total = 0;
    for (const [j, part] of term.entries()) {
      let partBest = 0;
      let at = -1;
      words.forEach((w, i) => {
        if (used.includes(i)) return;
        const forms = useSkeleton ? w.skeletons : w.forms;
        forms.forEach((f, k) => {
          const s = useSkeleton
            ? tokenScore(f, part, f, part, place)
            : tokenScore(f, part, w.phon[k], phon[j], place);
          if (s > partBest) [partBest, at] = [s, i];
        });
      });
      if (partBest === 0) return;
      used.push(at);
      total += partBest;
    }
    const score = (total / term.length) * (useSkeleton ? 0.95 : 1);
    if (score > best.score) best = { score, tokens: used };
  };
  p.terms.forEach((term, i) => tryTerm(term, p.phon[i] ?? term.map(phonetic)));
  if (words.some((w) => w.skeletons.length)) for (const sk of p.skeletons) tryTerm(sk, null);
  return best;
}

function rank(
  entries: PreparedEntry[],
  words: Word[],
  limit: number,
  place = false,
): InstantMatch[] {
  const out: InstantMatch[] = [];
  for (const p of entries) {
    const { score, tokens } = scoreEntry(p, words, place);
    if (score <= 0.6) continue;
    // A place's weight orders look-alikes; it never makes a weak match ("הולדת" for "מולדת")
    // strong.
    const weighted = score * (1 + 0.03 * p.entry.w);
    out.push({
      entry: p.entry,
      score: score < STRONG ? Math.min(weighted, STRONG - 0.001) : weighted,
      tokens,
    });
  }
  return out.sort((a, b) => b.score - a.score || (a.entry.s < b.entry.s ? -1 : 1)).slice(0, limit);
}

/** Each normalized word of a query, as typed: punctuation trimmed, final letters kept. */
function typedForms(query: string): Map<string, string> {
  const out = new Map<string, string>();
  for (const raw of query.split(/\s+/u)) {
    const words = normalize(raw).split(" ");
    const shown = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, "");
    if (words.length === 1 && words[0] && shown && !out.has(words[0])) out.set(words[0], shown);
  }
  return out;
}

/** Lane 1 (spec §5.2): places and kinds for a query, in the browser or on the server. */
export function matchInstant(
  prepared: Prepared,
  query: string,
  limits: { places?: number; kinds?: number } = {},
): InstantResult {
  const normalized = normalize(query);
  const { cues, rest } = detectCues(normalized);
  const content = tokenize(rest).filter((t) => !STOPWORDS.has(t));
  const words: Word[] = content.map((t) => {
    const forms = variants(t);
    const skeletons = [...new Set(arabiziKeys(t).map(arabiziForm))].filter((k) => k.length >= 2);
    return { forms, phon: forms.map(phonetic), skeletons };
  });
  const places = words.length ? rank(prepared.places, words, limits.places ?? 8, true) : [];
  const kinds = words.length ? rank(prepared.kinds, words, limits.kinds ?? 12) : [];
  const typed = typedForms(query);
  const used = new Set<number>();
  // Only a place strong enough to count claims its words; a weak look-alike ("يافه" for the
  // "نافه" in "كنافه") must not keep a strong kind on the same word out of the intent.
  const topPlace = places[0] && places[0].score >= STRONG ? places[0] : undefined;
  const topKind = kinds.find(
    (k) => !topPlace || k.tokens.every((t) => !topPlace.tokens.includes(t)),
  );
  for (const m of [topPlace, topKind])
    if (m && m.score >= STRONG) m.tokens.forEach((t) => used.add(t));
  return {
    normalized,
    blocked: isBlocked(normalized, prepared.names),
    cues,
    sentence: tokenize(normalized).length >= 4 || /[?؟]/.test(query),
    places,
    kinds,
    unmatched: content.filter((_, i) => !used.has(i)),
    content,
    typed: content.map((t) => typed.get(t) ?? t),
  };
}
