import type { Locale, Localized } from "@darb/core";
import { pickText } from "@darb/core";
import type { IntentDto, SearchResponseDto } from "@darb/contracts";
import type { StageLevel, StagePlace } from "@darb/stage";
import type { NearbyPlace } from "@/components/NoneYet";
import { href, paths } from "./routes";
import { toRows, type BusinessRowData } from "./rows";
import { searchStage } from "./stage-data";
import type { TaxonomyIndex } from "./taxonomy";

export type ChipType = "place" | "kind" | "openNow" | "delivers" | "nearMe" | "text";
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
}
export interface ViewContext {
  locale: Locale;
  index: TaxonomyIndex;
  names: Map<string, Localized>;
  place: StagePlace | null;
  labels: { openNow: string; delivers: string; nearMe: string };
  kmLabel: (km: number) => string;
}

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
  if (intent.nearMe) chips.push({ id: "nearMe", type: "nearMe", label: ctx.labels.nearMe });
  if (intent.freeText) chips.push({ id: "text", type: "text", label: `“${intent.freeText}”` });
  return chips;
}

export function removeChip(intent: IntentDto, chipId: string): IntentDto {
  if (chipId.startsWith("place:")) return { ...intent, place: null };
  if (chipId.startsWith("kind:"))
    return { ...intent, kinds: intent.kinds.filter((k) => `kind:${k}` !== chipId) };
  if (chipId === "openNow") return { ...intent, openNow: false };
  if (chipId === "delivers") return { ...intent, attributes: { delivers: false } };
  if (chipId === "nearMe") return { ...intent, nearMe: false };
  if (chipId === "text") return { ...intent, freeText: "" };
  return intent;
}

const NARROW: ChipType[] = ["text", "openNow", "delivers", "nearMe", "kind", "place"];
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
        ? res.nearest.map((p) => ({
            key: p.slug,
            name: pickText(p.name, ctx.locale),
            href: href(ctx.locale, paths.kind(p.slug, sector.slug, kind.slug)),
            distance: ctx.kmLabel(p.distanceKm),
          }))
        : [],
    narrowest: rows.length === 0 ? narrowestChip(chips) : null,
  };
}
