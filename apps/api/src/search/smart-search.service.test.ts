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
