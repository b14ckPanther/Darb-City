import { Inject, Injectable, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { Queue, Worker, type Job } from "bullmq";
import { APP_CONFIG, type AppConfig } from "../config.js";
import type { SearchEntityName } from "./documents.js";
import { SearchIndexer } from "./indexer.service.js";

export interface IndexJob {
  entity: SearchEntityName;
  ids: string[];
}

export const queueName = (databaseUrl: string) =>
  `search-index-${new URL(databaseUrl).pathname.replace(/^\//, "") || "default"}`;

/** BullMQ requires maxRetriesPerRequest: null on its connections. */
const connection = (config: AppConfig) => ({
  url: config.search.redisUrl,
  maxRetriesPerRequest: null,
});
const CHUNK = 500;

@Injectable()
export class SearchEvents implements OnModuleDestroy {
  private readonly queue: Queue<IndexJob>;

  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    this.queue = new Queue<IndexJob>(queueName(config.databaseUrl), {
      connection: connection(config),
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: "exponential", delay: 5000 },
        removeOnComplete: 100,
        removeOnFail: 500,
      },
    });
  }

  async changed(entity: SearchEntityName, ids: string[]): Promise<Job<IndexJob>[]> {
    const jobs: Job<IndexJob>[] = [];
    for (let i = 0; i < ids.length; i += CHUNK)
      jobs.push(await this.queue.add("changed", { entity, ids: ids.slice(i, i + CHUNK) }));
    return jobs;
  }

  async onModuleDestroy(): Promise<void> {
    await this.queue.close();
  }
}

@Injectable()
export class SearchIndexWorker implements OnModuleInit, OnModuleDestroy {
  private worker: Worker<IndexJob> | null = null;

  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly indexer: SearchIndexer,
  ) {}

  onModuleInit(): void {
    if (!this.config.search.indexWorker) return;
    this.worker = new Worker<IndexJob>(
      queueName(this.config.databaseUrl),
      (job) => this.indexer.index(job.data.entity, job.data.ids),
      { connection: connection(this.config), concurrency: 1 },
    );
    this.worker.on("error", () => undefined); // reconnects; failed jobs are retried by BullMQ
  }

  async onModuleDestroy(): Promise<void> {
    await this.worker?.close();
  }
}
