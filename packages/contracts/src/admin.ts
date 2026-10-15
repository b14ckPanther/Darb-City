import { initContract } from "@ts-rest/core";
import { isReservedSlug, PLACE_STATUSES, PLACE_TYPES, TEMPLATES, TIERS } from "@darb/core";
import { z } from "zod";
import { DietarySchema, HoursSchema, LocalizedSchema, SlugSchema } from "./schemas.js";
import {
  CtaHrefSchema,
  LocalizedListSchema,
  LocalizedOptionalSchema,
  PlanSchema,
  ShekelsSchema,
  SiteTextKeySchema,
} from "./pricing.js";
import { INQUIRY_STATUSES, INQUIRY_TOPICS } from "./inquiry.js";
import { LocaleSchema, MissingReportSchema, ReportQuerySchema } from "./search.js";

const c = initContract();

export const ADMIN_ENTITIES = ["place", "sector", "kind", "business", "plan", "text"] as const;
export type AdminEntity = (typeof ADMIN_ENTITIES)[number];

const id = z.string().uuid();
const stamp = z.string().nullable();
/** The row has a counterpart in the seed data, so "Return to seed data" applies to it. */
const seedSource = z.boolean();
/** New slugs are permanent URLs: never a route the web app owns. */
const NewSlugSchema = SlugSchema.refine((s) => !isReservedSlug(s), {
  message: "This slug is reserved",
});
const httpUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//i.test(u), { message: "Links must start with http:// or https://" });
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{5,19}$/, { message: "Use digits, spaces, dashes and an optional +" });
const accent = z
  .string()
  .regex(/^#[0-9a-f]{6}$/, { message: "Use a lower-case hex colour like #d9a54c" });
/** Israel, generously: v1 has no other country (spec §13). */
const lat = z.number().min(29).max(33.6);
const lng = z.number().min(34).max(36);

export const SynonymsSchema = z.object({
  he: z.array(z.string().trim().min(1).max(80)).max(80),
  ar: z.array(z.string().trim().min(1).max(80)).max(80),
  en: z.array(z.string().trim().min(1).max(80)).max(80),
});
export const AdminErrorSchema = z
  .object({
    message: z.union([z.string(), z.array(z.string())]),
    errors: z.array(z.string()).optional(),
  })
  .passthrough();
const guarded = { 401: AdminErrorSchema, 403: AdminErrorSchema } as const;
const writeErrors = {
  400: AdminErrorSchema,
  404: AdminErrorSchema,
  409: AdminErrorSchema,
  ...guarded,
} as const;

export const AdminListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.string().max(20).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const AdminBusinessListQuerySchema = AdminListQuerySchema.extend({
  place: SlugSchema.optional(),
  kind: SlugSchema.optional(),
});
export const AdminKindListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["active", "hidden"]).optional(),
  sector: id.optional(),
});
const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

// Places
export const AdminPlaceSchema = z.object({
  id,
  slug: SlugSchema,
  type: z.enum(PLACE_TYPES),
  parentId: id.nullable(),
  path: z.string(),
  name: LocalizedSchema,
  aliases: z.array(z.string()),
  lat: z.number(),
  lng: z.number(),
  population: z.number().int().nullable(),
  cbsCode: z.string().nullable(),
  status: z.enum(PLACE_STATUSES),
  editedAt: stamp,
  seedSource,
});
const placeFields = z.object({
  name: LocalizedSchema,
  aliases: z.array(z.string().trim().min(1).max(80)).max(50),
  lat,
  lng,
  population: z.number().int().nonnegative().nullable(),
  status: z.enum(PLACE_STATUSES),
});
export const AdminPlaceCreateSchema = placeFields.extend({
  slug: NewSlugSchema,
  type: z.enum(["region", "city", "town", "village", "neighbourhood"]),
  parentId: id,
  aliases: placeFields.shape.aliases.default([]),
  population: placeFields.shape.population.default(null),
  status: placeFields.shape.status.default("soon"),
});
export const AdminPlacePatchSchema = placeFields.partial().strict();

