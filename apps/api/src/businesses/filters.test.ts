import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabase, testDatabaseUrl } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { AppModule } from "../app.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CLOCK } from "./businesses.controller.js";

let app: INestApplication;
/** Monday 2026-10-12, 09:30 in Israel (06:30 UTC). */
const NOW = new Date("2026-10-12T06:30:00Z");

beforeAll(async () => {
  testDatabaseUrl();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => NOW)
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);
  const f = await seedFixtures(prisma);
  // Six more Sakhnin barbers: odd ones open now and deliver; spread east of the centre.
  for (let i = 1; i <= 6; i++) {
    await prisma.business.create({
      data: {
        slug: `extra-${i}`,
        name: { en: `Extra ${i}` },
        tagline: { en: "x" },
        address: { en: "x" },
        experience: {},
        tier: "example",
        source: "seed",
        status: "published",
        primaryKindId: f.barbershops.id,
        placeId: f.sakhnin.id,
        lat: 32.8638,
        lng: 35.31 + i * 0.01,
        attributes: i % 2 ? { delivers: true } : {},
        // extra-1 and extra-2 have fully gluten-free kitchens (Task 27b)
        dietary: i <= 2 ? ["gluten_free"] : [],
        hours:
          i % 2
            ? { weekly: { 1: [{ open: "09:00", close: "18:00" }] }, exceptions: [] }
            : { weekly: { 1: [{ open: "12:00", close: "18:00" }] }, exceptions: [] },
        kinds: { create: [{ kindId: f.barbershops.id }] },
      },
    });
  }
});
afterAll(() => app.close());

const get = (path: string) => request(app.getHttpServer()).get(path);
/** Near-sorted lists are POSTs: the point travels in the body, never in the URL (spec §5.4). */
const POINT = { lat: 32.8638, lng: 35.38 };
const near = (path: string, point: object = POINT) =>
  request(app.getHttpServer()).post(path.replace("/businesses?", "/businesses/near?")).send(point);
const slugs = (res: request.Response) => res.body.items.map((b: { slug: string }) => b.slug);

async function all(path: string, point?: object): Promise<string[]> {
  const out: string[] = [];
  let cursor: string | null = null;
  const fetch = (p: string) => (point ? near(p, point) : get(p));
  do {
    const res = await fetch(`${path}&limit=2${cursor ? `&cursor=${cursor}` : ""}`);
    expect(res.status).toBe(200);
    out.push(...slugs(res));
    cursor = res.body.nextCursor;
  } while (cursor);
  return out;
}

describe("level-3 filters", () => {
  it("pages open-now without gaps or repeats", async () => {
    const paged = await all("/places/sakhnin/businesses?kind=barbershops&openNow=true");
    expect(paged).toEqual(["abu-salim", "extra-1", "extra-3", "extra-5"]);
  });
  it("filters by delivers", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops&delivers=true");
    expect(slugs(res)).toEqual(["extra-1", "extra-3", "extra-5"]);
  });
  it("filters by a dietary fact and shows it on every summary (Task 27b)", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops&dietary=gluten_free");
    expect(slugs(res)).toEqual(["extra-1", "extra-2"]);
    expect(res.body.items.map((b: { dietary: string[] }) => b.dietary)).toEqual([
      ["gluten_free"],
      ["gluten_free"],
    ]);
    const plain = await get("/places/sakhnin/businesses?kind=barbershops");
    expect(plain.body.items.find((b: { slug: string }) => b.slug === "abu-salim").dietary).toEqual(
      [],
    );
  });
  it("combines dietary with open now, delivers and near me", async () => {
    const combined = await all(
      "/places/sakhnin/businesses?kind=barbershops&dietary=gluten_free&openNow=true&delivers=true",
      POINT,
    );
    expect(combined).toEqual(["extra-1"]);
    expect((await get("/places/sakhnin/businesses?kind=barbershops&dietary=vegan")).status).toBe(
      400,
    );
  });
  it("sorts by distance and reports it, nearest first", async () => {
    const res = await near("/places/sakhnin/businesses?kind=barbershops");
    expect(slugs(res).slice(0, 3)).toEqual(["extra-6", "extra-5", "extra-4"]);
    expect(res.body.items[0].distanceKm).toBeLessThan(1);
    expect(res.body.items[0].distanceKm).toBeGreaterThanOrEqual(0);
  });
  it("pages distance order without gaps or repeats, with filters combined", async () => {
    const paged = await all(
      "/places/sakhnin/businesses?kind=barbershops&openNow=true&delivers=true",
      POINT,
    );
    expect(paged).toEqual(["extra-5", "extra-3", "extra-1"]);
  });
  it("leaves distance out of plain lists", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops");
    expect(res.body.items[0].distanceKm).toBeUndefined();
  });
  it("rejects half a point, strings and out-of-range values", async () => {
    const list = "/places/sakhnin/businesses?kind=barbershops";
    expect((await near(list, { lat: 32.8 })).status).toBe(400);
    expect((await near(list, { lat: "32.8", lng: 35.3 })).status).toBe(400);
    expect((await near(list, { lat: 91, lng: 35.3 })).status).toBe(400);
  });
  it("ignores coordinates in a GET query string: they are never read from a URL", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops&lat=32.8638&lng=35.38");
    expect(res.status).toBe(200);
    expect(res.body.items[0].distanceKm).toBeUndefined();
  });
  it("404s the near list for an unknown place", async () => {
    expect((await near("/places/nowhere/businesses?kind=barbershops")).status).toBe(404);
  });
});
