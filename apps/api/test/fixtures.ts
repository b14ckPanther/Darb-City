import type { PrismaService } from "../src/prisma/prisma.service.js";

const hours = {
  weekly: { 0: [{ open: "09:00", close: "19:00" }], 1: [{ open: "09:00", close: "19:00" }] },
  exceptions: [],
};

export async function seedFixtures(prisma: PrismaService) {
  const israel = await prisma.place.create({
    data: {
      slug: "israel",
      type: "country",
      path: "/israel/",
      name: { he: "ישראל", en: "Israel" },
      aliases: [],
      lat: 31.5,
      lng: 34.9,
      status: "live",
    },
  });
  const north = await prisma.place.create({
    data: {
      slug: "northern-district",
      type: "region",
      parentId: israel.id,
      path: "/israel/northern-district/",
      name: { en: "Northern District" },
      aliases: [],
      lat: 32.9,
      lng: 35.4,
      status: "live",
    },
  });
  const sakhnin = await prisma.place.create({
    data: {
      slug: "sakhnin",
      type: "city",
      parentId: north.id,
      path: "/israel/northern-district/sakhnin/",
      name: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" },
      aliases: ["Sachnin"],
      lat: 32.8638,
      lng: 35.3023,
      status: "live",
      cbsCode: "7500",
    },
  });
  const tamra = await prisma.place.create({
    data: {
      slug: "tamra",
      type: "city",
      parentId: north.id,
      path: "/israel/northern-district/tamra/",
      name: { en: "Tamra" },
      aliases: [],
      lat: 32.853,
      lng: 35.198,
      status: "live",
      cbsCode: "8900",
    },
  });
  const eilat = await prisma.place.create({
    data: {
      slug: "eilat",
      type: "city",
      parentId: israel.id,
      path: "/israel/eilat/",
      name: { en: "Eilat" },
      aliases: [],
      lat: 29.557,
      lng: 34.952,
      status: "soon",
    },
  });
  const beauty = await prisma.sector.create({
    data: {
      slug: "beauty",
      name: { en: "Beauty Row" },
      tagline: { en: "Appointments" },
      accent: "#d9aaa2",
      order: 2,
    },
  });
  const food = await prisma.sector.create({
    data: {
      slug: "food",
      name: { en: "The Tasting Quarter" },
      tagline: { en: "Plates" },
      accent: "#d6a473",
      order: 1,
    },
  });
  const barbershops = await prisma.kind.create({
    data: {
      slug: "barbershops",
      sectorId: beauty.id,
      name: { en: "Barbershops" },
      synonyms: { he: [], ar: [], en: [] },
      template: "booking",
      contentSchema: {},
      attributes: [],
      order: 1,
    },
  });
  const kidsCuts = await prisma.kind.create({
    data: {
      slug: "kids-haircuts",
      sectorId: beauty.id,
      parentKindId: barbershops.id,
      name: { en: "Kids' haircuts" },
      synonyms: { he: [], ar: [], en: [] },
      template: "booking",
      contentSchema: {},
      attributes: [],
      order: 2,
    },
  });
  const hidden = await prisma.kind.create({
    data: {
      slug: "hidden-kind",
      sectorId: food.id,
      name: { en: "Hidden" },
      synonyms: { he: [], ar: [], en: [] },
      template: "menu",
      contentSchema: {},
      attributes: [],
      order: 1,
      status: "hidden",
    },
  });
  const base = {
    tagline: { en: "x" },
    address: { en: "Main st" },
    hours,
    experience: { title: { en: "Book" } },
    tier: "example" as const,
    source: "seed" as const,
    status: "published" as const,
  };
  const abuSalim = await prisma.business.create({
    data: {
      ...base,
      slug: "abu-salim",
      name: { ar: "أبو سليم" },
      primaryKindId: barbershops.id,
      placeId: sakhnin.id,
      lat: 32.864,
      lng: 35.303,
      kinds: { create: [{ kindId: barbershops.id }] },
    },
  });
  const littleCuts = await prisma.business.create({
    data: {
      ...base,
      slug: "little-cuts",
      name: { en: "Little Cuts" },
      primaryKindId: kidsCuts.id,
      placeId: sakhnin.id,
      lat: 32.865,
      lng: 35.304,
      hours: { weekly: {}, exceptions: [] },
      kinds: { create: [{ kindId: kidsCuts.id }] },
    },
  });
  const draft = await prisma.business.create({
    data: {
      ...base,
      slug: "draft-barber",
      name: { en: "Draft" },
      status: "draft",
      primaryKindId: barbershops.id,
      placeId: sakhnin.id,
      lat: 32.866,
      lng: 35.305,
      kinds: { create: [{ kindId: barbershops.id }] },
    },
  });
  const tamraBarber = await prisma.business.create({
    data: {
      ...base,
      slug: "tamra-barber",
      name: { en: "Tamra Barber" },
      primaryKindId: barbershops.id,
      placeId: tamra.id,
      lat: 32.853,
      lng: 35.198,
      kinds: { create: [{ kindId: barbershops.id }] },
    },
  });
  return {
    israel,
    north,
    sakhnin,
    tamra,
    eilat,
    beauty,
    food,
    barbershops,
    kidsCuts,
    hidden,
    abuSalim,
    littleCuts,
    draft,
    tamraBarber,
  };
}

export type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
