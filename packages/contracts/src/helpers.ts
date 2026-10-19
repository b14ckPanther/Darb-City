import { initContract } from "@ts-rest/core";
import { z } from "zod";
import { AdminErrorSchema } from "./admin.js";
import {
  FieldCaptureCreateSchema,
  FieldCaptureSchema,
  FieldCapturesSchema,
  FieldDuplicateQuerySchema,
  FieldDuplicatesSchema,
  FieldStatusSchema,
} from "./field.js";
import { LocateQuerySchema, LocateResultSchema } from "./locate.js";
import { LocalizedSchema, PhoneSchema } from "./schemas.js";

/**
 * Darb Helpers: friends who add businesses from their own towns with the street capture. Anyone
 * signed in may apply; an admin approves, pauses or resumes them. A helper never publishes: every
 * addition waits in the join queue like an admin's street capture.
 */

const c = initContract();

export const HELPER_STATUSES = ["none", "pending", "approved", "paused"] as const;
export type HelperStatus = (typeof HELPER_STATUSES)[number];

/**
 * A helper's (not an admin's) day: the same cap on additions and on sign readings (each reading
 * costs money). An admin may raise one helper's cap or lift it; admins themselves have none.
 */
export const HELPER_DAILY_DEFAULT = 150;
/** The caps an admin may give a helper; null is no cap at all. */
export const HELPER_LIMITS = [150, 500, null] as const;
export type HelperLimit = (typeof HELPER_LIMITS)[number];
/**
 * How User.helperDailyLimit is stored: null is the default (HELPER_DAILY_DEFAULT), 0 is no cap,
 * any other number is that cap. Returns the day's cap, or null for none.
 */
export function helperDailyLimit(stored: number | null | undefined): number | null {
  if (stored === null || stored === undefined) return HELPER_DAILY_DEFAULT;
  return stored === 0 ? null : stored;
}
/** The stored value for a cap an admin picked: the default is stored as null, no cap as 0. */
export function storedHelperLimit(limit: HelperLimit): number | null {
  if (limit === null) return 0;
  return limit === HELPER_DAILY_DEFAULT ? null : limit;
}

const HelperNameSchema = z.string().trim().min(2).max(60);

/** The signed-in person as the helper app sees them; status none until they apply. */
export const HelperMeSchema = z.object({
  status: z.enum(HELPER_STATUSES),
  name: z.string().nullable(),
  phone: z.string().nullable(),
  placeId: z.string().uuid().nullable(),
  placeName: LocalizedSchema.nullable(),
  note: z.string().nullable(),
  /** "Added by <name>" on the public cards of their published additions. */
  credit: z.boolean(),
  /** Admins are helpers too, without applying. */
  isAdmin: z.boolean(),
  /** Their cap on additions (and sign readings) a day; null is no cap (admins, or lifted). */
  dailyLimit: z.number().int().positive().nullable(),
  appliedAt: z.string().nullable(),
});
export type HelperMeDto = z.infer<typeof HelperMeSchema>;

/** The one-screen form. Applying again while waiting updates it; once decided it changes nothing. */
export const HelperApplySchema = z
  .object({
    name: HelperNameSchema,
    phone: PhoneSchema,
    /** Their home town, from the places list: information for the admin only. */
    placeId: z.string().uuid(),
    note: z.string().trim().max(500).optional(),
  })
  .strict();
export type HelperApplyDto = z.infer<typeof HelperApplySchema>;

export const HelperPatchSchema = z
  .object({ name: HelperNameSchema.optional(), credit: z.boolean().optional() })
  .strict()
  .refine((p) => p.name !== undefined || p.credit !== undefined, { message: "Nothing to change" });
export type HelperPatchDto = z.infer<typeof HelperPatchSchema>;

const signedIn = { 401: AdminErrorSchema, 403: AdminErrorSchema } as const;
/** 429: the helper's additions for today are used up (code daily_limit). */
const captureErrors = {
  400: AdminErrorSchema,
  404: AdminErrorSchema,
  409: AdminErrorSchema,
  429: AdminErrorSchema,
  ...signedIn,
} as const;

export const helpersContract = c.router({
  /** Signed in only (any Clerk user); the User row is made at first sight. */
  me: { method: "GET", path: "/helpers/me", responses: { 200: HelperMeSchema, ...signedIn } },
  apply: {
    method: "POST",
    path: "/helpers/apply",
    body: HelperApplySchema,
    responses: { 200: HelperMeSchema, 400: AdminErrorSchema, 404: AdminErrorSchema, ...signedIn },
  },
  /** Their display name and the public credit toggle. */
  update: {
    method: "PATCH",
    path: "/helpers/me",
    body: HelperPatchSchema,
    responses: { 200: HelperMeSchema, 400: AdminErrorSchema, 409: AdminErrorSchema, ...signedIn },
  },
  /**
   * The street capture for approved helpers (and admins): the admin's field routes mounted again.
   * The photo and the sign reading take the image itself as the request body, outside this
   * contract: POST /helpers/field/photo and POST /helpers/field/read.
   */
  field: c.router({
    status: {
      method: "GET",
      path: "/helpers/field/status",
      responses: { 200: FieldStatusSchema, ...signedIn },
    },
    duplicates: {
      method: "POST",
      path: "/helpers/field/duplicates",
      body: FieldDuplicateQuerySchema,
      responses: { 200: FieldDuplicatesSchema, 400: AdminErrorSchema, ...signedIn },
    },
    create: {
      method: "POST",
      path: "/helpers/field/captures",
      body: FieldCaptureCreateSchema,
      responses: { 200: FieldCaptureSchema, 201: FieldCaptureSchema, ...captureErrors },
    },
    /** Their own captures only, never anyone else's. */
    mine: {
      method: "GET",
      path: "/helpers/field/captures",
      responses: { 200: FieldCapturesSchema, ...signedIn },
    },
    /** A pasted map link or an address, to a point for the pin (the admin's finder). */
    locate: {
      method: "POST",
      path: "/helpers/field/locate",
      body: LocateQuerySchema,
      responses: { 200: LocateResultSchema, 400: AdminErrorSchema, ...signedIn },
    },
  }),
});
