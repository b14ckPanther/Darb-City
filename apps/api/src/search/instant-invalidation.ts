import {
  Inject,
  Injectable,
  Logger,
  type OnModuleDestroy,
  type OnModuleInit,
} from "@nestjs/common";
import type { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { REDIS } from "../redis/redis.module.js";
import { InstantService } from "./instant.service.js";

/** One channel per database, so test and dev databases never invalidate each other. */
export const instantChannel = (databaseUrl: string) =>
  `darb:instant:${new URL(databaseUrl).pathname.replace(/^\//, "") || "default"}`;

/** Keeps every API replica's lane-1 index in step after a place or kind changes. */
@Injectable()
export class InstantInvalidation implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstantInvalidation.name);
  private sub: Redis | null = null;
  private readonly channel: string;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly instant: InstantService,
  ) {
    this.channel = instantChannel(config.databaseUrl);
  }

  async onModuleInit(): Promise<void> {
    const sub = this.redis.duplicate({
      lazyConnect: true,
      enableOfflineQueue: true,
      commandTimeout: undefined,
    });
    sub.on("error", () => undefined);
    sub.on("message", (channel: string) => {
      if (channel === this.channel) this.instant.invalidate();
    });
    this.sub = sub;
    // Without Redis this replica still invalidates itself; others refresh within the 10 min TTL.
    await sub
      .connect()
      .then(() => sub.subscribe(this.channel))
      .catch(() =>
        this.logger.warn("Instant index invalidation is local only (Redis unavailable)"),
      );
  }

  publish(): void {
    this.instant.invalidate();
    void this.redis.publish(this.channel, "1").catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.sub?.quit().catch(() => this.sub?.disconnect());
  }
}
