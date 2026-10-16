import { createHash } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { REDIS } from "../redis/redis.module.js";
import { ipBucket } from "./ip-bucket.js";

export const ipHash = (salt: string, ip: string) =>
  createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);

/**
 * "report" counts wrong report keys only; "inquiry" counts /contact messages; "lookup", "join" and
 * "upload" count the /join form's lookups, forms and photos.
 */
type Bucket =
  | "search"
  | "results"
  | "click"
  | "report"
  | "suggest"
  | "inquiry"
  | "lookup"
  | "join"
  | "upload";

@Injectable()
export class RateLimiter {
  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  private key(bucket: Bucket, ip: string, window: number): string {
    return `darb:rl:${bucket}:${ipHash(this.config.search.ipSalt, ipBucket(ip))}:${window}`;
  }

  /** Whether this minute's count is still within the limit, without adding to it. */
  async within(bucket: Bucket, ip: string, limit: number): Promise<boolean> {
    const key = this.key(bucket, ip, Math.floor(Date.now() / 60_000));
    try {
      return Number((await this.redis.get(key)) ?? 0) <= limit;
    } catch {
      return true;
    }
  }

  /** Counts one more in the current window (a minute unless `windowSeconds` says otherwise). */
  async hit(
    bucket: Bucket,
    ip: string,
    limit: number,
    windowSeconds = 60,
  ): Promise<{ ok: boolean; retryAfter: number }> {
    const now = Date.now();
    const size = windowSeconds * 1000;
    const window = Math.floor(now / size);
    const key = this.key(bucket, ip, window);
    try {
      const result = await this.redis.multi().incr(key).expire(key, windowSeconds).exec();
      const count = Number(result?.[0]?.[1] ?? 0);
      return { ok: count <= limit, retryAfter: Math.ceil(((window + 1) * size - now) / 1000) };
    } catch {
      return { ok: true, retryAfter: 0 };
    }
  }
}
