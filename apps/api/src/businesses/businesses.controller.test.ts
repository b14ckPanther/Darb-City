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

const slugs = (body: { slug: string }[]) => body.map((b) => b.slug).sort();

describe("GET /places/:placeSlug/businesses", () => {
  it("lists published businesses of the kind and its sub-kinds", async () => {
    const res = await request(app.getHttpServer()).get(
      "/places/sakhnin/businesses?kind=barbershops",
    );
    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(["abu-salim", "little-cuts"]); // draft excluded
  });
  it("includes businesses anywhere under a region", async () => {
    const res = await request(app.getHttpServer()).get(
      "/places/northern-district/businesses?kind=barbershops",
    );
    expect(slugs(res.body)).toEqual(["abu-salim", "little-cuts", "tamra-barber"]);
  });
  it("computes openNow, null when there are no hours", async () => {
    const res = await request(app.getHttpServer()).get(
      "/places/sakhnin/businesses?kind=barbershops",
    );
    const byslug = Object.fromEntries(
      res.body.map((b: { slug: string; openNow: boolean | null }) => [b.slug, b.openNow]),
    );
    expect(byslug).toEqual({ "abu-salim": true, "little-cuts": null });
  });
  it("filters to open businesses", async () => {
    const res = await request(app.getHttpServer()).get(
      "/places/sakhnin/businesses?kind=barbershops&openNow=true",
    );
    expect(slugs(res.body)).toEqual(["abu-salim"]);
  });
  it("404s for an unknown place or kind, and for a hidden kind", async () => {
    expect((await request(app.getHttpServer()).get("/places/nowhere/businesses")).status).toBe(404);
    expect(
      (await request(app.getHttpServer()).get("/places/sakhnin/businesses?kind=nope")).status,
    ).toBe(404);
    expect(
      (await request(app.getHttpServer()).get("/places/sakhnin/businesses?kind=hidden-kind"))
        .status,
    ).toBe(404);
  });
});

describe("GET /places/:placeSlug/businesses/:slug", () => {
  it("returns the full business with raw localized text", async () => {
    const res = await request(app.getHttpServer()).get("/places/sakhnin/businesses/abu-salim");
    expect(res.status).toBe(200);
    expect(res.body.name).toEqual({ ar: "أبو سليم" });
    expect(res.body.placeSlug).toBe("sakhnin");
    expect(res.body.experience).toEqual({ title: { en: "Book" } });
  });
  it("404s for a business that lives in another place", async () => {
    expect(
      (await request(app.getHttpServer()).get("/places/sakhnin/businesses/tamra-barber")).status,
    ).toBe(404);
  });
  it("404s for a draft", async () => {
    expect(
      (await request(app.getHttpServer()).get("/places/sakhnin/businesses/draft-barber")).status,
    ).toBe(404);
  });
});
