import "dotenv/config";
import "reflect-metadata";
import { readFileSync } from "node:fs";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { RecordedCase } from "../src/ai/recorded-intent.provider.js";
import { AppModule } from "../src/app.module.js";
import { CLOCK } from "../src/businesses/businesses.controller.js";
import { PrismaService } from "../src/prisma/prisma.service.js";

const CASES = JSON.parse(readFileSync("test/search-quality/cases.json", "utf8")) as RecordedCase[];
/** Monday 2026-10-12, 12:00 in Israel: every seeded kind used here is open. */
const NOW = new Date("2026-10-12T09:00:00Z");
const started = new Date();
let app: INestApplication;
let prisma: PrismaService;
let kindSlug: Map<string, string>;
let placePath: Map<string, string>;

beforeAll(async () => {
  process.env["INTENT_PROVIDER"] = "recorded";
  process.env["SEARCH_RATE_LIMIT"] = "100000";
  process.env["SEARCH_INDEX_WORKER"] = "false";
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => NOW)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  prisma = app.get(PrismaService);
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
  // The quality run must not show up in the Missing kinds and places report.
  await prisma.searchQuery.deleteMany({ where: { createdAt: { gte: started } } });
  await app.close();
});

it("has at least 20 queries per language and 60 in all (spec §9.3)", () => {
  const real = CASES.filter((c) => !c.expect.blocked);
  expect(real.length).toBeGreaterThanOrEqual(60);
  for (const locale of ["he", "ar", "en"])
    expect(real.filter((c) => c.locale === locale).length).toBeGreaterThanOrEqual(20);
});

it("finds the expected kind in the expected place in the top 3, and blocks what Darb does not list", async () => {
  const failures: string[] = [];
  for (const c of CASES) {
    const res = await request(app.getHttpServer())
      .post("/search")
      .send({ q: c.query, locale: c.locale, ...(c.near ? { near: c.near } : {}) });
    if (c.expect.blocked) {
      if (res.body.status !== "blocked") failures.push(`${c.locale} "${c.query}": not blocked`);
      continue;
    }
    const top = (res.body.items ?? []).slice(0, 3) as {
      primaryKindId: string;
      placeSlug: string;
    }[];
    const root = placePath.get(c.expect.place ?? "") ?? "";
    const hit = top.some(
      (b) =>
        kindSlug.get(b.primaryKindId) === c.expect.kind &&
        (placePath.get(b.placeSlug) ?? "").startsWith(root),
    );
    if (!hit)
      failures.push(
        `${c.locale} "${c.query}" (${res.body.lane}): wanted ${c.expect.kind} in ${c.expect.place}, got ` +
          top.map((b) => `${kindSlug.get(b.primaryKindId)}@${b.placeSlug}`).join(", "),
      );
  }
  expect(failures).toEqual([]);
});
