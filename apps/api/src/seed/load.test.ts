import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { loadSeed, type SeedData } from "./load.js";

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const screen = {
  brand: { en: "Samer" },
  title: { en: "Book" },
  items: [{ label: { en: "Cut" } }],
  cta: { en: "Go" },
  palette: { bg: "#000000", surface: "#111111", ink: "#ffffff", accent: "#d9a54c" },
  font: "Heebo",
};
const data: SeedData = {
  places: [
    {
      slug: "israel",
      cbsCode: null,
      type: "country",
      parent: null,
      name: { en: "Israel" },
      aliases: [],
      lat: 31.5,
      lng: 34.9,
      status: "live",
    },
    {
      slug: "northern-district",
      cbsCode: null,
      type: "region",
      parent: "israel",
      name: { en: "North" },
      aliases: [],
      lat: 32.9,
      lng: 35.4,
      status: "live",
    },
    {
      slug: "sakhnin",
      cbsCode: "7500",
      type: "city",
      parent: "northern-district",
      name: { en: "Sakhnin" },
      aliases: [],
      lat: 32.86,
      lng: 35.3,
      status: "live",
    },
  ],
  sectors: [
    { slug: "beauty", name: { en: "Beauty" }, tagline: { en: "x" }, accent: "#d9aaa2", order: 1 },
  ],
  kinds: [
    {
      slug: "barbershops",
      sector: "beauty",
      parent: null,
      name: { en: "Barbershops" },
      synonyms: { he: ["ספר"], ar: ["حلاق"], en: ["barber"] },
      template: "booking",
      attributes: [],
      icon: null,
      order: 1,
      status: "active",
    },
    {
      slug: "kids-haircuts",
      sector: "beauty",
      parent: "barbershops",
      name: { en: "Kids" },
      synonyms: { he: ["x"], ar: ["x"], en: ["x"] },
      template: "booking",
      attributes: [],
      icon: null,
      order: 2,
      status: "active",
    },
  ],
  brands: [{ slug: "samer", name: { en: "Samer" } }],
  businesses: [
    {
      slug: "samer",
      place: "sakhnin",
      brand: "samer",
      primaryKind: "barbershops",
      kinds: ["barbershops"],
      name: { en: "Samer" },
      tagline: { en: "x" },
      address: { en: "Sakhnin" },
      lat: 32.861,
      lng: 35.301,
      hours: { weekly: {}, exceptions: [] },
      attributes: {},
      experience: screen,
      tier: "example",
    },
  ],
  plans: [
    {
      slug: "presence",
      order: 1,
      status: "live",
      name: { en: "Presence" },
      tagline: { en: "Be found" },
      monthly: 0,
      setup: null,
      priceNote: {},
      features: { he: [], ar: [], en: ["A pin"] },
      highlighted: false,
      ctaLabel: { en: "Join" },
      ctaHref: "mailto:founder@darb.co.il",
      finePrint: {},
    },
  ],
  texts: [{ key: "pricing.title", value: { en: "Pricing" } }],
};

it("loads a full tree with paths, sub-kinds and published businesses", async () => {
  const counts = await loadSeed(prisma, data);
  expect(counts).toEqual({
    places: 3,
    sectors: 1,
    kinds: 2,
    brands: 1,
    businesses: 1,
    plans: 1,
    texts: 1,
  });
  const sakhnin = await prisma.place.findUniqueOrThrow({ where: { slug: "sakhnin" } });
  expect(sakhnin.path).toBe("/israel/northern-district/sakhnin/");
  const kids = await prisma.kind.findUniqueOrThrow({
    where: { slug: "kids-haircuts" },
    include: { parent: true },
  });
  expect(kids.parent?.slug).toBe("barbershops");
  const b = await prisma.business.findFirstOrThrow({ include: { kinds: true, brand: true } });
  expect([b.status, b.source, b.brand?.slug, b.kinds.length]).toEqual([
    "published",
    "seed",
    "samer",
    1,
  ]);
});

it("is idempotent", async () => {
  await loadSeed(prisma, data);
  await loadSeed(prisma, data);
  expect(await prisma.place.count()).toBe(3);
  expect(await prisma.business.count()).toBe(1);
  expect(await prisma.businessKind.count()).toBe(1);
});

it("refuses experience content that breaks the screen schema", async () => {
  const bad = {
    ...data,
    businesses: [{ ...data.businesses[0]!, experience: { ...screen, items: [] } }],
  };
  await expect(loadSeed(prisma, bad)).rejects.toThrow(/samer/);
});

