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
  // A seed-suspended example in Tamra: tamra-barber is its only other business there.
  await created.prisma.business.update({
    where: { id: fx.tamraBarber.id },
    data: { status: "suspended" },
  });
});
afterAll(() => app.close());

it("counts published businesses in every live place's subtree, zero included", async () => {
  const res = await request(app.getHttpServer()).get("/place-counts");
  expect(res.status).toBe(200);
  // Sakhnin: abu-salim and little-cuts (draft-barber is a draft). Tamra's only business is
  // suspended. The district sums its cities. Eilat is soon and Israel is the country.
  expect(res.body).toEqual({ "northern-district": 2, sakhnin: 2, tamra: 0 });
});
