import type { Localized } from "@darb/core";

export const text = (fd: FormData, key: string): string => String(fd.get(key) ?? "").trim();
export const lines = (fd: FormData, key: string): string[] =>
  text(fd, key)
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== "");
export const localized = (fd: FormData, key: string): Localized =>
  Object.fromEntries(
    (["he", "ar", "en"] as const).flatMap((l) => {
      const v = text(fd, `${key}.${l}`);
      return v ? [[l, v]] : [];
    }),
  );
export const numberOrNull = (fd: FormData, key: string): number | null => {
  const v = text(fd, key);
  return v === "" ? null : Number(v);
};
const orNull = (v: string) => (v === "" ? null : v);

export function placeFields(fd: FormData) {
  return {
    name: localized(fd, "name"),
    aliases: lines(fd, "aliases"),
    lat: Number(text(fd, "lat")),
    lng: Number(text(fd, "lng")),
    population: numberOrNull(fd, "population"),
    status: text(fd, "status"),
  };
}

export function sectorFields(fd: FormData) {
  return {
    name: localized(fd, "name"),
    tagline: localized(fd, "tagline"),
    accent: text(fd, "accent").toLowerCase(),
    order: Number(text(fd, "order")),
  };
}

export function kindFields(fd: FormData) {
  return {
    sectorId: text(fd, "sectorId"),
    parentKindId: orNull(text(fd, "parentKindId")),
    name: localized(fd, "name"),
    synonyms: {
      he: lines(fd, "synonyms.he"),
      ar: lines(fd, "synonyms.ar"),
      en: lines(fd, "synonyms.en"),
    },
    template: text(fd, "template"),
    attributes: lines(fd, "attributes"),
    icon: orNull(text(fd, "icon")),
    order: Number(text(fd, "order")),
    status: text(fd, "status"),
  };
}

export function planFields(fd: FormData) {
  return {
    name: localized(fd, "name"),
    tagline: localized(fd, "tagline"),
    monthly: numberOrNull(fd, "monthly"),
    setup: numberOrNull(fd, "setup"),
    priceNote: localized(fd, "priceNote"),
    features: {
      he: lines(fd, "features.he"),
      ar: lines(fd, "features.ar"),
      en: lines(fd, "features.en"),
    },
    highlighted: fd.get("highlighted") === "on",
    ctaLabel: localized(fd, "ctaLabel"),
    ctaHref: text(fd, "ctaHref"),
    finePrint: localized(fd, "finePrint"),
    order: Number(text(fd, "order")),
    status: text(fd, "status"),
  };
}

export function zodErrors(error: {
  issues: { path: (string | number)[]; message: string }[];
}): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
}

/** JSON with sorted object keys, so { he, en } and { en, he } compare equal. */
const stable = (v: unknown): string =>
  JSON.stringify(v, (_k, x: unknown) =>
    x && typeof x === "object" && !Array.isArray(x)
      ? Object.fromEntries(
          Object.entries(x as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b)),
        )
      : x,
  );

/**
 * The PATCH body: only what the admin actually changed. The audit trail then names the real
 * fields, and an unchanged field (a kind's sector, a business's tier) is never re-sent.
 */
export function changedOnly<T extends Record<string, unknown>>(
  patch: T,
  current: Record<string, unknown>,
): Partial<T> {
  return Object.fromEntries(
    Object.entries(patch).filter(([k, v]) => stable(v) !== stable(current[k])),
  ) as Partial<T>;
}
