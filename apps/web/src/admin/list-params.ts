import { one, withParams, type SearchParams } from "./params";

export type ListState = Record<string, string | undefined>;

/** The list's state from the URL: only the keys it knows, first value each, empties dropped. */
export function readList(sp: SearchParams, keys: readonly string[]): ListState {
  return Object.fromEntries(keys.map((k) => [k, one(sp[k])]));
}

/** The 1-based page in the URL, never below 1 (or past the API's limit). */
export function pageOf(sp: SearchParams): number {
  const n = Number(one(sp.page));
  return Number.isInteger(n) && n >= 1 ? Math.min(n, 2000) : 1;
}

/**
 * The list's address with some values changed. Any change other than the page itself starts again
 * from page 1, so a new filter never lands on an empty page 7.
 */
export function listHref(base: string, state: ListState, change: ListState): string {
  const next = { ...state, ...change };
  if (!("page" in change)) delete next.page;
  if (next.page === "1") delete next.page;
  return withParams(base, next);
}

/** The sort a column header links to: the same column flips, another starts at its natural way. */
export function sortHref(
  base: string,
  state: ListState,
  column: string,
  natural: "asc" | "desc",
): string {
  const same = state.sort === column;
  const dir = same ? ((state.dir ?? natural) === "asc" ? "desc" : "asc") : natural;
  return listHref(base, state, { sort: column, dir });
}

/** aria-sort for a column header, or undefined when the list is not sorted by it. */
export function ariaSort(
  state: ListState,
  column: string,
  natural: "asc" | "desc",
  isDefault = false,
): "ascending" | "descending" | undefined {
  if (state.sort !== column && !(isDefault && !state.sort)) return undefined;
  return (state.dir ?? natural) === "asc" ? "ascending" : "descending";
}