// Sectors
export const AdminSectorSchema = z.object({
  id,
  slug: SlugSchema,
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  accent: z.string(),
  order: z.number().int(),
  editedAt: stamp,
  seedSource,
});
const sectorFields = z.object({
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  accent,
  order: z.number().int().min(0).max(999),
});
export const AdminSectorCreateSchema = sectorFields.extend({ slug: NewSlugSchema });
export const AdminSectorPatchSchema = sectorFields.partial().strict();

// Kinds
export const AdminKindSchema = z.object({
  id,
  slug: SlugSchema,
  sectorId: id,
  parentKindId: id.nullable(),
  name: LocalizedSchema,
  synonyms: SynonymsSchema,
  template: z.enum(TEMPLATES),
  attributes: z.array(z.string()),
  icon: z.string().nullable(),
  order: z.number().int(),
  status: z.enum(["active", "hidden"]),
  businessCount: z.number().int().nonnegative(),
  editedAt: stamp,
  seedSource,
});
const kindFields = z.object({
  sectorId: id,
  parentKindId: id.nullable(),
  name: LocalizedSchema,
  synonyms: SynonymsSchema,
  template: z.enum(TEMPLATES),
  attributes: z.array(SlugSchema).max(20),
  icon: z.string().max(40).nullable(),
  order: z.number().int().min(0).max(9999),
  status: z.enum(["active", "hidden"]),
});
/**
 * New kinds always start hidden: they are reviewed before anyone can see them (spec §4.3), and
 * going active is a separate, audited update. A create body that names a status is refused.
 */
export const AdminKindCreateSchema = kindFields
  .omit({ status: true })
  .extend({
    slug: NewSlugSchema,
    parentKindId: kindFields.shape.parentKindId.default(null),
    attributes: kindFields.shape.attributes.default([]),
    icon: kindFields.shape.icon.default(null),
  })
  .strict();
export const AdminKindPatchSchema = kindFields.partial().strict();

// Businesses
const BusinessStatus = z.enum(["draft", "published", "suspended"]);
export const AdminBusinessRowSchema = z.object({
  id,
  slug: SlugSchema,
  placeId: id,
  placeSlug: SlugSchema,
  name: LocalizedSchema,
  primaryKindId: id,
  tier: z.enum(TIERS),
  status: BusinessStatus,
  source: z.enum(["seed", "self", "claimed", "admin"]),
  editedAt: stamp,
  updatedAt: z.string(),
  seedSource,
});
const AppsSchema = z
  .object({ web: httpUrl.optional(), ios: httpUrl.optional(), android: httpUrl.optional() })
  .strict();
const businessFields = z.object({
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  address: LocalizedSchema,
  primaryKindId: id,
  kindIds: z.array(id).max(10),
  lat,
  lng,
  phone: phone.nullable(),
  whatsapp: phone.nullable(),
  website: httpUrl.nullable(),
  hours: HoursSchema,
  attributes: z.record(z.string().max(40), z.union([z.boolean(), z.string().max(200), z.number()])),
  // No default here: a partial PATCH must never reset it.
  dietary: z.array(DietarySchema).max(10),
  experience: z.record(z.string(), z.unknown()),
  tier: z.enum(TIERS),
  apps: AppsSchema,
});
export const AdminBusinessSchema = AdminBusinessRowSchema.extend(businessFields.shape).extend({
  brandId: id.nullable(),
});
export const AdminBusinessCreateSchema = businessFields.extend({
  dietary: businessFields.shape.dietary.default([]),
  slug: NewSlugSchema,
  placeId: id,
  status: z.enum(["draft", "published"]).default("draft"),
});
export const AdminBusinessPatchSchema = businessFields.partial().strict();
export const AdminStatusSchema = z.object({
  status: BusinessStatus,
  immediate: z.boolean().optional(),
});

