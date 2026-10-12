import { Module } from "@nestjs/common";
import { TaxonomyController } from "./taxonomy.controller.js";
import { TaxonomyRepository } from "./taxonomy.repository.js";

@Module({
  controllers: [TaxonomyController],
  providers: [TaxonomyRepository],
  exports: [TaxonomyRepository],
})
export class TaxonomyModule {}
