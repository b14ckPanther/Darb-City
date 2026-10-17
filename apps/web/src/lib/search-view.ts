import type { Locale, Localized } from "@darb/core";
import { pickText } from "@darb/core";
import type { IntentDto, SearchItemDto, SearchResponseDto } from "@darb/contracts";
import { detectCues, matchKey, normalize } from "@darb/search-text";
import type { StageLevel, StagePlace } from "@darb/stage";
import type { NearbyPlace } from "@/components/NoneYet";
import { href, paths } from "./routes";
import { toRows, type BusinessRowData } from "./rows";
import { searchStage } from "./stage-data";
import type { TaxonomyIndex } from "./taxonomy";

export type ChipType =
  "place" | "kind" | "items" | "openNow" | "delivers" | "glutenFree" | "nearMe" | "text";
export interface Chip {
  id: string;
  type: ChipType;
  label: string;
}
export interface SearchView {
  status: "ok" | "blocked";
  q: string;
  queryId: string | null;
  intent: IntentDto;
  needsLocation: boolean;
  chips: Chip[];
  rows: BusinessRowData[];
  stage: StageLevel;
  nearest: NearbyPlace[];
  narrowest: Chip | null;
  /** Open now emptied the list: the same kind, open or closed (in the place, else nationwide). */
  withoutOpenNow: { label: string; href: string } | null;
  /**
   * Nothing matched where asked: one honest line above what came instead (the nearest matches
   * beyond the place, or related businesses that meet every must).
   */
  fallback: { type: "wider" | "related"; line: string } | null;
}
export interface ViewContext {
  locale: Locale;
  index: TaxonomyIndex;
  names: Map<string, Localized>;
  place: StagePlace | null;
  /** The searched place is not live yet: it has no kind lists to link. */
  placeSoon?: boolean;
  labels: {
    openNow: string;
    delivers: string;
    nearMe: string;
    glutenFree: string;
    kindInPlace: string; // with {kind} and {place}
    kindNationwide: string; // with {kind}
    thingGlutenFree: string; // with {thing}
    searchWider: string; // with {thing}, {place}, {name}, {where}, {distance}
    searchWiderNear: string; // with {thing}, {name}, {where}, {distance}
    searchRelated: string; // with {thing}
  };
  kmLabel: (km: number) => string;
}

/** Each language's own quotation marks, as in its messages ("Search for „…”", «…»). */
const QUOTE: Record<Locale, (text: string) => string> = {
  he: (s) => `„${s}”`,
  ar: (s) => `«${s}»`,
  en: (s) => `“${s}”`,
};

export function chipsFor(intent: IntentDto, ctx: ViewContext): Chip[] {
  const chips: Chip[] = [];
  if (intent.place) {
    const name = ctx.names.get(intent.place);
    chips.push({
      id: `place:${intent.place}`,
      type: "place",
      label: name ? pickText(name, ctx.locale) : (ctx.place?.name ?? intent.place),
    });
  }
  for (const slug of intent.kinds) {
    const kind = ctx.index.kindBySlug.get(slug);
    if (kind)
      chips.push({ id: `kind:${slug}`, type: "kind", label: pickText(kind.name, ctx.locale) });
  }
  // The thing searched inside every card, as the person wrote it (its gloss stays unseen).
  const item = intent.items[0];
  if (item) chips.push({ id: "items", type: "items", label: QUOTE[ctx.locale](item) });
  if (intent.openNow) chips.push({ id: "openNow", type: "openNow", label: ctx.labels.openNow });
  if (intent.attributes.delivers)
    chips.push({ id: "delivers", type: "delivers", label: ctx.labels.delivers });
  if (intent.dietary.includes("gluten_free"))
    chips.push({ id: "glutenFree", type: "glutenFree", label: ctx.labels.glutenFree });
  if (intent.nearMe) chips.push({ id: "nearMe", type: "nearMe", label: ctx.labels.nearMe });
  // Free text the item already says is not a second chip.
  if (intent.freeText && !(item && normalize(item).includes(normalize(intent.freeText))))
    chips.push({ id: "text", type: "text", label: QUOTE[ctx.locale](intent.freeText) });
  return chips;
}

export function removeChip(intent: IntentDto, chipId: string): IntentDto {
  if (chipId.startsWith("place:")) return { ...intent, place: null };
  if (chipId.startsWith("kind:"))
    return { ...intent, kinds: intent.kinds.filter((k) => `kind:${k}` !== chipId) };
  if (chipId === "items") return { ...intent, items: [] };
  if (chipId === "openNow") return { ...intent, openNow: false };
  if (chipId === "delivers") return { ...intent, attributes: { delivers: false } };
  if (chipId === "glutenFree")
    return { ...intent, dietary: intent.dietary.filter((d) => d !== "gluten_free") };
  if (chipId === "nearMe") return { ...intent, nearMe: false };
  if (chipId === "text") return { ...intent, freeText: "" };
  return intent;
}

