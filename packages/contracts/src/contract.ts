import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  BadRequestSchema,
  DietarySchema,
  BusinessDetailSchema,
  BusinessPageSchema,
  DensitySchema,
  KindCountsSchema,
  PlaceCountsSchema,
  NearestPlaceSchema,
  NotFoundSchema,
  PlaceDetailSchema,
  PlaceSchema,
  SitemapBusinessSchema,
  SlugSchema,
  TaxonomySchema,
} from "./schemas.js";
import {
  ClickRequestSchema,
  InstantIndexSchema,
  MissingReportSchema,
  ReportQuerySchema,
  ResultsRequestSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  SuggestQuerySchema,
  SuggestionSchema,
  TooManySchema,
} from "./search.js";
import { adminContract } from "./admin.js";
import { InquiryAcceptedSchema, InquiryCreateSchema } from "./inquiry.js";
import {
  JoinAcceptedSchema,
  JoinCreateSchema,
  JoinLookupRequestSchema,
  JoinStatusSchema,
  JoinSuggestionSchema,
} from "./join.js";
import { PricingSchema } from "./pricing.js";
import { helpersContract } from "./helpers.js";

const c = initContract();

/**
 * A point in a JSON body. Coordinates never travel in a URL (spec §5.4): query strings end up in
 * access logs, proxies and caches, and a visitor's position must not be stored anywhere.
 */
export const PointBodySchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

/** Filters of a place's business list. Shared by the cached list and the near-sorted POST. */
const BusinessListQuerySchema = z.object({
  kind: SlugSchema.optional(),
  openNow: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  delivers: z
    .enum(["true", "false"])
    .transform((v) => v === "true")
    .optional(),
  /** Only businesses with this whole-business dietary fact (dietary=gluten_free). */
  dietary: DietarySchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(30),
  cursor: z.string().min(1).max(512).optional(),
});

export const contract = c.router({
  places: {
    list: {
      method: "GET",
      path: "/places",
      query: z.object({ status: z.enum(["live", "soon"]).optional() }),
      responses: { 200: z.array(PlaceSchema) },
    },
    get: {
      method: "GET",
      path: "/places/:slug",
      pathParams: z.object({ slug: SlugSchema }),
      responses: { 200: PlaceDetailSchema, 404: NotFoundSchema },
    },
    /** The nearest live settlement to a point (POST: the point stays out of the URL). */
    nearest: {
      method: "POST",
      path: "/nearest-place",
      body: PointBodySchema,
      responses: { 200: PlaceSchema, 404: NotFoundSchema },
    },
  },
  taxonomy: {
    get: { method: "GET", path: "/taxonomy", responses: { 200: TaxonomySchema } },
  },
  businesses: {
    list: {
      method: "GET",
      path: "/places/:placeSlug/businesses",
      pathParams: z.object({ placeSlug: SlugSchema }),
      query: BusinessListQuerySchema,
      responses: { 200: BusinessPageSchema, 400: BadRequestSchema, 404: NotFoundSchema },
    },
    /** The same list sorted by distance from a point in the body. Used once, never stored or logged. */
    listNear: {
      method: "POST",
      path: "/places/:placeSlug/businesses/near",
      pathParams: z.object({ placeSlug: SlugSchema }),
      query: BusinessListQuerySchema,
      body: PointBodySchema,
      responses: { 200: BusinessPageSchema, 400: BadRequestSchema, 404: NotFoundSchema },
    },
    /**
     * A business anywhere in the place's subtree, so a city's list can open one from its
     * neighbourhoods. `placeSlug` in the body is the business's own place. When places in the
     * subtree share the slug, the place itself wins, then the shallowest, then the first path.
     */
    get: {
      method: "GET",
      path: "/places/:placeSlug/businesses/:slug",
      pathParams: z.object({ placeSlug: SlugSchema, slug: SlugSchema }),
      responses: { 200: BusinessDetailSchema, 404: NotFoundSchema },
    },
    kindCounts: {
      method: "GET",
      path: "/places/:placeSlug/kind-counts",
      pathParams: z.object({ placeSlug: SlugSchema }),
      responses: { 200: KindCountsSchema, 404: NotFoundSchema },
    },
    nearestPlaces: {
      method: "POST",
      path: "/kinds/:kindSlug/nearest-places",
      pathParams: z.object({ kindSlug: SlugSchema }),
      body: PointBodySchema.extend({ limit: z.number().int().min(1).max(20).default(5) }),
      responses: { 200: z.array(NearestPlaceSchema), 404: NotFoundSchema },
    },
    density: {
      method: "GET",
      path: "/density",
      responses: { 200: DensitySchema },
    },
    placeCounts: {
      method: "GET",
      path: "/place-counts",
      responses: { 200: PlaceCountsSchema },
    },
  },
  search: {
    suggest: {
      method: "GET",
      path: "/search/suggest",
      query: SuggestQuerySchema,
      responses: { 200: z.array(SuggestionSchema), 429: TooManySchema },
    },
    search: {
      method: "POST",
      path: "/search",
      body: SearchRequestSchema,
      responses: { 200: SearchResponseSchema, 400: BadRequestSchema, 429: TooManySchema },
    },
    results: {
      method: "POST",
      path: "/search/results",
      body: ResultsRequestSchema,
      responses: { 200: SearchResponseSchema, 400: BadRequestSchema, 429: TooManySchema },
    },
    click: {
      method: "POST",
      path: "/search/click",
      body: ClickRequestSchema,
      responses: {
        204: c.noBody(),
        400: BadRequestSchema,
        404: NotFoundSchema,
        429: TooManySchema,
      },
    },
    /** The Missing kinds and places report (Plan 4's admin screen reads it). */
    report: {
      method: "GET",
      path: "/search/report",
      headers: z.object({ "x-darb-report-key": z.string().optional() }),
      query: ReportQuerySchema,
      responses: { 200: MissingReportSchema, 404: NotFoundSchema },
    },
    /** The live instant index (admin-added places and kinds appear without a web build). */
    instantIndex: {
      method: "GET",
      path: "/search/instant-index",
      responses: { 200: InstantIndexSchema },
    },
  },
  pricing: {
    /** Live plans in order, and the page's copy. */
    get: { method: "GET", path: "/pricing", responses: { 200: PricingSchema } },
  },
  inquiries: {
    /** The /contact form: stored for the admin inbox and mailed to the founder. */
    create: {
      method: "POST",
      path: "/inquiries",
      body: InquiryCreateSchema,
      responses: { 201: InquiryAcceptedSchema, 400: BadRequestSchema, 429: TooManySchema },
    },
  },
  join: {
    status: { method: "GET", path: "/join/status", responses: { 200: JoinStatusSchema } },
    /**
     * Finds the business from a link, a point or its name: map links are read here, addresses
     * come from OpenStreetMap, the rest from a web search by the model. Never stores anything.
     */
    lookup: {
      method: "POST",
      path: "/join/lookup",
      body: JoinLookupRequestSchema,
      responses: { 200: JoinSuggestionSchema, 400: BadRequestSchema, 429: TooManySchema },
    },
    /** A draft business and its request for the admin queue. Photos go to /join/photos first. */
    create: {
      method: "POST",
      path: "/join",
      body: JoinCreateSchema,
      responses: { 201: JoinAcceptedSchema, 400: BadRequestSchema, 429: TooManySchema },
    },
  },
  sitemap: {
    businesses: {
      method: "GET",
      path: "/sitemap/businesses",
      responses: { 200: z.array(SitemapBusinessSchema) },
    },
  },
  admin: adminContract,
  helpers: helpersContract,
});
