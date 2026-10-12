import "reflect-metadata";
import Anthropic from "@anthropic-ai/sdk";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import type { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { resetDatabase, testDatabaseUrl } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { INTENT_PROVIDER, type IntentProvider } from "../ai/intent.js";
import { AppModule } from "../app.module.js";
import { CLOCK } from "../businesses/businesses.controller.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { SearchIndexer } from "./indexer.service.js";

let app: INestApplication;
let prisma: PrismaService;
let redis: Redis;
const extract = vi.fn<IntentProvider["extract"]>(async () => ({
  kinds: ["barbershops"],
  place: "sakhnin",
  nearMe: false,
  openNow: false,
  attributes: { delivers: false },
  freeText: "",
}));

beforeAll(async () => {
  testDatabaseUrl();
  process.env["SEARCH_RATE_LIMIT"] = "5";
  process.env["SEARCH_PROXY_KEY"] = "proxy-key";
  process.env["SEARCH_RESULTS_RATE_LIMIT"] = "3";
  process.env["SEARCH_CLICK_RATE_LIMIT"] = "3";
  process.env["SEARCH_REPORT_KEY"] = "report-key";
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => new Date("2026-10-12T06:30:00Z"))
    .overrideProvider(INTENT_PROVIDER)
    .useValue({ name: "fake", extract })
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = app.get(PrismaService);
  redis = app.get(REDIS);
  await resetDatabase(prisma);
  await seedFixtures(prisma);
  await app.get(SearchIndexer).indexAll();
});
beforeEach(async () => {
  const keys = await redis.keys("darb:*");
  if (keys.length) await redis.del(...keys);
  extract.mockClear();
});
afterAll(async () => {
  delete process.env["SEARCH_RATE_LIMIT"];
  delete process.env["SEARCH_PROXY_KEY"];
  delete process.env["SEARCH_RESULTS_RATE_LIMIT"];
  delete process.env["SEARCH_CLICK_RATE_LIMIT"];
  delete process.env["SEARCH_REPORT_KEY"];
  await app.close();
});

const post = (path: string, body: object, ip = "10.1.1.1") =>
  request(app.getHttpServer())
    .post(path)
    .set("x-darb-proxy-key", "proxy-key")
    .set("x-darb-client-ip", ip)
    .send(body);

