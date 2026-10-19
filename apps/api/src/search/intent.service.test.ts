import Anthropic from "@anthropic-ai/sdk";
import type { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { AnthropicIntentProvider } from "../ai/anthropic-intent.provider.js";
import type { IntentProvider, RawIntentInput } from "../ai/intent.js";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";
import { InstantService } from "./instant.service.js";
import { IntentMetrics, metricsKey } from "./intent-metrics.js";
import {
  IntentService,
  describeModelError,
  intentCacheKey,
  resolvePlace,
} from "./intent.service.js";
import type { ModelBudget } from "./model-budget.js";

const prisma = testPrisma();
const config = loadConfig({ ...process.env, INTENT_TIMEOUT_MS: "100" });
let redis: Redis;
const open = { take: async () => true } as unknown as ModelBudget;
const instant = new InstantService(prisma);
const answer: RawIntentInput = {
  kinds: ["barbershops"],
  place: "sakhnin",
  nearMe: false,
  openNow: true,
  attributes: { delivers: false },
  freeText: "fade",
};

function service(extract: IntentProvider["extract"]) {
  const provider: IntentProvider = { name: "fake", extract: vi.fn(extract) };
  return {
    svc: new IntentService(instant, provider, redis, config, open, new IntentMetrics(redis)),
    provider,
  };
}

beforeAll(async () => {
  await resetDatabase(prisma);
  await seedFixtures(prisma);
  redis = await createRedis(config.search.redisUrl);
});
beforeEach(async () => {
  const keys = [...(await redis.keys("darb:intent:*")), ...(await redis.keys("darb:metrics:*"))];
  if (keys.length) await redis.del(...keys);
});
afterAll(async () => {
  await redis.quit();
  await prisma.$disconnect();
});

const Q = "somewhere in sakhnin for a fade, open now";

describe("IntentService", () => {
  it("uses the model's validated answer and caches it for 7 days", async () => {
    const { svc, provider } = service(async () => answer);
    const r = await svc.resolve(Q, "en");
    expect(r).toMatchObject({
      lane: "smart",
      blocked: false,
      intent: { kinds: ["barbershops"], place: "sakhnin", openNow: true, freeText: "fade" },
    });
    const key = intentCacheKey("en", r.instant.normalized, (await instant.world()).kindsVersion);
    expect(await redis.ttl(key)).toBeGreaterThan(604_000);
    await svc.resolve(Q, "en");
    expect(provider.extract).toHaveBeenCalledTimes(1);
  });
  it("short-circuits blocked queries without the model or the cache", async () => {
    const { svc, provider } = service(async () => answer);
    const r = await svc.resolve("bars in sakhnin", "en");
    expect(r.blocked).toBe(true);
    expect(provider.extract).not.toHaveBeenCalled();
    expect(await redis.keys("darb:intent:*")).toEqual([]);
  });
  it("skips the model when lane 1 explains every word", async () => {
    const { svc, provider } = service(async () => answer);
    const r = await svc.resolve("barbershops sakhnin", "en");
    expect(r).toMatchObject({
      lane: "instant",
      intent: { kinds: ["barbershops"], place: "sakhnin" },
    });
    expect(provider.extract).not.toHaveBeenCalled();
  });
  for (const [name, extract] of [
    ["a timeout", () => new Promise<RawIntentInput | null>(() => undefined)],
    [
      "an error",
      async () => {
        throw new Error("529 overloaded");
      },
    ],
    ["no answer (refusal)", async () => null],
    ["only foreign ids", async () => ({ ...answer, kinds: ["casino"], place: "tel-aviv" })],
  ] as const) {
    it(`falls back to lane 1 on ${name}, quietly and in time`, async () => {
      const { svc } = service(extract as IntentProvider["extract"]);
      const started = Date.now();
      const r = await svc.resolve(Q, "en");
      expect(Date.now() - started).toBeLessThan(1000);
      expect(r.lane).toBe("instant");
      expect(r.intent.place).toBe("sakhnin");
      expect(r.intent.openNow).toBe(true);
    });
  }
  it("still answers when Redis is down", async () => {
    const down = await createRedis("redis://127.0.0.1:9");
    const svc = new IntentService(
      instant,
      { name: "fake", extract: async () => answer },
      down,
      config,
      open,
      new IntentMetrics(down),
    );
    expect((await svc.resolve(Q, "en")).lane).toBe("smart");
    down.disconnect();
  });
});

describe("IntentService with the Anthropic SDK's typed errors", () => {
  const headers = new Headers();
  const failures = [
    ["a client timeout", new Anthropic.APIConnectionTimeoutError(), "timeout"],
    [
      "a 429",
      new Anthropic.RateLimitError(429, { type: "error" }, "rate limited", headers),
      "http 429",
    ],
    [
      "a 500",
      new Anthropic.InternalServerError(500, { type: "error" }, "boom", headers),
      "http 500",
    ],
    [
      "a 529 overloaded",
      Anthropic.APIError.generate(529, { type: "error" }, "overloaded", headers),
      "http 529",
    ],
    [
      "a connection error",
      new Anthropic.APIConnectionError({ message: "ECONNRESET" }),
      "connection",
    ],
  ] as const;
  for (const [name, error, kind] of failures) {
    it(`falls back to lane 1 on ${name} from the SDK`, async () => {
      expect(describeModelError(error)).toBe(kind);
      const client = { messages: { create: vi.fn(async () => Promise.reject(error)) } };
      const provider = new AnthropicIntentProvider(
        client as unknown as Pick<Anthropic, "messages">,
        "claude-haiku-5-5",
      );
      const svc = new IntentService(
        instant,
        provider,
        redis,
        config,
        open,
        new IntentMetrics(redis),
      );
      const r = await svc.resolve(Q, "en");
      expect(client.messages.create).toHaveBeenCalledTimes(1);
      expect(r).toMatchObject({
        lane: "instant",
        blocked: false,
        intent: { place: "sakhnin", openNow: true },
      });
      expect(await redis.keys("darb:intent:*")).toEqual([]);
    });
  }
  it("falls back when a provider throws before returning a promise", async () => {
    const provider: IntentProvider = {
      name: "sync-throw",
      extract: () => {
        throw new Anthropic.AuthenticationError(401, { type: "error" }, "bad key", headers);
      },
    };
    const r = await new IntentService(
      instant,
      provider,
      redis,
      config,
      open,
      new IntentMetrics(redis),
    ).resolve(Q, "en");
    expect(r.lane).toBe("instant");
  });
  it("names non-SDK failures without reading their message", () => {
    expect(describeModelError(new Error("429 rate limited"))).toBe("unexpected");
    expect(describeModelError(new Anthropic.APIUserAbortError())).toBe("aborted");
  });
});

describe("IntentService keeps lane 1's facts and its cache in step with the taxonomy", () => {
  it("keeps lane 1's strong place when the model leaves it out, in the answer and in the cache", async () => {
    const { svc } = service(async () => ({ ...answer, place: null }));
    const r = await svc.resolve(Q, "en");
    expect(r).toMatchObject({
      lane: "smart",
      intent: { kinds: ["barbershops"], place: "sakhnin" },
    });
    const world = await instant.world();
    const cached = await redis.get(intentCacheKey("en", r.instant.normalized, world.kindsVersion));
    expect(JSON.parse(cached!).place).toBe("sakhnin");
  });
  it("keeps the cache key when places change and moves it when active kinds change", async () => {
    const before = (await instant.world()).kindsVersion;
    await prisma.place.updateMany({ where: { slug: "tamra" }, data: { aliases: ["Tamra2"] } });
    instant.invalidate();
    expect((await instant.world()).kindsVersion).toBe(before);
    await prisma.kind.updateMany({ where: { slug: "barbershops" }, data: { status: "hidden" } });
    instant.invalidate();
    expect((await instant.world()).kindsVersion).not.toBe(before);
    await prisma.kind.updateMany({ where: { slug: "barbershops" }, data: { status: "active" } });
    instant.invalidate();
  });
});

describe("budget and negative cache", () => {
  it("answers from lane 1 without calling the model when the budget is spent", async () => {
    const provider: IntentProvider = { name: "fake", extract: vi.fn(async () => answer) };
    const closed = { take: async () => false } as unknown as ModelBudget;
    const svc = new IntentService(
      instant,
      provider,
      redis,
      config,
      closed,
      new IntentMetrics(redis),
    );
    const r = await svc.resolve(Q, "en");
    expect(r.lane).toBe("instant");
    expect(provider.extract).not.toHaveBeenCalled();
  });

  it("remembers an unhelpful answer and does not ask again", async () => {
    const empty: RawIntentInput = { ...answer, kinds: [], place: null, nearMe: false };
    const { svc, provider } = service(async () => empty);
    const q = "something lane one cannot explain at all";
    await svc.resolve(q, "en");
    await svc.resolve(q, "en");
    expect(provider.extract).toHaveBeenCalledTimes(1);
  });

  it("never remembers a failure", async () => {
    const { svc, provider } = service(async () => {
      throw new Error("boom");
    });
    const q = "another sentence lane one cannot explain";
    await svc.resolve(q, "en");
    await svc.resolve(q, "en");
    expect(provider.extract).toHaveBeenCalledTimes(2);
  });
});

describe("lane 2 metrics and the model's place", () => {
  const today = () => new Date().toISOString().slice(0, 10);
  it("counts a timeout and its milliseconds, never the query", async () => {
    const { svc } = service(
      (_r, signal) =>
        new Promise((_, reject) => signal.addEventListener("abort", () => reject(new Error("x")))),
    );
    expect((await svc.resolve("a sentence for the timeout count", "en")).lane).toBe("instant");
    const counts = await redis.hgetall(metricsKey(today()));
    expect(counts).toMatchObject({ timeout: "1", calls: "1", le500: "1" });
    expect(Number(counts["ms_total"])).toBeGreaterThanOrEqual(90);
    expect(JSON.stringify(counts)).not.toContain("sentence");
  });
  it("counts answers and cache hits", async () => {
    const { svc } = service(async () => answer);
    await svc.resolve(Q, "en");
    await svc.resolve(Q, "en");
    expect(await redis.hgetall(metricsKey(today()))).toMatchObject({ answered: "1", cached: "1" });
  });
  it("takes a place only when the query's own words name it, by slug or by name", async () => {
    const world = await instant.world();
    expect(resolvePlace({ place: "sakhnin", placeWords: "bsakhnin" }, "fade bsakhnin", world)).toBe(
      "sakhnin",
    );
    expect(resolvePlace({ place: "Sakhnin", placeWords: "سخنين" }, "حلاق سخنين", world)).toBe(
      "sakhnin",
    );
    // Words that are not in the query: an invented place.
    expect(resolvePlace({ place: "sakhnin", placeWords: "sakhnin" }, "a fade", world)).toBeNull();
    // Recorded before placeWords: the slug stands.
    expect(resolvePlace({ place: "sakhnin" }, "a fade", world)).toBe("sakhnin");
    expect(
      resolvePlace({ place: "Atlantis", placeWords: "atlantis" }, "atlantis", world),
    ).toBeNull();
  });
});
