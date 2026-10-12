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
};

it("loads a full tree with paths, sub-kinds and published businesses", async () => {
  const counts = await loadSeed(prisma, data);
  expect(counts).toEqual({ places: 3, sectors: 1, kinds: 2, brands: 1, businesses: 1 });
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
