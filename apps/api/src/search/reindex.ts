import "dotenv/config";
import { embeddingProviderFor } from "../ai/embeddings.js";
import { loadConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { SearchIndexer } from "./indexer.service.js";

/** Rebuilds every search document (after changing the embedding model or the document builders). */
const config = loadConfig(process.env);
const prisma = new PrismaService(config);
const started = Date.now();
const counts = await new SearchIndexer(prisma, embeddingProviderFor(config.search)).indexAll();
await prisma.$disconnect();
console.log(
  `Reindexed ${JSON.stringify(counts)} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
);
