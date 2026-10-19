import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { israelDay, OverviewAdmin } from "./overview.admin.js";

let app: INestApplication;
let prisma: PrismaService;
let revalidate: Mock;
let f: Fixtures;
beforeAll(async () => {
  ({ app, prisma, revalidate } = await createAdminTestApp());
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());
const as = <T extends request.Test>(t: T) => t.set("authorization", ADMIN);

/** Real (not showroom) businesses: the admin's lists and numbers leave examples out. */
async function real(
  slug: string,
  over: Partial<Parameters<PrismaService["business"]["create"]>[0]["data"]> = {},
) {
  return prisma.business.create({
    data: {
      slug,
      name: { en: slug.replace(/-/g, " "), he: `עסק ${slug}` },
      tagline: {},
      address: {},
      hours: { weekly: { "0": [{ open: "09:00", close: "17:00" }] }, exceptions: [] },
      experience: {},
      tier: "basic",
      source: "seed",
      status: "published",
      phone: "+972 50-111-2222",
      primaryKindId: f.barbershops.id,
      placeId: f.sakhnin.id,
      lat: 32.864,
      lng: 35.303,
      ...over,
    } as Parameters<PrismaService["business"]["create"]>[0]["data"],
  });
}

beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  // A fresh numbers cache for every test.
  (app.get(OverviewAdmin) as unknown as { cached: unknown }).cached = null;
  revalidate.mockClear();
});

describe("overview", () => {
  it("counts real businesses, the queue and gaps, and names the latest activity", async () => {
    await real("alpha");
    await real("no-phone", { phone: null });
    await real("no-hours", { hours: { weekly: {}, exceptions: [] } });
    await real("appointment", { hours: { weekly: {}, exceptions: [], byAppointment: true } });
    await real("far-away", { lat: 31.0, lng: 35.0 });
    await real("at-centre", { lat: f.sakhnin.lat, lng: f.sakhnin.lng });
    await real("a-draft", { status: "draft", source: "admin" });
    await prisma.inquiry.create({
      data: { name: "N", contact: "x@y.z", topic: "general", message: "hi", locale: "en" },
    });
    // An edit through the API leaves an audit row the overview names.
    const edit = await as(http().post("/admin/businesses/bulk")).send({
      ids: [(await prisma.business.findFirst({ where: { slug: "a-draft" } }))!.id],
      action: "publish",
    });
    expect(edit.status).toBe(200);

    const res = await as(http().get("/admin/overview"));
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.counts).toMatchObject({
      published: 7,
      draft: 0,
      placesLive: 4,
      placesTotal: 5,
      newInquiries: 1,
      pendingJoins: 0,
      // The admin-made draft was created now; seed rows never count as added.
      addedThisWeek: 1,
    });
    expect(res.body.attention).toEqual({
      "no-phone": 1,
      "no-hours": 1,
      "pin-at-centre": 1,
      "pin-outside": 1,
    });
    expect(res.body.added).toHaveLength(14);
    expect(res.body.added.at(-1)).toEqual({ day: israelDay(new Date()), count: 1 });
    expect(res.body.activity[0]).toMatchObject({
      action: "status",
      entityType: "business",
      self: true,
      name: { en: "a draft" },
    });
  });

  it("serves the same numbers for a short while, then reads again", async () => {
    const overview = app.get(OverviewAdmin);
    let now = 1_000_000;
    overview.now = () => now;
    const first = await as(http().get("/admin/overview"));
    await real("later");
    expect((await as(http().get("/admin/overview"))).body.counts.published).toBe(
      first.body.counts.published,
    );
    now += 31_000;
    expect((await as(http().get("/admin/overview"))).body.counts.published).toBe(
      first.body.counts.published + 1,
    );
    overview.now = () => Date.now();
  });
});

