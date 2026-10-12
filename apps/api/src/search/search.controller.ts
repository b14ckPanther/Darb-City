import { Controller, Inject, Req } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { clientIp, type ClientRequest } from "./client-ip.js";
import { RateLimiter } from "./rate-limiter.js";
import { SearchLogRepository } from "./search-log.repository.js";
import { SmartSearchService } from "./smart-search.service.js";
import { SuggestRepository } from "./suggest.repository.js";

const tooMany = (retryAfter: number) => ({
  status: 429 as const,
  body: { message: "Too many searches, try again in a minute", retryAfter },
});

@Controller()
export class SearchController {
  constructor(
    private readonly smart: SmartSearchService,
    private readonly suggestions: SuggestRepository,
    private readonly log: SearchLogRepository,
    private readonly limiter: RateLimiter,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  @TsRestHandler(contract.search)
  handler(@Req() req: ClientRequest) {
    const ip = () => clientIp(req, this.config.search.proxyKey);
    return tsRestHandler(contract.search, {
      suggest: async ({ query }) => ({
        status: 200,
        body: await this.suggestions.suggest(query.q, { place: query.place, limit: query.limit }),
      }),
      search: async ({ body }) => {
        const gate = await this.limiter.hit("search", ip(), this.config.search.rateLimit);
        if (!gate.ok) return tooMany(gate.retryAfter);
        return { status: 200, body: await this.smart.search(body) };
      },
      results: async ({ body }) => {
        const gate = await this.limiter.hit("results", ip(), this.config.search.resultsRateLimit);
        if (!gate.ok) return tooMany(gate.retryAfter);
        const out = await this.smart.results(body);
        return out
          ? { status: 200, body: out }
          : { status: 400, body: { message: "Unknown kind or place" } };
      },
      click: async ({ body }) =>
        (await this.log.click(body.queryId, body.key))
          ? { status: 204, body: undefined }
          : { status: 404, body: { message: "No such search" } },
      report: async () => ({ status: 404, body: { message: "Not found" } }), // Task 19
    });
  }
}