describe("POST /search", () => {
  it("answers a sentence through the model and logs it anonymously", async () => {
    const res = await post("/search", {
      q: "someone to fix my fade in sakhnin please",
      locale: "en",
      near: { lat: 32.86412, lng: 35.30311 },
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({
      status: "ok",
      lane: "smart",
      intent: { kinds: ["barbershops"], place: "sakhnin" },
    });
    // Barbershops include the kids-haircuts sub-kind (little-cuts); the draft never shows.
    expect(res.body.items.map((b: { slug: string }) => b.slug).sort()).toEqual([
      "abu-salim",
      "little-cuts",
    ]);
    const rows = await prisma.$queryRaw<Record<string, unknown>[]>`SELECT * FROM "SearchQuery"`;
    expect(rows).toHaveLength(1);
    expect(Object.keys(rows[0]!).sort()).toEqual([
      "clickedKey",
      "createdAt",
      "id",
      "intent",
      "lane",
      "locale",
      "normalized",
      "resultCount",
      "unmatched",
    ]);
    expect(JSON.stringify(rows)).not.toMatch(/32\.86|35\.30|10\.1\.1\.1/);
  });
  it("short-circuits a blocked query with no model call and no results", async () => {
    const res = await post("/search", { q: "בר בסחנין", locale: "he" });
    expect(res.body).toMatchObject({ status: "blocked", items: [], queryId: null });
    expect(extract).not.toHaveBeenCalled();
  });
  it("asks for location when the intent wants near me and no point came", async () => {
    extract.mockResolvedValueOnce({
      kinds: ["barbershops"],
      place: null,
      nearMe: true,
      openNow: false,
      attributes: { delivers: false },
      freeText: "",
    });
    const res = await post("/search", { q: "a barber close to where I am now", locale: "en" });
    expect(res.body.needsLocation).toBe(true);
  });
  it("rate-limits per client IP, and only trusts the IP with the proxy key", async () => {
    for (let i = 0; i < 5; i++)
      expect((await post("/search", { q: "barbershops", locale: "en" })).status).toBe(200);
    const refused = await post("/search", { q: "barbershops", locale: "en" });
    expect(refused.status).toBe(429);
    expect(refused.body.retryAfter).toBeGreaterThan(0);
    expect((await post("/search", { q: "barbershops", locale: "en" }, "10.1.1.2")).status).toBe(
      200,
    );
  });
  it("rejects an empty query", async () => {
    expect((await post("/search", { q: "  ", locale: "en" })).status).toBe(400);
  });
});

describe("POST /search/results (chips)", () => {
  it("re-runs retrieval with an edited intent and never calls the model", async () => {
    const intent = {
      kinds: ["barbershops"],
      place: null,
      nearMe: false,
      openNow: false,
      attributes: { delivers: false },
      freeText: "",
    };
    const res = await post("/search/results", { q: "barber", locale: "en", intent });
    expect(res.status).toBe(200);
    expect(res.body.items.map((b: { slug: string }) => b.slug).sort()).toEqual([
      "abu-salim",
      "little-cuts",
      "tamra-barber",
    ]);
    expect(res.body.queryId).toBeNull();
    expect(extract).not.toHaveBeenCalled();
  });
  it("400s an unknown kind", async () => {
    const intent = {
      kinds: ["casino"],
      place: null,
      nearMe: false,
      openNow: false,
      attributes: { delivers: false },
      freeText: "",
    };
    expect((await post("/search/results", { q: "x", locale: "en", intent })).status).toBe(400);
  });
});

describe("suggest and click", () => {
  it("suggests business names", async () => {
    const res = await request(app.getHttpServer()).get("/search/suggest?q=tamra");
    expect(res.body.map((s: { slug: string }) => s.slug)).toEqual(["tamra-barber"]);
  });
  it("records the first click on a logged search", async () => {
    const { body } = await post("/search", {
      q: "someone for a fade in sakhnin please",
      locale: "en",
    });
    expect(
      (await post("/search/click", { queryId: body.queryId, key: "sakhnin/abu-salim" })).status,
    ).toBe(204);
    expect(
      (await post("/search/click", { queryId: body.queryId, key: "sakhnin/little-cuts" })).status,
    ).toBe(404);
  });
});

describe("hardening", () => {
  it("answers from lane 1, never a 500, when the SDK throws a typed error", async () => {
    extract.mockRejectedValueOnce(
      new Anthropic.RateLimitError(429, { type: "error" }, "slow down", new Headers()),
    );
    const res = await post("/search", {
      q: "someone to fix my fade in sakhnin please",
      locale: "en",
    });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ status: "ok", lane: "instant", intent: { place: "sakhnin" } });
  });
  it("cannot dodge the limit by forging the client IP without the proxy key", async () => {
    const forged = (i: number) =>
      request(app.getHttpServer())
        .post("/search")
        .set("x-darb-client-ip", `10.9.9.${i}`)
        .send({ q: "barbershops", locale: "en" });
    for (let i = 0; i < 5; i++) expect((await forged(i)).status).toBe(200);
    expect((await forged(99)).status).toBe(429);
  });
  it("limits chip edits on their own budget", async () => {
    const intent = {
      kinds: ["barbershops"],
      place: null,
      nearMe: false,
      openNow: false,
      attributes: { delivers: false },
      freeText: "",
    };
    for (let i = 0; i < 3; i++)
      expect((await post("/search/results", { q: "barber", locale: "en", intent })).status).toBe(
        200,
      );
    expect((await post("/search/results", { q: "barber", locale: "en", intent })).status).toBe(429);
    expect((await post("/search", { q: "barbershops", locale: "en" })).status).toBe(200);
  });
  it("returns nothing, without a vector, for an empty chip query", async () => {
    const intent = {
      kinds: [],
      place: null,
      nearMe: false,
      openNow: false,
      attributes: { delivers: false },
      freeText: "",
    };
    const res = await post("/search/results", { q: "", locale: "en", intent });
    expect(res.status).toBe(200);
    expect(res.body.items).toEqual([]);
  });
});

