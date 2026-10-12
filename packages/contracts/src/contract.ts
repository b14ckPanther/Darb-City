import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  BadRequestSchema,
  BusinessDetailSchema,
  BusinessPageSchema,
  KindCountsSchema,
  NearestPlaceSchema,
  NotFoundSchema,
  PlaceDetailSchema,
  PlaceSchema,
  SlugSchema,
  TaxonomySchema,
} from "./schemas.js";

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
      query: z.object({
        kind: SlugSchema.optional(),
        openNow: z
          .enum(["true", "false"])
          .transform((v) => v === "true")
          .optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        cursor: z.string().min(1).max(512).optional(),
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
  },
});
