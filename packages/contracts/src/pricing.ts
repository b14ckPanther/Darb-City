import { z } from "zod";
import { LocalizedSchema, SlugSchema } from "./schemas.js";

/** Localized text that may be empty in every language ({}: the slot shows nothing). */
export const LocalizedOptionalSchema = z.object({
  he: z.string().optional(),
  ar: z.string().optional(),
  en: z.string().optional(),
});

/** One list per language (a plan's features), each item on its own line in the admin. */
export const LocalizedListSchema = z.object({
  he: z.array(z.string().trim().min(1).max(200)).max(20),
  ar: z.array(z.string().trim().min(1).max(200)).max(20),
  en: z.array(z.string().trim().min(1).max(200)).max(20),
});

/**
 * A plan's button: a web link, an email, or a path on this site ("/for-business"). Never a
 * protocol-relative "//host" or a script.
 */
export const CtaHrefSchema = z
  .string()
  .trim()
  .min(1)
  .max(500)
  .refine((u) => /^(?:https?:\/\/|mailto:)\S+$|^\/(?!\/)\S*$/i.test(u), {
    message: "Use an https:// link, a mailto: address or a path starting with /",
  });

/** Whole shekels: Darb never prices in agorot. */
export const ShekelsSchema = z.number().int().min(0).max(1_000_000);

export const PlanSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  order: z.number().int(),
  name: LocalizedSchema,
  tagline: LocalizedOptionalSchema,
  /** Per month; 0 is free, null is a custom quote ("Let's talk"). */
  monthly: ShekelsSchema.nullable(),
  /** One-time setup, when there is one. */
  setup: ShekelsSchema.nullable(),
  priceNote: LocalizedOptionalSchema,
  features: LocalizedListSchema,
  highlighted: z.boolean(),
  ctaLabel: LocalizedSchema,
  ctaHref: CtaHrefSchema,
  finePrint: LocalizedOptionalSchema,
});
export type PlanDto = z.infer<typeof PlanSchema>;

/**
 * The page's own copy, by key. The page reads the keys it knows (PRICING_TEXT_KEYS) and shows
 * nothing for a missing one, so a deploy that has not been seeded yet still renders.
 */
export const PRICING_TEXT_KEYS = [
  "pricing.eyebrow",
  "pricing.title",
  "pricing.intro",
  "pricing.badge",
  "pricing.free",
  "pricing.custom",
  "pricing.setup",
  "pricing.termsTitle",
  "pricing.terms",
  "pricing.faqTitle",
  "pricing.faq",
  "pricing.contactTitle",
  "pricing.contactBody",
] as const;
export type PricingTextKey = (typeof PRICING_TEXT_KEYS)[number];
export const SiteTextKeySchema = z.string().regex(/^[a-z]+(?:\.[a-zA-Z0-9]+)+$/);

export const PricingSchema = z.object({
  /** Live plans only, in order. */
  plans: z.array(PlanSchema),
  texts: z.record(z.string(), LocalizedOptionalSchema),
});
export type PricingDto = z.infer<typeof PricingSchema>;
