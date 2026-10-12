import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  BusinessDetailSchema,
  BusinessSummarySchema,
  NotFoundSchema,
  PlaceDetailSchema,
  PlaceSchema,
  SlugSchema,
  TaxonomySchema,
} from "./schemas.js";

const c = initContract();

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
      query: z.object({
        lat: z.coerce.number().min(-90).max(90),
        lng: z.coerce.number().min(-180).max(180),
      }),
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
      }),
      responses: { 200: z.array(BusinessSummarySchema), 404: NotFoundSchema },
    },
    get: {
      method: "GET",
      path: "/places/:placeSlug/businesses/:slug",
      pathParams: z.object({ placeSlug: SlugSchema, slug: SlugSchema }),
      responses: { 200: BusinessDetailSchema, 404: NotFoundSchema },
    },
  },
});
