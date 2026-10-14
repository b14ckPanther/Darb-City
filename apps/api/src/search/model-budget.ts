import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { REDIS } from "../redis/redis.module.js";

const KEY = (window: string) => `darb:model:calls:${window}`;

/**
 * A ceiling on model calls across every API replica (cost guard, spec §5.4). Counted in Redis;
 * when Redis fails, each process counts for itself against the same limits, so a Redis outage can
 * never mean unlimited calls. Over the limit, search answers from lane 1.
 */
@Injectable()
export class ModelBudget {
  private readonly local = new Map<string, number>();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async take(now: Date = new Date()): Promise<boolean> {
    const { modelCallsPerMinute: perMinute, modelCallsPerDay: perDay } = this.config.search;
    if (perMinute === 0 || perDay === 0) return false;
    const minute = `m:${Math.floor(now.getTime() / 60_000)}`;
    const day = `d:${now.toISOString().slice(0, 10)}`;
    try {
      const res = await this.redis
        .multi()
        .incr(KEY(minute))
        .expire(KEY(minute), 120)
        .incr(KEY(day))
        .expire(KEY(day), 2 * 86_400)
        .exec();
      if (!res || res.some(([err]) => err)) throw new Error("budget unavailable");
      return Number(res[0]![1]) <= perMinute && Number(res[2]![1]) <= perDay;
    } catch {
      return this.takeLocal(minute, day, perMinute, perDay);
    }
  }

  private takeLocal(minute: string, day: string, perMinute: number, perDay: number): boolean {
    for (const key of this.local.keys()) if (key !== minute && key !== day) this.local.delete(key);
    const m = (this.local.get(minute) ?? 0) + 1;
    const d = (this.local.get(day) ?? 0) + 1;
    this.local.set(minute, m);
    this.local.set(day, d);
    return m <= perMinute && d <= perDay;
  }
}
