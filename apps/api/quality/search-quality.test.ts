import "dotenv/config";
import "reflect-metadata";
import { readFileSync } from "node:fs";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { EMBEDDING_PROVIDER } from "../src/ai/embeddings.js";
import { HashEmbeddingProvider } from "../src/ai/hash-embedding.provider.js";
import { INTENT_PROVIDER } from "../src/ai/intent.js";
import { FAILED_SOURCE } from "../src/ai/record-cases.js";
import {
  OffIntentProvider,
  RecordedIntentProvider,
  type RecordedCase,
} from "../src/ai/recorded-intent.provider.js";
import { AppModule } from "../src/app.module.js";
import { CLOCK } from "../src/businesses/businesses.controller.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { normalize } from "@darb/search-text";
import { createRedis, REDIS } from "../src/redis/redis.module.js";

const CASES = JSON.parse(readFileSync("test/search-quality/cases.json", "utf8")) as RecordedCase[];
/** Monday 2026-10-12, 12:00 in Israel: every seeded kind used here is open. */
const NOW = new Date("2026-10-12T09:00:00Z");
const started = new Date();
let app: INestApplication;
let offApp: INestApplication;
let prisma: PrismaService;
let redis: Redis;
let kindSlug: Map<string, string>;
let placePath: Map<string, string>;

/**
 * The run's own Redis database (15), so its intent cache and rate-limit keys never land in the
 * cache the dev server shares (db 0), and clearing them never touches anyone else's.
 */
const QUALITY_REDIS = (() => {
  const url = new URL(process.env["REDIS_URL"] ?? "redis://localhost:6380");
  url.pathname = "/15";
  return url.toString();
})();
const clearRedis = async () => {
  const keys = await redis.keys("darb:*");
  if (keys.length) await redis.del(...keys);
};
/** What the search log stores for each case: cleanup removes only these rows. */
const NORMALIZED = [...new Set(CASES.map((c) => normalize(c.query)))];

beforeAll(async () => {
  // Set after dotenv/config has loaded apps/api/.env: never the model or Voyage, whatever it holds.
  process.env["INTENT_PROVIDER"] = "recorded";
  process.env["EMBEDDING_PROVIDER"] = "hash";
  process.env["SEARCH_RATE_LIMIT"] = "100000";
  process.env["SEARCH_INDEX_WORKER"] = "false";
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => NOW)
    .overrideProvider(REDIS)
    .useFactory({ factory: () => createRedis(QUALITY_REDIS) })
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = app.get(PrismaService);
  redis = app.get(REDIS);
  await clearRedis();
  // The same app with the model off: lane 1 only.
  const offRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => NOW)
    .overrideProvider(REDIS)
    .useFactory({ factory: () => createRedis(QUALITY_REDIS) })
    .overrideProvider(INTENT_PROVIDER)
    .useValue(new OffIntentProvider())
    .compile();
  offApp = offRef.createNestApplication();
  await offApp.init();
  kindSlug = new Map(
    (await prisma.kind.findMany({ select: { id: true, slug: true } })).map((k) => [k.id, k.slug]),
  );
  placePath = new Map(
    (await prisma.place.findMany({ select: { slug: true, path: true } })).map((p) => [
      p.slug,
      p.path,
    ]),
  );
});
afterAll(async () => {
  // The quality run must not show up in the Missing kinds and places report; other people's
  // dev searches made meanwhile stay.
  await prisma.searchQuery.deleteMany({
    where: { createdAt: { gte: started }, normalized: { in: NORMALIZED } },
  });
  await clearRedis();
  await offApp.close();
  await app.close();
});

it("runs on the recorded intents and the offline hash embeddings, never the network", () => {
  expect(app.get(INTENT_PROVIDER)).toBeInstanceOf(RecordedIntentProvider);
  expect(app.get(EMBEDDING_PROVIDER)).toBeInstanceOf(HashEmbeddingProvider);
  expect(offApp.get(EMBEDDING_PROVIDER)).toBeInstanceOf(HashEmbeddingProvider);
});

it("has at least 20 queries per language and 60 in all (spec §9.3)", () => {
  const real = CASES.filter((c) => !c.expect.blocked);
  expect(real.length).toBeGreaterThanOrEqual(60);
  for (const locale of ["he", "ar", "en"])
    expect(real.filter((c) => c.locale === locale).length).toBeGreaterThanOrEqual(20);
});

