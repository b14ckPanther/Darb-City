import { isSlug, PLACE_STATUSES, PLACE_TYPES, TEMPLATES, TIERS } from "@darb/core";
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
});

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
});
export type BusinessSummaryDto = z.infer<typeof BusinessSummarySchema>;

export const BusinessDetailSchema = BusinessSummarySchema.extend({
  kindIds: z.array(z.string()),
  address: LocalizedSchema,
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  website: z.string().nullable(),
  photos: z.array(z.object({ key: z.string(), alt: LocalizedSchema })),
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
