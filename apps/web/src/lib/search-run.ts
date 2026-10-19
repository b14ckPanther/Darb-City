import type { Locale } from "@darb/core";
import type { IntentDto } from "@darb/contracts";
import { ApiUnavailableError, postResults, postSearch, type SearchCall } from "./api";
import { viewContext } from "./search-context";
import { toSearchView, type SearchView } from "./search-view";

/**
 * Server only: the results for /search. A fresh query runs the full search (lane 1, maybe the
 * model). An edited one (chips in the URL) re-runs retrieval with that intent, never the model; if
 * its kind or place no longer exists, the full search answers instead. Null when smart search
 * cannot answer (down or rate-limited, spec §7): the page shows lane 1 and a retry.
 */
export async function runSearch(input: {
  locale: Locale;
  q: string;
  edited: IntentDto | null;
  ip: string;
  /** The quick first answer (lane 1 and cached answers, no model): `refining` says more comes. */
  instant?: boolean;
}): Promise<(SearchView & { refining: boolean }) | null> {
  const { locale, q, edited, ip, instant } = input;
  try {
    let res: SearchCall | null = edited
      ? await postResults({ q, locale, intent: edited }, ip)
      : null;
    if (!res || res.status === 400)
      res = await postSearch({ q, locale, ...(instant ? { instant: true } : {}) }, ip);
    if (res.status !== 200) return null;
    return {
      ...toSearchView(res.body, q, await viewContext(locale, res.body.intent)),
      refining: res.body.refining ?? false,
    };
  } catch (error) {
    if (error instanceof ApiUnavailableError) return null;
    throw error;
  }
}
