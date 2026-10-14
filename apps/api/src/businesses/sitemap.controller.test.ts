import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";

let app: INestApplication;
beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  const f = await seedFixtures(created.prisma);
  await created.prisma.business.update({ where: { id: f.abuSalim.id }, data: { tier: "darb" } });
  // Real but not public: a draft, one in a place that is not live, one whose kind is hidden.
  await created.prisma.business.update({ where: { id: f.draft.id }, data: { tier: "darb" } });
  await created.prisma.business.update({
    where: { id: f.tamraBarber.id },
    data: { tier: "verified" },
  });
  await created.prisma.place.update({ where: { id: f.tamra.id }, data: { status: "soon" } });
  await created.prisma.business.update({ where: { id: f.littleCuts.id }, data: { tier: "basic" } });
  await created.prisma.kind.update({ where: { id: f.kidsCuts.id }, data: { status: "hidden" } });
});
afterAll(() => app.close());

it("lists only real (non-example) published businesses", async () => {
  const res = await request(app.getHttpServer()).get("/sitemap/businesses");
  expect(res.status).toBe(200);
  expect(res.body.map((b: { slug: string }) => b.slug)).toEqual(["abu-salim"]);
  expect(res.body[0]).toEqual({
    placeSlug: "sakhnin",
    slug: "abu-salim",
    primaryKindId: expect.any(String),
    updatedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
  });
});
