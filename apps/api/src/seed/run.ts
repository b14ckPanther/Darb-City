import "dotenv/config";
import { loadBrands, loadBusinesses, loadKinds, loadPlaces, loadSectors } from "@darb/seed";
import { embeddingProviderFor } from "../ai/embeddings.js";
import { loadConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SearchIndexer } from "../search/indexer.service.js";
import { loadSeed } from "./load.js";

const config = loadConfig(process.env);
const prisma = new PrismaService(config);
const started = Date.now();
const counts = await loadSeed(prisma, {
  places: loadPlaces(),
  sectors: loadSectors(),
  kinds: loadKinds(),
  brands: loadBrands(),
  businesses: loadBusinesses(),
});
console.log(`Seeded ${JSON.stringify(counts)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
// Decision 8: the seed indexes directly (not through the queue), in batches of 128 embeddings.
const embeddings = embeddingProviderFor(config.search);
const indexed = await new SearchIndexer(prisma, embeddings).indexAll();
await prisma.$disconnect();
console.log(
  `Indexed ${JSON.stringify(indexed)} with ${embeddings.name} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
