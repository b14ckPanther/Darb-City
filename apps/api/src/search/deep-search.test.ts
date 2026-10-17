import { EMPTY_INTENT, type IntentDto } from "@darb/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { EmbeddingProvider } from "../ai/embeddings.js";
import { HashEmbeddingProvider } from "../ai/hash-embedding.provider.js";
import type { Prisma } from "../generated/prisma/client.js";
import { BusinessesRepository } from "../businesses/businesses.repository.js";
import { TaxonomyRepository } from "../taxonomy/taxonomy.repository.js";
import { SearchIndexer } from "./indexer.service.js";
import { InstantService } from "./instant.service.js";
import type { IntentService, Resolved } from "./intent.service.js";
import { RetrievalRepository, type RetrievalFilters } from "./retrieval.repository.js";
import { SearchLogRepository } from "./search-log.repository.js";
import { SmartSearchService } from "./smart-search.service.js";

/**
 * Deep search end to end on the test database: offerings read from cards, found by what they
 * offer whatever their kind, strict diets, and the fallbacks that never end at nothing.
 */
const prisma = testPrisma();
const hash = new HashEmbeddingProvider();
const indexer = new SearchIndexer(prisma, hash);
const repo = new RetrievalRepository(prisma);
const instant = new InstantService(prisma);
let f: Fixtures;
let ids: Record<string, string>;
let kinds: Record<string, string>;

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
const SAKHNIN = "/israel/northern-district/sakhnin/";
const hours = {
  weekly: Object.fromEntries(
    [0, 1, 2, 3, 4, 5, 6].map((d) => [d, [{ open: "08:00", close: "22:00" }]]),
  ),
  exceptions: [],
};

beforeAll(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  const kind = (slug: string, en: string, synonyms: string[], sectorId = f.food.id) =>
    prisma.kind.create({
      data: {
        slug,
        sectorId,
        name: { en },
        synonyms: { he: [], ar: [], en: synonyms },
        template: "menu",
        contentSchema: {},
        attributes: [],
        order: 9,
      },
    });
  const restaurants = await kind("restaurants", "Restaurants", ["restaurant", "food"]);
  const grill = await kind("grill", "Shawarma & grill", ["shawarma", "grill"]);
  const stations = await kind("stations", "Gas stations", ["fuel"], f.beauty.id);
  const carWash = await kind("car-wash", "Car wash", ["car wash"], f.beauty.id);
  kinds = {
    restaurants: restaurants.id,
    grill: grill.id,
    stations: stations.id,
    carWash: carWash.id,
  };
  const business = (
    slug: string,
    primary: string,
    placeId: string,
    point: [number, number],
    experience: Prisma.InputJsonValue,
    extra: Record<string, unknown> = {},
  ) =>
    prisma.business.create({
      data: {
        slug,
        name: { en: slug.replace(/-/g, " ") },
        tagline: { en: "x" },
        address: { en: "Main st" },
        hours,
        experience,
        tier: "basic",
        source: "seed",
        status: "published",
        primaryKindId: primary,
        placeId,
        lat: point[0],
        lng: point[1],
        kinds: { create: [{ kindId: primary }] },
        ...extra,
      },
    });
  // Tamra (~10 km from Sakhnin): a gluten-free kitchen whose sandwiches list shawarma.
  const celiac = await business(
    "celiac-corner",
    restaurants.id,
    f.tamra.id,
    [32.853, 35.198],
    {
      items: [
        {
          label: { he: "ארוחות", en: "Meals" },
          meta: { he: "כריכים: שניצל, שווארמה", en: "Sandwiches: schnitzel, shawarma" },
        },
      ],
      tags: [{ en: "Gluten-free" }],
    },
    { dietary: ["gluten_free"] },
  );
  // Sakhnin: shawarma, not gluten free.
  const grillHouse = await business("grill-house", grill.id, f.sakhnin.id, [32.864, 35.302], {
    items: [{ label: { he: "שווארמה", en: "Shawarma" }, meta: { en: "Veal shawarma" } }],
  });
  // Sakhnin: a fuel station whose card lists a car wash.
  const station = await business("north-fuel", stations.id, f.sakhnin.id, [32.862, 35.301], {
    items: [{ label: { en: "Fuel" } }, { label: { he: "שטיפת רכב", en: "Car wash" } }],
  });
  ids = { celiac: celiac.id, grillHouse: grillHouse.id, station: station.id };
  await indexer.indexAll();
});
afterAll(() => prisma.$disconnect());

