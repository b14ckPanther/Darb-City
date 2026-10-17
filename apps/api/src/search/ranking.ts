import { RANKING } from "./ranking.config.js";
import type { Candidate } from "./retrieval.repository.js";

export interface Ranked extends Candidate {
  relevance: number;
  score: number;
}

const cmp = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);

/** Features that are unknown for every candidate (no text, no vector, no point) carry no weight. */
export function rank(candidates: Candidate[], config = RANKING): Ranked[] {
  const w = config.weights;
  const hasText = candidates.some((c) => c.text > 0);
  const hasVector = candidates.some((c) => c.vector > 0);
  const hasDistance = candidates.some((c) => c.km !== null);
  // Deep search only: kinds lift rather than filter, so kind match is one more feature.
  const hasKind = candidates.some((c) => c.kind !== undefined);
  const total =
    (hasText ? w.text : 0) +
    (hasVector ? w.vector : 0) +
    (hasDistance ? w.distance : 0) +
    w.completeness +
    (hasKind ? config.kindWeight : 0);
  return (
    candidates
      .map((c) => {
        const distance = c.km === null ? 0 : 1 / (1 + c.km / config.distanceScaleKm);
        const sum =
          (hasText ? w.text * c.text : 0) +
          (hasVector ? w.vector * c.vector : 0) +
          (hasDistance ? w.distance * distance : 0) +
          w.completeness * c.completeness +
          (hasKind ? config.kindWeight * (c.kind ?? 0) : 0);
        const relevance = sum / total;
        const boost = Math.min(config.tierBoost[c.row.tier] ?? 0, config.tierCap);
        const demo = hasKind && c.row.tier === "example" ? config.examplePenalty : 0;
        return {
          ...c,
          relevance,
          score: relevance + boost - demo + config.niceBoost * (c.nice ?? 0),
        };
      })
      // Slugs repeat across places (one chain, many towns), so the id breaks the last tie.
      .sort((a, b) => b.score - a.score || cmp(a.row.slug, b.row.slug) || cmp(a.row.id, b.row.id))
      .slice(0, config.limit)
  );
}