const NARROW: ChipType[] = [
  "text",
  "items",
  "openNow",
  "delivers",
  "glutenFree",
  "nearMe",
  "kind",
  "place",
];
export function narrowestChip(chips: readonly Chip[]): Chip | null {
  for (const type of NARROW) {
    const chip = chips.filter((c) => c.type === type).at(-1);
    if (chip) return chip;
  }
  return null;
}

const fill = (template: string, vars: Record<string, string>) =>
  template.replace(/\{(\w+)\}/g, (all, key: string) => vars[key] ?? all);

/** The asked thing in words: "gluten-free shawarma" when the diet is a must. */
function thingOf(text: string, intent: IntentDto, ctx: ViewContext): string {
  const saysIt = detectCues(normalize(text)).cues.glutenFree;
  return intent.mustHave.includes("gluten_free") && !saysIt
    ? fill(ctx.labels.thingGlutenFree, { thing: text })
    : text;
}

/** The matched thing on a row, and the key that highlights it on the card (`?hl=`). */
function matchedOf(item: SearchItemDto, intent: IntentDto, ctx: ViewContext) {
  if (!item.matched) return null;
  const label = pickText(item.matched.label, ctx.locale);
  const context = item.matched.context ? pickText(item.matched.context, ctx.locale) : "";
  const keyed = item.matched.label.en || item.matched.label.he || item.matched.label.ar || label;
  return {
    label: thingOf(label, intent, ctx),
    context: context && context !== label ? context : null,
    key: matchKey(keyed),
  };
}

function fallbackLine(
  res: SearchResponseDto,
  rows: readonly BusinessRowData[],
  ctx: ViewContext,
): SearchView["fallback"] {
  if (res.status !== "ok" || !res.fallback || rows.length === 0) return null;
  const intent = res.intent;
  const kind = intent.kinds[0] ? ctx.index.kindBySlug.get(intent.kinds[0]) : undefined;
  const asked =
    intent.items[0] || intent.freeText || (kind ? pickText(kind.name, ctx.locale) : "") || "";
  if (!asked) return null;
  const thing = thingOf(asked, intent, ctx);
  if (res.fallback === "related")
    return { type: "related", line: fill(ctx.labels.searchRelated, { thing }) };
  const first = res.items[0]!;
  const where = ctx.names.get(first.placeSlug);
  const vars = {
    thing,
    place: ctx.place?.name ?? "",
    name: rows[0]!.name,
    where: where ? pickText(where, ctx.locale) : "",
    distance: first.distanceKm === undefined ? "" : ctx.kmLabel(first.distanceKm),
  };
  const template = ctx.place ? ctx.labels.searchWider : ctx.labels.searchWiderNear;
  // A part a fact is missing for ("Akko" unknown) is left out, never shown empty.
  const line = fill(template, vars)
    .replace(/(,|،)\s*(?=(,|،|$))/gu, "")
    .trim();
  return { type: "wider", line };
}

