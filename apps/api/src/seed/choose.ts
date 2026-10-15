import type { SeedBusiness } from "@darb/seed";

/**
 * SEED_SHOWROOM=0 seeds only the real clients. The loader then suspends the seed-owned showroom
 * examples already in the database; running again without the flag brings them back.
 */
export function pickBusinesses(
  env: Record<string, string | undefined>,
  lists: { all: () => SeedBusiness[]; real: () => SeedBusiness[] },
): SeedBusiness[] {
  return env.SEED_SHOWROOM === "0" ? lists.real() : lists.all();
}
