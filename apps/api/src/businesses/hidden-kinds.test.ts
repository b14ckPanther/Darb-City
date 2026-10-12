import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";

let app: INestApplication;
let fx: Fixtures;

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  fx = await seedFixtures(created.prisma);
  const base = {
    tagline: { en: "x" },
    address: { en: "Main st" },
    hours: { weekly: {}, exceptions: [] },
    experience: { title: { en: "x" } },
    tier: "example" as const,
    source: "seed" as const,
    status: "published" as const,
    placeId: fx.tamra.id,
    lat: 32.853,
    lng: 35.198,
  };
  await created.prisma.business.create({
    data: {
      ...base,
      slug: "mixed-barber",
      name: { en: "Mixed" },
      primaryKindId: fx.barbershops.id,
      kinds: { create: [{ kindId: fx.barbershops.id }, { kindId: fx.hidden.id }] },
    },
  });
  await created.prisma.business.create({
    data: {
      ...base,
      slug: "hidden-shop",
      name: { en: "Hidden" },
      primaryKindId: fx.hidden.id,
      kinds: { create: [{ kindId: fx.hidden.id }] },
    },
  });
});
afterAll(() => app.close());

const get = (path: string) => request(app.getHttpServer()).get(path);

it("never returns a hidden kind id", async () => {
  const res = await get("/places/tamra/businesses/mixed-barber");
  expect(res.status).toBe(200);
  expect(res.body.kindIds).toEqual([fx.barbershops.id]);
});

it("hides businesses whose primary kind is hidden", async () => {
  expect((await get("/places/tamra/businesses/hidden-shop")).status).toBe(404);
  const list = await get("/places/tamra/businesses");
  expect(list.body.items.map((b: { slug: string }) => b.slug).sort()).toEqual([
    "mixed-barber",
    "tamra-barber",
  ]);
});
