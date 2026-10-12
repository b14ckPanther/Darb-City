import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { REDIS } from "../redis/redis.module.js";

export const ipHash = (salt: string, ip: string) =>
  createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);

@Injectable()
export class RateLimiter {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async hit(
    bucket: "search" | "results",
    ip: string,
    limit: number,
  ): Promise<{ ok: boolean; retryAfter: number }> {
    const now = Date.now();
    const window = Math.floor(now / 60_000);
    const key = `darb:rl:${bucket}:${ipHash(this.config.search.ipSalt, ip)}:${window}`;
    try {
      const result = await this.redis.multi().incr(key).expire(key, 60).exec();
      const count = Number(result?.[0]?.[1] ?? 0);
      return { ok: count <= limit, retryAfter: Math.ceil(((window + 1) * 60_000 - now) / 1000) };
    } catch {
      return { ok: true, retryAfter: 0 };
    }
  }
}
