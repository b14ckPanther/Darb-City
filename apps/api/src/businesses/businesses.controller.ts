import { Controller, Inject } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { PlacesRepository } from "../places/places.repository.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TaxonomyRepository } from "../taxonomy/taxonomy.repository.js";
import { toBusinessDetail, toBusinessSummary } from "./business.mapper.js";
import { BusinessesRepository } from "./businesses.repository.js";
import { decodeCursor, encodeCursor } from "./cursor.js";

export const CLOCK = Symbol("CLOCK");
export type Clock = () => Date;

@Controller()
export class BusinessesController {
  constructor(
    private readonly prisma: PrismaService,
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
        });
        return {
          status: 200,
          body: {
            items: rows.map((r) => toBusinessSummary(r, r.place.slug, now)),
            nextCursor: hasMore ? encodeCursor(offset + query.limit) : null,
          },
        };
      },
      get: async ({ params }) => {
        const row = await this.prisma.business.findFirst({
          where: { slug: params.slug, status: "published", place: { slug: params.placeSlug } },
          include: { kinds: { select: { kindId: true } } },
        });
        if (!row)
          return {
            status: 404,
            body: { message: `No business "${params.slug}" in "${params.placeSlug}"` },
          };
        return { status: 200, body: toBusinessDetail(row, params.placeSlug, this.clock()) };
      },
    });
  }
}
