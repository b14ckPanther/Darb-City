import type { LocateHitDto, LocateResultDto } from "@darb/contracts";
import { googleMapsUrl, type LatLng, type Locale } from "@darb/core";
import type { NominatimHit } from "../../join/geocoder.js";
import { pair, readLink } from "../../join/links.js";
import { parseAddress, sameStreet, suffixOf, type ParsedAddress } from "./address.js";
import {
  exactNumber,
  interpolate,
  metres,
  nearestNumber,
  numberText,
  round6,
  type KnownNumber,
} from "./numbers.js";
import type { Box } from "./overpass.js";

/** What the locator needs from the outside world; tests hand it fakes. */
export interface LocatorDeps {
  geocoder: {
    enabled: boolean;
    find(
      query: { street: string; city?: string } | { q: string },
      locale: Locale,
      near?: LatLng,
    ): Promise<NominatimHit[] | null>;
  };
  overpass: { enabled: boolean; numbers(street: string, box: Box): Promise<KnownNumber[] | null> };
  /** A maps.app.goo.gl link to the long one, or null. */
  resolveShort(url: string): Promise<string | null>;
}

export interface LocateInput {
  query: string;
  locale: Locale;
  /** The town to use when the query names none. */
  town?: string | null;
  /** The business's town's point: answers stay near it while the query names no other town. */
  near?: LatLng | null;
}

/** Two pieces of one street closer than this are one piece. */
const SAME_PART_M = 250;
/** A hit this far from the business's town is some other town's street of that name. */
const NEAR_TOWN_KM = 25;
/** Room around the street's box for houses set back from it, in degrees (about 250 m). */
const PAD = 0.0025;

const miss = (
  reason: "not-found" | "off",
  extra: Partial<LocateResultDto> = {},
): LocateResultDto => ({
  found: null,
  alternatives: [],
  reason,
  address: null,
  googleLink: null,
  ...extra,
});

const at = (p: LatLng): LatLng => ({ lat: round6(p.lat), lng: round6(p.lng) });

/**
 * Find the place, in this order:
 *  1. a Google Maps or Waze link, or "lat, lng": the link's own point ("link");
 *  2. Nominatim's own house with that number ("exact");
 *  3. OpenStreetMap's house numbers on the street: that number, or between the nearest lower
 *     and higher numbers on the same side ("exact", "between");
 *  4. the street itself, each distinct part of it an answer ("street").
 * Nothing here throws: a failure anywhere is a softer answer or not-found.
 */
export class Locator {
  constructor(private readonly deps: LocatorDeps) {}

  async locate(input: LocateInput): Promise<LocateResultDto> {
    const query = input.query.trim();
    const typed = pair(query);
    if (typed)
      return {
        found: { point: at(typed), precision: "link", label: `${typed.lat}, ${typed.lng}` },
        alternatives: [],
        address: null,
        googleLink: null,
      };

    let addressText = query;
    let googleLink: string | null = null;
    const facts = /\s/.test(query) ? null : readLink(query);
    if (facts && (facts.source === "google" || facts.source === "waze")) {
      let read = facts;
      if (facts.short) {
        const long = await this.deps.resolveShort(query).catch(() => null);
        read = (long ? readLink(long) : null) ?? facts;
        googleLink = googleMapsUrl(long ?? query);
      } else if (facts.source === "google") googleLink = googleMapsUrl(query);
      if (read.point)
        return {
          found: {
            point: at(read.point),
            precision: "link",
            label: read.name ?? `${round6(read.point.lat)}, ${round6(read.point.lng)}`,
          },
          alternatives: [],
          address: null,
          googleLink,
        };
      // A link without a point but with a place's name: look the name up instead.
      if (!read.name) return miss("not-found", { googleLink });
      addressText = read.name;
    }

    if (!this.deps.geocoder.enabled) return miss("off", { googleLink });
    const parsed = parseAddress(addressText);
    if (!parsed) return miss("not-found", { googleLink });
    const address = parsed.number ? `${parsed.street} ${parsed.number}` : parsed.street;
    const result = await this.address(parsed, input);
    return { ...result, address: facts ? null : address.slice(0, 200), googleLink };
  }

