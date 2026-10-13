import { createHash } from "node:crypto";
import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import { Queue, Worker, type Job } from "bullmq";
import { APP_CONFIG, type AppConfig } from "../config.js";
import type { SearchEntityName } from "./documents.js";
import { SearchIndexer } from "./indexer.service.js";
import { InstantService } from "./instant.service.js";

export interface IndexJob {
  entity: SearchEntityName;
  ids: string[];
}

export const queueName = (databaseUrl: string) =>
  `search-index-${new URL(databaseUrl).pathname.replace(/^\//, "") || "default"}`;

/** A stable key per change: `entity:id`, or `entity:<sha1 of the sorted ids>` for a batch. */
export function jobKey(entity: SearchEntityName, ids: string[]): string {
  if (ids.length === 1) return `${entity}:${ids[0]}`;
  return `${entity}:${createHash("sha1")
    .update([...ids].sort().join(","))
    .digest("hex")}`;
}

/** BullMQ requires maxRetriesPerRequest: null on its connections. */
const connection = (config: AppConfig) => ({
  url: config.search.redisUrl,
  maxRetriesPerRequest: null,
});
const CHUNK = 500;
const ATTEMPTS = 3;
const UUID = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi;

/** An error for the log: its name and a short message, with ids taken out. */
const describeError = (err: Error) =>
  `${err.name}: ${err.message.replace(UUID, "<id>").slice(0, 200)}`;

/** Places and kinds feed the instant index too, so their changes rebuild it. */
const feedsInstant = (entity: SearchEntityName) => entity !== "business";

@Injectable()
export class SearchEvents implements OnModuleDestroy {
  private readonly logger = new Logger(SearchEvents.name);
  /** Opened on the first change, so an API that never changes anything never connects. */
  private queue: Queue<IndexJob> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly instant: InstantService,
  ) {}

  /** Plan 4's admin writes call this after each change (spec §6.2 domain events). */
  async changed(entity: SearchEntityName, ids: string[]): Promise<Job<IndexJob>[]> {
    if (feedsInstant(entity)) this.instant.invalidate();
    const queue = this.open();
    const jobs: Job<IndexJob>[] = [];
    for (let i = 0; i < ids.length; i += CHUNK) {
      const chunk = ids.slice(i, i + CHUNK);
      // Deduplication (not a fixed jobId) holds the key only while the job waits or runs, so a
      // change after the job is done is indexed again; one that lands mid-run is kept for after it.
      jobs.push(
        await queue.add(
          "changed",
          { entity, ids: chunk },
          { deduplication: { id: jobKey(entity, chunk), keepLastIfActive: true } },
        ),
      );
    }
    return jobs;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue?.close();
  }

  private open(): Queue<IndexJob> {
    if (!this.queue) {
      this.queue = new Queue<IndexJob>(queueName(this.config.databaseUrl), {
        connection: connection(this.config),
        defaultJobOptions: {
          attempts: ATTEMPTS,
          backoff: { type: "exponential", delay: 5000 },
          removeOnComplete: 100,
          removeOnFail: 500,
        },
      });
      this.queue.on("error", (err) =>
        this.logger.error(`Search index queue: ${describeError(err)}`),
      );
    }
    return this.queue;
  }
}

@Injectable()
export class SearchIndexWorker implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchIndexWorker.name);
  private worker: Worker<IndexJob> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly indexer: SearchIndexer,
    private readonly instant: InstantService,
  ) {}

  onModuleInit(): void {
    if (!this.config.search.indexWorker) return;
    this.worker = new Worker<IndexJob>(
      queueName(this.config.databaseUrl),
      async (job) => {
        const out = await this.indexer.index(job.data.entity, job.data.ids);
        // The change may come from another process; this one's instant index is stale too.
        if (feedsInstant(job.data.entity)) this.instant.invalidate();
        return out;
      },
      { connection: connection(this.config), concurrency: 1 },
    );
    // Redis drops reconnect on their own and BullMQ retries failed jobs; both are logged.
    this.worker.on("error", (err) =>
      this.logger.error(`Search index worker: ${describeError(err)}`),
    );
    this.worker.on("failed", (job, err) => {
      const attempts = job?.opts.attempts ?? ATTEMPTS;
      const made = job?.attemptsMade ?? 0;
      const what = `${job?.data.ids.length ?? 0} ${job?.data.entity ?? "unknown"} id(s)`;
      const line = `Search index job for ${what} failed, attempt ${made} of ${attempts}: ${describeError(err)}`;
      if (made >= attempts) this.logger.error(line);
      else this.logger.warn(line);
    });
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
