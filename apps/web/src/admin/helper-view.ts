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

/** The caps on offer on a helper's card, as the form sends them ("none" is no cap). */
export const LIMIT_CHOICES = ["150", "500", "none"] as const;
export type LimitChoice = (typeof LIMIT_CHOICES)[number];
/** Which choice a helper's cap shows as (anything from 500 up reads as 500). */
export const limitChoice = (dailyLimit: number | null): LimitChoice =>
  dailyLimit === null ? "none" : dailyLimit >= 500 ? "500" : "150";
