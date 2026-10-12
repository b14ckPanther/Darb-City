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
  const fx = await seedFixtures(created.prisma);
  // Published, but its primary kind is hidden: it never counts.
  await created.prisma.business.create({
    data: {
      slug: "hidden-shop",
      name: { en: "Hidden" },
      tagline: { en: "x" },
      address: { en: "Main st" },
      hours: { weekly: {}, exceptions: [] },
      experience: { title: { en: "x" } },
      tier: "example",
      source: "seed",
      status: "published",
      placeId: fx.tamra.id,
      lat: 32.853,
      lng: 35.198,
      primaryKindId: fx.hidden.id,
      kinds: { create: [{ kindId: fx.hidden.id }] },
    },
  });
});
afterAll(() => app.close());

it("counts published businesses of active kinds in every live settlement", async () => {
  const res = await request(app.getHttpServer()).get("/density");
  expect(res.status).toBe(200);
  // Sakhnin: abu-salim and little-cuts (draft-barber is a draft). Tamra: tamra-barber only.
  // Eilat is soon; Israel and the district are not settlements.
  expect(res.body).toEqual({ sakhnin: 2, tamra: 1 });
});
