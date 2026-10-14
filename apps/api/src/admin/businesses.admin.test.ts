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
    expect(res.body.dietary).toEqual([]);
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
    expect(res.body.revalidated).toBe(true);
    expect(revalidate).toHaveBeenLastCalledWith(expect.arrayContaining(["businesses"]), {
      immediate: true,
    });
    expect(notify).toHaveBeenLastCalledWith("business", [f.abuSalim.id]);
    const actions = (await prisma.auditLog.findMany({ orderBy: { at: "asc" } })).map(
      (a) => a.action,
    );
    expect(actions).toEqual(["update", "status"]);
  });

  it("toggles a gluten-free kitchen, audited by field name only (Task 27b)", async () => {
    const on = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      dietary: ["gluten_free"],
    });
    expect([on.status, on.body.dietary]).toEqual([200, ["gluten_free"]]);
    const other = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      phone: "+972 50-111-1111",
    });
    expect(other.body.dietary).toEqual(["gluten_free"]); // untouched by a patch without it
    const off = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({ dietary: [] });
    expect(off.body.dietary).toEqual([]);
    const audits = await prisma.auditLog.findMany({ orderBy: { at: "asc" } });
    expect(audits.map((a) => a.fields)).toEqual([["dietary"], ["phone"], ["dietary"]]);
    const bad = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      dietary: ["gluten_option"],
    });
    expect(bad.status).toBe(400);
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

  it("changing the primary kind alone replaces the old primary link", async () => {
    const res = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      primaryKindId: f.kidsCuts.id,
    });
    expect(res.status).toBe(200);
    expect(res.body.kindIds).toEqual([f.kidsCuts.id]);
    const links = await prisma.businessKind.findMany({ where: { businessId: f.abuSalim.id } });
    expect(links.map((l) => l.kindId)).toEqual([f.kidsCuts.id]);
  });

  it("keeps showroom examples and real businesses apart: tier never moves to or from example", async () => {
    const toReal = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      tier: "verified",
    });
    expect(toReal.status).toBe(400);
    expect(toReal.body.code).toBe("example_tier_fixed");
    const created = await as(http().post("/admin/businesses")).send(draft());
    const toExample = await as(http().patch(`/admin/businesses/${created.body.id}`)).send({
      tier: "example",
    });
    expect(toExample.status).toBe(400);
    expect(toExample.body.code).toBe("example_tier_fixed");
    expect((await prisma.business.findUniqueOrThrow({ where: { id: f.abuSalim.id } })).tier).toBe(
      "example",
    );
    const same = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      tier: "example",
    });
    expect(same.status).toBe(200);
  });

  it("refuses to create a business as a showroom example", async () => {
    const res = await as(http().post("/admin/businesses")).send({ ...draft(), tier: "example" });
    expect(res.status).toBe(400);
    expect(res.body.code).toBe("example_tier_fixed");
  });

  it("finds English names whatever the case", async () => {
    const res = await as(http().get("/admin/businesses?q=LITTLE%20cuts"));
    expect(res.body.items.map((b: { slug: string }) => b.slug)).toEqual(["little-cuts"]);
  });

  it("lists by place and text, newest first", async () => {
    const res = await as(http().get("/admin/businesses?place=sakhnin&q=little"));
    expect(res.body.items.map((b: { slug: string }) => b.slug)).toEqual(["little-cuts"]);
  });
});

it("the admin still sees the real pin of a business that keeps its street private", async () => {
  await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
    attributes: { addressHidden: true },
    lat: 32.9,
    lng: 35.4,
  });
  const res = await as(http().get(`/admin/businesses/${f.abuSalim.id}`));
  expect([res.body.lat, res.body.lng, res.body.attributes.addressHidden]).toEqual([
    32.9,
    35.4,
    true,
  ]);
});

describe("takedown outcome", () => {
  it("says when the web did not drop its pages, and only for takedowns", async () => {
    revalidate.mockResolvedValueOnce(false);
    const down = await as(http().post(`/admin/businesses/${f.abuSalim.id}/status`)).send({
      status: "suspended",
    });
    expect([down.status, down.body.status, down.body.revalidated]).toEqual([
      200,
      "suspended",
      false,
    ]);
    const publish = await as(http().post(`/admin/businesses/${f.abuSalim.id}/status`)).send({
      status: "published",
    });
    expect(publish.status).toBe(200);
    expect(publish.body).not.toHaveProperty("revalidated");
    const edit = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({
      name: { ar: "أبو سليم" },
    });
    expect(edit.body).not.toHaveProperty("revalidated");
  });
  it("retries: the web is asked again for the business's pages, at once", async () => {
    revalidate.mockClear();
    const res = await as(http().post(`/admin/revalidate/business/${f.abuSalim.id}`)).send({});
    expect(res.body).toEqual({ revalidated: true });
    expect(revalidate).toHaveBeenCalledWith(
      expect.arrayContaining(["businesses", "business:sakhnin/abu-salim"]),
      { immediate: true },
    );
    revalidate.mockResolvedValueOnce(false);
    expect(
      (await as(http().post(`/admin/revalidate/kind/${f.barbershops.id}`)).send({})).body,
    ).toEqual({ revalidated: false });
  });
  it("retries a deleted business through the businesses tag", async () => {
    revalidate.mockClear();
    const gone = "0190a000-0000-7000-8000-00000000dead";
    const res = await as(http().post(`/admin/revalidate/business/${gone}`)).send({});
    expect(res.body).toEqual({ revalidated: true });
    expect(revalidate).toHaveBeenCalledWith(["businesses"], { immediate: true });
    expect((await as(http().post(`/admin/revalidate/place/${gone}`)).send({})).status).toBe(404);
  });
  it("retry is admin only", async () => {
    expect((await http().post(`/admin/revalidate/business/${f.abuSalim.id}`).send({})).status).toBe(
      401,
    );
  });
});

describe("delete", () => {
  it("deletes admin drafts only", async () => {
    expect(
      (await as(http().post(`/admin/businesses/${f.abuSalim.id}/delete`)).send({})).status,
    ).toBe(409);
    const created = await as(http().post("/admin/businesses")).send(draft());
    const res = await as(http().post(`/admin/businesses/${created.body.id}/delete`)).send({});
    expect(res.body).toEqual({ deleted: true, revalidated: true });
    expect(await prisma.business.count({ where: { id: created.body.id } })).toBe(0);
  });
});
