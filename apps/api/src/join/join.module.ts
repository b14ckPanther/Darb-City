import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { MediaModule } from "../media/media.js";
import { RateLimiter } from "../search/rate-limiter.js";
import { Geocoder } from "./geocoder.js";
import { JoinController, JoinPhotosController } from "./join.controller.js";
import { JoinService } from "./join.service.js";
import { LOOKUP_AI, lookupAiFor } from "./lookup-ai.js";

/** The /join form: the lookup, photo uploads and the draft it leaves for the admin's queue. */
@Module({
  imports: [MediaModule],
  controllers: [JoinController, JoinPhotosController],
  providers: [
    JoinService,
    Geocoder,
    RateLimiter,
    {
      provide: LOOKUP_AI,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) =>
        lookupAiFor({ ...config.join, apiKey: config.search.anthropicApiKey }),
    },
  ],
  /** One Nominatim queue for the whole process (its one-a-second policy): admin's Find the place too. */
  exports: [Geocoder],
})
export class JoinModule {}
