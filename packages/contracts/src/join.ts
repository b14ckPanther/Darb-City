import { ISRAEL_BOX, websiteUrl } from "@darb/core";
import { z } from "zod";
import {
  CardStyleSchema,
  HoursSchema,
  LinksInputSchema,
  LinksSchema,
  LocalizedSchema,
  MediaKeySchema,
  PhoneSchema,
  SlugSchema,
} from "./schemas.js";
import { LocaleSchema } from "./search.js";

const lat = z.number().min(ISRAEL_BOX.lat[0]).max(ISRAEL_BOX.lat[1]);
const lng = z.number().min(ISRAEL_BOX.lng[0]).max(ISRAEL_BOX.lng[1]);
export const JoinPointSchema = z.object({ lat, lng });

const words = (max: number) => z.string().trim().max(max).optional();
/** Any of the three languages; the owner fills theirs, the others are translated later. */
const LocalizedTextSchema = (max: number) =>
  z.object({ he: words(max), ar: words(max), en: words(max) }).strict();

/** "samir.co.il" or a full link, kept as an https URL. */
export const WebsiteInputSchema = z
  .string()
  .trim()
  .max(500)
  .transform((raw, ctx) => {
    const url = websiteUrl(raw);
    if (!url) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Not a web address" });
      return z.NEVER;
    }
    return url;
  });

/** "Find my business": a name and town, a map, Waze or social link, or where the owner stands. */
export const JoinLookupRequestSchema = z
  .object({
    query: z.string().trim().max(200).optional(),
    url: z.string().trim().max(1000).optional(),
    /** "I'm at my business now": the device's position, used once and never stored. */
    point: JoinPointSchema.optional(),
    locale: LocaleSchema,
  })
  .refine((v) => Boolean(v.query || v.url || v.point), { message: "Nothing to look up" });
export type JoinLookupRequestDto = z.infer<typeof JoinLookupRequestSchema>;

export const JOIN_LOOKUP_REASONS = ["off", "excluded", "none"] as const;

/**
 * What the lookup found, every field optional: a map link gives a point, the web gives the rest.
 * `osm` says OpenStreetMap (Nominatim) data was used, so the form credits it. `reason` is set when
 * nothing was found: "off" (no AI or the day's lookups are spent), "excluded" (a kind of business
 * Darb does not list), "none".
 */
export const JoinSuggestionSchema = z.object({
  found: z.boolean(),
  reason: z.enum(JOIN_LOOKUP_REASONS).optional(),
  point: JoinPointSchema.optional(),
  address: z.string().max(300).optional(),
  placeSlug: SlugSchema.optional(),
  kindSlug: SlugSchema.optional(),
  name: LocalizedTextSchema(120).optional(),
  phone: z.string().max(40).optional(),
  whatsapp: z.string().max(40).optional(),
  website: z.string().url().max(500).optional(),
  links: LinksSchema.optional(),
  hours: HoursSchema.optional(),
  description: LocalizedTextSchema(400).optional(),
  sources: z.array(z.string().url().max(500)).max(10).default([]),
  osm: z.boolean().default(false),
});
export type JoinSuggestionDto = z.infer<typeof JoinSuggestionSchema>;

/** How the owner filled the /join form. */
export const JOIN_FORM_SOURCES = ["lookup", "manual"] as const;
/** Every request in the queue: the form's two, and "field" (an admin added it from the street). */
export const JOIN_SOURCES = [...JOIN_FORM_SOURCES, "field"] as const;
export type JoinSource = (typeof JOIN_SOURCES)[number];
export const JOIN_STATUSES = ["pending", "approved", "rejected"] as const;
export type JoinStatus = (typeof JOIN_STATUSES)[number];
export const JOIN_MAX_PHOTOS = 6;

/**
 * The /join form. Everything about the business becomes a draft business; `owner` stays private
 * (only Darb sees it, to confirm). `website2` is a honeypot like /contact's: a filled one is
 * answered 201 and nothing is kept. Photo keys must be ones /join/photos handed out.
 */
export const JoinCreateSchema = z.object({
  name: LocalizedSchema.pipe(LocalizedTextSchema(120)),
  kindSlug: SlugSchema,
  placeSlug: SlugSchema,
  lat,
  lng,
  address: LocalizedTextSchema(200).default({}),
  phone: PhoneSchema.nullable().default(null),
  whatsapp: PhoneSchema.nullable().default(null),
  website: WebsiteInputSchema.nullable().default(null),
  links: LinksInputSchema.default({}),
  hours: HoursSchema.default({ weekly: {}, exceptions: [] }),
  description: LocalizedTextSchema(400).default({}),
  logo: MediaKeySchema.nullable().default(null),
  photos: z.array(MediaKeySchema).max(JOIN_MAX_PHOTOS).default([]),
  cardStyle: CardStyleSchema.default({}),
  owner: z
    .object({
      name: z.string().trim().min(2).max(80),
      phone: PhoneSchema,
      email: z.string().trim().email().max(120).optional(),
    })
    .strict(),
  note: z.string().trim().max(1000).optional(),
  source: z.enum(JOIN_FORM_SOURCES),
  /** What the lookup suggested, shown to the admin beside what the owner kept. */
  lookup: JoinSuggestionSchema.optional(),
  locale: LocaleSchema,
  website2: z.string().max(500).optional(),
});
export type JoinCreateDto = z.infer<typeof JoinCreateSchema>;
export type JoinCreateInput = z.input<typeof JoinCreateSchema>;

export const JoinAcceptedSchema = z.object({ ok: z.literal(true) });

/** POST /join/photos answers with the key to send back and where the image can be seen. */
export const JoinPhotoSchema = z.object({ key: MediaKeySchema, url: z.string().url() });
export type JoinPhotoDto = z.infer<typeof JoinPhotoSchema>;

/** What the form can offer right now: photo uploads (R2 set) and the smart lookup (model on). */
export const JoinStatusSchema = z.object({ uploads: z.boolean(), lookup: z.boolean() });
export type JoinStatusDto = z.infer<typeof JoinStatusSchema>;
