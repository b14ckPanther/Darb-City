import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import { HashEmbeddingProvider } from "../ai/hash-embedding.provider.js";
import { Prisma } from "../generated/prisma/client.js";
import { InstantService } from "./instant.service.js";
import { SearchIndexer } from "./indexer.service.js";
import { SuggestRepository } from "./suggest.repository.js";

const prisma = testPrisma();
const suggest = new SuggestRepository(prisma);
const instant = new InstantService(prisma);
const indexer = new SearchIndexer(prisma, new HashEmbeddingProvider());
let f: Fixtures;

beforeAll(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  await indexer.indexAll();
});
afterAll(() => prisma.$disconnect());

describe("suggest", () => {
  it("finds business names by prefix, inside a word and with a typo", async () => {
    expect((await suggest.suggest("tamra b", { limit: 6 })).map((s) => s.slug)).toEqual([
      "tamra-barber",
    ]);
    expect((await suggest.suggest("barb", { limit: 6 }))[0]?.slug).toBe("tamra-barber");
    expect((await suggest.suggest("tamar barber", { limit: 6 }))[0]?.slug).toBe("tamra-barber");
    expect((await suggest.suggest("أبو سليم", { limit: 6 }))[0]).toMatchObject({
      slug: "abu-salim",
      placeSlug: "sakhnin",
      kindSlug: "barbershops",
      sectorSlug: "beauty",
    });
  });
  it("ignores one-letter queries and never lists drafts", async () => {
    expect(await suggest.suggest("t", { limit: 6 })).toEqual([]);
    expect((await suggest.suggest("draft", { limit: 6 })).map((s) => s.slug)).toEqual([]);
  });
});

describe("instant lane on the server", () => {
  it("matches places and kinds from the database", async () => {
    const r = await instant.match("barbershops in sakhnin");
    expect(r.kinds[0]?.entry.s).toBe("barbershops");
    expect(r.places[0]?.entry.s).toBe("sakhnin");
    expect((await instant.world()).places.get("sakhnin")?.path).toBe(
      "/israel/northern-district/sakhnin/",
    );
  });
});

describe("suggest bounds", () => {
  it("only lists businesses in live places, even before a reindex", async () => {
    await prisma.place.update({ where: { id: f.tamra.id }, data: { status: "soon" } });
    try {
      expect(await suggest.suggest("tamra b", { limit: 6 })).toEqual([]);
    } finally {
      await prisma.place.update({ where: { id: f.tamra.id }, data: { status: "live" } });
    }
    expect((await suggest.suggest("tamra b", { limit: 6 })).map((s) => s.slug)).toEqual([
      "tamra-barber",
    ]);
  });
  it("clamps the limit to 1–10 itself", async () => {
    const src = await prisma.business.findFirstOrThrow({ where: { slug: "tamra-barber" } });
    const ids: string[] = [];
    for (let i = 1; i <= 12; i++) {
      const b = await prisma.business.create({
        data: {
          slug: `clamp-studio-${i}`,
          name: { en: `Clamp Studio ${i}` },
          tagline: src.tagline as Prisma.InputJsonValue,
          address: src.address as Prisma.InputJsonValue,
          hours: src.hours as Prisma.InputJsonValue,
          experience: src.experience as Prisma.InputJsonValue,
          primaryKindId: src.primaryKindId,
          placeId: src.placeId,
          lat: src.lat,
          lng: src.lng,
          tier: src.tier,
          source: src.source,
          status: "published",
        },
      });
      ids.push(b.id);
    }
    await indexer.index("business", ids);
    expect(await suggest.suggest("clamp studio", { limit: 50 })).toHaveLength(10);
    expect(await suggest.suggest("clamp studio", { limit: -5 })).toHaveLength(1);
    expect(await suggest.suggest("clamp studio", { limit: Number.NaN })).toHaveLength(6);
  });
});