it("expects only kinds and places the seed has (an unknown place would match anywhere)", () => {
  const kinds = new Set(kindSlug.values());
  const unknown = CASES.filter((c) => !c.expect.blocked).flatMap((c) =>
    [
      ...[c.expect.kind, ...(c.expect.orKinds ?? [])].flatMap((k) =>
        k !== null && kinds.has(k) ? [] : [`kind ${k}`],
      ),
      ...(c.expect.place !== null && placePath.has(c.expect.place)
        ? []
        : [`place ${c.expect.place}`]),
    ].map((what) => `${c.locale} "${c.query}": ${what}`),
  );
  expect(unknown).toEqual([]);
});

it("has no case whose recording failed (search:record marks them)", () => {
  expect(CASES.filter((c) => c.source === FAILED_SOURCE).map((c) => c.query)).toEqual([]);
});

/** Null when the case passes, else why it failed. */
async function check(on: INestApplication, c: RecordedCase): Promise<string | null> {
  const res = await request(on.getHttpServer())
    .post("/search")
    .send({ q: c.query, locale: c.locale, ...(c.near ? { near: c.near } : {}) });
  if (c.expect.blocked)
    return res.body.status === "blocked" ? null : `${c.locale} "${c.query}": not blocked`;
  const top = (res.body.items ?? []).slice(0, 3) as {
    primaryKindId: string;
    placeSlug: string;
    slug: string;
    dietary: string[];
    matched?: { label: Record<string, string> };
  }[];
  const root = placePath.get(c.expect.place ?? "");
  if (!root || !c.expect.kind) throw new Error(`${c.locale} "${c.query}": unknown place or kind`);
  // Deep search: the exact business first, safe for the diet asked, showing the asked thing.
  const first = top[0];
  const said = `${c.locale} "${c.query}" (${res.body.lane})`;
  if (c.expect.first && `${first?.placeSlug}/${first?.slug}` !== c.expect.first)
    return `${said}: wanted ${c.expect.first} first, got ${first ? `${first.placeSlug}/${first.slug}` : "nothing"}`;
  if (c.expect.firstHas && !first?.dietary.includes(c.expect.firstHas))
    return `${said}: the first result is not ${c.expect.firstHas}`;
  if (c.expect.matched && !(first?.matched?.label[c.locale] ?? "").includes(c.expect.matched))
    return `${said}: the first result does not show "${c.expect.matched}" as its match`;
  const wanted = [c.expect.kind, ...(c.expect.orKinds ?? [])];
  const hit = top.some(
    (b) =>
      wanted.includes(kindSlug.get(b.primaryKindId) ?? "") &&
      (placePath.get(b.placeSlug) ?? "").startsWith(root),
  );
  return hit
    ? null
    : `${c.locale} "${c.query}" (${res.body.lane}): wanted ${wanted.join(" or ")} in ${c.expect.place}, got ` +
        top.map((b) => `${kindSlug.get(b.primaryKindId)}@${b.placeSlug}`).join(", ");
}

it("puts a gluten-free kitchen first for every gluten-free case, with the model on or off", async () => {
  const cases = CASES.filter((c) => c.expect.firstHas === "gluten_free");
  expect(cases.length).toBeGreaterThanOrEqual(4);
  const failures: string[] = [];
  for (const on of [app, offApp])
    for (const c of cases) {
      const res = await request(on.getHttpServer())
        .post("/search")
        .send({ q: c.query, locale: c.locale });
      // Never a place that is not gluten free, anywhere in the list.
      const unsafe = (res.body.items as { slug: string; dietary: string[] }[])
        .filter((b) => !b.dietary.includes("gluten_free"))
        .map((b) => b.slug);
      if (res.body.items.length === 0) failures.push(`${c.query}: nothing`);
      if (unsafe.length) failures.push(`${c.query}: ${unsafe.join(", ")}`);
    }
  expect(failures).toEqual([]);
});

it("has model-only cases that lane 1 alone cannot answer, in every language", async () => {
  const modelOnly = CASES.filter((c) => c.expect.modelOnly);
  expect(modelOnly.length).toBeGreaterThanOrEqual(6);
  for (const locale of ["he", "ar", "en"])
    expect(modelOnly.filter((c) => c.locale === locale).length).toBeGreaterThanOrEqual(2);
  // Cached answers from an earlier run would let the model-off app "pass" through the cache.
  await clearRedis();
  const passedWithoutModel: string[] = [];
  for (const c of modelOnly)
    if ((await check(offApp, c)) === null) passedWithoutModel.push(c.query);
  expect(passedWithoutModel).toEqual([]);
});

it("finds the expected kind in the expected place in the top 3, and blocks what Darb does not list", async () => {
  const failures: string[] = [];
  for (const c of CASES) {
    const failure = await check(app, c);
    if (failure) failures.push(failure);
  }
  expect(failures).toEqual([]);
});
