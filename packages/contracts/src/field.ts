import { ISRAEL_BOX } from "@darb/core";
import { z } from "zod";
import { MediaKeySchema, PhoneSchema, SlugSchema } from "./schemas.js";
import { JOIN_STATUSES } from "./join.js";
import { LocaleSchema } from "./search.js";

/**
 * "Add from the street": an admin photographs a shop's sign, the pin comes from the phone, and the
 * capture becomes a draft business with a request in the join queue (source "field").
 */

const lat = z.number().min(ISRAEL_BOX.lat[0]).max(ISRAEL_BOX.lat[1]);
const lng = z.number().min(ISRAEL_BOX.lng[0]).max(ISRAEL_BOX.lng[1]);
const words = (max: number) => z.string().trim().max(max).optional();
const FieldNameSchema = z
  .object({ he: words(120), ar: words(120), en: words(120) })
  .strict()
  .refine((n) => Object.values(n).some((v) => v && v.trim()), { message: "A name is needed" });

/** What reading the sign gave: every field may be missing; nothing here is trusted. */
export const FieldReadingSchema = z.object({
  name: z.object({
    he: z.string().max(120).nullable(),
    ar: z.string().max(120).nullable(),
    en: z.string().max(120).nullable(),
  }),
  phone: z.string().max(40).nullable(),
  kindSlug: SlugSchema.nullable(),
  /** 0 to 1: how sure the reading is that it read the sign right. */
  confidence: z.number().min(0).max(1).nullable(),
});
export type FieldReadingDto = z.infer<typeof FieldReadingSchema>;

/**
 * POST /admin/field/read answers with a reading, or null and why: "off" (no model on this
 * deployment), "budget" (the day's reads are spent), "excluded" (a kind of business Darb does not
 * list), "unreadable" (no sign found, or the model failed).
 */
export const FIELD_READ_REASONS = ["off", "budget", "excluded", "unreadable"] as const;
export const FieldReadResultSchema = z.object({
  reading: FieldReadingSchema.nullable(),
  reason: z.enum(FIELD_READ_REASONS).optional(),
});
export type FieldReadResultDto = z.infer<typeof FieldReadResultSchema>;

/** POST /admin/field/photo: the stored storefront photo's key, or null when uploads are off. */
export const FieldPhotoResultSchema = z.object({ key: MediaKeySchema.nullable() });
export type FieldPhotoResultDto = z.infer<typeof FieldPhotoResultSchema>;

export const FieldStatusSchema = z.object({ reading: z.boolean(), uploads: z.boolean() });
export type FieldStatusDto = z.infer<typeof FieldStatusSchema>;

export const FieldDuplicateQuerySchema = z
  .object({
    lat,
    lng,
    name: z
      .object({ he: words(120), ar: words(120), en: words(120) })
      .strict()
      .default({}),
    phone: z.string().trim().max(40).optional(),
  })
  .strict();
export type FieldDuplicateQueryDto = z.infer<typeof FieldDuplicateQuerySchema>;

export const FieldMatchSchema = z.object({
  id: z.string().uuid(),
  name: z.object({
    he: z.string().optional(),
    ar: z.string().optional(),
    en: z.string().optional(),
  }),
  placeSlug: SlugSchema,
  status: z.enum(["draft", "published", "suspended"]),
  /** Why it matched: the same phone number, or a similar name close by. */
  reason: z.enum(["phone", "name"]),
  /** Metres from the pin. */
  metres: z.number().int().nonnegative(),
});
export const FieldDuplicatesSchema = z.object({ matches: z.array(FieldMatchSchema) });
export type FieldMatchDto = z.infer<typeof FieldMatchSchema>;

/** A similar name this close is a strong match (as the same phone number always is). */
export const STRONG_MATCH_METRES = 25;
/** A helper (not an admin) must say how a capture differs from a strong match to save it. */
export const isStrongMatch = (m: Pick<FieldMatchDto, "reason" | "metres">) =>
  m.reason === "phone" || m.metres <= STRONG_MATCH_METRES;
export type FieldDuplicatesDto = z.infer<typeof FieldDuplicatesSchema>;

/** One capture as the phone sends it, once it can (the queue retries with the same clientId). */
export const FieldCaptureCreateSchema = z
  .object({
    clientId: z.string().uuid(),
    name: FieldNameSchema,
    phone: PhoneSchema.nullable().default(null),
    kindSlug: SlugSchema,
    lat,
    lng,
    /** The device's reported accuracy, in metres, when the pin came from it. */
    accuracy: z.number().nonnegative().max(100_000).nullable().default(null),
    photo: MediaKeySchema.nullable().default(null),
    hours: z.string().trim().max(300).optional(),
    note: z.string().trim().max(1000).optional(),
    /** What reading the sign suggested, kept beside what the admin saved. */
    reading: FieldReadingSchema.nullable().default(null),
    /**
     * Why this is not the likely duplicate the check found. A helper (not an admin) must write it
     * to save past a strong match; it reaches the review with the note.
     */
    distinct: z.string().trim().max(300).optional(),
    capturedAt: z.string().datetime().optional(),
    locale: LocaleSchema,
  })
  .strict();
export type FieldCaptureCreateDto = z.infer<typeof FieldCaptureCreateSchema>;
export type FieldCaptureCreateInput = z.input<typeof FieldCaptureCreateSchema>;

export const FieldCaptureSchema = z.object({
  id: z.string().uuid(),
  clientId: z.string().nullable(),
  businessName: z.object({
    he: z.string().optional(),
    ar: z.string().optional(),
    en: z.string().optional(),
  }),
  status: z.enum(JOIN_STATUSES),
  businessId: z.string().uuid().nullable(),
  createdAt: z.string(),
  /** The admin's reason, once a capture was not added. */
  rejectReason: z.string().nullable().default(null),
  /** The public card's path segments while the business is live; null otherwise. */
  live: z
    .object({ place: SlugSchema, sector: SlugSchema, kind: SlugSchema, business: SlugSchema })
    .nullable()
    .default(null),
});
export type FieldCaptureDto = z.infer<typeof FieldCaptureSchema>;

/**
 * The admin's (or helper's) own street captures, newest first, how many were added today (Israel
 * time), and in all: every capture, and those live on Darb now.
 */
export const FieldCapturesSchema = z.object({
  today: z.number().int().nonnegative(),
  total: z.number().int().nonnegative().default(0),
  live: z.number().int().nonnegative().default(0),
  items: z.array(FieldCaptureSchema),
});
export type FieldCapturesDto = z.infer<typeof FieldCapturesSchema>;
