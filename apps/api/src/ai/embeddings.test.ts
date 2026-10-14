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
  it("times out on its own after 10 s, and still honours the caller's signal", async () => {
    const seen: (AbortSignal | null | undefined)[] = [];
    const fetchImpl = (async (_url: string, init: RequestInit) => {
      seen.push(init.signal);
      return Response.json({ data: [{ index: 0, embedding: Array(512).fill(0.1) }] });
    }) as unknown as typeof fetch;
    const timeout = vi.spyOn(AbortSignal, "timeout");
    const voyage = new VoyageEmbeddingProvider("k", "m", fetchImpl);
    await voyage.embed(["a"], "query");
    expect(timeout).toHaveBeenCalledWith(10_000);
    expect(seen[0]).toBeInstanceOf(AbortSignal);
    const caller = new AbortController();
    await voyage.embed(["a"], "query", caller.signal);
    caller.abort();
    expect(seen[1]?.aborted).toBe(true);
    timeout.mockRestore();
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

const ok = (n: number) =>
  new Response(
    JSON.stringify({
      data: Array.from({ length: n }, (_, index) => ({ index, embedding: Array(512).fill(0.1) })),
    }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

it("backs off on 429 for documents, honouring Retry-After", async () => {
  const sleeps: number[] = [];
  const responses = [
    new Response("", { status: 429, headers: { "retry-after": "2" } }),
    new Response("", { status: 503 }),
    ok(1),
  ];
  const fetchImpl = (async () => responses.shift()!) as typeof fetch;
  const voyage = new VoyageEmbeddingProvider("k", "voyage-4-lite", fetchImpl, async (ms) => {
    sleeps.push(ms);
  });
  const out = await voyage.embed(["a"], "document");
  expect(out).toHaveLength(1);
  expect(sleeps).toEqual([2000, 2000]);
});

it("never retries a query embedding", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response("", { status: 429 });
  }) as typeof fetch;
  const voyage = new VoyageEmbeddingProvider("k", "m", fetchImpl, async () => undefined);
  await expect(voyage.embed(["a"], "query")).rejects.toThrow(/429/);
  expect(calls).toBe(1);
});

it("gives up after four retries", async () => {
  const fetchImpl = (async () => new Response("", { status: 429 })) as typeof fetch;
  const sleeps: number[] = [];
  const voyage = new VoyageEmbeddingProvider("k", "m", fetchImpl, async (ms) => {
    sleeps.push(ms);
  });
  await expect(voyage.embed(["a"], "document")).rejects.toThrow(/429/);
  expect(sleeps).toEqual([1000, 2000, 4000, 8000]);
});