export function toSearchView(res: SearchResponseDto, q: string, ctx: ViewContext): SearchView {
  const strict = res.intent.mustHave.includes("gluten_free");
  const rows = toRows(res.items, {
    locale: ctx.locale,
    index: ctx.index,
    names: ctx.names,
    here: null,
    kmLabel: ctx.kmLabel,
  }).map((row, i) => {
    const item = res.items.find((b) => `${b.placeSlug}/${b.slug}` === row.key) ?? res.items[i]!;
    const matched = matchedOf(item, res.intent, ctx);
    return {
      ...row,
      // The matched thing is highlighted on the card it opens (never the raw query).
      ...(matched
        ? {
            href: `${row.href}?${new URLSearchParams({ hl: matched.key })}`,
            matched: { label: matched.label, context: matched.context },
          }
        : {}),
      strictGlutenFree: strict && row.glutenFree,
    };
  });
  const chips = res.status === "blocked" ? [] : chipsFor(res.intent, ctx);
  const kind = res.intent.kinds[0] ? ctx.index.kindBySlug.get(res.intent.kinds[0]) : undefined;
  const sector = kind ? ctx.index.sectorById.get(kind.sectorId) : undefined;
  const kindName = kind ? pickText(kind.name, ctx.locale) : "";
  const placeName = ctx.place?.name ?? "";
  const withoutOpenNow =
    res.status === "ok" && rows.length === 0 && res.intent.openNow && kind && sector
      ? res.intent.place && ctx.place
        ? ctx.placeSoon
          ? null
          : {
              label: ctx.labels.kindInPlace
                .replace("{kind}", () => kindName)
                .replace("{place}", () => placeName),
              href: href(ctx.locale, paths.kind(res.intent.place, sector.slug, kind.slug)),
            }
        : {
            label: ctx.labels.kindNationwide.replace("{kind}", () => kindName),
            href: href(ctx.locale, paths.nationalKind(kind.slug)),
          }
      : null;
  return {
    status: res.status,
    q,
    queryId: res.queryId,
    intent: res.intent,
    needsLocation: res.needsLocation,
    chips,
    rows,
    stage: searchStage(ctx.place, rows),
    nearest:
      kind && sector
        ? // The searched place is the one that came up empty: never offer it as "nearest".
          res.nearest
            .filter((p) => p.slug !== res.intent.place)
            .map((p) => ({
              key: p.slug,
              name: pickText(p.name, ctx.locale),
              // A soon place has no kind lists yet: its own page says it is coming.
              href: href(
                ctx.locale,
                p.status === "soon"
                  ? paths.place(p.slug)
                  : paths.kind(p.slug, sector.slug, kind.slug),
              ),
              distance: ctx.kmLabel(p.distanceKm),
            }))
        : [],
    narrowest: rows.length === 0 ? narrowestChip(chips) : null,
    withoutOpenNow,
    fallback: fallbackLine(res, rows, ctx),
  };
}

/*
 * Chip edits live in the URL (fix round 1), so a reload or a shared link shows the same results
 * without asking the model again: `chips` lists the chips that are left, by the same ids as
 * `data-chip` (place:<slug>, kind:<slug>, items, openNow, delivers, glutenFree, nearMe, text),
 * `text` carries the free text when its chip is kept, and `item` (repeated) the asked things.
 * No `chips` means the query was never edited.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_KINDS = 5; // IntentSchema
const MAX_TEXT = 120; // IntentSchema
const MAX_ITEMS = 5; // IntentSchema
const MAX_ITEM = 60; // IntentSchema

export function editedHref(locale: Locale, q: string, intent: IntentDto): string {
  const chips = [
    ...(intent.place ? [`place:${intent.place}`] : []),
    ...intent.kinds.map((k) => `kind:${k}`),
    ...(intent.items.length ? ["items"] : []),
    ...(intent.openNow ? ["openNow"] : []),
    ...(intent.attributes.delivers ? ["delivers"] : []),
    ...(intent.dietary.includes("gluten_free") ? ["glutenFree"] : []),
    ...(intent.nearMe ? ["nearMe"] : []),
    ...(intent.freeText ? ["text"] : []),
  ];
  const text = intent.freeText ? `&${new URLSearchParams({ text: intent.freeText })}` : "";
  const items = intent.items.length
    ? `&${new URLSearchParams(intent.items.slice(0, MAX_ITEMS).map((i) => ["item", i]))}`
    : "";
  // Chip ids are slugs, colons and commas: left as they are, so the URL stays readable.
  return `${href(locale, paths.search())}?${new URLSearchParams({ q })}&chips=${chips.join(",")}${text}${items}`;
}

export function intentFromUrl(
  chips: string | undefined,
  text: string | undefined,
  items: readonly string[] = [],
): IntentDto | null {
  if (chips === undefined) return null;
  const intent: IntentDto = {
    kinds: [],
    place: null,
    nearMe: false,
    openNow: false,
    attributes: { delivers: false },
    dietary: [],
    freeText: "",
    items: [],
    mustHave: [],
    niceToHave: [],
  };
  for (const id of chips.split(",")) {
    const [type, slug = ""] = id.split(":");
    if (type === "place" && SLUG.test(slug)) intent.place ??= slug;
    else if (type === "kind" && SLUG.test(slug) && !intent.kinds.includes(slug)) {
      if (intent.kinds.length < MAX_KINDS) intent.kinds.push(slug);
    } else if (id === "openNow") intent.openNow = true;
    else if (id === "delivers") intent.attributes.delivers = true;
    else if (id === "glutenFree" && !intent.dietary.includes("gluten_free"))
      intent.dietary.push("gluten_free");
    else if (id === "nearMe") intent.nearMe = true;
    else if (id === "text") intent.freeText = (text ?? "").trim().slice(0, MAX_TEXT);
    else if (id === "items")
      intent.items = items
        .map((i) => i.trim().slice(0, MAX_ITEM))
        .filter(Boolean)
        .slice(0, MAX_ITEMS);
  }
  return intent;
}
