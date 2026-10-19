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

/** A helper's (not an admin's) day: additions, and sign readings (each one costs money). */
export const HELPER_DAILY = { captures: 40, reads: 20 } as const;

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
