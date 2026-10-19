import { afterAll, beforeAll, expect, it } from "vitest";
import { EMPTY_INTENT } from "@darb/contracts";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import type { IntentMetrics } from "./intent-metrics.js";
import { ReportRepository } from "./report.repository.js";

const prisma = testPrisma();
const NOW = new Date("2026-10-12T12:00:00Z");

beforeAll(async () => {
  await resetDatabase(prisma);
  await seedFixtures(prisma); // eilat is a "soon" place
  const row = (
    normalized: string,
    intent: object,
    resultCount: number,
    unmatched: string[] = [],
    lane: "smart" | "instant" | "blocked" = "smart",
    daysAgo = 1,
  ) => ({
    normalized,
    locale: "en",
    intent: { ...EMPTY_INTENT, ...intent },
    unmatched,
    lane,
    resultCount,
    createdAt: new Date(NOW.getTime() - daysAgo * 86_400_000),
  });
  await prisma.searchQuery.createMany({
    data: [
      row("tailor", {}, 0, ["tailor"]),
      row("tailor", {}, 0, ["tailor"]),
      row("upholstery", {}, 0, ["upholstery"]),
      row("barber eilat", { kinds: ["barbershops"], place: "eilat" }, 0),
      row("barber shefaram", { kinds: ["barbershops"] }, 3, ["shefaram"]),
      row("bar", {}, 0, [], "blocked"),
      row("tailor", {}, 0, ["tailor"], "smart", 40), // outside the window
    ],
  });
});
afterAll(() => prisma.$disconnect());

it("reports missing kinds, missing places and searches with no results", async () => {
  const intent = [{ day: "2026-10-12", counts: { answered: 4, timeout: 1, calls: 5 } }];
  const metrics = { days: async () => intent } as unknown as IntentMetrics;
  const report = await new ReportRepository(prisma, metrics).report(30, 10, NOW);
  expect(report.intent).toEqual(intent);
  expect(report.missingKinds).toEqual([
    { term: "tailor", count: 2 },
    { term: "upholstery", count: 1 },
  ]);
  expect(report.missingPlaces).toEqual([
    { term: "eilat", count: 1 },
    { term: "shefaram", count: 1 },
  ]);
  expect(report.noResults).toEqual([
    { term: "tailor", count: 2 },
    { term: "barber eilat", count: 1 },
    { term: "upholstery", count: 1 },
  ]);
  expect(report.since).toBe("2026-09-12T12:00:00.000Z");
});
