import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import { TaxonomyRepository } from "./taxonomy.repository.js";

let app: INestApplication;
let fx: Fixtures;

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  fx = await seedFixtures(created.prisma);
});
afterAll(() => app.close());

it("returns sectors in order with their active kinds in order", async () => {
  const res = await request(app.getHttpServer()).get("/taxonomy");
  expect(res.status).toBe(200);
  expect(res.body.sectors.map((s: { slug: string }) => s.slug)).toEqual(["food", "beauty"]);
  const beauty = res.body.sectors[1];
  expect(beauty.kinds.map((k: { slug: string }) => k.slug)).toEqual(["barbershops", "kids-haircuts"]);
  expect(res.body.sectors[0].kinds).toEqual([]); // hidden kinds never leave the API
});

it("expands a kind to itself and its sub-kinds", async () => {
  const ids = await app.get(TaxonomyRepository).descendantKindIds(fx.barbershops.id);
  expect(ids.sort()).toEqual([fx.barbershops.id, fx.kidsCuts.id].sort());
});
