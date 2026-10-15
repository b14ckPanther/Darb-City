const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return SLUG.test(value);
}

/** Latin text to a URL slug. Apostrophes vanish ("Ma'alot" → "maalot"); other gaps become "-". */
export function toSlug(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug === "") throw new Error(`Cannot make a slug from "${input}"`);
  return slug;
}

/**
 * First path segments the web app owns. No place, sector or kind may take one of these as its
 * slug, or its page would be shadowed by (or shadow) a route.
 */
export const RESERVED_SLUGS: readonly string[] = [
  "ar",
  "en",
  "he",
  "k",
  "admin",
  "api",
  "for-business",
  "pricing",
  "contact",
  "search",
  "login",
  "register",
  "_next",
  "brand",
  "accessibility",
  "terms",
  "privacy",
];
const RESERVED = new Set(RESERVED_SLUGS);

export function isReservedSlug(value: string): boolean {
  return RESERVED.has(value);
}
