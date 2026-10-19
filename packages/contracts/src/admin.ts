import { initContract } from "@ts-rest/core";
import {
  isReservedSlug,
  ISRAEL_BOX,
  PLACE_STATUSES,
  PLACE_TYPES,
  TEMPLATES,
  TIERS,
} from "@darb/core";
import { z } from "zod";
import {
  CardStyleSchema,
  DietarySchema,
  HoursSchema,
  LinksInputSchema,
  LinksSchema,
  LocalizedSchema,
  LogoSchema,
  PhoneSchema,
  PhotoSchema,
  SlugSchema,
} from "./schemas.js";
import {
  CtaHrefSchema,
  LocalizedListSchema,
  LocalizedOptionalSchema,
  PlanSchema,
  ShekelsSchema,
  SiteTextKeySchema,
} from "./pricing.js";
import { INQUIRY_STATUSES, INQUIRY_TOPICS } from "./inquiry.js";
import {
  FieldCaptureCreateSchema,
  FieldCaptureSchema,
  FieldCapturesSchema,
  FieldDuplicateQuerySchema,
  FieldDuplicatesSchema,
  FieldStatusSchema,
} from "./field.js";
import { JOIN_SOURCES, JOIN_STATUSES, JoinSuggestionSchema } from "./join.js";
import { LocateQuerySchema, LocateResultSchema } from "./locate.js";
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
const phone = PhoneSchema;
const accent = z
  .string()
  .regex(/^#[0-9a-f]{6}$/, { message: "Use a lower-case hex colour like #d9a54c" });
const lat = z.number().min(ISRAEL_BOX.lat[0]).max(ISRAEL_BOX.lat[1]);
const lng = z.number().min(ISRAEL_BOX.lng[0]).max(ISRAEL_BOX.lng[1]);

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
/** Where a business came from, as the admin filters it. */
export const BUSINESS_ORIGINS = ["imported", "edited", "street", "join"] as const;
/** Gaps the overview counts and the businesses list filters by. */
export const BUSINESS_ISSUES = ["no-phone", "no-hours", "pin-at-centre", "pin-outside"] as const;
export type BusinessIssue = (typeof BUSINESS_ISSUES)[number];
const SortDir = z.enum(["asc", "desc"]);
/** 1-based page number; wins over `cursor` when both are given. */
const pageNumber = z.coerce.number().int().min(1).max(2000);
export const AdminBusinessListQuerySchema = AdminListQuerySchema.extend({
  place: SlugSchema.optional(),
  kind: SlugSchema.optional(),
  /** Showroom examples are left out unless asked for ("1"). */
  examples: z.enum(["0", "1"]).optional(),
  sector: SlugSchema.optional(),
  tier: z.enum(TIERS).optional(),
  source: z.enum(BUSINESS_ORIGINS).optional(),
  issue: z.enum(BUSINESS_ISSUES).optional(),
  sort: z.enum(["updated", "created", "name"]).optional(),
  dir: SortDir.optional(),
  page: pageNumber.optional(),
  /** The name's language for sort=name. */
  locale: LocaleSchema.optional(),
});
export const AdminPlaceListQuerySchema = AdminListQuerySchema.extend({
  type: z.enum(PLACE_TYPES).optional(),
  sort: z.enum(["name", "population", "businesses"]).optional(),
  dir: SortDir.optional(),
  page: pageNumber.optional(),
  locale: LocaleSchema.optional(),
});
export const AdminKindListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["active", "hidden"]).optional(),
  sector: id.optional(),
});
/** `total` counts every match (lists that report it); `nextCursor` stays for older callers. */
const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    nextCursor: z.string().nullable(),
    total: z.number().int().nonnegative().optional(),
  });

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
  /** List rows only: the parent's name and how many real businesses the place holds. */
  parentName: LocalizedSchema.nullable().optional(),
  businessCount: z.number().int().nonnegative().optional(),
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
  kindCount: z.number().int().nonnegative().optional(),
  businessCount: z.number().int().nonnegative().optional(),
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
  /** List rows: readable place and kind names, a thumbnail key (logo, else first photo). */
  placeName: LocalizedSchema.optional(),
  kindName: LocalizedSchema.optional(),
  thumb: z.string().nullable().optional(),
  createdAt: z.string().optional(),
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
  links: LinksInputSchema,
  logo: LogoSchema.nullable(),
  photos: z.array(PhotoSchema).max(12),
  cardStyle: CardStyleSchema,
});
export const AdminBusinessSchema = AdminBusinessRowSchema.extend(businessFields.shape).extend({
  links: LinksSchema,
  brandId: id.nullable(),
});
export const AdminBusinessCreateSchema = businessFields.extend({
  dietary: businessFields.shape.dietary.default([]),
  links: businessFields.shape.links.default({}),
  logo: businessFields.shape.logo.default(null),
  photos: businessFields.shape.photos.default([]),
  cardStyle: businessFields.shape.cardStyle.default({}),
  slug: NewSlugSchema,
  placeId: id,
  status: z.enum(["draft", "published"]).default("draft"),
});
export const AdminBusinessPatchSchema = businessFields.partial().strict();
export const AdminStatusSchema = z.object({
  status: BusinessStatus,
  immediate: z.boolean().optional(),
});
export const BULK_ACTIONS = ["publish", "draft", "suspend", "kind"] as const;
/** One change to many businesses; each one is written and audited on its own. */
export const AdminBulkSchema = z
  .object({
    ids: z.array(id).min(1).max(100),
    action: z.enum(BULK_ACTIONS),
    kindId: id.optional(),
  })
  .strict()
  .refine((b) => (b.action === "kind") === Boolean(b.kindId), {
    message: "kindId goes with the kind action, and only with it",
  });
