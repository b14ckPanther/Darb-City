import { Controller, Inject } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { toPlaceDto } from "../places/place.mapper.js";
import { PlacesRepository } from "../places/places.repository.js";
import { TaxonomyRepository } from "../taxonomy/taxonomy.repository.js";
import { toBusinessDetail, toBusinessSummary } from "./business.mapper.js";
import { BusinessesRepository } from "./businesses.repository.js";
import { decodeCursor, encodeCursor } from "./cursor.js";

export const CLOCK = Symbol("CLOCK");
export type Clock = () => Date;

@Controller()
export class BusinessesController {
  constructor(
    private readonly places: PlacesRepository,
    private readonly taxonomy: TaxonomyRepository,
    private readonly businesses: BusinessesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @TsRestHandler(contract.businesses)
  handler() {
    return tsRestHandler(contract.businesses, {
      list: async ({ params, query }) => {
        const place = await this.places.bySlug(params.placeSlug);
        if (!place) return { status: 404, body: { message: `No place "${params.placeSlug}"` } };
        const offset = decodeCursor(query.cursor);
        if (offset === null) return { status: 400, body: { message: "Invalid cursor" } };
        let kindIds: string[] | undefined;
        if (query.kind) {
          const kind = await this.taxonomy.activeKindBySlug(query.kind);
          if (!kind) return { status: 404, body: { message: `No kind "${query.kind}"` } };
          kindIds = await this.taxonomy.descendantKindIds(kind.id);
        }
        const now = this.clock();
        const { rows, hasMore } = await this.businesses.page({
          placeIds: await this.places.subtreeIds(place),
          kindIds,
          offset,
          limit: query.limit,
          openAt: query.openNow ? now : null,
          delivers: query.delivers ?? false,
          near:
            query.lat !== undefined && query.lng !== undefined
              ? { lat: query.lat, lng: query.lng }
              : null,
        });
        return {
          status: 200,
          body: {
            items: rows.map((r) => ({
              ...toBusinessSummary(r, r.place.slug, now),
              ...(r.distanceKm === null ? {} : { distanceKm: r.distanceKm }),
            })),
            nextCursor: hasMore ? encodeCursor(offset + query.limit) : null,
          },
        };
      },
      get: async ({ params }) => {
        const place = await this.places.bySlug(params.placeSlug);
        const row = place ? await this.businesses.detail(place.path, params.slug) : null;
        if (!row)
          return {
            status: 404,
            body: { message: `No business "${params.slug}" in "${params.placeSlug}"` },
          };
        return { status: 200, body: toBusinessDetail(row, row.place.slug, this.clock()) };
      },
      kindCounts: async ({ params }) => {
        const place = await this.places.bySlug(params.placeSlug);
        if (!place) return { status: 404, body: { message: `No place "${params.placeSlug}"` } };
        return { status: 200, body: await this.businesses.countsByKind(place.path) };
      },
      nearestPlaces: async ({ params, query }) => {
        const kind = await this.taxonomy.activeKindBySlug(params.kindSlug);
        if (!kind) return { status: 404, body: { message: `No kind "${params.kindSlug}"` } };
        const kindIds = await this.taxonomy.descendantKindIds(kind.id);
        const rows = await this.businesses.nearestPlacesWithKind(
          kindIds,
          query.lat,
          query.lng,
          query.limit,
        );
        return {
          status: 200,
          body: rows.map((r) => ({
            ...toPlaceDto(r.place),
            count: r.count,
            distanceKm: r.distanceKm,
          })),
        };
      },
      density: async () => ({ status: 200, body: await this.businesses.density() }),
    });
  }
}
