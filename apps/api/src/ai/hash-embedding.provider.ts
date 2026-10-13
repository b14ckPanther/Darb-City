import { normalize, tokenize } from "@darb/search-text";
import { EMBEDDING_DIMENSIONS, type EmbeddingProvider, type EmbedPurpose } from "./embeddings.js";

/** FNV-1a, 32 bit. */
function fnv(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 0x01000193) >>> 0;
  return h;
}

/**
 * Offline embeddings for CI and for development without a key: words and character trigrams
 * hashed into 512 signed buckets, then scaled to unit length.
 */
export class HashEmbeddingProvider implements EmbeddingProvider {
  readonly name = "hash";

  /** Purpose and signal do not change a hash; they are accepted to match the interface. */
  async embed(
    texts: string[],
    _purpose?: EmbedPurpose,
    _signal?: AbortSignal,
  ): Promise<number[][]> {
    return texts.map((text) => {
      const v = new Array<number>(EMBEDDING_DIMENSIONS).fill(0);
      for (const word of tokenize(normalize(text))) {
        const grams = [
          word,
          ...Array.from({ length: Math.max(0, word.length - 2) }, (_, i) => word.slice(i, i + 3)),
        ];
        for (const g of grams) {
          const h = fnv(g);
          v[h % EMBEDDING_DIMENSIONS]! += h & 0x80000000 ? -1 : 1;
        }
      }
      const norm = Math.hypot(...v);
      return norm === 0 ? v : v.map((x) => x / norm);
    });
  }
}
