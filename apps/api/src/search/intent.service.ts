import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Locale } from "@darb/core";
import { EMPTY_INTENT, IntentSchema, type IntentDto } from "@darb/contracts";
import type { InstantResult } from "@darb/search-text";
import type { Redis } from "ioredis";
import { INTENT_PROVIDER, type IntentProvider, type RawIntent } from "../ai/intent.js";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { REDIS } from "../redis/redis.module.js";
import {
  explainedByInstant,
  intentCandidates,
  intentFromInstant,
  validateIntent,
} from "./filters.js";
import { InstantService } from "./instant.service.js";

export const INTENT_CACHE_SECONDS = 604_800;
export const intentCacheKey = (locale: Locale, normalized: string) =>
  `darb:intent:v1:${locale}:${createHash("sha256").update(normalized).digest("hex")}`;

export interface Resolved {
  intent: IntentDto;
  lane: "smart" | "instant";
  blocked: boolean;
  instant: InstantResult;
}

/**
 * What kind of failure the model call hit, from the SDK's typed errors only (never the message,
 * which is not a contract). Every kind falls back to lane 1; the label only feeds the log line.
 */
export function describeModelError(err: unknown): string {
  if (err instanceof Anthropic.APIConnectionTimeoutError) return "timeout";
  if (err instanceof Anthropic.APIUserAbortError) return "aborted";
  if (err instanceof Anthropic.APIConnectionError) return "connection";
  if (err instanceof Anthropic.APIError)
    return err.status === undefined ? "api" : `http ${err.status}`;
  if (err instanceof Anthropic.AnthropicError) return "sdk";
  return "unexpected";
}

/** A corrupt cache entry is a miss, never a 500. */
const parseJson = (text: string): unknown => {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
};

const useful = (i: IntentDto) => i.kinds.length > 0 || i.place !== null || i.nearMe;

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);

  constructor(
    private readonly instant: InstantService,
    @Inject(INTENT_PROVIDER) private readonly provider: IntentProvider,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async resolve(q: string, locale: Locale): Promise<Resolved> {
    const instant = await this.instant.match(q);
    if (instant.blocked) return { intent: EMPTY_INTENT, lane: "instant", blocked: true, instant };
    const fallback: Resolved = {
      intent: intentFromInstant(instant),
      lane: "instant",
      blocked: false,
      instant,
    };
    if (explainedByInstant(instant) || instant.normalized === "") return fallback;

    const world = await this.instant.world();
    const allowed = {
      kinds: new Set([...instant.kinds.map((k) => k.entry.s), ...world.kinds.keys()]),
      places: new Set(instant.places.map((p) => p.entry.s)),
    };
    const key = intentCacheKey(locale, instant.normalized);
    const hit = await this.redis.get(key).catch(() => null);
    if (hit) {
      const parsed = IntentSchema.safeParse(parseJson(hit));
      if (parsed.success) {
        const intent = validateIntent(
          parsed.data,
          { kinds: new Set(world.kinds.keys()), places: new Set(world.places.keys()) },
          instant.cues,
        );
        if (useful(intent)) return { intent, lane: "smart", blocked: false, instant };
      }
    }

    const raw = await this.callModel(q, locale, instant);
    const intent = raw ? validateIntent(raw, allowed, instant.cues) : null;
    if (!intent || !useful(intent)) return fallback;
    await this.redis
      .set(key, JSON.stringify(intent), "EX", INTENT_CACHE_SECONDS)
      .catch(() => undefined);
    return { intent, lane: "smart", blocked: false, instant };
  }

  /** Spec §5.4: any failure or anything slower than INTENT_TIMEOUT_MS is "no answer". */
  private async callModel(
    q: string,
    locale: Locale,
    instant: InstantResult,
  ): Promise<RawIntent | null> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    const timeout = new Promise<null>((resolve) => {
      timer = setTimeout(() => {
        controller.abort();
        resolve(null);
      }, this.config.search.intentTimeoutMs);
    });
    try {
      // Promise.resolve().then also catches a provider that throws before returning a promise.
      const answer = Promise.resolve()
        .then(() =>
          this.provider.extract(
            { query: q, locale, candidates: intentCandidates(instant, locale) },
            controller.signal,
          ),
        )
        .catch((err: unknown) => {
          // An abort after our own timeout is expected; anything else is worth one log line.
          // The query and the error message stay out of the log (spec §4.7).
          if (!controller.signal.aborted)
            this.logger.warn(`Intent model failed (${describeModelError(err)}); using lane 1`);
          return null;
        });
      return await Promise.race([answer, timeout]);
    } finally {
      clearTimeout(timer);
    }
  }
}
