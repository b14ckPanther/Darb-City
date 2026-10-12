import "reflect-metadata";
import { Test } from "@nestjs/testing";
import { QueueEvents } from "bullmq";
import { afterAll, beforeAll, expect, it } from "vitest";
import { resetDatabase, testDatabaseUrl } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { AiModule } from "../ai/ai.module.js";
import { loadConfig } from "../config.js";
import { PrismaModule } from "../prisma/prisma.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SearchEvents, queueName } from "./index-queue.js";
import { SearchIndexer } from "./indexer.service.js";
import { SearchIndexModule } from "./search-index.module.js";

const url = testDatabaseUrl();
const moduleRef = await Test.createTestingModule({
  imports: [PrismaModule, AiModule, SearchIndexModule],
}).compile();
await moduleRef.init();
const prisma = moduleRef.get(PrismaService);
const events = moduleRef.get(SearchEvents);
const queueEvents = new QueueEvents(queueName(url), {
  connection: { url: loadConfig(process.env).search.redisUrl },
});

beforeAll(async () => {
  await queueEvents.waitUntilReady();
  await resetDatabase(prisma);
  await seedFixtures(prisma);
  await moduleRef.get(SearchIndexer).indexAll();
});
afterAll(async () => {
  await queueEvents.close();
  await moduleRef.close();
});

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
  const [row] = await prisma.$queryRaw<{ text: string }[]>`
    SELECT text FROM "SearchDocument" WHERE "entityId" = ${b.id}::uuid`;
  expect(row?.text).toContain("tamra fade studio");
});
