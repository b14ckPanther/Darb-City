export type SearchParams = Record<string, string | string[] | undefined>;

export function one(v: string | string[] | undefined): string | undefined {
  const value = Array.isArray(v) ? v[0] : v;
  return value ? value : undefined;
}

export function withParams(href: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams(
    Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])),
  );
  const s = qs.toString().replace(/\+/g, "%20");
  return s ? `${href}?${s}` : href;
}