it("follows a place's slug rename instead of tripping over its CBS code", async () => {
  await loadSeed(prisma, data);
  const before = await prisma.place.findUniqueOrThrow({ where: { cbsCode: "7500" } });
  const renamed: SeedData = {
    ...data,
    places: data.places.map((p) => (p.slug === "sakhnin" ? { ...p, slug: "sakhnin-city" } : p)),
    businesses: data.businesses.map((b) => ({ ...b, place: "sakhnin-city" })),
  };
  await loadSeed(prisma, renamed);
  const after = await prisma.place.findUniqueOrThrow({ where: { cbsCode: "7500" } });
  expect(after.id).toBe(before.id);
  expect([after.slug, after.path]).toEqual([
    "sakhnin-city",
    "/israel/northern-district/sakhnin-city/",
  ]);
  expect(await prisma.place.count()).toBe(3);
  expect(await prisma.business.count()).toBe(1);
});

it("hides kinds that are no longer in the data", async () => {
  await loadSeed(prisma, data);
  await loadSeed(prisma, { ...data, kinds: data.kinds.filter((k) => k.slug !== "kids-haircuts") });
  const kinds = await prisma.kind.findMany({ orderBy: { slug: "asc" } });
  expect(kinds.map((k) => [k.slug, k.status])).toEqual([
    ["barbershops", "active"],
    ["kids-haircuts", "hidden"],
  ]);
});

it("suspends seeded businesses that are no longer in the data, and only those", async () => {
  const second = {
    ...data.businesses[0]!,
    slug: "samer-2",
    brand: null,
    lat: 32.862,
  };
  await loadSeed(prisma, { ...data, businesses: [...data.businesses, second] });
  const kind = await prisma.kind.findUniqueOrThrow({ where: { slug: "barbershops" } });
  const place = await prisma.place.findUniqueOrThrow({ where: { slug: "sakhnin" } });
  await prisma.business.create({
    data: {
      slug: "owner-made",
      placeId: place.id,
      primaryKindId: kind.id,
      name: { en: "Owner" },
      tagline: { en: "x" },
      address: { en: "Sakhnin" },
      hours: { weekly: {}, exceptions: [] },
      experience: screen,
      lat: 32.86,
      lng: 35.3,
      source: "self",
      status: "published",
      tier: "basic",
    },
  });
  await loadSeed(prisma, data);
  const rows = await prisma.business.findMany({ orderBy: { slug: "asc" } });
  expect(rows.map((b) => [b.slug, b.status])).toEqual([
    ["owner-made", "published"],
    ["samer", "published"],
    ["samer-2", "suspended"],
  ]);
});

it("republishes a suspended seeded business that comes back", async () => {
  await loadSeed(prisma, data);
  await loadSeed(prisma, { ...data, businesses: [] });
  expect((await prisma.business.findFirstOrThrow()).status).toBe("suspended");
  await loadSeed(prisma, data);
  expect((await prisma.business.findFirstOrThrow()).status).toBe("published");
});

it("admin-edited rows are never overwritten, hidden or suspended", async () => {
  await loadSeed(prisma, data);
  const stamp = { editedAt: new Date() };
  await prisma.place.update({
    where: { slug: "sakhnin" },
    data: { name: { en: "Sakhnin (admin)" }, ...stamp },
  });
  await prisma.sector.update({ where: { slug: "beauty" }, data: { accent: "#123456", ...stamp } });
  await prisma.kind.update({
    where: { slug: "kids-haircuts" },
    data: { name: { en: "Kids (admin)" }, ...stamp },
  });
  const biz = await prisma.business.findFirstOrThrow({ where: { slug: "samer" } });
  await prisma.business.update({
    where: { id: biz.id },
    data: { name: { en: "Samer (admin)" }, ...stamp },
  });
  await prisma.businessKind.deleteMany({ where: { businessId: biz.id } });

  // The data drops the edited kind and business: the seed would hide and suspend them.
  await loadSeed(prisma, {
    ...data,
    kinds: data.kinds.filter((k) => k.slug !== "kids-haircuts"),
    businesses: [],
  });

  expect((await prisma.place.findUniqueOrThrow({ where: { slug: "sakhnin" } })).name).toEqual({
    en: "Sakhnin (admin)",
  });
  expect((await prisma.sector.findUniqueOrThrow({ where: { slug: "beauty" } })).accent).toBe(
    "#123456",
  );
  const kids = await prisma.kind.findUniqueOrThrow({ where: { slug: "kids-haircuts" } });
  expect([kids.name, kids.status]).toEqual([{ en: "Kids (admin)" }, "active"]);
  const after = await prisma.business.findUniqueOrThrow({ where: { id: biz.id } });
  expect([after.name, after.status]).toEqual([{ en: "Samer (admin)" }, "published"]);
  expect(await prisma.businessKind.count({ where: { businessId: biz.id } })).toBe(0);
});