// Plans (/pricing)
const PlanStatus = z.enum(["live", "hidden"]);
export const AdminPlanSchema = PlanSchema.extend({
  status: PlanStatus,
  editedAt: stamp,
  seedSource,
});
const planFields = z.object({
  name: LocalizedSchema,
  tagline: LocalizedOptionalSchema,
  monthly: ShekelsSchema.nullable(),
  setup: ShekelsSchema.nullable(),
  priceNote: LocalizedOptionalSchema,
  features: LocalizedListSchema,
  highlighted: z.boolean(),
  ctaLabel: LocalizedSchema,
  ctaHref: CtaHrefSchema,
  finePrint: LocalizedOptionalSchema,
  order: z.number().int().min(0).max(999),
  status: PlanStatus,
});
/** A new plan starts hidden unless the body says live: it is read over before anyone sees it. */
export const AdminPlanCreateSchema = planFields
  .extend({ slug: SlugSchema, status: PlanStatus.default("hidden") })
  .strict();
export const AdminPlanPatchSchema = planFields.partial().strict();

// Site texts (page copy by key)
export const AdminTextSchema = z.object({
  id,
  key: SiteTextKeySchema,
  value: LocalizedOptionalSchema,
  editedAt: stamp,
  seedSource,
});
export const AdminTextPatchSchema = z
  .object({
    value: z.object({
      he: z.string().max(4000).optional(),
      ar: z.string().max(4000).optional(),
      en: z.string().max(4000).optional(),
    }),
  })
  .strict();

