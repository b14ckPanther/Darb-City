import "dotenv/config";
import "reflect-metadata";
import { readFileSync } from "node:fs";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { INTENT_PROVIDER } from "../src/ai/intent.js";
import { OffIntentProvider, type RecordedCase } from "../src/ai/recorded-intent.provider.js";
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
  process.env["INTENT_PROVIDER"] = "recorded";
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
      ...(c.expect.kind !== null && kinds.has(c.expect.kind) ? [] : [`kind ${c.expect.kind}`]),
      ...(c.expect.place !== null && placePath.has(c.expect.place)
        ? []
        : [`place ${c.expect.place}`]),
    ].map((what) => `${c.locale} "${c.query}": ${what}`),
  );
  expect(unknown).toEqual([]);
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
  }[];
  const root = placePath.get(c.expect.place ?? "");
  if (!root || !c.expect.kind) throw new Error(`${c.locale} "${c.query}": unknown place or kind`);
  const hit = top.some(
    (b) =>
      kindSlug.get(b.primaryKindId) === c.expect.kind &&
      (placePath.get(b.placeSlug) ?? "").startsWith(root),
  );
  return hit
    ? null
    : `${c.locale} "${c.query}" (${res.body.lane}): wanted ${c.expect.kind} in ${c.expect.place}, got ` +
        top.map((b) => `${kindSlug.get(b.primaryKindId)}@${b.placeSlug}`).join(", ");
}

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