it("still places children under an edited parent and overwrites rows released back to the seed", async () => {
  await loadSeed(prisma, data);
  await prisma.place.update({
    where: { slug: "northern-district" },
    data: { editedAt: new Date() },
  });
  await prisma.business.updateMany({ data: { name: { en: "Local" }, editedAt: new Date() } });
  await prisma.business.updateMany({ data: { editedAt: null } }); // "Return to seed data"
  await loadSeed(prisma, data);
  const sakhnin = await prisma.place.findUniqueOrThrow({ where: { slug: "sakhnin" } });
  expect(sakhnin.path).toBe("/israel/northern-district/sakhnin/");
  expect((await prisma.business.findFirstOrThrow()).name).toEqual({ en: "Samer" });
});

it("writes a business's dietary facts, empty when the data has none (Task 27b)", async () => {
  const gf = { ...data.businesses[0]!, slug: "gf", brand: null, dietary: ["gluten_free" as const] };
  await loadSeed(prisma, { ...data, businesses: [...data.businesses, gf] });
  const rows = await prisma.business.findMany({ orderBy: { slug: "asc" } });
  expect(rows.map((b) => [b.slug, b.dietary])).toEqual([
    ["gf", ["gluten_free"]],
    ["samer", []],
  ]);
});

it("writes a client's contact details and app links", async () => {
  const client = {
    ...data.businesses[0]!,
    slug: "client",
    tier: "darb" as const,
    phone: "+972 4-000-0000",
    whatsapp: null,
    website: "https://client.darb.co.il",
    apps: { web: "https://client.darb.co.il" },
  };
  await loadSeed(prisma, { ...data, businesses: [...data.businesses, client] });
  const row = await prisma.business.findFirstOrThrow({ where: { slug: "client" } });
  expect([row.phone, row.website, row.apps, row.tier]).toEqual([
    "+972 4-000-0000",
    "https://client.darb.co.il",
    { web: "https://client.darb.co.il" },
    "darb",
  ]);
  const showroom = await prisma.business.findFirstOrThrow({ where: { slug: "samer" } });
  expect([showroom.phone, showroom.whatsapp, showroom.website, showroom.apps]).toEqual([
    null,
    null,
    null,
    {},
  ]);
});

it("seeds plans and texts, hides plans that left the data and keeps edited ones", async () => {
  const signature = { ...data.plans![0]!, slug: "signature", monthly: 349, highlighted: true };
  await loadSeed(prisma, { ...data, plans: [...data.plans!, signature] });
  expect(
    await prisma.siteText.findUniqueOrThrow({ where: { key: "pricing.title" } }),
  ).toMatchObject({ value: { en: "Pricing" }, editedAt: null });
  await prisma.plan.update({
    where: { slug: "presence" },
    data: { monthly: 19, status: "hidden", editedAt: new Date() },
  });
  await prisma.siteText.update({
    where: { key: "pricing.title" },
    data: { value: { en: "Plans" }, editedAt: new Date() },
  });
  // The data drops both plans: the seed hides the one it owns and never touches the edited one.
  await loadSeed(prisma, { ...data, plans: [], texts: [{ key: "pricing.title", value: {} }] });
  const plans = await prisma.plan.findMany({ orderBy: { slug: "asc" } });
  expect(plans.map((p) => [p.slug, p.status, p.monthly])).toEqual([
    ["presence", "hidden", 19],
    ["signature", "hidden", 349],
  ]);
  expect(
    (await prisma.siteText.findUniqueOrThrow({ where: { key: "pricing.title" } })).value,
  ).toEqual({ en: "Plans" });
});

it("seeds the real pricing data when the caller passes none (src/seed/run.ts)", async () => {
  const { plans: _p, texts: _t, ...rest } = data;
  const counts = await loadSeed(prisma, rest);
  expect(counts.plans).toBeGreaterThanOrEqual(4);
  const plans = await prisma.plan.findMany({
    where: { status: "live" },
    orderBy: { order: "asc" },
  });
  expect(plans.map((p) => p.slug)).toEqual(["presence", "spotlight", "signature", "ecosystem"]);
  expect(plans.filter((p) => p.highlighted).map((p) => p.slug)).toEqual(["signature"]);
  expect(await prisma.siteText.count({ where: { key: { startsWith: "pricing." } } })).toBe(
    counts.texts,
  );
});
