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
};