  private async address(
    parsed: ParsedAddress,
    input: LocateInput,
  ): Promise<Omit<LocateResultDto, "address" | "googleLink">> {
    const city = parsed.town ?? input.town ?? undefined;
    // The business's town keeps answers near it, unless the query names a town of its own.
    const near = parsed.town ? undefined : (input.near ?? undefined);
    const hits = await this.search(parsed, city, input.locale, near);
    if (!hits.length) return { found: null, alternatives: [], reason: "not-found" };

    // 2. Nominatim knows the house itself.
    if (parsed.number && parsed.numeric !== null) {
      const house = hits.find(
        (h) =>
          h.house &&
          h.houseNumber !== null &&
          Number(/\d+/.exec(h.houseNumber)?.[0]) === parsed.numeric &&
          suffixOf(h.houseNumber) === suffixOf(parsed.number!),
      );
      if (house)
        return {
          found: { point: at(house.point), precision: "exact", label: house.label },
          alternatives: [],
        };
    }

    const streets = hits.filter((h) => !h.house && h.road);
    const pieces = streets.length ? streets : hits.filter((h) => h.road);
    if (!pieces.length) return { found: null, alternatives: [], reason: "not-found" };
    const road = pieces[0]!.road!;

    // 3. OpenStreetMap's house numbers on that street.
    let known: KnownNumber[] = [];
    if (parsed.numeric !== null && this.deps.overpass.enabled) {
      const box = boxAround(pieces.filter((p) => p.road && sameStreet(p.road, road)));
      known = (box ? await this.deps.overpass.numbers(road, box).catch(() => null) : null) ?? [];
      const label = (n: string) => `${road} ${n}${pieces[0]!.town ? `, ${pieces[0]!.town}` : ""}`;
      const same = exactNumber(known, parsed.numeric, suffixOf(parsed.number!));
      if (same)
        return {
          found: { point: at(same.point), precision: "exact", label: label(numberText(same)) },
          alternatives: [],
        };
      const between = interpolate(known, parsed.numeric);
      if (between)
        return {
          found: {
            point: between.point,
            precision: "between",
            label: label(parsed.number!),
            between: [numberText(between.lo), numberText(between.hi)],
          },
          alternatives: [],
        };
    }

    // 4. The street: each distinct part of it, the one nearest the asked number first.
    const parts = distinctParts(pieces);
    const answers: (LocateHitDto & { gap: number })[] = parts.map((p) => {
      const near = nearestNumber(known, p.point);
      return {
        point: at(p.point),
        precision: "street",
        label: p.area && parts.length > 1 ? `${p.label} · ${p.area}` : p.label,
        ...(near ? { near: numberText(near) } : {}),
        gap: near && parsed.numeric !== null ? Math.abs(near.n - parsed.numeric) : Infinity,
      };
    });
    const ordered = known.length ? [...answers].sort((a, b) => a.gap - b.gap) : answers;
    const [first, ...rest] = ordered.map(({ gap: _gap, ...hit }) => hit);
    return { found: first!, alternatives: rest.slice(0, 4) };
  }

  /** Structured search for each spelling in turn, then a free search; near the town when known. */
  private async search(
    parsed: ParsedAddress,
    city: string | undefined,
    locale: Locale,
    near: LatLng | undefined,
  ): Promise<NominatimHit[]> {
    const keep = (hits: NominatimHit[] | null) =>
      (hits ?? []).filter((h) => !near || metres(h.point, near) <= NEAR_TOWN_KM * 1000);
    for (const variant of parsed.variants.slice(0, 2)) {
      const street = parsed.number ? `${parsed.number} ${variant}` : variant;
      const hits = keep(await this.deps.geocoder.find({ street, city }, locale, near));
      if (hits.length) return hits;
    }
    const q = [`${parsed.variants[0]}${parsed.number ? ` ${parsed.number}` : ""}`, city]
      .filter(Boolean)
      .join(", ");
    return keep(await this.deps.geocoder.find({ q }, locale, near));
  }
}

/** The street's pieces' boxes as one, padded; null when Nominatim gave none. */
export function boxAround(hits: NominatimHit[]): Box | null {
  const boxes = hits.flatMap((h) => (h.box ? [h.box] : []));
  if (!boxes.length) return null;
  return [
    Math.min(...boxes.map((b) => b[0])) - PAD,
    Math.min(...boxes.map((b) => b[1])) - PAD,
    Math.max(...boxes.map((b) => b[2])) + PAD,
    Math.max(...boxes.map((b) => b[3])) + PAD,
  ];
}

/** Street pieces more than SAME_PART_M apart, in Nominatim's order (the first of each group). */
export function distinctParts(hits: NominatimHit[]): NominatimHit[] {
  const out: NominatimHit[] = [];
  for (const h of hits) if (!out.some((o) => metres(o.point, h.point) < SAME_PART_M)) out.push(h);
  return out;
}
