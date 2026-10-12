import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { HashEmbeddingProvider } from "../ai/hash-embedding.provider.js";
import { InstantService } from "./instant.service.js";
import { SearchIndexer } from "./indexer.service.js";
import { SuggestRepository } from "./suggest.repository.js";

const prisma = testPrisma();
const suggest = new SuggestRepository(prisma);
const instant = new InstantService(prisma);

beforeAll(async () => {
  await resetDatabase(prisma);
  await seedFixtures(prisma);
  await new SearchIndexer(prisma, new HashEmbeddingProvider()).indexAll();
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