const offerings = (businessId: string) =>
  prisma.$queryRaw<{ ref: string; source: string; embedHash: string | null }[]>`
    SELECT ref, source, "embedHash" FROM "SearchOffering" WHERE "businessId" = ${businessId}::uuid
    ORDER BY ref`;

describe("indexing offerings", () => {
  it("indexes every item, list part, tag and kind of a listed business", async () => {
    const refs = (await offerings(ids.celiac!)).map((o) => o.ref);
    expect(refs).toEqual(
      expect.arrayContaining([
        "items.0",
        "items.0.meta.0",
        "items.0.meta.1",
        "tags.0",
        "kind:restaurants",
      ]),
    );
    // A draft is never searchable, inside or out.
    expect(await offerings(f.draft.id)).toEqual([]);
  });
  it("embeds each distinct text once, shared by every card that says it", async () => {
    const [orphans] = await prisma.$queryRaw<{ count: bigint }[]>`
      SELECT count(*) FROM "SearchEmbedding" e
      WHERE NOT EXISTS (SELECT 1 FROM "SearchOffering" o WHERE o."embedHash" = e.hash)`;
    expect(Number(orphans?.count)).toBe(0);
    const spy = vi.spyOn(hash, "embed");
    try {
      await indexer.index("business", [ids.grillHouse!]);
      // Nothing on the card changed: no offering text is embedded again.
      const embedded = spy.mock.calls.flatMap(([texts]) => texts);
      expect(embedded.filter((t) => t.includes("Veal"))).toEqual([]);
    } finally {
      spy.mockRestore();
    }
  });
  it("follows an edit, and drops the offerings of a business that is no longer listed", async () => {
    await prisma.business.update({
      where: { id: ids.station! },
      data: { experience: { items: [{ label: { en: "Fuel" } }, { label: { en: "Tyre air" } }] } },
    });
    await indexer.index("business", [ids.station!]);
    expect((await offerings(ids.station!)).map((o) => o.ref)).toEqual(
      expect.arrayContaining(["items.1"]),
    );
    const [air] = await prisma.$queryRaw<{ text: string }[]>`
      SELECT text FROM "SearchOffering" WHERE "businessId" = ${ids.station!}::uuid AND ref = 'items.1'`;
    expect(air?.text).toContain("tyre air");
    await prisma.business.update({ where: { id: ids.station! }, data: { status: "suspended" } });
    await indexer.index("business", [ids.station!]);
    expect(await offerings(ids.station!)).toEqual([]);
    // Back as it was, for the tests below.
    await prisma.business.update({
      where: { id: ids.station! },
      data: {
        status: "published",
        experience: {
          items: [{ label: { en: "Fuel" } }, { label: { he: "שטיפת רכב", en: "Car wash" } }],
        },
      },
    });
    await indexer.index("business", [ids.station!]);
  });
});

