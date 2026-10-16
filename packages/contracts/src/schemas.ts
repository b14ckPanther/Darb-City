import {
  CARD_ACCENTS,
  CARD_ICON_STYLES,
  DIETARY,
  facebookUrl,
  instagramUrl,
  isSlug,
  PLACE_STATUSES,
  PLACE_TYPES,
  TEMPLATES,
  tiktokUrl,
  TIERS,
  wazeUrl,
} from "@darb/core";
import { z } from "zod";

const text = z.string().optional();
export const LocalizedSchema = z
  .object({ he: text, ar: text, en: text })
  .refine((v) => [v.he, v.ar, v.en].some((t) => t !== undefined && t.trim() !== ""), {
    message: "At least one language must have text",
  });

export const SlugSchema = z.string().refine(isSlug, { message: "Invalid slug" });

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const IntervalSchema = z.object({ open: time, close: time });
export const HoursSchema = z.object({
  weekly: z.record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(IntervalSchema)),
  exceptions: z.array(
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), intervals: z.array(IntervalSchema) }),
  ),
  /** Visits by arrangement only: never open now, shown as "By appointment" (Task 28). */
  byAppointment: z.boolean().optional(),
});

/** A phone number as people type it: digits, spaces, dashes, brackets and an optional +. */
export const PhoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{5,19}$/, { message: "Use digits, spaces, dashes and an optional +" });

/**
 * An uploaded image in the media bucket. Photos sent to /join wait under pending/ (kept there
 * once approved); `b/` is free for a later move. Always WebP, named by a random UUID.
 */
export const MediaKeySchema = z
  .string()
  .regex(/^(?:pending|b\/[0-9a-f-]{36})\/[0-9a-f-]{36}\.webp$/, { message: "Unknown image" });
export const PhotoSchema = z.object({ key: MediaKeySchema, alt: LocalizedSchema });
export const LogoSchema = z.object({ key: MediaKeySchema });

/** The card's look: one of the palette's accents, and line or solid icons. */
export const CardStyleSchema = z
  .object({
    accent: z.enum(CARD_ACCENTS).optional(),
    icons: z.enum(CARD_ICON_STYLES).optional(),
  })
  .strict();
export type CardStyleDto = z.infer<typeof CardStyleSchema>;

/** Stored links: full https URLs, each on its own network. */
export const LinksSchema = z.object({
  instagram: z.string().url().optional(),
  facebook: z.string().url().optional(),
  tiktok: z.string().url().optional(),
  waze: z.string().url().optional(),
});
export type LinksDto = z.infer<typeof LinksSchema>;

const linkInput = (normalize: (raw: string) => string | null, what: string) =>
  z
    .string()
    .trim()
    .max(300)
    .transform((raw, ctx) => {
      const url = normalize(raw);
      if (!url) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: `Not ${what} link or name` });
        return z.NEVER;
      }
      return url;
    });
/** Links as people type them ("@name", "instagram.com/name"), normalised to full https URLs. */
export const LinksInputSchema = z
  .object({
    instagram: linkInput(instagramUrl, "an Instagram").optional(),
    facebook: linkInput(facebookUrl, "a Facebook").optional(),
    tiktok: linkInput(tiktokUrl, "a TikTok").optional(),
    waze: linkInput(wazeUrl, "a Waze").optional(),
  })
  .strict();

/** Whole-business dietary facts (core DIETARY); gluten_free means the entire kitchen is. */
export const DietarySchema = z.enum(DIETARY);

export const PlaceSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  type: z.enum(PLACE_TYPES),
  name: LocalizedSchema,
  status: z.enum(PLACE_STATUSES),
  lat: z.number(),
  lng: z.number(),
  parentId: z.string().nullable(),
});
export type PlaceDto = z.infer<typeof PlaceSchema>;

export const PlaceDetailSchema = PlaceSchema.extend({
  /** Root first, excluding the place itself. */
  ancestors: z.array(PlaceSchema),
  children: z.array(PlaceSchema),
});
export type PlaceDetailDto = z.infer<typeof PlaceDetailSchema>;

export const SectorSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  accent: z.string().regex(/^#[0-9a-f]{6}$/),
  order: z.number().int(),
});
export type SectorDto = z.infer<typeof SectorSchema>;

export const KindSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  sectorId: z.string(),
  parentKindId: z.string().nullable(),
  name: LocalizedSchema,
  template: z.enum(TEMPLATES),
  attributes: z.array(z.string()),
  icon: z.string().nullable(),
  order: z.number().int(),
});
export type KindDto = z.infer<typeof KindSchema>;

export const TaxonomySchema = z.object({
  sectors: z.array(SectorSchema.extend({ kinds: z.array(KindSchema) })),
});
export type TaxonomyDto = z.infer<typeof TaxonomySchema>;

