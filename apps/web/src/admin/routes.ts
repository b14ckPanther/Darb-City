import type { Locale } from "@darb/core";

/** /admin… (Hebrew), /ar/admin…, /en/admin… → the locale and the path after "admin". */
export function adminRoute(pathname: string): { locale: Locale; rest: string } | null {
  const m = /^\/(?:(ar|en)\/)?admin(\/.*)?$/.exec(pathname);
  return m ? { locale: (m[1] ?? "he") as Locale, rest: m[2] ?? "" } : null;
}

export function adminHref(locale: Locale, path = ""): string {
  return `${locale === "he" ? "" : `/${locale}`}/admin${path}`;
}
