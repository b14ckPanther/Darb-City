import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { PrismaService } from "../prisma/prisma.service.js";

let app: INestApplication;
let prisma: PrismaService;
let notify: Mock;
let revalidate: Mock;
let f: Fixtures;
const strict = {
  type: "object",
  required: ["title"],
  properties: { title: { type: "object" } },
  additionalProperties: false,
};
beforeAll(async () => {
  ({ app, prisma, notify, revalidate } = await createAdminTestApp());
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  await prisma.kind.update({ where: { id: f.barbershops.id }, data: { contentSchema: strict } });
  notify.mockClear();
  revalidate.mockClear();
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());
const as = <T extends request.Test>(t: T) => t.set("authorization", ADMIN);
const draft = () => ({
  slug: "fade-lab",
  placeId: f.sakhnin.id,
  name: { ar: "فيد لاب" },
  tagline: { ar: "قص شعر" },
  address: { ar: "سخنين" },
  primaryKindId: f.barbershops.id,
  kindIds: [],
  lat: 32.864,
  lng: 35.302,
  phone: "+972 50-000-0000",
  whatsapp: null,
  website: null,
  hours: { weekly: { "0": [{ open: "09:00", close: "19:00" }] }, exceptions: [] },
  attributes: {},
  experience: { title: { ar: "احجز" } },
  tier: "basic",
  apps: {},
});

describe("create", () => {
  it("validates experience against the primary kind's schema", async () => {
    const res = await as(http().post("/admin/businesses")).send({
      ...draft(),
      experience: { nope: 1 },
    });
    expect(res.status).toBe(400);
    expect(res.body.errors.join(" ")).toMatch(/title/);
  });

  it("refuses app links below the darb tier", async () => {
    const res = await as(http().post("/admin/businesses")).send({
      ...draft(),
      apps: { web: "https://x.darb.co.il" },
    });
    expect(res.status).toBe(400);
  });

  it("creates an admin-sourced draft with its primary kind linked", async () => {
    const res = await as(http().post("/admin/businesses")).send(draft());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      source: "admin",
      status: "draft",
      placeSlug: "sakhnin",
      kindIds: [f.barbershops.id],
    });
    expect(notify).toHaveBeenCalledWith("business", [res.body.id]);
    expect(revalidate).toHaveBeenCalledWith(
      ["businesses", "business:sakhnin/fade-lab", "place:sakhnin"],
      { immediate: undefined },
    );
    expect((await as(http().post("/admin/businesses")).send(draft())).status).toBe(409);
  });
});

describe("edit and status", () => {
  it("patches a seed business, stamps editedAt, and suspends it as an immediate takedown", async () => {
    const patched = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      name: { ar: "أبو سليم للحلاقة" },
    });
    expect(patched.status).toBe(200);
    expect(patched.body.editedAt).not.toBeNull();
    const res = await as(http().post(`/admin/businesses/${f.abuSalim.id}/status`)).send({
      status: "suspended",
    });
    expect([res.status, res.body.status]).toEqual([200, "suspended"]);
    expect(revalidate).toHaveBeenLastCalledWith(expect.arrayContaining(["businesses"]), {
      immediate: true,
    });
    expect(notify).toHaveBeenLastCalledWith("business", [f.abuSalim.id]);
    const actions = (await prisma.auditLog.findMany({ orderBy: { at: "asc" } })).map(
      (a) => a.action,
    );
    expect(actions).toEqual(["update", "status"]);
  });

  it("re-validates the stored experience when the primary kind changes", async () => {
    await prisma.kind.update({
      where: { id: f.kidsCuts.id },
      data: { contentSchema: { type: "object", required: ["items"] } },
    });
    const res = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      primaryKindId: f.kidsCuts.id,
    });
    expect(res.status).toBe(400);
  });

  it("lists by place and text, newest first", async () => {
    const res = await as(http().get("/admin/businesses?place=sakhnin&q=little"));
    expect(res.body.items.map((b: { slug: string }) => b.slug)).toEqual(["little-cuts"]);
  });
});

describe("delete", () => {
  it("deletes admin drafts only", async () => {
    expect(
      (await as(http().post(`/admin/businesses/${f.abuSalim.id}/delete`)).send({})).status,
    ).toBe(409);
    const created = await as(http().post("/admin/businesses")).send(draft());
    const res = await as(http().post(`/admin/businesses/${created.body.id}/delete`)).send({});
    expect(res.status).toBe(200);
    expect(await prisma.business.count({ where: { id: created.body.id } })).toBe(0);
  });
});