export const BusinessSummarySchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  tier: z.enum(TIERS),
  primaryKindId: z.string(),
  placeId: z.string(),
  placeSlug: SlugSchema,
  lat: z.number(),
  lng: z.number(),
  photo: z.string().nullable(),
  /** Null when the business has no hours at all. */
  openNow: z.boolean().nullable(),
  /** Weekly hours, so browsers recompute open-now on cached pages (Plan 4). */
  hours: HoursSchema,
  /** Whole-business dietary facts: gluten_free is a fully gluten-free kitchen (Task 27b). */
  dietary: z.array(DietarySchema).default([]),
  /** Kilometres from the point a list was sorted by; absent otherwise. */
  distanceKm: z.number().nonnegative().optional(),
  /** The owner's logo and accent, so list rows wear the card's look; absent from older caches. */
  logo: LogoSchema.nullable().optional(),
  cardStyle: CardStyleSchema.optional(),
});
export type BusinessSummaryDto = z.infer<typeof BusinessSummarySchema>;

export const BusinessDetailSchema = BusinessSummarySchema.extend({
  kindIds: z.array(z.string()),
  address: LocalizedSchema,
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  website: z.string().nullable(),
  photos: z.array(z.object({ key: z.string(), alt: LocalizedSchema })),
  /** The owner's logo, when there is one. Keys are paths in the media bucket (MEDIA_URL). */
  logo: LogoSchema.nullable().default(null),
  /** Instagram, Facebook, TikTok and an own Waze link; the website stays in `website`. */
  links: LinksSchema.default({}),
  cardStyle: CardStyleSchema.default({}),
  hours: HoursSchema,
  attributes: z.record(z.string(), z.union([z.boolean(), z.string(), z.number()])),
  experience: z.record(z.string(), z.unknown()),
  apps: z.object({
    web: z.string().url().optional(),
    ios: z.string().url().optional(),
    android: z.string().url().optional(),
  }),
  brandId: z.string().nullable(),
});
export type BusinessDetailDto = z.infer<typeof BusinessDetailSchema>;

export const NotFoundSchema = z.object({ message: z.string() });

export const BusinessPageSchema = z.object({
  items: z.array(BusinessSummarySchema),
  /** Opaque; send it back as `cursor` for the next page. Null on the last page. */
  nextCursor: z.string().nullable(),
});
export type BusinessPageDto = z.infer<typeof BusinessPageSchema>;

export const BadRequestSchema = z.object({ message: z.string() });

/** Published businesses per active kind slug in a place's subtree. Every active kind is present. */
export const KindCountsSchema = z.record(z.string(), z.number().int().nonnegative());
export type KindCountsDto = z.infer<typeof KindCountsSchema>;

/**
 * Published businesses (primary kind active) in each live settlement's subtree, by place slug.
 * Every live city, town and village is present, with 0 when it has none. Feeds the map's glow.
 */
export const DensitySchema = z.record(z.string(), z.number().int().nonnegative());
export type DensityDto = z.infer<typeof DensitySchema>;

/**
 * Published businesses (primary kind active) in each live place's subtree, by place slug, at any
 * level (regions and neighbourhoods too). Every live place below the country is present, with 0
 * when it has none. Lets browse pages hide places with nothing to show.
 */
export const PlaceCountsSchema = z.record(z.string(), z.number().int().nonnegative());
export type PlaceCountsDto = z.infer<typeof PlaceCountsSchema>;

export const NearestPlaceSchema = PlaceSchema.extend({
  distanceKm: z.number().nonnegative(),
  /** Published businesses of the kind there. */
  count: z.number().int().positive(),
});
export type NearestPlaceDto = z.infer<typeof NearestPlaceSchema>;

const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** A business's experience screen (the v1 shape every template shares; see seed SCREEN_SCHEMA). */
export const ScreenSchema = z.object({
  brand: LocalizedSchema,
  title: LocalizedSchema,
  subtitle: LocalizedSchema.optional(),
  tags: z.array(LocalizedSchema).optional(),
  items: z.array(z.object({ label: LocalizedSchema, meta: LocalizedSchema.optional() })).min(1),
  cta: LocalizedSchema,
  palette: z.object({ bg: hex, surface: hex, ink: hex, accent: hex }),
  font: z.string().min(1),
});
export type ScreenDto = z.infer<typeof ScreenSchema>;

/** A real business page for the web sitemap (showroom examples are left out). */
export const SitemapBusinessSchema = z.object({
  placeSlug: SlugSchema,
  slug: SlugSchema,
  primaryKindId: z.string(),
  updatedAt: z.string(),
});
export type SitemapBusinessDto = z.infer<typeof SitemapBusinessSchema>;
