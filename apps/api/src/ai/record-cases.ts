import type { InstantResult } from "@darb/search-text";
import { intentCandidates } from "../search/filters.js";
import type { IntentProvider } from "./intent.js";
import type { RecordedCase } from "./recorded-intent.provider.js";

/**
 * A case the model did not answer while recording. Its old `recorded` stays only so the file still
 * parses; the quality set refuses to run until it is recorded again or fixed by hand.
 */
export const FAILED_SOURCE = "FAILED: no answer when recorded";

/** Decision 4: asks the model every case again and rewrites `recorded` in place. */
export async function recordCases(
  cases: RecordedCase[],
  provider: IntentProvider,
  match: (q: string) => Promise<InstantResult>,
  model: string,
): Promise<{ changed: number; failed: string[] }> {
  let changed = 0;
  const failed: string[] = [];
  for (const c of cases) {
    if (c.expect.blocked) continue;
    const lane1 = await match(c.query);
    const answer = await provider
      .extract(
        { query: c.query, locale: c.locale, candidates: intentCandidates(lane1, c.locale) },
        AbortSignal.timeout(20_000),
      )
      .catch(() => null);
    if (!answer) {
      c.source = FAILED_SOURCE;
      failed.push(`${c.locale} "${c.query}"`);
      continue;
    }
    if (JSON.stringify(answer) !== JSON.stringify(c.recorded)) changed++;
    c.recorded = answer;
    c.source = model;
  }
  return { changed, failed };
}
