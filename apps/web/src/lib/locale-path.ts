export type LocaleRoute =
  | { action: "next" }
  | { action: "rewrite"; pathname: string }
  | { action: "redirect"; pathname: string };

const PREFIXED = new Set(["ar", "en"]);

/** Hebrew is served unprefixed; `[locale]` is internal. */
export function routeLocale(pathname: string): LocaleRoute {
  const first = pathname.split("/")[1] ?? "";
  if (first === "he") {
    const rest = pathname.slice(3);
    return { action: "redirect", pathname: rest === "" ? "/" : rest };
  }
  if (PREFIXED.has(first)) return { action: "next" };
  return { action: "rewrite", pathname: pathname === "/" ? "/he" : `/he${pathname}` };
}