describe("retrieval by offerings", () => {
  const deep = async (items: string[], f2: Partial<RetrievalFilters> = {}) =>
    repo.retrieve({ ...NONE, ...f2, items });

  it("finds a business by a thing on its card, whatever its kind, and says what matched", async () => {
    const rows = await deep(["car wash"], { kindIds: [kinds.carWash!], placePath: SAKHNIN });
    const station = rows.find((r) => r.row.slug === "north-fuel");
    expect(station).toBeDefined();
    expect(station!.kind).toBe(0); // a soft lift only: its kind is stations
    expect(station!.matched).toMatchObject({ source: "item", label: { en: "Car wash" } });
  });
  it("keeps a list part's heading as its context", async () => {
    const [row] = await deep(["shawarma"], { dietary: ["gluten_free"] });
    expect(row?.row.slug).toBe("celiac-corner");
    expect(row?.matched).toMatchObject({
      label: { en: "shawarma" },
      context: { en: "Sandwiches" },
    });
  });
  it("never lets a strict diet through a business without it", async () => {
    const rows = await deep(["shawarma"], { dietary: ["gluten_free"] });
    expect(rows.map((r) => r.row.slug)).toEqual(["celiac-corner"]);
    const all = await deep(["shawarma"]);
    expect(all.map((r) => r.row.slug)).toEqual(
      expect.arrayContaining(["grill-house", "celiac-corner"]),
    );
  });
  it("still finds a business by its name", async () => {
    const rows = await deep(["grill house"]);
    expect(rows[0]?.row.slug).toBe("grill-house");
  });
});

describe("smart search never ends at nothing", () => {
  function service(intent: IntentDto) {
    const embeddings: EmbeddingProvider = { name: "hash", embed: (t, p) => hash.embed(t, p) };
    return new SmartSearchService(
      {
        resolve: async (q: string): Promise<Resolved> => ({
          intent,
          lane: "smart",
          blocked: false,
          instant: await instant.match(q),
        }),
      } as unknown as IntentService,
      instant,
      repo,
      new TaxonomyRepository(prisma),
      new BusinessesRepository(prisma),
      new SearchLogRepository(prisma),
      embeddings,
      () => new Date("2026-10-12T09:00:00Z"),
    );
  }

  it("answers with the asked thing where it was asked, with its match", async () => {
    const res = await service({
      ...EMPTY_INTENT,
      kinds: ["car-wash"],
      place: "sakhnin",
      items: ["car wash"],
    }).search({ q: "car wash in sakhnin", locale: "en" });
    expect(res.fallback).toBeNull();
    const station = res.items.find((b) => b.slug === "north-fuel");
    expect(station?.matched).toEqual({ label: { he: "שטיפת רכב", en: "Car wash" } });
  });
  it("widens to the nearest match beyond the place, with its distance", async () => {
    const res = await service({
      ...EMPTY_INTENT,
      kinds: ["grill"],
      place: "sakhnin",
      dietary: ["gluten_free"],
      items: ["shawarma"],
    }).search({ q: "gluten free shawarma in sakhnin", locale: "en" });
    expect(res.fallback).toBe("wider");
    expect(res.items.map((b) => b.slug)).toEqual(["celiac-corner"]);
    expect(res.items[0]!.distanceKm).toBeGreaterThan(5);
    expect(res.intent.mustHave).toEqual(["gluten_free"]);
  });
  it("offers related businesses that meet every must when the thing is nowhere", async () => {
    const res = await service({
      ...EMPTY_INTENT,
      kinds: ["restaurants"],
      place: "sakhnin",
      dietary: ["gluten_free"],
      items: ["sushi"],
    }).search({ q: "gluten free sushi in sakhnin", locale: "en" });
    expect(res.fallback).toBe("related");
    expect(res.items.map((b) => b.slug)).toEqual(["celiac-corner"]);
    expect(res.items[0]!.matched).toBeUndefined();
  });
  it("looks inside every card when a kind alone has nothing (no items asked)", async () => {
    const res = await service({ ...EMPTY_INTENT, kinds: ["car-wash"], place: "sakhnin" }).search({
      q: "car wash sakhnin",
      locale: "en",
    });
    expect(res.items.map((b) => b.slug)).toContain("north-fuel");
    expect(res.fallback).toBeNull();
  });
  it("lifts a wish instead of filtering by it", async () => {
    const res = await service({
      ...EMPTY_INTENT,
      place: "sakhnin",
      openNow: true,
      niceToHave: ["openNow"],
      items: ["shawarma"],
    }).search({ q: "shawarma in sakhnin, ideally open now", locale: "en" });
    expect(res.intent).toMatchObject({ mustHave: [], niceToHave: ["openNow"] });
    expect(res.items.map((b) => b.slug)).toContain("grill-house");
  });
});
