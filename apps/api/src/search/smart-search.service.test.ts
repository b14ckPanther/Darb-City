import { EMPTY_INTENT } from "@darb/contracts";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import type { EmbeddingProvider } from "../ai/embeddings.js";
import { HashEmbeddingProvider } from "../ai/hash-embedding.provider.js";
import { BusinessesRepository } from "../businesses/businesses.repository.js";
import { TaxonomyRepository } from "../taxonomy/taxonomy.repository.js";
import { SearchIndexer } from "./indexer.service.js";
import { InstantService } from "./instant.service.js";
import type { IntentService, Resolved } from "./intent.service.js";
import { RetrievalRepository } from "./retrieval.repository.js";
import { SearchLogRepository } from "./search-log.repository.js";
import { SmartSearchService } from "./smart-search.service.js";

const prisma = testPrisma();
const instant = new InstantService(prisma);
const hash = new HashEmbeddingProvider();

function service(resolve: (q: string) => Promise<Resolved>) {
  const embeddings: EmbeddingProvider = {
    name: "spy",
    embed: vi.fn((texts, purpose) => hash.embed(texts, purpose)),
  };
  const svc = new SmartSearchService(
    { resolve } as unknown as IntentService,
    instant,
    new RetrievalRepository(prisma),
    new TaxonomyRepository(prisma),
    new BusinessesRepository(prisma),
    new SearchLogRepository(prisma),
    embeddings,
    () => new Date("2026-10-12T06:30:00Z"),
  );
  return { svc, embeddings };
}

beforeAll(async () => {
  await resetDatabase(prisma);
  await seedFixtures(prisma);
  await new SearchIndexer(prisma, hash).indexAll();
});
afterAll(() => prisma.$disconnect());

describe("SmartSearchService", () => {
  it("never sends a blocked query to the embeddings provider", async () => {
    const { svc, embeddings } = service(async (q) => ({
      intent: EMPTY_INTENT,
      lane: "instant",
      blocked: true,
      instant: await instant.match(q),
    }));
    const res = await svc.search({ q: "bars in sakhnin", locale: "en" });
    expect(res.status).toBe("blocked");
    expect(embeddings.embed).not.toHaveBeenCalled();
  });
  it("drops a kind the world no longer has instead of failing", async () => {
    const { svc } = service(async (q) => ({
      intent: { ...EMPTY_INTENT, kinds: ["gone-since-rebuild", "barbershops"], place: "sakhnin" },
      lane: "smart",
      blocked: false,
      instant: await instant.match(q),
    }));
    const res = await svc.search({ q: "someone for a fade in sakhnin", locale: "en" });
    expect(res.status).toBe("ok");
    expect(res.items.map((b) => b.slug).sort()).toEqual(["abu-salim", "little-cuts"]);
  });
});

describe("SmartSearchService.results (chip edits)", () => {
  const unused = async (): Promise<Resolved> => {
    throw new Error("a chip edit never resolves the intent");
  };

  it("blocks a query Darb does not list and never embeds it", async () => {
    const { svc, embeddings } = service(unused);
    const res = await svc.results({ q: "beer", locale: "en", intent: EMPTY_INTENT });
    expect(res?.status).toBe("blocked");
    expect(res?.items).toEqual([]);
    expect(embeddings.embed).not.toHaveBeenCalled();
  });
  it("blocks blocked free text from the URL (?chips=text&text=beer) and never embeds it", async () => {
    const { svc, embeddings } = service(unused);
    const res = await svc.results({
      q: "beer",
      locale: "en",
      intent: { ...EMPTY_INTENT, kinds: ["barbershops"], freeText: "beer" },
    });
    expect(res?.status).toBe("blocked");
    expect(embeddings.embed).not.toHaveBeenCalled();
    const edited = await svc.results({
      q: "barber",
      locale: "en",
      intent: { ...EMPTY_INTENT, kinds: ["barbershops"], freeText: "beer" },
    });
    expect(edited?.status).toBe("blocked");
    expect(edited?.items).toEqual([]);
    expect(embeddings.embed).not.toHaveBeenCalled();
  });
  it("keeps a look-alike of a blocked word (barber)", async () => {
    const { svc } = service(unused);
    const res = await svc.results({ q: "barber", locale: "en", intent: EMPTY_INTENT });
    expect(res?.status).toBe("ok");
  });
  it("embeds the same text as the search, so removing an unrelated chip keeps the order", async () => {
    const intent = { ...EMPTY_INTENT, kinds: ["barbershops"], nearMe: true, freeText: "kids" };
    const q = "kids haircut barber near me";
    const { svc, embeddings } = service(async (text) => ({
      intent,
      lane: "smart",
      blocked: false,
      instant: await instant.match(text),
    }));
    const searched = await svc.search({ q, locale: "en" });
    const edited = await svc.results({ q, locale: "en", intent: { ...intent, nearMe: false } });
    expect(searched.status).toBe("ok");
    expect(edited?.status).toBe("ok");
    const calls = vi.mocked(embeddings.embed).mock.calls.map((c) => c[0]);
    expect(calls).toHaveLength(2);
    expect(calls[1]).toEqual(calls[0]);
    expect(edited?.items.map((b) => b.slug)).toEqual(searched.items.map((b) => b.slug));
  });
});

describe("the quick answer and the fallbacks without the model", () => {
  it("answers at once without logging when asked not to wait, and says more is coming", async () => {
    const seen: boolean[] = [];
    const { svc } = service(async (q) => ({
      intent: EMPTY_INTENT,
      lane: "instant",
      blocked: false,
      instant: await instant.match(q),
      skipped: true,
    }));
    const intents = (svc as unknown as { intents: { resolve: (...a: unknown[]) => unknown } })
      .intents;
    const resolve = intents.resolve;
    intents.resolve = (...a: unknown[]) => {
      seen.push(a[2] as boolean);
      return resolve(...a);
    };
    const before = await prisma.searchQuery.count();
    const res = await svc.search({ q: "somebody for my hair", locale: "en", instant: true });
    expect(seen).toEqual([false]);
    expect(res).toMatchObject({ refining: true, queryId: null, lane: "instant" });
    expect(await prisma.searchQuery.count()).toBe(before);
  });
  it("offers the closest kinds when nothing answered", async () => {
    const { svc } = service(async (q) => ({
      intent: EMPTY_INTENT,
      lane: "smart",
      blocked: false,
      instant: await instant.match(q),
    }));
    // "barbe" only starts the barbers' name: too weak to search by, close enough to offer.
    const res = await svc.search({ q: "barbe zzqx", locale: "en" });
    expect(res.items).toEqual([]);
    expect(res.suggestions.map((k) => k.slug)).toContain("barbershops");
  });
  it("takes the kind closest in meaning when the model gave nothing", async () => {
    const { svc } = service(async (q) => ({
      intent: { ...EMPTY_INTENT, freeText: "barbershops haircuts" },
      lane: "instant",
      blocked: false,
      instant: { ...(await instant.match(q)), unmatched: ["barbershops", "haircuts"] },
    }));
    const res = await svc.search({ q: "barbershops haircuts", locale: "en" });
    // The hash embeddings share the words with the barbershops kind's own offerings.
    expect(res.intent.kinds.length).toBeGreaterThan(0);
  });
});
