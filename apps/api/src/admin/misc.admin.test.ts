import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { ADMIN, STRANGER, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { PrismaService } from "../prisma/prisma.service.js";

let app: INestApplication;
let prisma: PrismaService;
let f: Fixtures;
beforeAll(async () => {
  ({ app, prisma } = await createAdminTestApp());
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());

it("says who is signed in", async () => {
  const res = await http().get("/admin/me").set("authorization", ADMIN);
  expect(res.body.clerkUserId).toBe("user_admin");
});

it("lists an entity's audit trail newest first, then releases it to the seed", async () => {
  await http()
    .patch(`/admin/places/${f.tamra.id}`)
    .set("authorization", ADMIN)
    .send({ aliases: ["Tamra"] });
  const rel = await http()
    .post(`/admin/release/place/${f.tamra.id}`)
    .set("authorization", ADMIN)
    .send({});
  expect(rel.status).toBe(200);
  expect((await prisma.place.findUniqueOrThrow({ where: { id: f.tamra.id } })).editedAt).toBeNull();
  const audit = await http()
    .get(`/admin/audit?entityType=place&entityId=${f.tamra.id}`)
    .set("authorization", ADMIN);
  expect(audit.body.map((a: { action: string }) => a.action)).toEqual(["release", "update"]);
  expect(audit.body[0].actor).toBe("user_admin");
});

it("serves the Missing report to admins only, with no-store", async () => {
  await prisma.searchQuery.create({
    data: {
      normalized: "ice skating",
      locale: "en",
      intent: {
        kinds: [],
        place: null,
        nearMe: false,
        openNow: false,
        attributes: { delivers: false },
        freeText: "",
      },
      unmatched: [],
      lane: "instant",
      resultCount: 0,
    },
  });
  const res = await http().get("/admin/report?days=30").set("authorization", ADMIN);
  expect(res.status).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.body.missingKinds).toEqual([{ term: "ice skating", count: 1 }]);
  expect((await http().get("/admin/report").set("authorization", STRANGER)).status).toBe(403);
});

it("refuses to return an admin-created row to seed data: there is none (409 no_seed_source)", async () => {
  // kids-haircuts is a fixture kind with no seed counterpart, like one created in admin.
  await prisma.kind.update({ where: { id: f.kidsCuts.id }, data: { editedAt: new Date() } });
  const kind = await http().get(`/admin/kinds/${f.kidsCuts.id}`).set("authorization", ADMIN);
  expect(kind.body.seedSource).toBe(false);
  const res = await http()
    .post(`/admin/release/kind/${f.kidsCuts.id}`)
    .set("authorization", ADMIN)
    .send({});
  expect([res.status, res.body.code]).toEqual([409, "no_seed_source"]);
  expect(
    (await prisma.kind.findUniqueOrThrow({ where: { id: f.kidsCuts.id } })).editedAt,
  ).not.toBeNull();
  expect(await prisma.auditLog.count({ where: { action: "release" } })).toBe(0);
  const business = await http()
    .post(`/admin/release/business/${f.abuSalim.id}`)
    .set("authorization", ADMIN)
    .send({});
  expect([business.status, business.body.code]).toEqual([409, "no_seed_source"]);
});

it("marks which rows have seed data behind them", async () => {
  const kind = await http().get(`/admin/kinds/${f.barbershops.id}`).set("authorization", ADMIN);
  expect(kind.body.seedSource).toBe(true);
  const place = await http().get(`/admin/places/${f.tamra.id}`).set("authorization", ADMIN);
  expect(place.body.seedSource).toBe(true);
  const sectors = await http().get("/admin/sectors").set("authorization", ADMIN);
  expect(sectors.body.every((s: { seedSource: boolean }) => s.seedSource)).toBe(true);
  const biz = await http().get(`/admin/businesses/${f.abuSalim.id}`).set("authorization", ADMIN);
  expect(biz.body.seedSource).toBe(false);
});
