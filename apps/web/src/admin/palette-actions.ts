"use server";

import type { AdminSearchDto } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { isLocale } from "@/lib/locale";
import { adminApi } from "./api";
import { at } from "./copy";
import type { PaletteHit } from "./palette";
import { adminHref } from "./routes";
import { mediaThumb } from "./media";

/**
 * The command palette's search: businesses, places, kinds and categories by name, address or
 * phone, already worded for the admin's language. Null when the API did not answer.
 */
export async function paletteSearch(rawLocale: string, q: string): Promise<PaletteHit[] | null> {
  const locale: Locale = isLocale(rawLocale) ? rawLocale : "he";
  const query = q.trim().slice(0, 80);
  if (!query) return [];
  try {
    const res = await (await adminApi()).misc.search({ query: { q: query } });
    if (res.status !== 200) return null;
    return hitsFrom(locale, res.body);
  } catch {
    return null;
  }
}

function hitsFrom(locale: Locale, r: AdminSearchDto): PaletteHit[] {
  const name = (n: Parameters<typeof pickText>[0]) => pickText(n, locale);
  return [
    ...r.businesses.map((b): PaletteHit => ({
      id: `b-${b.id}`,
      group: "paletteBusinesses",
      label: name(b.name),
      sub: name(b.placeName),
      href: adminHref(locale, `/businesses/${b.id}`),
      icon: "store",
      thumb: mediaThumb(b.thumb),
      status: b.status,
    })),
    ...r.places.map((p): PaletteHit => ({
      id: `p-${p.id}`,
      group: "palettePlaces",
      label: name(p.name),
      sub: at(locale, p.status === "live" ? "statusLive" : "statusSoon"),
      href: adminHref(locale, `/places/${p.id}`),
      icon: "pin",
    })),
    ...r.kinds.map((k): PaletteHit => ({
      id: `k-${k.id}`,
      group: "paletteKinds",
      label: name(k.name),
      sub: at(locale, k.status === "active" ? "statusActive" : "statusHidden"),
      href: adminHref(locale, `/kinds/${k.id}`),
      icon: "tag",
    })),
    ...r.sectors.map((s): PaletteHit => ({
      id: `s-${s.id}`,
      group: "paletteSectors",
      label: name(s.name),
      href: adminHref(locale, `/sectors/${s.id}`),
      icon: "grid",
      swatch: s.accent,
    })),
  ];
}
