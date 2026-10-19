import type { Locale } from "@darb/core";

/** /helpers… (Hebrew), /ar/helpers…, /en/helpers… → the locale and the path after "helpers". */
export function helperRoute(pathname: string): { locale: Locale; rest: string } | null {
  const m = /^\/(?:(ar|en)\/)?helpers(\/.*)?$/.exec(pathname);
  return m ? { locale: (m[1] ?? "he") as Locale, rest: m[2] ?? "" } : null;
}

/** The helper app's public URL: its scope and start page are helperHref(locale). */
export function helperHref(locale: Locale, path = ""): string {
  return `${locale === "he" ? "" : `/${locale}`}/helpers${path}`;
}

/** The helper app's own web manifest, one per locale (outside the app's scope, like an API). */
export function helperManifestHref(locale: Locale): string {
  return `/api/helpers/manifest/${locale}`;
}