describe("GET /search/report", () => {
  it("is hidden without the key and answers with it", async () => {
    const server = app.getHttpServer();
    expect((await request(server).get("/search/report")).status).toBe(404);
    expect(
      (await request(server).get("/search/report").set("x-darb-report-key", "wrong-key!")).status,
    ).toBe(404);
    const res = await request(server)
      .get("/search/report?days=7")
      .set("x-darb-report-key", "report-key");
    expect(res.status).toBe(200);
    expect(Object.keys(res.body).sort()).toEqual([
      "missingKinds",
      "missingPlaces",
      "noResults",
      "since",
    ]);
  });
  it("hides itself from a bad query without the key, and reads defaults with it", async () => {
    const server = app.getHttpServer();
    expect((await request(server).get("/search/report?days=abc&limit=-1")).status).toBe(404);
    const res = await request(server)
      .get("/search/report?days=9999&limit=abc")
      .set("x-darb-report-key", "report-key");
    expect(res.status).toBe(200);
  });
  it("stops answering an IP after 10 wrong keys in a minute, even to the right key", async () => {
    const server = app.getHttpServer();
    const from = (ip: string, key: string) =>
      request(server)
        .get("/search/report")
        .set("x-darb-proxy-key", "proxy-key")
        .set("x-darb-client-ip", ip)
        .set("x-darb-report-key", key);
    for (let i = 0; i < 10; i++) expect((await from("10.9.9.9", `guess-${i}`)).status).toBe(404);
    expect((await from("10.9.9.9", "report-key")).status).toBe(200); // 10 misses: still allowed
    expect((await from("10.9.9.9", "guess-10")).status).toBe(404);
    expect((await from("10.9.9.9", "report-key")).status).toBe(404); // 11 misses: locked out
    expect((await from("10.9.9.8", "report-key")).status).toBe(200);
  });
  it("answers 404, never 500, to a key of the same length in other bytes", async () => {
    // "é" is one character but two UTF-8 bytes: timingSafeEqual must not see unequal lengths.
    const res = await request(app.getHttpServer())
      .get("/search/report")
      .set("x-darb-report-key", "report-k\u00e9y");
    expect(res.status).toBe(404);
  });
});

describe("click guards", () => {
  const some = "019a0000-0000-7000-8000-00000000000a";
  it("refuses a key that is not place/slug", async () => {
    expect((await post("/search/click", { queryId: some, key: "x" })).status).toBe(400);
  });
  it("records clicks only on searches from the last 24 hours", async () => {
    const { body } = await post("/search", {
      q: "someone for a fade in sakhnin please",
      locale: "en",
    });
    await prisma.searchQuery.update({
      where: { id: body.queryId },
      data: { createdAt: new Date(Date.now() - 25 * 3_600_000) },
    });
    expect(
      (await post("/search/click", { queryId: body.queryId, key: "sakhnin/abu-salim" })).status,
    ).toBe(404);
    expect(
      (await prisma.searchQuery.findUnique({ where: { id: body.queryId } }))?.clickedKey,
    ).toBeNull();
  });
  it("rate-limits clicks on their own budget", async () => {
    for (let i = 0; i < 3; i++)
      expect(
        (await post("/search/click", { queryId: some, key: "sakhnin/abu-salim" })).status,
      ).toBe(404);
    const refused = await post("/search/click", { queryId: some, key: "sakhnin/abu-salim" });
    expect(refused.status).toBe(429);
    expect(refused.body.retryAfter).toBeGreaterThan(0);
    expect((await post("/search", { q: "barbershops", locale: "en" })).status).toBe(200);
  });
});
