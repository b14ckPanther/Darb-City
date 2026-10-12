import { describe, expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import { EMBEDDING_DIMENSIONS, embeddingProviderFor, vectorLiteral } from "./embeddings.js";
import { HashEmbeddingProvider } from "./hash-embedding.provider.js";
import { VoyageEmbeddingProvider } from "./voyage-embedding.provider.js";

const cosine = (a: number[], b: number[]) => a.reduce((s, x, i) => s + x * (b[i] ?? 0), 0);

describe("hash embeddings", () => {
  const hash = new HashEmbeddingProvider();
  it("are unit vectors of the right size, and deterministic", async () => {
    const [a, b] = await hash.embed(["Knafeh in Haifa", "Knafeh in Haifa"], "document");
    expect(a).toHaveLength(EMBEDDING_DIMENSIONS);
    expect(cosine(a!, a!)).toBeCloseTo(1, 6);
    expect(a).toEqual(b);
  });
  it("place similar texts closer than unrelated ones", async () => {
    const [q, near, far] = await hash.embed(
      ["kunafa sweets", "knafeh and arabic sweets", "car garage mechanic"],
      "query",
    );
    expect(cosine(q!, near!)).toBeGreaterThan(cosine(q!, far!));
  });
  it("embed empty text as a zero vector", async () => {
    const [v] = await hash.embed([""], "query");
    expect(v!.every((x) => x === 0)).toBe(true);
  });
});

describe("Voyage", () => {
  it("posts the texts, purpose, model and 512 dimensions, and keeps input order", async () => {
    const fetchImpl = vi.fn(async () =>
      Response.json({
        data: [
          { index: 1, embedding: Array(512).fill(0.2) },
          { index: 0, embedding: Array(512).fill(0.1) },
        ],
        usage: { total_tokens: 7 },
      }),
    );
    const voyage = new VoyageEmbeddingProvider("key", "voyage-4-lite", fetchImpl as typeof fetch);
    const out = await voyage.embed(["a", "b"], "query");
    expect(out.map((v) => v[0])).toEqual([0.1, 0.2]);
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe("https://api.voyageai.com/v1/embeddings");
    expect(init.headers).toMatchObject({ authorization: "Bearer key" });
    expect(JSON.parse(String(init.body))).toEqual({
      input: ["a", "b"],
      model: "voyage-4-lite",
      input_type: "query",
      output_dimension: 512,
    });
  });
  it("throws on an error status or a wrong size, so callers fall back", async () => {
    const bad = new VoyageEmbeddingProvider(
      "k",
      "m",
      (async () => new Response("no", { status: 500 })) as typeof fetch,
    );
    await expect(bad.embed(["a"], "query")).rejects.toThrow(/500/);
    const short = new VoyageEmbeddingProvider("k", "m", (async () =>
      Response.json({ data: [{ index: 0, embedding: [1, 2] }] })) as typeof fetch);
    await expect(short.embed(["a"], "query")).rejects.toThrow(/dimensions/);
  });
});

it("picks the provider from config, and writes pgvector literals", () => {
  expect(embeddingProviderFor(loadConfig({ DATABASE_URL: "x" }).search).name).toBe("hash");
  expect(
    embeddingProviderFor(loadConfig({ DATABASE_URL: "x", VOYAGE_API_KEY: "k" }).search).name,
  ).toBe("voyage-4-lite");
  expect(vectorLiteral([0.5, -1, 0])).toBe("[0.5,-1,0]");
});
