import { createHash } from "node:crypto";
import Anthropic from "@anthropic-ai/sdk";
import { Inject, Injectable, Logger } from "@nestjs/common";
import type { Locale } from "@darb/core";
import { EMPTY_INTENT, IntentSchema, type IntentDto } from "@darb/contracts";
import { matchInstant, normalize, STRONG, type InstantResult } from "@darb/search-text";
import type { Redis } from "ioredis";
import { INTENT_PROVIDER, type IntentProvider, type RawIntentInput } from "../ai/intent.js";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { REDIS } from "../redis/redis.module.js";
import {
  explainedByInstant,
  intentCandidates,
  intentFromInstant,
  validateIntent,
} from "./filters.js";
import { IntentMetrics } from "./intent-metrics.js";
import { InstantService, type World } from "./instant.service.js";
import { ModelBudget } from "./model-budget.js";

export const INTENT_CACHE_SECONDS = 604_800;
/**
 * v4: the dialect-aware prompt, with the place named in the query's own words (v3 answers often
 * named a look-alike place). Keyed by the active kind set only: a cached answer is re-validated
 * against the world on read.
 */
export const intentCacheKey = (locale: Locale, normalized: string, kindsVersion: string) =>
  `darb:intent:v4:${kindsVersion}:${locale}:${createHash("sha256").update(normalized).digest("hex")}`;

export interface Resolved {
  intent: IntentDto;
  lane: "smart" | "instant";
  blocked: boolean;
  instant: InstantResult;
  /** Asked not to wait, it skipped a model call the full search would make. */
  skipped?: boolean;
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

/** "slug: English name" for each active kind, sorted by slug: the prompt's kind list. */
export const kindLines = (world: World): string[] =>
  [...world.kinds.values()]
    .sort((a, b) => (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .map((k) => `${k.slug}: ${k.name.en ?? k.name.he ?? k.slug}`);

/**
 * The model's place, checked: a slug or a name ("Haifa") read back through lane 1's place index,
 * and only when the words it says name the place are in the query (a place the query does not
 * name is invented). Answers recorded before placeWords keep their slug as it was.
 */
export function resolvePlace(
  raw: { place: string | null; placeWords?: string | undefined },
  query: string,
  world: World,
): string | null {
  if (!raw.place) return null;
  if (raw.placeWords !== undefined) {
    const words = normalize(raw.placeWords);
    if (!words || !` ${normalize(query)} `.includes(` ${words} `)) return null;
  }
  if (world.places.has(raw.place)) return raw.place;
  const named = matchInstant(world.prepared, raw.place).places[0];
  return named && named.score >= STRONG ? named.entry.s : null;
}

@Injectable()
export class IntentService {
  private readonly logger = new Logger(IntentService.name);

  constructor(
    private readonly instant: InstantService,
    @Inject(INTENT_PROVIDER) private readonly provider: IntentProvider,
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    private readonly budget: ModelBudget,
    private readonly metrics: IntentMetrics,
  ) {}

  /** `wait: false` answers from lane 1 and the cache only, never calling the model. */
  async resolve(q: string, locale: Locale, wait = true): Promise<Resolved> {
    const instant = await this.instant.match(q);
    if (instant.blocked) return { intent: EMPTY_INTENT, lane: "instant", blocked: true, instant };
    const fallback: Resolved = {
      intent: intentFromInstant(instant),
      lane: "instant",
      blocked: false,
      instant,
    };
    if (explainedByInstant(instant) || instant.normalized === "") {
      if (instant.normalized !== "") await this.metrics.record("instant", null);
      return fallback;
    }

    const world = await this.instant.world();
    const allowed = {
      kinds: new Set([...instant.kinds.map((k) => k.entry.s), ...world.kinds.keys()]),
      places: new Set(instant.places.map((p) => p.entry.s)),
    };
    const key = intentCacheKey(locale, instant.normalized, world.kindsVersion);
    // A place lane 1 matched strongly is a fact about the words; a model that drops it loses it.
    const keepPlace = (intent: IntentDto): IntentDto =>
      intent.place === null && fallback.intent.place !== null
        ? { ...intent, place: fallback.intent.place }
        : intent;
    const hit = await this.redis.get(key).catch(() => null);
    if (hit) {
      const parsed = IntentSchema.safeParse(parseJson(hit));
      if (parsed.success) {
        const intent = validateIntent(
          parsed.data,
          { kinds: new Set(world.kinds.keys()), places: new Set(world.places.keys()) },
          instant.cues,
        );
        if (useful(intent)) {
          await this.metrics.record("cached", null);
          return { intent: keepPlace(intent), lane: "smart", blocked: false, instant };
        }
      }
    }

    const negative = `${key}:neg`;
    if ((await this.redis.get(negative).catch(() => null)) !== null) {
      await this.metrics.record("negative", null);
      return fallback;
    }
    if (!wait) return { ...fallback, skipped: true };
    if (!(await this.budget.take())) {
      await this.metrics.record("budget", null);
      return fallback;
    }

    const started = Date.now();
    const call = await this.callModel(q, locale, instant, kindLines(world));
    const ms = Date.now() - started;
    if (call.raw === null) {
      // Failure or timeout: transient, never remembered.
      await this.metrics.record(call.outcome, ms);
      return fallback;
    }
    const raw = call.raw;
    const place = resolvePlace(raw, q, world);
    const validated = validateIntent(
      { ...raw, place },
      { ...allowed, places: new Set(place ? [place] : []) },
      instant.cues,
    );
    await this.metrics.record(useful(validated) ? "answered" : "empty", ms);
    if (!useful(validated)) {
      const ttl = this.config.search.negativeCacheSeconds;
      if (ttl > 0) await this.redis.set(negative, "1", "EX", ttl).catch(() => undefined);
      return fallback;
    }
    const intent = keepPlace(validated);
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
    activeKinds: readonly string[],
  ): Promise<{ raw: RawIntentInput | null; outcome: "answered" | "empty" | "timeout" | "error" }> {
    const controller = new AbortController();
    let timer: NodeJS.Timeout | undefined;
    let failed = false;
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
            { query: q, locale, candidates: intentCandidates(instant, locale), activeKinds },
            controller.signal,
          ),
        )
        .catch((err: unknown) => {
          // An abort after our own timeout is expected; anything else is worth one log line.
          // The query and the error message stay out of the log (spec §4.7).
          if (!controller.signal.aborted) {
            failed = true;
            this.logger.warn(`Intent model failed (${describeModelError(err)}); using lane 1`);
          }
          return null;
        });
      const raw = await Promise.race([answer, timeout]);
      // Our own abort is a timeout (counted in the metrics, never a warning).
      const outcome =
        raw !== null
          ? "answered"
          : failed
            ? "error"
            : controller.signal.aborted
              ? "timeout"
              : "empty";
      return { raw, outcome };
    } finally {
      clearTimeout(timer);
    }
  }
}