// Inquiries (the /contact inbox)
export const AdminInquirySchema = z.object({
  id,
  name: z.string(),
  contact: z.string(),
  businessName: z.string().nullable(),
  topic: z.enum(INQUIRY_TOPICS),
  plan: z.string().nullable(),
  message: z.string(),
  locale: LocaleSchema,
  status: z.enum(INQUIRY_STATUSES),
  emailedAt: stamp,
  createdAt: z.string(),
});
export const AdminInquiryListQuerySchema = z.object({
  status: z.enum(INQUIRY_STATUSES).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
/** Newest first; `newCount` is every new inquiry, whatever the filter (the nav's badge). */
export const AdminInquiryPageSchema = z.object({
  items: z.array(AdminInquirySchema),
  nextCursor: z.string().nullable(),
  newCount: z.number().int().nonnegative(),
});
export const AdminInquiryStatusSchema = z.object({ status: z.enum(INQUIRY_STATUSES) }).strict();

// Audit and identity
export const AuditRowSchema = z.object({
  id,
  at: z.string(),
  actor: z.string(),
  action: z.enum(["create", "update", "status", "release", "delete"]),
  entityType: z.enum(ADMIN_ENTITIES),
  entityId: id,
  fields: z.array(z.string()),
});
export const AdminMeSchema = z.object({ clerkUserId: z.string(), userId: id });

export type AdminPlaceDto = z.infer<typeof AdminPlaceSchema>;
export type AdminPlaceCreateDto = z.infer<typeof AdminPlaceCreateSchema>;
export type AdminPlacePatchDto = z.infer<typeof AdminPlacePatchSchema>;
export type AdminSectorDto = z.infer<typeof AdminSectorSchema>;
export type AdminSectorCreateDto = z.infer<typeof AdminSectorCreateSchema>;
export type AdminSectorPatchDto = z.infer<typeof AdminSectorPatchSchema>;
export type AdminKindDto = z.infer<typeof AdminKindSchema>;
export type AdminKindCreateDto = z.infer<typeof AdminKindCreateSchema>;
export type AdminKindPatchDto = z.infer<typeof AdminKindPatchSchema>;
export type AdminBusinessRowDto = z.infer<typeof AdminBusinessRowSchema>;
export type AdminBusinessDto = z.infer<typeof AdminBusinessSchema>;
export type AdminBusinessCreateDto = z.infer<typeof AdminBusinessCreateSchema>;
export type AdminBusinessPatchDto = z.infer<typeof AdminBusinessPatchSchema>;
export type AdminStatusDto = z.infer<typeof AdminStatusSchema>;
export type AdminListQueryDto = z.infer<typeof AdminListQuerySchema>;
export type AdminBusinessListQueryDto = z.infer<typeof AdminBusinessListQuerySchema>;
export type AdminKindListQueryDto = z.infer<typeof AdminKindListQuerySchema>;
export type AdminPlanDto = z.infer<typeof AdminPlanSchema>;
export type AdminPlanCreateDto = z.infer<typeof AdminPlanCreateSchema>;
export type AdminPlanPatchDto = z.infer<typeof AdminPlanPatchSchema>;
export type AdminTextDto = z.infer<typeof AdminTextSchema>;
export type AdminTextPatchDto = z.infer<typeof AdminTextPatchSchema>;
export type AdminInquiryDto = z.infer<typeof AdminInquirySchema>;
export type AdminInquiryListQueryDto = z.infer<typeof AdminInquiryListQuerySchema>;
export type AdminInquiryPageDto = z.infer<typeof AdminInquiryPageSchema>;
export type AuditRowDto = z.infer<typeof AuditRowSchema>;
export type AdminErrorDto = z.infer<typeof AdminErrorSchema>;

const byId = z.object({ id });
const empty = z.object({}).strict();
/**
 * Takedowns (suspend, back to draft, delete, kind hidden, place no longer live) wait for the web
 * to drop its cached pages and say whether it did. false: the change is saved and out of search,
 * but public pages may still show it until a retry succeeds. Absent: nothing to confirm.
 */
const revalidated = { revalidated: z.boolean().optional() };
export const AdminRevalidateResultSchema = z.object({ revalidated: z.boolean() });
export type AdminRevalidateResultDto = z.infer<typeof AdminRevalidateResultSchema>;

export const adminContract = c.router({
  misc: c.router({
    me: { method: "GET", path: "/admin/me", responses: { 200: AdminMeSchema, ...guarded } },
    audit: {
      method: "GET",
      path: "/admin/audit",
      query: z.object({ entityType: z.enum(ADMIN_ENTITIES), entityId: id }),
      responses: { 200: z.array(AuditRowSchema), ...guarded },
    },
    /** Raw visitor search terms: sensitive (Plan 3 note). Admin only, never cached, never logged. */
    report: {
      method: "GET",
      path: "/admin/report",
      query: ReportQuerySchema,
      responses: { 200: MissingReportSchema, ...guarded },
    },
    /**
     * Clears editedAt: the next seed run overwrites the row again. A row with no seed counterpart
     * (seedSource false: created in admin) is refused with 409 code no_seed_source.
     */
    release: {
      method: "POST",
      path: "/admin/release/:entity/:id",
      pathParams: z.object({ entity: z.enum(ADMIN_ENTITIES), id }),
      body: empty,
      responses: { 200: z.object({ released: z.literal(true) }), ...writeErrors },
    },
    /** Retry: asks the web again to drop the entity's pages at once, and waits for the answer. */
    revalidate: {
      method: "POST",
      path: "/admin/revalidate/:entity/:id",
      pathParams: z.object({ entity: z.enum(ADMIN_ENTITIES), id }),
      body: empty,
      responses: { 200: AdminRevalidateResultSchema, ...writeErrors },
    },
  }),
  places: c.router({
    list: {
      method: "GET",
      path: "/admin/places",
      query: AdminListQuerySchema,
      responses: { 200: page(AdminPlaceSchema), ...guarded },
    },
    get: {
      method: "GET",
      path: "/admin/places/:id",
      pathParams: byId,
      responses: { 200: AdminPlaceSchema, 404: AdminErrorSchema, ...guarded },
    },
    create: {
      method: "POST",
      path: "/admin/places",
      body: AdminPlaceCreateSchema,
      responses: { 201: AdminPlaceSchema, ...writeErrors },
    },
    update: {
      method: "PATCH",
      path: "/admin/places/:id",
      pathParams: byId,
      body: AdminPlacePatchSchema,
      responses: { 200: AdminPlaceSchema.extend(revalidated), ...writeErrors },
    },
  }),
  sectors: c.router({
    list: {
      method: "GET",
      path: "/admin/sectors",
      responses: { 200: z.array(AdminSectorSchema), ...guarded },
    },
    create: {
      method: "POST",
      path: "/admin/sectors",
      body: AdminSectorCreateSchema,
      responses: { 201: AdminSectorSchema, ...writeErrors },
    },
    update: {
      method: "PATCH",
      path: "/admin/sectors/:id",
      pathParams: byId,
      body: AdminSectorPatchSchema,
      responses: { 200: AdminSectorSchema, ...writeErrors },
    },
  }),
  kinds: c.router({
    list: {
      method: "GET",
      path: "/admin/kinds",
      query: AdminKindListQuerySchema,
      responses: { 200: z.array(AdminKindSchema), ...guarded },
    },
    get: {
      method: "GET",
      path: "/admin/kinds/:id",
      pathParams: byId,
      responses: { 200: AdminKindSchema, 404: AdminErrorSchema, ...guarded },
    },
    create: {
      method: "POST",
      path: "/admin/kinds",
      body: AdminKindCreateSchema,
      responses: { 201: AdminKindSchema, ...writeErrors },
    },
    update: {
      method: "PATCH",
      path: "/admin/kinds/:id",
      pathParams: byId,
      body: AdminKindPatchSchema,
      responses: { 200: AdminKindSchema.extend(revalidated), ...writeErrors },
    },
  }),
  businesses: c.router({
    list: {
      method: "GET",
      path: "/admin/businesses",
      query: AdminBusinessListQuerySchema,
      responses: { 200: page(AdminBusinessRowSchema), ...guarded },
    },
    get: {
      method: "GET",
      path: "/admin/businesses/:id",
      pathParams: byId,
      responses: { 200: AdminBusinessSchema, 404: AdminErrorSchema, ...guarded },
    },
    create: {
      method: "POST",
      path: "/admin/businesses",
      body: AdminBusinessCreateSchema,
      responses: { 201: AdminBusinessSchema, ...writeErrors },
    },
    update: {
      method: "PATCH",
      path: "/admin/businesses/:id",
      pathParams: byId,
      body: AdminBusinessPatchSchema,
      responses: { 200: AdminBusinessSchema, ...writeErrors },
    },
    status: {
      method: "POST",
      path: "/admin/businesses/:id/status",
      pathParams: byId,
      body: AdminStatusSchema,
      responses: { 200: AdminBusinessSchema.extend(revalidated), ...writeErrors },
    },
    /** Only drafts the admin created; everything else is suspended instead. */
    remove: {
      method: "POST",
      path: "/admin/businesses/:id/delete",
      pathParams: byId,
      body: empty,
      responses: { 200: z.object({ deleted: z.literal(true), ...revalidated }), ...writeErrors },
    },
  }),
  plans: c.router({
    list: {
      method: "GET",
      path: "/admin/plans",
      responses: { 200: z.array(AdminPlanSchema), ...guarded },
    },
    get: {
      method: "GET",
      path: "/admin/plans/:id",
      pathParams: byId,
      responses: { 200: AdminPlanSchema, 404: AdminErrorSchema, ...guarded },
    },
    create: {
      method: "POST",
      path: "/admin/plans",
      body: AdminPlanCreateSchema,
      responses: { 201: AdminPlanSchema, ...writeErrors },
    },
    update: {
      method: "PATCH",
      path: "/admin/plans/:id",
      pathParams: byId,
      body: AdminPlanPatchSchema,
      responses: { 200: AdminPlanSchema, ...writeErrors },
    },
  }),
  texts: c.router({
    list: {
      method: "GET",
      path: "/admin/texts",
      responses: { 200: z.array(AdminTextSchema), ...guarded },
    },
    update: {
      method: "PATCH",
      path: "/admin/texts/:id",
      pathParams: byId,
      body: AdminTextPatchSchema,
      responses: { 200: AdminTextSchema, ...writeErrors },
    },
  }),
  inquiries: c.router({
    list: {
      method: "GET",
      path: "/admin/inquiries",
      query: AdminInquiryListQuerySchema,
      responses: { 200: AdminInquiryPageSchema, ...guarded },
    },
    /** Mark handled, or reopen. Not audited: an inquiry is mail, not site content. */
    status: {
      method: "PATCH",
      path: "/admin/inquiries/:id",
      pathParams: byId,
      body: AdminInquiryStatusSchema,
      responses: { 200: AdminInquirySchema, ...writeErrors },
    },
  }),
});
