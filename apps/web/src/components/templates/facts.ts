/**
 * A screen item's meta, cut into the facts it lists ("₪60 · 30 min" → a price and a duration), each
 * typed by its shape so a template can set it right: a price large, a time in board digits, a
 * percent as a bar. Only the shape is read; the words are shown as written.
 */
export type FactKind = "price" | "percent" | "time" | "duration" | "distance" | "number" | "words";

export interface Fact {
  text: string;
  kind: FactKind;
  /** A percent's value (0..100), for a bar. */
  value?: number;
}

const PERCENT = /(\d{1,3})(?:[.,]\d+)?\s*%/;
const PRICE = /[₪$€]|\bNIS\b|ש"ח|شيكل/;
const TIME = /\b\d{1,2}:\d{2}\b/;
const DURATION =
  /\d\s*(min|mins|minutes|h|hrs?|hours?|דק|דקות|שעה|שעות|دقيقة|دقائق|دقايق|ساعة|ساعات)(?![\p{L}])/iu;
const DISTANCE = /\d\s*(km|m|ק"מ|קמ|כ"מ|كم|كيلو)(?![\p{L}])/iu;
const NUMBER = /^[#№]?\s*[\d][\d,.\s/]*$/;

export function factKind(text: string): FactKind {
  if (PERCENT.test(text)) return "percent";
  if (PRICE.test(text)) return "price";
  if (TIME.test(text)) return "time";
  if (DURATION.test(text)) return "duration";
  if (DISTANCE.test(text)) return "distance";
  if (NUMBER.test(text.trim())) return "number";
  return "words";
}

export function factsOf(meta: string): Fact[] {
  return meta
    .split("·")
    .map((part) => part.trim())
    .filter(Boolean)
    .map((text) => {
      const kind = factKind(text);
      if (kind !== "percent") return { text, kind };
      const value = Math.min(100, Math.max(0, Number(PERCENT.exec(text)?.[1] ?? 0)));
      return { text, kind, value };
    });
}

/** The first fact of a kind, if the meta has one. */
export const factOf = (facts: Fact[], kind: FactKind) => facts.find((f) => f.kind === kind);
