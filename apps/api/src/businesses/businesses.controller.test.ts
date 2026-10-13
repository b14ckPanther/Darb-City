import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabaseUrl, resetDatabase } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { AppModule } from "../app.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CLOCK } from "./businesses.controller.js";

let app: INestApplication;

beforeAll(async () => {
  testDatabaseUrl();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => new Date("2026-10-12T06:30:00Z"))
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);
  await seedFixtures(prisma);
});
afterAll(() => app.close());

const get = (path: string) => request(app.getHttpServer()).get(path);
const slugs = (items: { slug: string }[]) => items.map((b) => b.slug).sort();

describe("GET /places/:placeSlug/businesses", () => {
  it("lists published businesses of the kind and its sub-kinds", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops");
    expect(res.status).toBe(200);
    expect(slugs(res.body.items)).toEqual(["abu-salim", "little-cuts"]); // draft excluded
    expect(res.body.nextCursor).toBeNull();
  });
  it("includes businesses anywhere under a region", async () => {
    const res = await get("/places/northern-district/businesses?kind=barbershops");
    expect(slugs(res.body.items)).toEqual(["abu-salim", "little-cuts", "tamra-barber"]);
  });
  it("computes openNow, null when there are no hours", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops");
    const byslug = Object.fromEntries(
      res.body.items.map((b: { slug: string; openNow: boolean | null }) => [b.slug, b.openNow]),
    );
    expect(byslug).toEqual({ "abu-salim": true, "little-cuts": null });
  });
  it("carries the weekly hours so browsers recompute open-now on cached pages", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops");
    const abu = res.body.items.find((b: { slug: string }) => b.slug === "abu-salim");
    expect(abu.hours).toMatchObject({ weekly: expect.any(Object), exceptions: [] });
    expect(Object.keys(abu.hours.weekly).length).toBeGreaterThan(0);
  });
  it("filters to open businesses", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops&openNow=true");
    expect(slugs(res.body.items)).toEqual(["abu-salim"]);
  });
  it("404s for an unknown place or kind, and for a hidden kind", async () => {
    expect((await get("/places/nowhere/businesses")).status).toBe(404);
    expect((await get("/places/sakhnin/businesses?kind=nope")).status).toBe(404);
    expect((await get("/places/sakhnin/businesses?kind=hidden-kind")).status).toBe(404);
  });
});

describe("pagination", () => {
  it("pages in a stable order and ends with a null cursor", async () => {
    const first = await get("/places/northern-district/businesses?kind=barbershops&limit=2");
    expect(first.body.items.map((b: { slug: string }) => b.slug)).toEqual([
      "abu-salim",
      "little-cuts",
    ]);
    expect(typeof first.body.nextCursor).toBe("string");
    const second = await get(
      `/places/northern-district/businesses?kind=barbershops&limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(second.body.items.map((b: { slug: string }) => b.slug)).toEqual(["tamra-barber"]);
    expect(second.body.nextCursor).toBeNull();
  });
  it("pages after the open-now filter, not before it", async () => {
    const res = await get(
      "/places/northern-district/businesses?kind=barbershops&openNow=true&limit=1",
    );
    expect(res.body.items.map((b: { slug: string }) => b.slug)).toEqual(["abu-salim"]);
    const next = await get(
      `/places/northern-district/businesses?kind=barbershops&openNow=true&limit=1&cursor=${res.body.nextCursor}`,
    );
    expect(next.body.items.map((b: { slug: string }) => b.slug)).toEqual(["tamra-barber"]);
    expect(next.body.nextCursor).toBeNull();
  });
  it("rejects bad limits and foreign cursors with 400", async () => {
    expect((await get("/places/sakhnin/businesses?limit=0")).status).toBe(400);
    expect((await get("/places/sakhnin/businesses?limit=101")).status).toBe(400);
    expect((await get("/places/sakhnin/businesses?cursor=nonsense")).status).toBe(400);
    const huge = Buffer.from('{"o":3000000000}').toString("base64url");
    expect((await get(`/places/sakhnin/businesses?cursor=${huge}`)).status).toBe(400);
  });
});

describe("GET /places/:placeSlug/businesses/:slug", () => {
  it("returns the full business with raw localized text", async () => {
    const res = await get("/places/sakhnin/businesses/abu-salim");
    expect(res.status).toBe(200);
    expect(res.body.name).toEqual({ ar: "أبو سليم" });
    expect(res.body.placeSlug).toBe("sakhnin");
    expect(res.body.experience).toEqual({ title: { en: "Book" } });
  });
  it("resolves a business in a child place through its parent, with its real place", async () => {
    const res = await get("/places/northern-district/businesses/abu-salim");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("abu-salim");
    expect(res.body.placeSlug).toBe("sakhnin");
  });
  it("404s for a business that lives in a sibling place", async () => {
    expect((await get("/places/sakhnin/businesses/tamra-barber")).status).toBe(404);
  });
  it("404s for an unknown place", async () => {
    expect((await get("/places/nowhere/businesses/abu-salim")).status).toBe(404);
  });
  it("404s for a draft", async () => {
    expect((await get("/places/sakhnin/businesses/draft-barber")).status).toBe(404);
  });
});

describe("GET /places/:placeSlug/kind-counts", () => {
  it("counts published businesses per active kind, sub-kinds included", async () => {
    const res = await get("/places/sakhnin/kind-counts");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ barbershops: 2, "kids-haircuts": 1 });
  });
  it("counts the whole subtree of a region", async () => {
    const res = await get("/places/northern-district/kind-counts");
    expect(res.body).toEqual({ barbershops: 3, "kids-haircuts": 1 });
  });
  it("lists every active kind with zero where there is nothing", async () => {
    const res = await get("/places/eilat/kind-counts");
    expect(res.body).toEqual({ barbershops: 0, "kids-haircuts": 0 });
  });
  it("404s for an unknown place", async () => {
    expect((await get("/places/nowhere/kind-counts")).status).toBe(404);
  });
});

describe("GET /kinds/:kindSlug/nearest-places", () => {
  it("orders live places that have the kind by distance", async () => {
    const res = await get("/kinds/barbershops/nearest-places?lat=32.853&lng=35.198");
    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual(["tamra", "sakhnin"]);
    expect(res.body.map((p: { count: number }) => p.count)).toEqual([1, 2]);
    expect(res.body[0].distanceKm).toBeLessThan(0.5);
    expect(res.body[1].distanceKm).toBeGreaterThan(9);
    expect(res.body[1].distanceKm).toBeLessThan(11);
  });
  it("respects the limit and includes sub-kinds only where they exist", async () => {
    const one = await get("/kinds/barbershops/nearest-places?lat=32.86&lng=35.3&limit=1");
    expect(one.body.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
    const kids = await get("/kinds/kids-haircuts/nearest-places?lat=32.853&lng=35.198");
    expect(kids.body.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
  });
  it("404s for unknown and hidden kinds, 400s for blank coordinates", async () => {
    expect((await get("/kinds/nope/nearest-places?lat=32&lng=35")).status).toBe(404);
    expect((await get("/kinds/hidden-kind/nearest-places?lat=32&lng=35")).status).toBe(404);
    expect((await get("/kinds/barbershops/nearest-places?lat=&lng=35")).status).toBe(400);
  });
});
