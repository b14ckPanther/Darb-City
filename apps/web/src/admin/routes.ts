import type { Locale } from "@darb/core";

/** /admin… (Hebrew), /ar/admin…, /en/admin… → the locale and the path after "admin". */
export function adminRoute(pathname: string): { locale: Locale; rest: string } | null {
  const m = /^\/(?:(ar|en)\/)?admin(\/.*)?$/.exec(pathname);
  return m ? { locale: (m[1] ?? "he") as Locale, rest: m[2] ?? "" } : null;
}

export function adminHref(locale: Locale, path = ""): string {
  return `${locale === "he" ? "" : `/${locale}`}/admin${path}`;
}

const LISTS = {
  place: "places",
  sector: "sectors",
  kind: "kinds",
  business: "businesses",
  // Plans and texts are never taken down (no write of theirs is immediate); listed for the types.
  plan: "plans",
  text: "plans/texts",
} as const;

/**
 * Where a takedown's outcome is shown: the entity's own page, or its list after a delete. `stale`
 * adds the flag that shows the "public pages did not confirm" warning with its Retry button.
 */
export function takedownHref(
  locale: Locale,
  entity: keyof typeof LISTS,
  id: string,
  back: "page" | "list",
  stale: boolean,
): string {
  const list = `/${LISTS[entity]}`;
  const flag = encodeURIComponent(id);
  if (back === "list") return adminHref(locale, stale ? `${list}?stale=${flag}` : list);
  return adminHref(locale, `${list}/${flag}${stale ? "?stale=1" : ""}`);
}
