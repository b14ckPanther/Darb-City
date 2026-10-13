import { Global, Inject, Module, type OnModuleDestroy } from "@nestjs/common";
import { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../config.js";

export const REDIS = Symbol("REDIS");
/** A hung Redis costs a search at most this much per call; callers then fail open. */
export const REDIS_COMMAND_TIMEOUT_MS = 150;

/**
 * One client for the intent cache and the rate limiter. Commands never queue while Redis is down
 * (enableOfflineQueue: false): they fail at once, and callers fail open (search still answers).
 * A Redis that accepts commands but stops answering fails them after REDIS_COMMAND_TIMEOUT_MS.
 */
export async function createRedis(url: string): Promise<Redis> {
  const redis = new Redis(url, {
    lazyConnect: true,
    enableOfflineQueue: false,
    maxRetriesPerRequest: 1,
    connectTimeout: 2000,
    commandTimeout: REDIS_COMMAND_TIMEOUT_MS,
  });
  redis.on("error", () => undefined); // reconnects on its own; errors surface per command
  await redis.connect().catch(() => undefined);
  return redis;
}

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => createRedis(config.search.redisUrl),
    },
  ],
  exports: [REDIS],
})
export class RedisModule implements OnModuleDestroy {
  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async onModuleDestroy(): Promise<void> {
    await this.redis.quit().catch(() => this.redis.disconnect());
  }
}