export const AdminBulkResultSchema = z.object({
  changed: z.number().int().nonnegative(),
  unchanged: z.number().int().nonnegative(),
  /** Ids that do not exist (or could not change). */
  failed: z.array(id),
  /** Takedowns: false when the web did not confirm it dropped every page. */
  revalidated: z.boolean().optional(),
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

// Join requests (the /join form's queue)
export const AdminJoinRequestSchema = z.object({
  id,
  status: z.enum(JOIN_STATUSES),
  source: z.enum(JOIN_SOURCES),
  ownerName: z.string(),
  ownerPhone: z.string(),
  ownerEmail: z.string().nullable(),
  note: z.string().nullable(),
  locale: LocaleSchema,
  /** The business's name as sent, kept after a rejected draft is deleted. */
  businessName: LocalizedSchema,
  /** The draft (then published) business; null once a rejection deleted it. */
  businessId: id.nullable(),
  placeSlug: SlugSchema.nullable(),
  placeName: LocalizedSchema.nullable().optional(),
  /** The draft's first photo (for a street capture, the photo of its sign); null without one. */
  photo: z.string().nullable(),
  lookup: JoinSuggestionSchema.nullable(),
  rejectReason: z.string().nullable(),
  createdAt: z.string(),
  decidedAt: stamp,
  /** A helper's street capture (its creator is not an admin): who added it. */
  helper: z.object({ id, name: z.string() }).nullable().default(null),
});
export const AdminJoinListQuerySchema = z.object({
  status: z.enum(JOIN_STATUSES).optional(),
  /** Only this helper's additions (from the Helpers screen). */
  helper: id.optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
/** Pending first, then newest; `newCount` is every pending request (the nav's badge). */
export const AdminJoinPageSchema = z.object({
  items: z.array(AdminJoinRequestSchema),
  nextCursor: z.string().nullable(),
  newCount: z.number().int().nonnegative(),
});
export const AdminJoinRejectSchema = z
  .object({ reason: z.string().trim().min(2).max(500) })
  .strict();

// Helpers (friends who add businesses from their towns)
export const ADMIN_HELPER_STATUSES = ["pending", "approved", "paused"] as const;
export const AdminHelperSchema = z.object({
  id,
  status: z.enum(ADMIN_HELPER_STATUSES),
  name: z.string(),
  phone: z.string().nullable(),
  placeName: LocalizedSchema.nullable(),
  note: z.string().nullable(),
  credit: z.boolean(),
  appliedAt: stamp,
  decidedAt: stamp,
  /** Their street captures: every one, and how the review went (the acceptance rate). */
  added: z.number().int().nonnegative(),
  approved: z.number().int().nonnegative(),
  rejected: z.number().int().nonnegative(),
});
export const AdminHelperListQuerySchema = z.object({
  status: z.enum(ADMIN_HELPER_STATUSES).default("pending"),
});
/** One tab's helpers (waiting: oldest first; the rest: newest decision first), and every tab's count. */
export const AdminHelperPageSchema = z.object({
  items: z.array(AdminHelperSchema),
  counts: z.object({
    pending: z.number().int().nonnegative(),
    approved: z.number().int().nonnegative(),
    paused: z.number().int().nonnegative(),
  }),
});

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

/** One search word added to a kind (from the search gaps), in the language it was typed in. */
export const AdminSynonymSchema = z
  .object({ locale: LocaleSchema, word: z.string().trim().min(1).max(80) })
  .strict();

// Overview and the command palette
export const AdminOverviewSchema = z.object({
  counts: z.object({
    published: z.number().int(),
    draft: z.number().int(),
    suspended: z.number().int(),
    /** Created this week by people (admin, join form, street), not by the seed import. */
    addedThisWeek: z.number().int(),
    placesLive: z.number().int(),
    placesTotal: z.number().int(),
    kindsActive: z.number().int(),
    kindsHidden: z.number().int(),
    pendingJoins: z.number().int(),
    streetPending: z.number().int(),
    /** People who applied to be helpers and wait for an answer. */
    helpersWaiting: z.number().int(),
    newInquiries: z.number().int(),
  }),
  /** Published businesses with a gap, by issue. */
  attention: z.record(z.enum(BUSINESS_ISSUES), z.number().int()),
  /** Businesses added by people per day, oldest first, last 14 days (Asia/Jerusalem days). */
  added: z.array(z.object({ day: z.string(), count: z.number().int() })),
  activity: z.array(
    AuditRowSchema.extend({
      /** The entity's readable name, null once it is gone. */
      name: LocalizedSchema.nullable(),
      self: z.boolean(),
    }),
  ),
  generatedAt: z.string(),
});
export const AdminSearchQuerySchema = z.object({ q: z.string().trim().min(1).max(80) });
const hit = z.object({ id, slug: z.string(), name: LocalizedSchema });
export const AdminSearchSchema = z.object({
  businesses: z.array(
    hit.extend({
      placeName: LocalizedSchema,
      status: BusinessStatus,
      thumb: z.string().nullable(),
    }),
  ),
  places: z.array(hit.extend({ status: z.enum(PLACE_STATUSES), type: z.enum(PLACE_TYPES) })),
  kinds: z.array(hit.extend({ status: z.enum(["active", "hidden"]) })),
  sectors: z.array(hit.extend({ accent: z.string() })),
});

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
export type AdminJoinRequestDto = z.infer<typeof AdminJoinRequestSchema>;
export type AdminJoinListQueryDto = z.infer<typeof AdminJoinListQuerySchema>;
export type AdminJoinPageDto = z.infer<typeof AdminJoinPageSchema>;
export type AdminHelperDto = z.infer<typeof AdminHelperSchema>;
export type AdminHelperListQueryDto = z.infer<typeof AdminHelperListQuerySchema>;
export type AdminHelperPageDto = z.infer<typeof AdminHelperPageSchema>;
export type AuditRowDto = z.infer<typeof AuditRowSchema>;
export type AdminErrorDto = z.infer<typeof AdminErrorSchema>;
export type AdminPlaceListQueryDto = z.infer<typeof AdminPlaceListQuerySchema>;
export type AdminBulkDto = z.infer<typeof AdminBulkSchema>;
export type AdminBulkResultDto = z.infer<typeof AdminBulkResultSchema>;
export type AdminOverviewDto = z.infer<typeof AdminOverviewSchema>;
export type AdminSearchDto = z.infer<typeof AdminSearchSchema>;
export type AdminSynonymDto = z.infer<typeof AdminSynonymSchema>;

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
    /** The dashboard's numbers, queue and activity (cached briefly by the API). */
    overview: {
      method: "GET",
      path: "/admin/overview",
      responses: { 200: AdminOverviewSchema, ...guarded },
    },
    /** The command palette: a few of each, by name or address. */
    search: {
      method: "GET",
      path: "/admin/search",
      query: AdminSearchQuerySchema,
      responses: { 200: AdminSearchSchema, 400: AdminErrorSchema, ...guarded },
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
      query: AdminPlaceListQuerySchema,
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
    /** Adds one search word (a search gap) to the kind's words, audited like any update. */
    synonym: {
      method: "POST",
      path: "/admin/kinds/:id/synonym",
      pathParams: byId,
      body: AdminSynonymSchema,
      responses: { 200: AdminKindSchema, ...writeErrors },
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
    /** Publish, back to draft, suspend or move to another kind, many at once. */
    bulk: {
      method: "POST",
      path: "/admin/businesses/bulk",
      body: AdminBulkSchema,
      responses: { 200: AdminBulkResultSchema, ...writeErrors },
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
  joinRequests: c.router({
    list: {
      method: "GET",
      path: "/admin/join-requests",
      query: AdminJoinListQuerySchema,
      responses: { 200: AdminJoinPageSchema, ...guarded },
    },
    get: {
      method: "GET",
      path: "/admin/join-requests/:id",
      pathParams: byId,
      responses: { 200: AdminJoinRequestSchema, 404: AdminErrorSchema, ...guarded },
    },
    /** Publishes the draft as it now stands (edit it first in the business form), audited. */
    approve: {
      method: "POST",
      path: "/admin/join-requests/:id/approve",
      pathParams: byId,
      body: empty,
      responses: { 200: AdminJoinRequestSchema.extend(revalidated), ...writeErrors },
    },
    /** Deletes the draft and its photos; the request stays, with the reason. */
    reject: {
      method: "POST",
      path: "/admin/join-requests/:id/reject",
      pathParams: byId,
      body: AdminJoinRejectSchema,
      responses: { 200: AdminJoinRequestSchema, ...writeErrors },
    },
  }),
  /**
   * Add from the street. The photo and the sign reading take the image itself as the request body,
   * outside this contract: POST /admin/field/photo and POST /admin/field/read.
   */
  field: c.router({
    status: {
      method: "GET",
      path: "/admin/field/status",
      responses: { 200: FieldStatusSchema, ...guarded },
    },
    duplicates: {
      method: "POST",
      path: "/admin/field/duplicates",
      body: FieldDuplicateQuerySchema,
      responses: { 200: FieldDuplicatesSchema, 400: AdminErrorSchema, ...guarded },
    },
    /** A draft business and its request in the join queue; the same clientId answers the first. */
    create: {
      method: "POST",
      path: "/admin/field/captures",
      body: FieldCaptureCreateSchema,
      responses: { 200: FieldCaptureSchema, 201: FieldCaptureSchema, ...writeErrors },
    },
    mine: {
      method: "GET",
      path: "/admin/field/captures",
      responses: { 200: FieldCapturesSchema, ...guarded },
    },
  }),
  /** Helpers: approve a waiting one, pause an active one, resume a paused one; audited. */
  helpers: c.router({
    list: {
      method: "GET",
      path: "/admin/helpers",
      query: AdminHelperListQuerySchema,
      responses: { 200: AdminHelperPageSchema, ...guarded },
    },
    approve: {
      method: "POST",
      path: "/admin/helpers/:id/approve",
      pathParams: byId,
      body: empty,
      responses: { 200: AdminHelperSchema, ...writeErrors },
    },
    pause: {
      method: "POST",
      path: "/admin/helpers/:id/pause",
      pathParams: byId,
      body: empty,
      responses: { 200: AdminHelperSchema, ...writeErrors },
    },
    resume: {
      method: "POST",
      path: "/admin/helpers/:id/resume",
      pathParams: byId,
      body: empty,
      responses: { 200: AdminHelperSchema, ...writeErrors },
    },
  }),
  /** Find the place: an address or a map link to a point for the pin. Never fails loudly. */
  locate: {
    method: "POST",
    path: "/admin/locate",
    body: LocateQuerySchema,
    responses: { 200: LocateResultSchema, 400: AdminErrorSchema, ...guarded },
  },
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
