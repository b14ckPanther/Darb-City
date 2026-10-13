import "reflect-metadata";
import { Logger } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import { Queue, QueueEvents } from "bullmq";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetDatabase, testDatabaseUrl } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import { AiModule } from "../ai/ai.module.js";
import { loadConfig, type AppConfig } from "../config.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SearchEvents, SearchIndexWorker, jobKey, queueName } from "./index-queue.js";
import { SearchIndexer } from "./indexer.service.js";
import { InstantService } from "./instant.service.js";
import { SearchIndexModule } from "./search-index.module.js";

const url = testDatabaseUrl();
// The test environment turns the worker off (vitest.config.ts); this file is the one that needs it.
process.env["SEARCH_INDEX_WORKER"] = "true";
const moduleRef = await Test.createTestingModule({
  imports: [PrismaModule, AiModule, SearchIndexModule],
}).compile();
await moduleRef.init();
const prisma = moduleRef.get(PrismaService);
const events = moduleRef.get(SearchEvents);
const instant = moduleRef.get(InstantService);
const redisUrl = loadConfig(process.env).search.redisUrl;
const queueEvents = new QueueEvents(queueName(url), { connection: { url: redisUrl } });
let f: Fixtures;

/** A config whose queue no running worker listens on. */
const isolated = (db: string): AppConfig => {
  const config = loadConfig(process.env);
  return { ...config, databaseUrl: url.replace(/\/[^/]+$/, `/${db}`) };
};

beforeAll(async () => {
  await queueEvents.waitUntilReady();
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  await moduleRef.get(SearchIndexer).indexAll();
});
afterAll(async () => {
  await queueEvents.close();
  await moduleRef.close();
  delete process.env["SEARCH_INDEX_WORKER"];
});

const text = async (id: string) =>
  (
    await prisma.$queryRaw<{ text: string }[]>`
      SELECT text FROM "SearchDocument" WHERE "entityId" = ${id}::uuid`
  )[0]?.text;

it("names the queue after the database", () => {
  expect(queueName("postgresql://a:b@h:1/darb_test")).toBe("search-index-darb_test");
});

it("reindexes a business through the queue", async () => {
  const b = await prisma.business.findFirstOrThrow({ where: { slug: "tamra-barber" } });
  await prisma.business.update({
    where: { id: b.id },
    data: { name: { en: "Tamra Fade Studio" } },
  });
  const [job] = await events.changed("business", [b.id]);
  await job!.waitUntilFinished(queueEvents, 10_000);
  expect(await text(b.id)).toContain("tamra fade studio");
});

it("still indexes a later change to the same business once the first job is done", async () => {
  const id = f.tamraBarber.id;
  for (const name of ["Tamra Clippers", "Tamra Blades"]) {
    await prisma.business.update({ where: { id }, data: { name: { en: name } } });
    const [job] = await events.changed("business", [id]);
    await job!.waitUntilFinished(queueEvents, 10_000);
    expect(await text(id)).toContain(name.toLowerCase());
  }
});

it("rebuilds the instant world when places or kinds change, not businesses", async () => {
  const before = instant.world();
  const [own] = await events.changed("business", [f.tamraBarber.id]);
  expect(instant.world()).toBe(before);
  const [kind] = await events.changed("kind", [f.barbershops.id]);
  expect(instant.world()).not.toBe(before);
  const again = instant.world();
  const [place] = await events.changed("place", [f.tamra.id]);
  expect(instant.world()).not.toBe(again);
  for (const job of [own, kind, place]) await job!.waitUntilFinished(queueEvents, 10_000);
});

describe("without a worker on the queue", () => {
  it("keys a job by entity and id, and a batch by a hash of its sorted ids", () => {
    expect(jobKey("business", ["a"])).toBe("business:a");
    expect(jobKey("kind", ["b", "a"])).toBe(jobKey("kind", ["a", "b"]));
    expect(jobKey("kind", ["a", "b"])).toMatch(/^kind:[0-9a-f]{40}$/);
    expect(jobKey("place", ["a", "b"])).not.toBe(jobKey("kind", ["a", "b"]));
  });

  it("enqueues repeated changes to the same ids once", async () => {
    const config = isolated("darb_test_dedupe");
    const lone = new SearchEvents(config, new InstantService(prisma));
    const queue = new Queue(queueName(config.databaseUrl), { connection: { url: redisUrl } });
    try {
      await queue.obliterate({ force: true });
      const a = await lone.changed("business", [f.abuSalim.id]);
      const b = await lone.changed("business", [f.abuSalim.id]);
      await lone.changed("business", [f.littleCuts.id, f.abuSalim.id]);
      await lone.changed("business", [f.abuSalim.id, f.littleCuts.id]);
      expect(b[0]!.id).toBe(a[0]!.id);
      expect(await queue.getWaitingCount()).toBe(2);
    } finally {
      await queue.obliterate({ force: true });
      await queue.close();
      await lone.onModuleDestroy();
    }
  });

  it("opens no Redis connection until the first change", async () => {
    const base = isolated("darb_test_lazy");
    const config = { ...base, search: { ...base.search, redisUrl: "redis://127.0.0.1:1" } };
    const lone = new SearchEvents(config, new InstantService(prisma));
    expect((lone as unknown as { queue: unknown }).queue).toBeNull();
    await lone.onModuleDestroy();
  });

  it("logs a failed attempt with its count, and never the ids", async () => {
    const config = isolated("darb_test_logs");
    const secret = "019a0000-0000-7000-8000-000000000001";
    const failing = {
      index: async () => {
        throw new Error(`Voyage said no for ${secret}`);
      },
    } as unknown as SearchIndexer;
    const warn = vi.spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);
    const worker = new SearchIndexWorker(config, failing, new InstantService(prisma));
    const lone = new SearchEvents(config, new InstantService(prisma));
    const queue = new Queue(queueName(config.databaseUrl), { connection: { url: redisUrl } });
    try {
      await queue.obliterate({ force: true });
      worker.onModuleInit();
      await lone.changed("business", [secret]);
      await vi.waitFor(() => expect(warn).toHaveBeenCalled(), { timeout: 5000 });
      const line = String(warn.mock.calls[0]?.[0]);
      expect(line).toContain("attempt 1 of 3");
      expect(line).toContain("business");
      expect(line).not.toContain(secret);
    } finally {
      warn.mockRestore();
      await worker.onModuleDestroy();
      await queue.obliterate({ force: true });
      await queue.close();
      await lone.onModuleDestroy();
    }
  });
});
