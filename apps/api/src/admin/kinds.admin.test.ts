import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
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
const synonyms = { he: ["ספרית ילדים"], ar: ["حلاق اطفال"], en: ["kids barber"] };

it("lists kinds with business counts, filtered by status and text", async () => {
  const res = await http().get("/admin/kinds?status=active&q=barber").set("authorization", ADMIN);
  expect(res.status).toBe(200);
  const barbers = res.body.find((k: { slug: string }) => k.slug === "barbershops");
  expect(barbers.businessCount).toBeGreaterThan(0);
  expect(res.body.every((k: { status: string }) => k.status === "active")).toBe(true);
});

it("creates a hidden kind with the shared content schema", async () => {
  const res = await http()
    .post("/admin/kinds")
    .set("authorization", ADMIN)
    .send({
      slug: "beard-studios",
      sectorId: f.beauty.id,
      name: { en: "Beard studios" },
      synonyms,
      template: "booking",
      order: 50,
    });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe("hidden");
  const row = await prisma.kind.findUniqueOrThrow({ where: { slug: "beard-studios" } });
  expect((row.contentSchema as { required: string[] }).required).toContain("items");
  expect(notify).toHaveBeenCalledWith("kind", [row.id]);
  expect(revalidate).toHaveBeenCalledWith(["taxonomy", "businesses"], { immediate: undefined });
});

it("refuses a parent from another sector and a parent cycle", async () => {
  const other = await http()
    .patch(`/admin/kinds/${f.barbershops.id}`)
    .set("authorization", ADMIN)
    .send({ parentKindId: f.hidden.id });
  expect(other.status).toBe(400);
  const cycle = await http()
    .patch(`/admin/kinds/${f.barbershops.id}`)
    .set("authorization", ADMIN)
    .send({ parentKindId: f.kidsCuts.id });
  expect(cycle.status).toBe(400);
});

it("hiding an active kind is an immediate takedown", async () => {
  const res = await http()
    .patch(`/admin/kinds/${f.barbershops.id}`)
    .set("authorization", ADMIN)
    .send({ status: "hidden" });
  expect(res.status).toBe(200);
  expect(revalidate).toHaveBeenCalledWith(["taxonomy", "businesses"], { immediate: true });
});

it("refuses to create a kind as active", async () => {
  const res = await http()
    .post("/admin/kinds")
    .set("authorization", ADMIN)
    .send({
      slug: "beard-studios",
      sectorId: f.beauty.id,
      name: { en: "Beard studios" },
      synonyms,
      template: "booking",
      order: 50,
      status: "active",
    });
  expect(res.status).toBe(400);
  expect(await prisma.kind.count({ where: { slug: "beard-studios" } })).toBe(0);
});

it("refuses to move a kind with sub-kinds to another sector", async () => {
  const other = await prisma.sector.findFirstOrThrow({ where: { id: { not: f.beauty.id } } });
  const res = await http()
    .patch(`/admin/kinds/${f.barbershops.id}`)
    .set("authorization", ADMIN)
    .send({ sectorId: other.id });
  expect(res.status).toBe(409);
  expect(res.body.code).toBe("kind_has_sub_kinds");
  const [parent, child] = await Promise.all([
    prisma.kind.findUniqueOrThrow({ where: { id: f.barbershops.id } }),
    prisma.kind.findUniqueOrThrow({ where: { id: f.kidsCuts.id } }),
  ]);
  expect([parent.sectorId, child.sectorId]).toEqual([f.beauty.id, f.beauty.id]);
  expect(await prisma.auditLog.count()).toBe(0);
});

it("refuses a parent when the kind tree is too deep to check for a cycle", async () => {
  // A chain deeper than the walk's cap, with the kind being moved at its very top.
  let parentKindId: string | null = f.kidsCuts.id;
  const chain: string[] = [];
  for (let i = 0; i < 12; i++) {
    const k: { id: string } = await prisma.kind.create({
      data: {
        slug: `deep-${i}`,
        sectorId: f.beauty.id,
        parentKindId,
        name: { en: `Deep ${i}` },
        synonyms: { he: [], ar: [], en: [] },
        template: "booking",
        contentSchema: {},
        order: i,
      },
    });
    chain.push(k.id);
    parentKindId = k.id;
  }
  const res = await http()
    .patch(`/admin/kinds/${f.barbershops.id}`)
    .set("authorization", ADMIN)
    .send({ parentKindId: chain.at(-1) });
  expect(res.status).toBe(400);
  expect(res.body.code).toBe("kind_tree_too_deep");
  const row = await prisma.kind.findUniqueOrThrow({ where: { id: f.barbershops.id } });
  expect(row.parentKindId).toBeNull();
});
