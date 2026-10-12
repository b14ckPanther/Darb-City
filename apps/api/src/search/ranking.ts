import { RANKING } from "./ranking.config.js";
import type { Candidate } from "./retrieval.repository.js";

export interface Ranked extends Candidate {
  relevance: number;
  score: number;
}

/** Features that are unknown for every candidate (no text, no vector, no point) carry no weight. */
export function rank(candidates: Candidate[], config = RANKING): Ranked[] {
  const w = config.weights;
  const hasText = candidates.some((c) => c.text > 0);
  const hasVector = candidates.some((c) => c.vector > 0);
  const hasDistance = candidates.some((c) => c.km !== null);
  const total =
    (hasText ? w.text : 0) +
    (hasVector ? w.vector : 0) +
    (hasDistance ? w.distance : 0) +
    w.completeness;
  return candidates
    .map((c) => {
      const distance = c.km === null ? 0 : 1 / (1 + c.km / config.distanceScaleKm);
      const sum =
        (hasText ? w.text * c.text : 0) +
        (hasVector ? w.vector * c.vector : 0) +
        (hasDistance ? w.distance * distance : 0) +
        w.completeness * c.completeness;
      const relevance = sum / total;
      const boost = Math.min(config.tierBoost[c.row.tier] ?? 0, config.tierCap);
      return { ...c, relevance, score: relevance + boost };
    })
    .sort(
      (a, b) =>
        b.score - a.score || (a.row.slug < b.row.slug ? -1 : a.row.slug > b.row.slug ? 1 : 0),
    )
    .slice(0, config.limit);
}
