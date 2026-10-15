import type { Locale } from "@darb/core";
import {
  matchInstant,
  prepare,
  STRONG,
  type InstantEntry,
  type InstantIndex,
  type Prepared,
} from "@darb/search-text";
import { href, paths } from "@/lib/routes";
import type { SearchLabels, SearchOption } from "./types";

const LOCALE_INDEX: Record<Locale, number> = { he: 0, ar: 1, en: 2 };
const name = (e: InstantEntry, locale: Locale) =>
  e.n[LOCALE_INDEX[locale]] || e.n[2] || e.n[0] || e.n[1];
const LIMIT = 5;

let loading: Promise<Prepared> | null = null;

/** The live index first, then the one built with the app (works with the API down). */
export const INDEX_URLS: readonly string[] = [
  "/api/search/instant",
  process.env.NEXT_PUBLIC_SEARCH_INDEX_URL ?? "",
].filter((u) => u !== "");

async function fetchFirst(urls: readonly string[]): Promise<InstantIndex> {
  let last: unknown = new Error("No index URL");
  for (const url of urls) {
    try {
      const res = await fetch(url);
      // A proxy error page can answer 2xx: only a real index stops the fallback.
      const body = res.ok ? ((await res.json().catch(() => null)) as InstantIndex | null) : null;
      if (body?.v === 1 && Array.isArray(body.places) && Array.isArray(body.kinds)) return body;
      last = new Error(res.ok ? "Not a search index" : String(res.status));
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

/** The instant index (spec §5.2), fetched once per page load. */
export function loadPrepared(urls: readonly string[] = INDEX_URLS): Promise<Prepared> {
  loading ??= fetchFirst(urls)
    .then(prepare)
    .catch((error: unknown) => {
      loading = null; // the next focus tries again
      throw error;
    });
  return loading;
}

/** Tests only: forget the memoized index. */
export function resetPreparedForTests(): void {
  loading = null;
}

export function instantOptions(
  prepared: Prepared,
  query: string,
  locale: Locale,
  labels: SearchLabels,
): SearchOption[] {
  const q = query.trim();
  const search = searchOption(q, locale, labels);
  if (!search) return [];
  const r = matchInstant(prepared, q, { places: LIMIT, kinds: LIMIT });
  const out: SearchOption[] = [];
  const place = r.places[0] && r.places[0].score >= STRONG ? r.places[0] : null;
  const kind = r.kinds.find(
    (k) => k.score >= STRONG && !(place && k.tokens.some((t) => place.tokens.includes(t))),
  );
  if (!r.blocked && place && kind)
    out.push({
      id: `pair:${place.entry.s}/${kind.entry.s}`,
      group: "kinds",
      label: name(kind.entry, locale),
      sublabel: name(place.entry, locale),
      // A soon place has no businesses yet: its own page says so, an empty kind list would not.
      href: href(
        locale,
        place.entry.z
          ? paths.place(place.entry.s)
          : paths.kind(place.entry.s, kind.entry.p, kind.entry.s),
      ),
    });
  if (!r.blocked) {
    for (const p of r.places)
      out.push({
        id: `place:${p.entry.s}`,
        group: "places",
        label: name(p.entry, locale),
        href: href(locale, paths.place(p.entry.s)),
      });
    for (const k of r.kinds)
      out.push({
        id: `kind:${k.entry.s}`,
        group: "kinds",
        label: name(k.entry, locale),
        sublabel: labels.nationwide,
        href: href(locale, paths.nationalKind(k.entry.s)),
      });
  }
  out.push(search);
  return out;
}

/** The last option: the full search page for the text as typed; null for blank text. */
export function searchOption(
  query: string,
  locale: Locale,
  labels: SearchLabels,
): SearchOption | null {
  const q = query.trim();
  if (q === "") return null;
  return {
    id: "search",
    group: "search",
    label: labels.searchFor.replace("{q}", () => q),
    href: `${href(locale, paths.search())}?${new URLSearchParams({ q })}`,
  };
}

/**
 * Options grouped under their headings, each group where its best option ranked: places first,
 * unless a kind in a place ("barber haifa") leads, then the kinds go first.
 */
export function inGroups(options: readonly SearchOption[]): SearchOption[] {
  const order = [...new Set(options.map((o) => o.group))];
  return order.flatMap((group) => options.filter((o) => o.group === group));
}
