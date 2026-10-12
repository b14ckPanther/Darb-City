import { Module } from "@nestjs/common";
import { PlacesModule } from "../places/places.module.js";
import { TaxonomyModule } from "../taxonomy/taxonomy.module.js";
import { BusinessesController, CLOCK } from "./businesses.controller.js";

@Module({
  imports: [PlacesModule, TaxonomyModule],
  controllers: [BusinessesController],
  providers: [{ provide: CLOCK, useValue: () => new Date() }],
})
export class BusinessesModule {}
