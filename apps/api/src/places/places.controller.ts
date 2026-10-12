import { Controller } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { toPlaceDto } from "./place.mapper.js";
import { PlacesRepository } from "./places.repository.js";

@Controller()
export class PlacesController {
  constructor(private readonly places: PlacesRepository) {}

  @TsRestHandler(contract.places)
  handler() {
    return tsRestHandler(contract.places, {
      list: async ({ query }) => {
        const rows = await this.places.listSettlements(query.status);
        return { status: 200, body: rows.map(toPlaceDto) };
      },
      get: async ({ params }) => {
        const place = await this.places.bySlug(params.slug);
        if (!place) return { status: 404, body: { message: `No place "${params.slug}"` } };
        const [ancestors, children] = await Promise.all([
          this.places.ancestors(place),
          this.places.children(place.id),
        ]);
        return {
          status: 200,
          body: {
            ...toPlaceDto(place),
            ancestors: ancestors.map(toPlaceDto),
            children: children.map(toPlaceDto),
          },
        };
      },
      nearest: async ({ query }) => {
        const place = await this.places.nearestLive(query.lat, query.lng);
        if (!place) return { status: 404, body: { message: "No live place yet" } };
        return { status: 200, body: toPlaceDto(place) };
      },
    });
  }
}
