import { Module } from "@nestjs/common";
import { PlacesModule } from "../places/places.module.js";
import { TaxonomyModule } from "../taxonomy/taxonomy.module.js";
import { BusinessesController, CLOCK } from "./businesses.controller.js";
import { BusinessesRepository } from "./businesses.repository.js";

@Module({
  imports: [PlacesModule, TaxonomyModule],
  controllers: [BusinessesController],
  providers: [BusinessesRepository, { provide: CLOCK, useValue: () => new Date() }],
})
export class BusinessesModule {}
