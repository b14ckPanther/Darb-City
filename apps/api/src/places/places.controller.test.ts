import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";

let app: INestApplication;

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  await seedFixtures(created.prisma);
});
afterAll(() => app.close());

describe("GET /places", () => {
  it("lists only settlements, filtered by status", async () => {
    const res = await request(app.getHttpServer()).get("/places?status=live");
    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug).sort()).toEqual(["sakhnin", "tamra"]);
  });
});

describe("GET /places/:slug", () => {
  it("returns the place with its ancestors (root first) and children", async () => {
    const res = await request(app.getHttpServer()).get("/places/northern-district");
    expect(res.status).toBe(200);
    expect(res.body.ancestors.map((p: { slug: string }) => p.slug)).toEqual(["israel"]);
    expect(res.body.children.map((p: { slug: string }) => p.slug).sort()).toEqual([
      "sakhnin",
      "tamra",
    ]);
  });
  it("returns raw localized names for the client to pick", async () => {
    const res = await request(app.getHttpServer()).get("/places/sakhnin");
    expect(res.body.name).toEqual({ he: "סח'נין", ar: "سخنين", en: "Sakhnin" });
    expect(res.body.ancestors.map((p: { slug: string }) => p.slug)).toEqual([
      "israel",
      "northern-district",
    ]);
  });
  it("404s for an unknown place", async () => {
    const res = await request(app.getHttpServer()).get("/places/nowhere");
    expect(res.status).toBe(404);
  });
});

describe("GET /nearest-place", () => {
  it("finds the nearest live settlement, skipping soon places", async () => {
    const res = await request(app.getHttpServer()).get("/nearest-place?lat=32.85&lng=35.21");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("tamra");
  });
  it("never returns a soon place even when it is closest", async () => {
    const res = await request(app.getHttpServer()).get("/nearest-place?lat=29.55&lng=34.95");
    expect(res.body.slug).not.toBe("eilat");
  });
  it("rejects out-of-range coordinates", async () => {
    const res = await request(app.getHttpServer()).get("/nearest-place?lat=200&lng=35");
    expect(res.status).toBe(400);
  });
  it("rejects blank coordinates instead of reading them as zero", async () => {
    expect((await request(app.getHttpServer()).get("/nearest-place?lat=&lng=35")).status).toBe(400);
    expect((await request(app.getHttpServer()).get("/nearest-place?lat=32.8&lng=")).status).toBe(
      400,
    );
  });
  it("answers 200 with a live place for valid coordinates", async () => {
    const res = await request(app.getHttpServer()).get("/nearest-place?lat=32.85&lng=35.21");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("live");
  });
});