describe("search (the command palette)", () => {
  it("finds businesses, places, kinds and categories by name or phone, never examples", async () => {
    await real("shawarma-king", { name: { en: "Shawarma King" }, phone: "+972 4-674-0000" });
    const res = await as(http().get("/admin/search").query({ q: "shawarma" }));
    expect(res.status).toBe(200);
    expect(res.body.businesses).toHaveLength(1);
    expect(res.body.businesses[0]).toMatchObject({
      slug: "shawarma-king",
      status: "published",
      placeName: f.sakhnin.name,
    });
    expect(
      (await as(http().get("/admin/search").query({ q: "6740000" }))).body.businesses,
    ).toHaveLength(1);
    // Fixture businesses are showroom examples.
    expect((await as(http().get("/admin/search").query({ q: "abu" }))).body.businesses).toEqual([]);
    const place = await as(http().get("/admin/search").query({ q: "sakhnin" }));
    expect(place.body.places.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
    const kind = await as(http().get("/admin/search").query({ q: "barber" }));
    expect(kind.body.kinds.map((k: { slug: string }) => k.slug)).toContain("barbershops");
    expect((await as(http().get("/admin/search"))).status).toBe(400);
  });
});

describe("business list", () => {
  it("filters by category, tier, source and gap, sorts by name, and reports the total", async () => {
    await real("zeta", { name: { en: "Zeta" } });
    await real("alef", { name: { en: "Alef" }, tier: "verified" });
    await real("gamma", { name: { en: "Gamma" }, phone: null, editedAt: new Date() });
    const list = (query: Record<string, string | number>) =>
      as(http().get("/admin/businesses").query(query));

    const all = await list({ limit: 2, sort: "name", dir: "asc", locale: "en" });
    expect(all.body.total).toBe(3);
    expect(all.body.items.map((b: { slug: string }) => b.slug)).toEqual(["alef", "gamma"]);
    expect(all.body.items[0]).toMatchObject({
      placeName: f.sakhnin.name,
      kindName: f.barbershops.name,
      thumb: null,
    });
    const page2 = await list({ limit: 2, page: 2, sort: "name", dir: "asc", locale: "en" });
    expect(page2.body.items.map((b: { slug: string }) => b.slug)).toEqual(["zeta"]);

    expect((await list({ tier: "verified" })).body.total).toBe(1);
    expect((await list({ source: "edited" })).body.total).toBe(1);
    expect((await list({ source: "imported" })).body.total).toBe(2);
    expect((await list({ issue: "no-phone" })).body.items[0].slug).toBe("gamma");
    expect((await list({ sector: "beauty" })).body.total).toBe(3);
    expect((await list({ sector: "food" })).body.total).toBe(0);
    expect((await list({ sector: "nowhere" })).body).toEqual({
      items: [],
      nextCursor: null,
      total: 0,
    });
    // Asking for examples keeps the old behaviour.
    expect((await list({ examples: "1" })).body.total).toBe(7);
  });
});

describe("bulk", () => {
  it("publishes, suspends and moves kind, each one audited, skipping what is already so", async () => {
    const a = await real("one", { status: "draft" });
    const b = await real("two", { status: "draft" });
    const c = await real("three");
    const missing = "0190a000-0000-7000-8000-00000000abcd";
    const pub = await as(http().post("/admin/businesses/bulk")).send({
      ids: [a.id, b.id, c.id, missing],
      action: "publish",
    });
    expect(pub.status).toBe(200);
    expect(pub.body).toMatchObject({ changed: 2, unchanged: 1, failed: [missing] });
    expect(await prisma.auditLog.count({ where: { action: "status" } })).toBe(2);

    const sus = await as(http().post("/admin/businesses/bulk")).send({
      ids: [a.id, b.id],
      action: "suspend",
    });
    // A takedown waits for the web and says whether it confirmed.
    expect(sus.body).toMatchObject({ changed: 2, revalidated: true });
    expect(revalidate).toHaveBeenCalledWith(expect.any(Array), { immediate: true });

    const moved = await as(http().post("/admin/businesses/bulk")).send({
      ids: [c.id],
      action: "kind",
      kindId: f.kidsCuts.id,
    });
    expect(moved.body.changed).toBe(1);
    expect((await prisma.business.findUnique({ where: { id: c.id } }))!.primaryKindId).toBe(
      f.kidsCuts.id,
    );
  });

  it("refuses a kind move without a kind, and too many at once", async () => {
    const a = await real("one");
    expect(
      (await as(http().post("/admin/businesses/bulk")).send({ ids: [a.id], action: "kind" }))
        .status,
    ).toBe(400);
    expect(
      (
        await as(http().post("/admin/businesses/bulk")).send({
          ids: Array.from({ length: 101 }, () => a.id),
          action: "publish",
        })
      ).status,
    ).toBe(400);
  });
});

describe("kind words from the search gaps", () => {
  it("adds a word once, in its language, audited", async () => {
    const add = () =>
      as(http().post(`/admin/kinds/${f.barbershops.id}/synonym`)).send({
        locale: "he",
        word: "מספרה לגברים",
      });
    const res = await add();
    expect(res.status).toBe(200);
    expect(res.body.synonyms.he).toContain("מספרה לגברים");
    await add();
    const kind = await prisma.kind.findUnique({ where: { id: f.barbershops.id } });
    expect(
      (kind!.synonyms as { he: string[] }).he.filter((w) => w === "מספרה לגברים"),
    ).toHaveLength(1);
    expect(await prisma.auditLog.count({ where: { entityType: "kind" } })).toBe(1);
  });
});

describe("places and categories lists", () => {
  it("counts businesses per place, sorts by them, and reports the total", async () => {
    await real("one");
    await real("two", { placeId: f.tamra.id });
    await real("three");
    const res = await as(http().get("/admin/places").query({ sort: "businesses", type: "city" }));
    expect(res.status).toBe(200);
    expect(res.body.total).toBe(res.body.items.length);
    const sakhnin = res.body.items.find((p: { slug: string }) => p.slug === "sakhnin");
    expect(sakhnin).toMatchObject({ businessCount: 2, parentName: f.north.name });
    // Without a sort, by address as before.
    const plain = await as(http().get("/admin/places"));
    const slugs = plain.body.items.map((p: { slug: string }) => p.slug);
    expect(slugs).toEqual([...slugs].sort());
  });

  it("gives each category its kind and business counts", async () => {
    await real("one");
    const res = await as(http().get("/admin/sectors"));
    const beauty = res.body.find((s: { slug: string }) => s.slug === "beauty");
    expect(beauty).toMatchObject({ kindCount: 2, businessCount: 1 });
  });
});
