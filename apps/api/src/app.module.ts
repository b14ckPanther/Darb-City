import { Module } from "@nestjs/common";
import { BusinessesModule } from "./businesses/businesses.module.js";
import { HealthController } from "./health/health.controller.js";
import { PlacesModule } from "./places/places.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { TaxonomyModule } from "./taxonomy/taxonomy.module.js";

@Module({
  imports: [PrismaModule, PlacesModule, TaxonomyModule, BusinessesModule],
  controllers: [HealthController],
})
export class AppModule {}
