import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import type { EmbeddingProvider } from "../ai/embeddings.js";
import { HashEmbeddingProvider } from "../ai/hash-embedding.provider.js";
import { SearchIndexer } from "./indexer.service.js";

const prisma = testPrisma();
const indexer = new SearchIndexer(prisma, new HashEmbeddingProvider());
let f: Awaited<ReturnType<typeof seedFixtures>>;

beforeAll(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
});
afterAll(() => prisma.$disconnect());

const docs = (type: string) =>
  prisma.$queryRaw<{ slug: string; has_vector: boolean }[]>`
    SELECT slug, embedding IS NOT NULL AS has_vector FROM "SearchDocument"
    WHERE "entityType" = ${type}::"SearchEntity" ORDER BY slug`;

describe("SearchIndexer", () => {
  it("indexes every place, active kind and listed business, with vectors", async () => {
    const counts = await indexer.indexAll();
    expect(counts.business).toBe(3); // abu-salim, little-cuts, tamra-barber; never the draft
    expect((await docs("business")).map((d) => d.slug)).toEqual([
      "abu-salim",
      "little-cuts",
      "tamra-barber",
    ]);
    expect((await docs("kind")).map((d) => d.slug)).not.toContain("hidden-kind");
    expect((await docs("business")).every((d) => d.has_vector)).toBe(true);
  });
  it("is idempotent", async () => {
    await indexer.indexAll();
    expect(await docs("business")).toHaveLength(3);
  });
  it("updates a changed business and drops one that is no longer listed", async () => {
    const abu = await prisma.business.findFirstOrThrow({ where: { slug: "abu-salim" } });
    await prisma.business.update({ where: { id: abu.id }, data: { name: { en: "Salim Cuts" } } });
    await indexer.index("business", [abu.id]);
    const [row] = await prisma.$queryRaw<
      { text: string }[]
    >`SELECT text FROM "SearchDocument" WHERE "entityId" = ${abu.id}::uuid`;
    expect(row?.text).toContain("salim cuts");
    await prisma.business.update({ where: { id: abu.id }, data: { status: "suspended" } });
    expect(await indexer.index("business", [abu.id])).toEqual({ upserted: 0, deleted: 1 });
  });
  it("reindexes a kind's businesses when the kind is hidden", async () => {
    await prisma.kind.update({ where: { id: f.kidsCuts.id }, data: { status: "hidden" } });
    await indexer.index("kind", [f.kidsCuts.id]);
    expect((await docs("business")).map((d) => d.slug)).toEqual(["tamra-barber"]);
    expect((await docs("kind")).map((d) => d.slug)).not.toContain("kids-haircuts");
  });
});

describe("SearchIndexer limits", () => {
  it("reindexes a place's businesses in bounded chunks", async () => {
    const chunked = new SearchIndexer(prisma, new HashEmbeddingProvider());
    chunked.cascadeChunk = 2;
    const spy = vi.spyOn(chunked, "index");
    await chunked.index("place", [f.israel.id]);
    const businessCalls = spy.mock.calls.filter(([entity]) => entity === "business");
    expect(businessCalls.every(([, ids]) => ids.length <= 2)).toBe(true);
    // Every business under Israel is visited once: abu-salim, little-cuts, draft-barber, tamra-barber.
    expect(businessCalls.flatMap(([, ids]) => ids).sort()).toEqual(
      [f.abuSalim.id, f.littleCuts.id, f.draft.id, f.tamraBarber.id].sort(),
    );
  });
  it("stores no vector for a text that embeds to all zeros", async () => {
    const zeros: EmbeddingProvider = {
      name: "zeros",
      embed: async (texts) => texts.map(() => new Array<number>(512).fill(0)),
    };
    await new SearchIndexer(prisma, zeros).index("place", [f.eilat.id]);
    const [row] = await prisma.$queryRaw<{ has_vector: boolean }[]>`
      SELECT embedding IS NOT NULL AS has_vector FROM "SearchDocument" WHERE "entityId" = ${f.eilat.id}::uuid`;
    expect(row).toEqual({ has_vector: false });
  });
});
