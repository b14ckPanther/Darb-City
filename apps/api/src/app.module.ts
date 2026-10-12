import { Module } from "@nestjs/common";
import { AiModule } from "./ai/ai.module.js";
import { BusinessesModule } from "./businesses/businesses.module.js";
import { HealthController } from "./health/health.controller.js";
import { PlacesModule } from "./places/places.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { TaxonomyModule } from "./taxonomy/taxonomy.module.js";

@Module({
  imports: [PrismaModule, RedisModule, AiModule, PlacesModule, TaxonomyModule, BusinessesModule],
  controllers: [HealthController],
})
export class AppModule {}
