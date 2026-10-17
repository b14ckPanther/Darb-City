import type { Locale, Localized } from "@darb/core";
import { normalize, splitList, wordySegments } from "@darb/search-text";

/**
 * Deep search: the things a business offers, read from everything on its card (a full Darb app
 * screen or a business card with a services list), so a search for "shawarma" finds the
 * restaurant whose sandwiches list it even when its kind is "restaurants".
 */
export type OfferingSource = "item" | "part" | "tag" | "tagline" | "kind";

export interface Offering {
  /** Where on the card it comes from, unique per business ("items.0.meta.2"). */
  ref: string;
  source: OfferingSource;
  label: Localized;
  /** What it belongs to: the item for a part of its list, the list's heading when it has one. */
  context: Localized | null;
  /** The label, normalized, in every language. */
  labelText: string;
  /** The label in each language on its own (and a kind's synonyms), normalized. */
  labelForms: string[];
  /** The label, its context and (for a kind) its synonyms, normalized, in every language. */
  text: string;
  /** What is embedded: the same text for the same offering on any card (shared vectors). */
  embedText: string;
}

type Synonyms = { he: string[]; ar: string[]; en: string[] };
export interface OfferingSourceData {
  tagline: Localized;
  experience: Record<string, unknown>;
  kinds: { slug: string; name: Localized; synonyms: Synonyms }[];
}

const LOCALES: Locale[] = ["he", "ar", "en"];
/** Never more per business: a long menu still indexes, a broken one cannot flood the table. */
export const MAX_OFFERINGS = 60;

const values = (l: Localized) =>
  LOCALES.map((k) => l[k]).filter((v): v is string => !!v && v.trim() !== "");
const join = (parts: string[]) => [...new Set(parts.map(normalize).filter(Boolean))].join(" ");

const isLocalized = (v: unknown): v is Localized =>
  !!v &&
  typeof v === "object" &&
  !Array.isArray(v) &&
  LOCALES.some((k) => typeof (v as Record<string, unknown>)[k] === "string");

const clean = (l: Localized): Localized | null => {
  const out: Localized = {};
  for (const k of LOCALES) {
    const v = l[k]?.trim();
    if (v) out[k] = v;
  }
  return Object.keys(out).length > 0 ? out : null;
};

/** A meta line without its price, time or percentage segments; null when nothing is left. */
function wordsOnly(meta: Localized): Localized | null {
  const out: Localized = {};
  for (const k of LOCALES) {
    const kept = wordySegments(meta[k] ?? "");
    if (kept) out[k] = kept;
  }
  return clean(out);
}

/**
 * A meta line's parts, aligned across languages when every language lists the same number of
 * things (the seed and the admin write translations side by side); otherwise each language's
 * parts stand alone.
 */
function metaParts(meta: Localized): { label: Localized; head: Localized | null }[] {
  const byLocale = LOCALES.flatMap((locale) => {
    const text = meta[locale]?.trim();
    if (!text) return [];
    const flat = splitList(text).flatMap((s) => s.parts.map((part) => ({ part, head: s.head })));
    return [{ locale, flat }];
  });
  if (byLocale.length === 0) return [];
  const count = byLocale[0]!.flat.length;
  if (byLocale.every((l) => l.flat.length === count))
    return Array.from({ length: count }, (_, i) => {
      const label: Localized = {};
      const head: Localized = {};
      for (const { locale, flat } of byLocale) {
        label[locale] = flat[i]!.part;
        if (flat[i]!.head) head[locale] = flat[i]!.head!;
      }
      return { label, head: clean(head) };
    });
  return byLocale.flatMap(({ locale, flat }) =>
    flat.map(({ part, head }) => ({
      label: { [locale]: part } as Localized,
      head: head ? ({ [locale]: head } as Localized) : null,
    })),
  );
}

function make(
  ref: string,
  source: OfferingSource,
  label: Localized,
  context: Localized | null,
  extra: string[] = [],
  /** Other names it goes by, as exact as its label (a kind's synonyms). */
  aliases: string[] = [],
): Offering {
  const labels = values(label);
  const contexts = context ? values(context) : [];
  return {
    ref,
    source,
    label,
    context,
    labelText: join(labels),
    labelForms: [...new Set([...labels, ...aliases].map(normalize).filter(Boolean))],
    text: join([...labels, ...contexts, ...extra]),
    embedText: [labels.join(" / "), contexts.join(" / ")].filter(Boolean).join(" — "),
  };
}

export function extractOfferings(b: OfferingSourceData): Offering[] {
  const out: Offering[] = [];
  const exp = b.experience;
  const items = Array.isArray(exp["items"]) ? (exp["items"] as unknown[]) : [];
  items.forEach((raw, i) => {
    if (!raw || typeof raw !== "object") return;
    const { label: rawLabel, meta: rawMeta } = raw as { label?: unknown; meta?: unknown };
    const label = isLocalized(rawLabel) ? clean(rawLabel) : null;
    const meta = isLocalized(rawMeta) ? clean(rawMeta) : null;
    if (!label) return;
    // The item itself, with its meta line as context ("Meals" with "sandwiches: ..."), minus
    // what is not words ("₪45 · inside and out" is "inside and out").
    out.push(make(`items.${i}`, "item", label, meta ? wordsOnly(meta) : null));
    if (!meta) return;
    metaParts(meta).forEach(({ label: part, head }, j) => {
      // "Shawarma" keeps "Challah and laffa sandwiches" when the line names them, else "Meals".
      const context = head ?? label;
      out.push(make(`items.${i}.meta.${j}`, "part", part, context, head ? values(label) : []));
    });
  });
  const tags = Array.isArray(exp["tags"]) ? (exp["tags"] as unknown[]) : [];
  tags.forEach((raw, i) => {
    const tag = isLocalized(raw) ? clean(raw) : null;
    if (tag) out.push(make(`tags.${i}`, "tag", tag, null));
  });
  const tagline = clean(b.tagline);
  if (tagline) out.push(make("tagline", "tagline", tagline, null));
  for (const kind of b.kinds) {
    const name = clean(kind.name);
    const synonyms = [...kind.synonyms.he, ...kind.synonyms.ar, ...kind.synonyms.en];
    if (name) out.push(make(`kind:${kind.slug}`, "kind", name, null, synonyms, synonyms));
  }
  // The same thing twice on one card ("Delivery" as a tag and an item) is one offering: the
  // first, which is the more specific (items come before tags, tags before the tagline).
  const seen = new Set<string>();
  return out
    .filter((o) => {
      if (o.labelText === "" || seen.has(o.labelText)) return false;
      seen.add(o.labelText);
      return true;
    })
    .slice(0, MAX_OFFERINGS);
}

/** Every offering's searchable words, for the business's own search document. */
export const offeringsText = (offerings: readonly Offering[]): string =>
  join(offerings.filter((o) => o.source !== "kind").map((o) => o.text));

/** The offerings as one line for the business's own embedding (bounded). */
export const offeringsEmbedText = (offerings: readonly Offering[]): string =>
  offerings
    .filter((o) => o.source === "item" || o.source === "part" || o.source === "tag")
    .map((o) => values(o.label).join(" / "))
    .join("; ")
    .slice(0, 1500);
