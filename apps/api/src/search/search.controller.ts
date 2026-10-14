import { createHash, timingSafeEqual } from "node:crypto";
import { Controller, Inject, Req } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { CLOCK, type Clock } from "../businesses/businesses.controller.js";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { clientIp, proxied, type ClientRequest } from "./client-ip.js";
import { InstantService } from "./instant.service.js";
import { RateLimiter } from "./rate-limiter.js";
import { ReportRepository } from "./report.repository.js";
import { SearchLogRepository } from "./search-log.repository.js";
import { SmartSearchService } from "./smart-search.service.js";
import { SuggestRepository } from "./suggest.repository.js";

/**
 * Fixed-size digests, so the constant-time compare never sees unequal lengths (a same-length key
 * in other UTF-8 bytes would make timingSafeEqual throw) and never leaks the key's length.
 */
const digest = (s: string) => createHash("sha256").update(s).digest();

/** Wrong report keys an IP may send in a minute. */
export const REPORT_GUESSES = 10;

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
    private readonly reports: ReportRepository,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(CLOCK) private readonly clock: Clock,
    private readonly instant: InstantService,
  ) {}

  @TsRestHandler(contract.search)
  handler(@Req() req: ClientRequest & { res?: { setHeader(k: string, v: string): void } }) {
    const ip = () => clientIp(req, this.config.search.proxyKey);
    return tsRestHandler(contract.search, {
      suggest: async ({ query }) => {
        // The web server limits each visitor itself (it can cache); direct callers are limited here.
        if (!proxied(req, this.config.search.proxyKey)) {
          const gate = await this.limiter.hit("suggest", ip(), this.config.search.suggestRateLimit);
          if (!gate.ok) return tooMany(gate.retryAfter);
        }
        return {
          status: 200,
          body: await this.suggestions.suggest(query.q, { place: query.place, limit: query.limit }),
        };
      },
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
      click: async ({ body }) => {
        const gate = await this.limiter.hit("click", ip(), this.config.search.clickRateLimit);
        if (!gate.ok) return tooMany(gate.retryAfter);
        return (await this.log.click(body.queryId, body.key))
          ? { status: 204 as const, body: undefined }
          : { status: 404 as const, body: { message: "No such search" } };
      },
      report: async ({ headers, query }) => {
        const notFound = { status: 404 as const, body: { message: "Not found" } };
        const want = this.config.search.reportKey;
        if (want === null) return notFound;
        // A 429 would say the endpoint exists: an IP past REPORT_GUESSES misses a minute gets
        // 404s, even for the right key, until the minute ends.
        if (!(await this.limiter.within("report", ip(), REPORT_GUESSES))) return notFound;
        const got = headers["x-darb-report-key"] ?? "";
        if (!timingSafeEqual(digest(got), digest(want))) {
          await this.limiter.hit("report", ip(), REPORT_GUESSES);
          return notFound;
        }
        return {
          status: 200,
          body: await this.reports.report(query.days, query.limit, this.clock()),
        };
      },
      instantIndex: async () => {
        // Express links the response to the request; @Res would hand the reply to this handler.
        req.res?.setHeader("cache-control", "public, max-age=60");
        const { v, places, kinds } = (await this.instant.world()).index;
        return { status: 200, body: { v, places, kinds } };
      },
    });
  }
}
