import { Module } from "@nestjs/common";
import { BusinessesModule } from "../businesses/businesses.module.js";
import { PlacesModule } from "../places/places.module.js";
import { TaxonomyModule } from "../taxonomy/taxonomy.module.js";
import { IntentService } from "./intent.service.js";
import { ModelBudget } from "./model-budget.js";
import { RateLimiter } from "./rate-limiter.js";
import { ReportRepository } from "./report.repository.js";
import { SearchLogRetention } from "./retention.js";
import { RetrievalRepository } from "./retrieval.repository.js";
import { SearchIndexModule } from "./search-index.module.js";
import { SearchLogRepository } from "./search-log.repository.js";
import { SearchController } from "./search.controller.js";
import { SmartSearchService } from "./smart-search.service.js";
import { SuggestRepository } from "./suggest.repository.js";

/** InstantService comes from SearchIndexModule (one instant index cache per process). */
@Module({
  imports: [PlacesModule, TaxonomyModule, BusinessesModule, SearchIndexModule],
  controllers: [SearchController],
  providers: [
    IntentService,
    ModelBudget,
    RateLimiter,
    ReportRepository,
    RetrievalRepository,
    SearchLogRepository,
    SearchLogRetention,
    SmartSearchService,
    SuggestRepository,
  ],
})
export class SearchModule {}
