import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { HashEmbeddingProvider } from "../ai/hash-embedding.provider.js";
import { SearchIndexer } from "./indexer.service.js";
import { RetrievalRepository, type RetrievalFilters } from "./retrieval.repository.js";

const prisma = testPrisma();
const repo = new RetrievalRepository(prisma);
const hash = new HashEmbeddingProvider();
let f: Awaited<ReturnType<typeof seedFixtures>>;
const NONE: RetrievalFilters = {
  kindIds: null,
  placePath: null,
  near: null,
  radiusKm: null,
  openAt: null,
  delivers: false,
  dietary: [],
  text: "",
  embedding: null,
};
const slugs = async (filters: Partial<RetrievalFilters>) =>
  (await repo.retrieve({ ...NONE, ...filters })).map((c) => c.row.slug).sort();

beforeAll(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  await new SearchIndexer(prisma, hash).indexAll();
});
afterAll(() => prisma.$disconnect());

describe("retrieval", () => {
  it("filters by kinds and place subtree, published only", async () => {
    const kinds = [f.barbershops.id, f.kidsCuts.id];
    expect(
      await slugs({ kindIds: kinds, placePath: "/israel/northern-district/sakhnin/" }),
    ).toEqual(["abu-salim", "little-cuts"]);
    expect(await slugs({ kindIds: kinds, placePath: "/israel/northern-district/" })).toEqual([
      "abu-salim",
      "little-cuts",
      "tamra-barber",
    ]);
  });
  it("filters by open now in SQL", async () => {
    // Monday 2026-10-12 09:30 Israel; little-cuts has no hours.
    expect(
      await slugs({
        kindIds: [f.barbershops.id, f.kidsCuts.id],
        openAt: new Date("2026-10-12T06:30:00Z"),
      }),
    ).toEqual(["abu-salim", "tamra-barber"]);
  });
  it("filters by radius and reports distance", async () => {
    const rows = await repo.retrieve({
      ...NONE,
      kindIds: [f.barbershops.id],
      near: { lat: 32.8638, lng: 35.3023 },
      radiusKm: 5,
    });
    expect(rows.map((r) => r.row.slug)).toEqual(["abu-salim"]);
    expect(rows[0]!.km).toBeLessThan(1);
  });
  it("matches free text alone, scoring text and vectors", async () => {
    const [embedding] = await hash.embed(["tamra barber"], "query");
    const rows = await repo.retrieve({ ...NONE, text: "tamra barber", embedding: embedding! });
    expect(rows[0]?.row.slug).toBe("tamra-barber");
    expect(rows[0]!.text).toBeGreaterThan(0.5);
    expect(rows[0]!.vector).toBeGreaterThan(0.5);
  });
  it("returns nothing without any scope", async () => {
    expect(await slugs({})).toEqual([]);
  });
});

describe("retrieval guards", () => {
  it("skips the vector part for a zero query embedding (an empty text embeds to zeros)", async () => {
    const [zeros] = await hash.embed([""], "query");
    expect(zeros!.every((x) => x === 0)).toBe(true);
    const rows = await repo.retrieve({
      ...NONE,
      kindIds: [f.barbershops.id, f.kidsCuts.id],
      embedding: zeros!,
    });
    expect(rows.map((r) => r.row.slug).sort()).toEqual([
      "abu-salim",
      "little-cuts",
      "tamra-barber",
    ]);
    for (const r of rows) expect(r.vector).toBe(0);
  });
  it("scores a document without a vector as 0, never NaN", async () => {
    await prisma.$executeRaw`UPDATE "SearchDocument" SET embedding = NULL WHERE slug = 'tamra-barber'`;
    try {
      const [embedding] = await hash.embed(["tamra barber"], "query");
      const rows = await repo.retrieve({
        ...NONE,
        kindIds: [f.barbershops.id],
        embedding: embedding!,
      });
      const tamra = rows.find((r) => r.row.slug === "tamra-barber");
      expect(tamra!.vector).toBe(0);
      for (const r of rows) expect(Number.isNaN(r.vector)).toBe(false);
    } finally {
      await new SearchIndexer(prisma, hash).index("business", [f.tamraBarber.id]);
    }
  });
  it("leaves out businesses in places that are not live, even before a reindex", async () => {
    await prisma.place.update({ where: { id: f.tamra.id }, data: { status: "soon" } });
    try {
      expect(await slugs({ kindIds: [f.barbershops.id, f.kidsCuts.id] })).toEqual([
        "abu-salim",
        "little-cuts",
      ]);
    } finally {
      await prisma.place.update({ where: { id: f.tamra.id }, data: { status: "live" } });
    }
  });
});

describe("the candidate pre-cut", () => {
  it("keeps the nearest business when there are more matches than the limit", async () => {
    const small = new RetrievalRepository(prisma);
    small.candidateLimit = 1;
    // Tamra: tamra-barber is at the door, the Sakhnin barbers are ~10 km away (and have lower ids).
    const rows = await small.retrieve({
      ...NONE,
      kindIds: [f.barbershops.id, f.kidsCuts.id],
      near: { lat: 32.853, lng: 35.198 },
    });
    expect(rows.map((r) => r.row.slug)).toEqual(["tamra-barber"]);
    const sakhnin = await small.retrieve({
      ...NONE,
      kindIds: [f.barbershops.id, f.kidsCuts.id],
      near: { lat: 32.864, lng: 35.303 },
    });
    expect(sakhnin.map((r) => r.row.slug)).toEqual(["abu-salim"]);
  });
  it("prefers the more complete business when nothing else tells them apart", async () => {
    await prisma.$executeRaw`UPDATE "SearchDocument" SET completeness = 0.9 WHERE slug = 'tamra-barber'`;
    try {
      const small = new RetrievalRepository(prisma);
      small.candidateLimit = 1;
      const rows = await small.retrieve({ ...NONE, kindIds: [f.barbershops.id, f.kidsCuts.id] });
      expect(rows.map((r) => r.row.slug)).toEqual(["tamra-barber"]);
    } finally {
      await new SearchIndexer(prisma, hash).index("business", [f.tamraBarber.id]);
    }
  });
});
