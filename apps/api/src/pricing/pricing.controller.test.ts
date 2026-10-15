import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";

let app: INestApplication;

const plan = (slug: string, order: number, status: "live" | "hidden") => ({
  slug,
  order,
  status,
  name: { en: slug },
  tagline: {},
  monthly: order === 4 ? null : order * 100,
  setup: null,
  priceNote: {},
  features: { he: [], ar: [], en: [`${slug} feature`] },
  ctaLabel: { en: "Talk" },
  ctaHref: "mailto:founder@darb.co.il",
  finePrint: {},
});

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  const prisma = created.prisma;
  await resetDatabase(prisma);
  await prisma.plan.createMany({
    data: [plan("ecosystem", 4, "live"), plan("presence", 1, "live"), plan("old", 2, "hidden")],
  });
  await prisma.siteText.createMany({
    data: [
      { key: "pricing.title", value: { en: "Pricing" } },
      { key: "home.title", value: { en: "Not on this page" } },
    ],
  });
});
afterAll(() => app.close());

it("returns live plans in order with the pricing texts, never hidden plans", async () => {
  const res = await request(app.getHttpServer()).get("/pricing");
  expect(res.status).toBe(200);
  expect(res.body.plans.map((p: { slug: string }) => p.slug)).toEqual(["presence", "ecosystem"]);
  expect(res.body.plans[1].monthly).toBeNull();
  expect(res.body.plans[0]).not.toHaveProperty("editedAt");
  expect(res.body.texts).toEqual({ "pricing.title": { en: "Pricing" } });
});
