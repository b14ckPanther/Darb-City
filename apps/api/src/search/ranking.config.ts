import type { Tier } from "@darb/core";

/**
 * Spec §5.3: the blend's weights. Changing them must keep ranking.test.ts and the quality set
 * (pnpm --filter @darb/api search:quality) green.
 */
export const RANKING = {
  weights: { text: 0.35, vector: 0.3, distance: 0.2, completeness: 0.15 },
  /** Distance score = 1 / (1 + km / scale): 1 at the door, 0.5 at 3 km. */
  distanceScaleKm: 3,
  tierBoost: { example: 0, basic: 0.01, verified: 0.02, darb: 0.03 } as Record<Tier, number>,
  /** Never above this, so tier can only reorder results of similar relevance. */
  tierCap: 0.03,
  limit: 30,
  /**
   * Deep search (the intent names items): a business of an asked kind gets this much extra
   * weight, so kinds lift results without filtering out a station that has a car wash.
   */
  kindWeight: 0.15,
  /**
   * Deep search mixes kinds, so a showroom example (a demo of its kind) never outranks a real
   * business that offers the asked thing on its own card by kind alone.
   */
  examplePenalty: 0.12,
  /** Per stated wish ("ideally open now") a result meets: a small lift, never a filter. */
  niceBoost: 0.03,
  offerings: {
    /** How much an offering's match counts, by where on the card it comes from. */
    sourceWeight: { item: 1, part: 1, tag: 0.9, tagline: 0.6, kind: 0.8 } as Record<string, number>,
    /** A match on the offering's context or synonyms (not its own name) counts this much. */
    contextWeight: 0.6,
    /** A match by vector alone counts this much of its cosine similarity. */
    vectorWeight: 0.8,
    /** Trigram word similarity an offering's text needs to be a candidate (pg_trgm default 0.6). */
    minWordSimilarity: 0.5,
    /** Offerings whose text is at least this close to the query's vector are candidates too. */
    minVector: 0.5,
    /** Nearest distinct offering texts looked at by vector. */
    vectorPool: 200,
    /** Below this, the best offering is not shown as "the matched thing" on the row. */
    showMatch: 0.5,
  },
};
