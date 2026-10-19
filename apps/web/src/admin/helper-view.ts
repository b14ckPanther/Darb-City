import type { AdminHelperDto } from "@darb/contracts";

/** Below this share of decided additions accepted, a helper is marked on the Helpers screen. */
export const LOW_ACCEPTANCE = 0.5;
/** Too few decisions say nothing yet about how careful a helper is. */
export const MIN_DECIDED = 4;

/** The share of a helper's decided additions that were accepted; null before any decision. */
export function acceptance(
  h: Pick<AdminHelperDto, "approved" | "rejected">,
): { percent: number; low: boolean } | null {
  const decided = h.approved + h.rejected;
  if (decided === 0) return null;
  const share = h.approved / decided;
  return {
    percent: Math.round(share * 100),
    low: decided >= MIN_DECIDED && share < LOW_ACCEPTANCE,
  };
}
