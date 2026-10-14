import type { Locale, Localized } from "@darb/core";
import { pickText } from "@darb/core";
import type { IntentDto, SearchResponseDto } from "@darb/contracts";
import type { StageLevel, StagePlace } from "@darb/stage";
import type { NearbyPlace } from "@/components/NoneYet";
import { href, paths } from "./routes";
import { toRows, type BusinessRowData } from "./rows";
import { searchStage } from "./stage-data";
import type { TaxonomyIndex } from "./taxonomy";

export type ChipType = "place" | "kind" | "openNow" | "delivers" | "glutenFree" | "nearMe" | "text";
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
  if (intent.openNow) chips.push({ id: "openNow", type: "openNow", label: ctx.labels.openNow });
  if (intent.attributes.delivers)
    chips.push({ id: "delivers", type: "delivers", label: ctx.labels.delivers });
  if (intent.dietary.includes("gluten_free"))
    chips.push({ id: "glutenFree", type: "glutenFree", label: ctx.labels.glutenFree });
  if (intent.nearMe) chips.push({ id: "nearMe", type: "nearMe", label: ctx.labels.nearMe });
  if (intent.freeText)
    chips.push({ id: "text", type: "text", label: QUOTE[ctx.locale](intent.freeText) });
  return chips;
}

export function removeChip(intent: IntentDto, chipId: string): IntentDto {
  if (chipId.startsWith("place:")) return { ...intent, place: null };
  if (chipId.startsWith("kind:"))
    return { ...intent, kinds: intent.kinds.filter((k) => `kind:${k}` !== chipId) };
  if (chipId === "openNow") return { ...intent, openNow: false };
  if (chipId === "delivers") return { ...intent, attributes: { delivers: false } };
  if (chipId === "glutenFree")
    return { ...intent, dietary: intent.dietary.filter((d) => d !== "gluten_free") };
  if (chipId === "nearMe") return { ...intent, nearMe: false };
  if (chipId === "text") return { ...intent, freeText: "" };
  return intent;
}

const NARROW: ChipType[] = ["text", "openNow", "delivers", "glutenFree", "nearMe", "kind", "place"];
export function narrowestChip(chips: readonly Chip[]): Chip | null {
  for (const type of NARROW) {
    const chip = chips.filter((c) => c.type === type).at(-1);
    if (chip) return chip;
  }
  return null;
}

export function toSearchView(res: SearchResponseDto, q: string, ctx: ViewContext): SearchView {
  const rows = toRows(res.items, {
    locale: ctx.locale,
    index: ctx.index,
    names: ctx.names,
    here: null,
    kmLabel: ctx.kmLabel,
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
  };
}

/*
 * Chip edits live in the URL (fix round 1), so a reload or a shared link shows the same results
 * without asking the model again: `chips` lists the chips that are left, by the same ids as
 * `data-chip` (place:<slug>, kind:<slug>, openNow, delivers, glutenFree, nearMe, text), and `text` carries the
 * free text when its chip is kept. No `chips` means the query was never edited.
 */
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MAX_KINDS = 5; // IntentSchema
const MAX_TEXT = 120; // IntentSchema

export function editedHref(locale: Locale, q: string, intent: IntentDto): string {
  const chips = [
    ...(intent.place ? [`place:${intent.place}`] : []),
    ...intent.kinds.map((k) => `kind:${k}`),
    ...(intent.openNow ? ["openNow"] : []),
    ...(intent.attributes.delivers ? ["delivers"] : []),
    ...(intent.dietary.includes("gluten_free") ? ["glutenFree"] : []),
    ...(intent.nearMe ? ["nearMe"] : []),
    ...(intent.freeText ? ["text"] : []),
  ];
  const text = intent.freeText ? `&${new URLSearchParams({ text: intent.freeText })}` : "";
  // Chip ids are slugs, colons and commas: left as they are, so the URL stays readable.
  return `${href(locale, paths.search())}?${new URLSearchParams({ q })}&chips=${chips.join(",")}${text}`;
}

export function intentFromUrl(
  chips: string | undefined,
  text: string | undefined,
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
  }
  return intent;
}
