import type { SearchConfig } from "../config.js";
import { HashEmbeddingProvider } from "./hash-embedding.provider.js";
import { VoyageEmbeddingProvider } from "./voyage-embedding.provider.js";

/** The SearchDocument.embedding column is vector(512). Changing it needs a migration and a reindex. */
export const EMBEDDING_DIMENSIONS = 512;
export type EmbedPurpose = "document" | "query";

export interface EmbeddingProvider {
  readonly name: string;
  embed(texts: string[], purpose: EmbedPurpose, signal?: AbortSignal): Promise<number[][]>;
}

export const EMBEDDING_PROVIDER = Symbol("EMBEDDING_PROVIDER");

export const vectorLiteral = (vector: readonly number[]): string => `[${vector.join(",")}]`;

export function embeddingProviderFor(
  config: SearchConfig,
  fetchImpl: typeof fetch = fetch,
): EmbeddingProvider {
  return config.embeddingProvider === "voyage" && config.voyageApiKey
    ? new VoyageEmbeddingProvider(config.voyageApiKey, config.embeddingModel, fetchImpl)
    : new HashEmbeddingProvider();
}
