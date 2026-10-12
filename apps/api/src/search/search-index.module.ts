import { Module } from "@nestjs/common";
import { SearchEvents, SearchIndexWorker } from "./index-queue.js";
import { SearchIndexer } from "./indexer.service.js";

@Module({
  providers: [SearchIndexer, SearchEvents, SearchIndexWorker],
  exports: [SearchIndexer, SearchEvents],
})
export class SearchIndexModule {}
