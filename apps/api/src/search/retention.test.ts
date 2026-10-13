import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { loadConfig } from "../config.js";
import { SearchLogRetention } from "./retention.js";

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

it("deletes search log rows older than the retention window", async () => {
  const now = new Date("2026-10-13T00:00:00Z");
  const day = 86_400_000;
  const row = (age: number) => ({
    normalized: `q${age}`,
    locale: "en",
    intent: {},
    unmatched: [],
    lane: "instant" as const,
    resultCount: 0,
    createdAt: new Date(now.getTime() - age * day),
  });
  await prisma.searchQuery.createMany({ data: [row(1), row(89), row(91), row(400)] });
  const retention = new SearchLogRetention(
    prisma,
    loadConfig({ ...process.env, SEARCH_INDEX_WORKER: "false" }),
  );
  expect(await retention.purge(now)).toBe(2);
  expect((await prisma.searchQuery.findMany()).map((r) => r.normalized).sort()).toEqual([
    "q1",
    "q89",
  ]);
});
