import type { PlanDto, PricingDto, PricingTextKey } from "@darb/contracts";
import { pickText, type Locale } from "@darb/core";
import { INTL_TAG } from "./locale";

/** A page text in the locale (falling back like every Localized), or "" when it was never set. */
export function pricingText(texts: PricingDto["texts"], key: PricingTextKey, locale: Locale) {
  return pickText(texts[key] ?? {}, locale);
}

/** Whole shekels in the locale's own order ("₪349", "‏349 ₪"), split so the sign can be styled. */
export function shekelParts(value: number, locale: Locale): { text: string; currency: boolean }[] {
  return new Intl.NumberFormat(INTL_TAG[locale], {
    style: "currency",
    currency: "ILS",
    maximumFractionDigits: 0,
  })
    .formatToParts(value)
    .map((p) => ({ text: p.value, currency: p.type === "currency" }));
}

export const formatShekels = (value: number, locale: Locale) =>
  shekelParts(value, locale)
    .map((p) => p.text)
    .join("");

/** What the price slot says: an amount, the "Free" text, or the custom "Let's talk" text. */
export type PriceLabel =
  | { kind: "amount"; value: number }
  | { kind: "free"; text: string }
  | { kind: "custom"; text: string };

export function priceLabel(plan: PlanDto, texts: PricingDto["texts"], locale: Locale): PriceLabel {
  if (plan.monthly === null)
    return { kind: "custom", text: pricingText(texts, "pricing.custom", locale) };
  const free = plan.monthly === 0 ? pricingText(texts, "pricing.free", locale) : "";
  return free ? { kind: "free", text: free } : { kind: "amount", value: plan.monthly };
}

/** One item per non-blank line (the terms, a plan's lists in the admin). */
export const textLines = (text: string): string[] =>
  text
    .split(/\r?\n/)
    .map((s) => s.trim())
    .filter((s) => s !== "");

/**
 * The FAQ text: entries split by a blank line, the first line of each the question and the rest
 * its answer. An entry with no answer is dropped rather than shown half-written.
 */
export function faqEntries(text: string): { question: string; answer: string }[] {
  return text.split(/\r?\n\s*\r?\n/).flatMap((block) => {
    const [question, ...answer] = textLines(block);
    return question && answer.length > 0 ? [{ question, answer: answer.join(" ") }] : [];
  });
}
