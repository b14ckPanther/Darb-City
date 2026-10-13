import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type Mock } from "vitest";
import { ADMIN, STRANGER, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { PrismaService } from "../prisma/prisma.service.js";

let app: INestApplication;
let prisma: PrismaService;
let notify: Mock;
let revalidate: Mock;
let f: Fixtures;
beforeAll(async () => {
  ({ app, prisma, notify, revalidate } = await createAdminTestApp());
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  notify.mockClear();
  revalidate.mockClear();
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());

describe("guard", () => {
  it("401s without a token and 403s a non-admin", async () => {
    expect((await http().get("/admin/places")).status).toBe(401);
    expect((await http().get("/admin/places").set("authorization", STRANGER)).status).toBe(403);
  });
});

describe("places", () => {
  it("lists and searches by slug or name", async () => {
    const res = await http().get("/admin/places?q=sakh").set("authorization", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
    const byName = await http()
      .get(`/admin/places?q=${encodeURIComponent("سخنين")}`)
      .set("authorization", ADMIN);
    expect(byName.body.items.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
  });

  it("creates a place under a parent, audited, indexed and revalidated", async () => {
    const res = await http()
      .post("/admin/places")
      .set("authorization", ADMIN)
      .send({
        slug: "wadi-salameh",
        type: "neighbourhood",
        parentId: f.sakhnin.id,
        name: { ar: "وادي سلامة" },
        lat: 32.86,
        lng: 35.3,
      });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      path: "/israel/northern-district/sakhnin/wadi-salameh/",
      status: "soon",
    });
    expect(res.body.editedAt).not.toBeNull();
    expect(notify).toHaveBeenCalledWith("place", [res.body.id]);
    expect(revalidate).toHaveBeenCalledWith(["places", "place:wadi-salameh"], {
      immediate: undefined,
    });
    const audit = await prisma.auditLog.findFirstOrThrow({ include: { actor: true } });
    expect([audit.action, audit.entityType, audit.actor.clerkUserId]).toEqual([
      "create",
      "place",
      "user_admin",
    ]);
  });

  it("refuses a taken slug (409), a reserved slug (400) and an unknown parent (404)", async () => {
    const base = { type: "town", parentId: f.north.id, name: { en: "x" }, lat: 32.8, lng: 35.2 };
    expect(
      (
        await http()
          .post("/admin/places")
          .set("authorization", ADMIN)
          .send({ ...base, slug: "tamra" })
      ).status,
    ).toBe(409);
    expect(
      (
        await http()
          .post("/admin/places")
          .set("authorization", ADMIN)
          .send({ ...base, slug: "search" })
      ).status,
    ).toBe(400);
    expect(
      (
        await http()
          .post("/admin/places")
          .set("authorization", ADMIN)
          .send({ ...base, slug: "new-town", parentId: "0190a000-0000-7000-8000-00000000dead" })
      ).status,
    ).toBe(404);
  });

  it("taking a live place to soon is an immediate takedown, and stamps editedAt", async () => {
    const res = await http()
      .patch(`/admin/places/${f.sakhnin.id}`)
      .set("authorization", ADMIN)
      .send({ status: "soon" });
    expect(res.status).toBe(200);
    expect(revalidate).toHaveBeenCalledWith(["places", "place:sakhnin"], { immediate: true });
    expect(
      (await prisma.place.findUniqueOrThrow({ where: { id: f.sakhnin.id } })).editedAt,
    ).not.toBeNull();
  });

  it("refuses an empty patch", async () => {
    expect(
      (await http().patch(`/admin/places/${f.sakhnin.id}`).set("authorization", ADMIN).send({}))
        .status,
    ).toBe(400);
  });
});

describe("sectors", () => {
  it("lists in order and updates the accent", async () => {
    const list = await http().get("/admin/sectors").set("authorization", ADMIN);
    expect(list.body.map((s: { slug: string }) => s.slug)).toEqual(["food", "beauty"]);
    const res = await http()
      .patch(`/admin/sectors/${f.beauty.id}`)
      .set("authorization", ADMIN)
      .send({ accent: "#aa8877" });
    expect([res.status, res.body.accent]).toEqual([200, "#aa8877"]);
    expect(revalidate).toHaveBeenCalledWith(["taxonomy"], { immediate: undefined });
  });
});
