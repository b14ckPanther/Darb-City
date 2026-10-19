import { Module } from "@nestjs/common";
import { AdminModule } from "./admin/admin.module.js";
import { AiModule } from "./ai/ai.module.js";
import { BusinessesModule } from "./businesses/businesses.module.js";
import { HealthController } from "./health/health.controller.js";
import { HelpersModule } from "./helpers/helpers.module.js";
import { InquiriesModule } from "./inquiries/inquiries.module.js";
import { JoinModule } from "./join/join.module.js";
import { PlacesModule } from "./places/places.module.js";
import { PricingModule } from "./pricing/pricing.module.js";
import { PrismaModule } from "./prisma/prisma.module.js";
import { RedisModule } from "./redis/redis.module.js";
import { SearchModule } from "./search/search.module.js";
import { TaxonomyModule } from "./taxonomy/taxonomy.module.js";

@Module({
  imports: [
    PrismaModule,
    RedisModule,
    AiModule,
    PlacesModule,
    TaxonomyModule,
    BusinessesModule,
    SearchModule,
    PricingModule,
    InquiriesModule,
    JoinModule,
    AdminModule,
    HelpersModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
