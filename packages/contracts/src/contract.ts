import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  BadRequestSchema,
  BusinessDetailSchema,
  BusinessPageSchema,
  DensitySchema,
  KindCountsSchema,
  NearestPlaceSchema,
  NotFoundSchema,
  PlaceDetailSchema,
  PlaceSchema,
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

const c = initContract();

/** A coordinate from a query string. Blank strings are rejected instead of coerced to 0. */
const coordinate = (min: number, max: number) =>
  z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number().min(min).max(max));

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
    nearest: {
      method: "GET",
      path: "/nearest-place",
      query: z.object({ lat: coordinate(-90, 90), lng: coordinate(-180, 180) }),
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
      query: z
        .object({
          kind: SlugSchema.optional(),
          openNow: z
            .enum(["true", "false"])
            .transform((v) => v === "true")
            .optional(),
          delivers: z
            .enum(["true", "false"])
            .transform((v) => v === "true")
            .optional(),
          /** With lng: sort by distance from this point. Used once, never stored or logged. */
          lat: coordinate(-90, 90).optional(),
          lng: coordinate(-180, 180).optional(),
          limit: z.coerce.number().int().min(1).max(100).default(30),
          cursor: z.string().min(1).max(512).optional(),
        })
        .refine((q) => (q.lat === undefined) === (q.lng === undefined), {
          message: "lat and lng go together",
        }),
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
      method: "GET",
      path: "/kinds/:kindSlug/nearest-places",
      pathParams: z.object({ kindSlug: SlugSchema }),
      query: z.object({
        lat: coordinate(-90, 90),
        lng: coordinate(-180, 180),
        limit: z.coerce.number().int().min(1).max(20).default(5),
      }),
      responses: { 200: z.array(NearestPlaceSchema), 404: NotFoundSchema },
    },
    density: {
      method: "GET",
      path: "/density",
      responses: { 200: DensitySchema },
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
  admin: adminContract,
});
