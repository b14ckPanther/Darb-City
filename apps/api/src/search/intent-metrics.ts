import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Redis } from "ioredis";
import { REDIS } from "../redis/redis.module.js";

/**
 * How a search's intent was decided. "answered" and "empty" are model calls that came back (with
 * a useful intent or not); "timeout" gave up at INTENT_TIMEOUT_MS; "error" failed; "budget" and
 * "negative" never called the model; "cached" reused an answer; "instant" was lane 1 alone.
 */
export type IntentOutcome =
  "instant" | "cached" | "negative" | "budget" | "answered" | "empty" | "timeout" | "error";

/** Model call latency buckets (upper bounds, ms); the last bucket is everything slower. */
export const LATENCY_BUCKETS = [500, 1000, 1500, 2000, 3000, 5000] as const;
export const METRICS_DAYS = 30;
const PREFIX = "darb:metrics:intent:";

export const metricsKey = (day: string) => `${PREFIX}${day}`;
const dayOf = (at: Date) => at.toISOString().slice(0, 10);

/** The bucket field a model call of `ms` counts in ("le1500", "gt5000"). */
export function bucketOf(ms: number): string {
  const bound = LATENCY_BUCKETS.find((b) => ms <= b);
  return bound === undefined ? `gt${LATENCY_BUCKETS[LATENCY_BUCKETS.length - 1]}` : `le${bound}`;
}

/**
 * Counts and timings of lane 2, per UTC day in Redis (kept METRICS_DAYS), plus one log line per
 * model call. Never the query or anything about the person: only the outcome and milliseconds.
 */
@Injectable()
export class IntentMetrics {
  private readonly logger = new Logger("IntentMetrics");

  constructor(@Inject(REDIS) private readonly redis: Redis) {}

  async record(outcome: IntentOutcome, ms: number | null, at = new Date()): Promise<void> {
    const key = metricsKey(dayOf(at));
    const called = ms !== null && ["answered", "empty", "timeout", "error"].includes(outcome);
    if (called) this.logger.log(`intent ${outcome} ${Math.round(ms)}ms`);
    try {
      const tx = this.redis.multi().hincrby(key, outcome, 1);
      if (called)
        tx.hincrby(key, "calls", 1)
          .hincrby(key, "ms_total", Math.round(ms))
          .hincrby(key, bucketOf(ms), 1);
      await tx.expire(key, METRICS_DAYS * 86_400).exec();
    } catch {
      // Metrics never fail a search.
    }
  }

  /** The last `days` days, newest first, each with its counters (empty days left out). */
  async days(
    days: number,
    now = new Date(),
  ): Promise<{ day: string; counts: Record<string, number> }[]> {
    const out: { day: string; counts: Record<string, number> }[] = [];
    for (let i = 0; i < Math.min(days, METRICS_DAYS); i++) {
      const day = dayOf(new Date(now.getTime() - i * 86_400_000));
      const raw = await this.redis.hgetall(metricsKey(day)).catch(() => ({}));
      const counts = Object.fromEntries(
        Object.entries(raw as Record<string, string>).map(([k, v]) => [k, Number(v)]),
      );
      if (Object.keys(counts).length) out.push({ day, counts });
    }
    return out;
  }
}
