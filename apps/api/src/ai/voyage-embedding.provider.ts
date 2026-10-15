import { EMBEDDING_DIMENSIONS, type EmbeddingProvider, type EmbedPurpose } from "./embeddings.js";

const URL_EMBEDDINGS = "https://api.voyageai.com/v1/embeddings";
/** A bulk reindex has no caller deadline; this keeps a hung request from stalling it. */
const TIMEOUT_MS = 10_000;

const RETRIES = 4;
const retryable = (status: number) => status === 429 || status >= 500;

/** Voyage AI over plain fetch: no SDK to pin, and tests fake fetch and sleep. */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    readonly name: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: (ms: number, signal?: AbortSignal) => Promise<void> = (ms, signal) =>
      new Promise((resolve, reject) => {
        if (signal?.aborted) return reject(signal.reason);
        const timer = setTimeout(resolve, ms);
        signal?.addEventListener("abort", () => (clearTimeout(timer), reject(signal.reason)), {
          once: true,
        });
      }),
  ) {}

  async embed(texts: string[], purpose: EmbedPurpose, signal?: AbortSignal): Promise<number[][]> {
    if (texts.length === 0) return [];
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(URL_EMBEDDINGS, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          input: texts,
          model: this.name,
          input_type: purpose,
          output_dimension: EMBEDDING_DIMENSIONS,
        }),
        signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), ...(signal ? [signal] : [])]),
      });
      // A query has an 800 ms deadline: it fails fast and search ranks without the vector.
      if (!res.ok && retryable(res.status) && purpose === "document" && attempt < RETRIES) {
        const after = Number(res.headers.get("retry-after"));
        // Unread bodies hold the connection open until garbage collection.
        await res.body?.cancel();
        await this.sleep(after > 0 ? Math.min(after * 1000, 60_000) : 1000 * 2 ** attempt, signal);
        continue;
      }
      if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status}`);
      const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
      const out = [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      if (out.length !== texts.length || out.some((v) => v.length !== EMBEDDING_DIMENSIONS))
        throw new Error(
          `Voyage returned the wrong count or dimensions (want ${EMBEDDING_DIMENSIONS})`,
        );
      return out;
    }
  }
}
