import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DAY_MS = 86_400_000;

/** Spec §4.7 search log, kept about 90 days (SEARCH_LOG_RETENTION_DAYS) and then deleted. */
@Injectable()
export class SearchLogRetention implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchLogRetention.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.search.indexWorker) return;
    const run = () =>
      void this.purge()
        .then((n) => n > 0 && this.logger.log(`Deleted ${n} search log rows past retention`))
        .catch(() => this.logger.warn("Search log retention run failed; next run in 24 h"));
    const first = setTimeout(run, 60_000);
    const daily = setInterval(run, DAY_MS);
    first.unref();
    daily.unref();
    this.timers = [first, daily];
  }

  async purge(now: Date = new Date()): Promise<number> {
    const before = new Date(now.getTime() - this.config.search.logRetentionDays * DAY_MS);
    const { count } = await this.prisma.searchQuery.deleteMany({
      where: { createdAt: { lt: before } },
    });
    return count;
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearTimeout(t);
  }
}
