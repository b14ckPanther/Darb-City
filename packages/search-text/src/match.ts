import { blockedNames, isBlocked } from "./blocked.js";
import { detectCues, type Cues } from "./cues.js";
import { levenshtein } from "./distance.js";
import type { InstantEntry, InstantIndex } from "./instant-index.js";
import { arabiziKey, normalize } from "./normalize.js";
import { STOPWORDS, tokenize, variants } from "./tokens.js";

export interface PreparedEntry {
  entry: InstantEntry;
  terms: string[][];
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
}

export const STRONG = 0.75;

const split = (e: InstantEntry): PreparedEntry => ({
  entry: e,
  terms: e.t.map((t) => t.split(" ")),
  skeletons: e.k.map((k) => k.split(" ")),
});

export function prepare(index: InstantIndex): Prepared {
  return {
    places: index.places.map(split),
    kinds: index.kinds.map(split),
    names: blockedNames([...index.places, ...index.kinds].flatMap((e) => e.t)),
  };
}

/** One query word against one term word: 1 exact, up to 0.9 prefix, 0.8 plural, 0.7 typo. */
export function tokenScore(query: string, term: string): number {
  if (query === term) return 1;
  if (query.length >= 2 && term.startsWith(query)) return 0.6 + 0.3 * (query.length / term.length);
  if (term.length >= 4 && query.startsWith(term) && query.length - term.length <= 2) return 0.8;
  if (query.length >= 4) {
    const max = query.length >= 8 ? 2 : 1;
    if (levenshtein(query, term, max) <= max) return 0.7;
  }
  return 0;
}

interface Word {
  forms: string[];
  skeleton: string | null;
}

/** The best way an entry's term covers some query words; every term word must be covered. */
function scoreEntry(p: PreparedEntry, words: Word[]): { score: number; tokens: number[] } {
  let best = { score: 0, tokens: [] as number[] };
  const tryTerm = (term: string[], useSkeleton: boolean) => {
    const used: number[] = [];
    let total = 0;
    for (const part of term) {
      let partBest = 0;
      let at = -1;
      words.forEach((w, i) => {
        if (used.includes(i)) return;
        const forms = useSkeleton ? (w.skeleton ? [w.skeleton] : []) : w.forms;
        for (const f of forms) {
          const s = tokenScore(f, part);
          if (s > partBest) [partBest, at] = [s, i];
        }
      });
      if (partBest === 0) return;
      used.push(at);
      total += partBest;
    }
    const score = (total / term.length) * (useSkeleton ? 0.95 : 1);
    if (score > best.score) best = { score, tokens: used };
  };
  for (const term of p.terms) tryTerm(term, false);
  if (words.some((w) => w.skeleton)) for (const sk of p.skeletons) tryTerm(sk, true);
  return best;
}

function rank(entries: PreparedEntry[], words: Word[], limit: number): InstantMatch[] {
  const out: InstantMatch[] = [];
  for (const p of entries) {
    const { score, tokens } = scoreEntry(p, words);
    if (score > 0.6) out.push({ entry: p.entry, score: score * (1 + 0.03 * p.entry.w), tokens });
  }
  return out.sort((a, b) => b.score - a.score || (a.entry.s < b.entry.s ? -1 : 1)).slice(0, limit);
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
  const words: Word[] = content.map((t) => ({ forms: variants(t), skeleton: arabiziKey(t) }));
  const places = words.length ? rank(prepared.places, words, limits.places ?? 8) : [];
  const kinds = words.length ? rank(prepared.kinds, words, limits.kinds ?? 12) : [];
  const used = new Set<number>();
  const topPlace = places[0];
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
  };
}
