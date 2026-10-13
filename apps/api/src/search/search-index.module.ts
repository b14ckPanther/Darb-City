import { Module } from "@nestjs/common";
import { SearchEvents, SearchIndexWorker } from "./index-queue.js";
import { SearchIndexer } from "./indexer.service.js";
import { InstantInvalidation } from "./instant-invalidation.js";
import { InstantService } from "./instant.service.js";

/**
 * The instant index lives here so SearchEvents and the worker can rebuild it; modules that
 * match queries import this one and use the exported InstantService (one cache per process).
 */
@Module({
  providers: [SearchIndexer, SearchEvents, SearchIndexWorker, InstantService, InstantInvalidation],
  exports: [SearchIndexer, SearchEvents, InstantService, InstantInvalidation],
})
export class SearchIndexModule {}
