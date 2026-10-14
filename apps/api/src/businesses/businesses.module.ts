import { Module } from "@nestjs/common";
import { PlacesModule } from "../places/places.module.js";
import { TaxonomyModule } from "../taxonomy/taxonomy.module.js";
import { BusinessesController, CLOCK } from "./businesses.controller.js";
import { BusinessesRepository } from "./businesses.repository.js";
import { SitemapController } from "./sitemap.controller.js";

@Module({
  imports: [PlacesModule, TaxonomyModule],
  controllers: [BusinessesController, SitemapController],
  providers: [BusinessesRepository, { provide: CLOCK, useValue: () => new Date() }],
  exports: [BusinessesRepository, CLOCK],
})
export class BusinessesModule {}
