import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import type { PrismaService } from "../prisma/prisma.service.js";

let app: INestApplication;
let prisma: PrismaService;
let revalidate: Mock;
beforeAll(async () => {
  ({ app, prisma, revalidate } = await createAdminTestApp());
});
beforeEach(async () => {
  await resetDatabase(prisma);
  revalidate.mockClear();
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());

const plan = {
  slug: "signature",
  name: { he: "חותם", en: "Signature" },
  tagline: { en: "Yours alone" },
  monthly: 349,
  setup: 2900,
  priceNote: { en: "per month" },
  features: { he: [], ar: [], en: ["A web app made only for you"] },
  highlighted: true,
  ctaLabel: { en: "Design my app" },
  ctaHref: "mailto:founder@darb.co.il",
  finePrint: {},
  order: 3,
};

it("creates a plan hidden, audits it and refreshes the pricing page", async () => {
  const res = await http().post("/admin/plans").set("authorization", ADMIN).send(plan);
  expect(res.status).toBe(201);
  expect([res.body.status, res.body.monthly, res.body.seedSource]).toEqual(["hidden", 349, true]);
  expect(res.body.editedAt).not.toBeNull();
  expect(revalidate).toHaveBeenCalledWith(["pricing"], { immediate: undefined });
  const audit = await prisma.auditLog.findFirstOrThrow();
  expect([audit.action, audit.entityType, audit.entityId]).toEqual(["create", "plan", res.body.id]);
  const again = await http().post("/admin/plans").set("authorization", ADMIN).send(plan);
  expect(again.status).toBe(409);
});

it("updates price, order and status, with only the changed fields in the audit", async () => {
  const { body } = await http().post("/admin/plans").set("authorization", ADMIN).send(plan);
  const res = await http()
    .patch(`/admin/plans/${body.id}`)
    .set("authorization", ADMIN)
    .send({ monthly: null, status: "live", order: 1 });
  expect(res.status).toBe(200);
  expect([res.body.monthly, res.body.status, res.body.order]).toEqual([null, "live", 1]);
  const audit = await prisma.auditLog.findFirstOrThrow({ where: { action: "update" } });
  expect(audit.fields).toEqual(["monthly", "order", "status"]);
  const list = await http().get("/admin/plans").set("authorization", ADMIN);
  expect(list.body.map((p: { slug: string }) => p.slug)).toEqual(["signature"]);
  const one = await http().get(`/admin/plans/${body.id}`).set("authorization", ADMIN);
  expect(one.body.features.en).toEqual(["A web app made only for you"]);
});

it("refuses script links, fractional prices and empty patches", async () => {
  const bad = await http()
    .post("/admin/plans")
    .set("authorization", ADMIN)
    .send({ ...plan, ctaHref: "javascript:alert(1)" });
  expect(bad.status).toBe(400);
  const agorot = await http()
    .post("/admin/plans")
    .set("authorization", ADMIN)
    .send({ ...plan, monthly: 89.9 });
  expect(agorot.status).toBe(400);
  const { body } = await http().post("/admin/plans").set("authorization", ADMIN).send(plan);
  const empty = await http().patch(`/admin/plans/${body.id}`).set("authorization", ADMIN).send({});
  expect(empty.status).toBe(400);
  const missing = await http()
    .patch("/admin/plans/0190a000-0000-7000-8000-00000000abcd")
    .set("authorization", ADMIN)
    .send({ order: 2 });
  expect(missing.status).toBe(404);
});

it("edits a page text, trimming emptied languages, and returns it to the seed", async () => {
  const text = await prisma.siteText.create({
    data: { key: "pricing.title", value: { he: "מחירים", en: "Pricing" } },
  });
  const res = await http()
    .patch(`/admin/texts/${text.id}`)
    .set("authorization", ADMIN)
    .send({ value: { he: " תוכניות ", ar: "", en: "Plans" } });
  expect(res.status).toBe(200);
  expect(res.body.value).toEqual({ he: "תוכניות", en: "Plans" });
  expect(res.body.seedSource).toBe(true);
  expect(revalidate).toHaveBeenCalledWith(["pricing"], { immediate: undefined });
  const list = await http().get("/admin/texts").set("authorization", ADMIN);
  expect(list.body.map((t: { key: string }) => t.key)).toEqual(["pricing.title"]);
  const rel = await http()
    .post(`/admin/release/text/${text.id}`)
    .set("authorization", ADMIN)
    .send({});
  expect(rel.status).toBe(200);
  expect((await prisma.siteText.findUniqueOrThrow({ where: { id: text.id } })).editedAt).toBeNull();
  const audit = await http()
    .get(`/admin/audit?entityType=text&entityId=${text.id}`)
    .set("authorization", ADMIN);
  expect(audit.body.map((a: { action: string }) => a.action)).toEqual(["release", "update"]);
});

it("refuses to return an admin-made plan to seed data", async () => {
  const { body } = await http()
    .post("/admin/plans")
    .set("authorization", ADMIN)
    .send({ ...plan, slug: "made-up" });
  expect(body.seedSource).toBe(false);
  const res = await http()
    .post(`/admin/release/plan/${body.id}`)
    .set("authorization", ADMIN)
    .send({});
  expect([res.status, res.body.code]).toEqual([409, "no_seed_source"]);
});
