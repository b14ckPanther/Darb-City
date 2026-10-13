import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { INestApplication } from "@nestjs/common";
import { config as dotenv } from "dotenv";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { loadConfig } from "../config.js";
import { AnthropicIntentProvider } from "./anthropic-intent.provider.js";
import { EMBEDDING_PROVIDER } from "./embeddings.js";
import { HashEmbeddingProvider } from "./hash-embedding.provider.js";
import { INTENT_PROVIDER } from "./intent.js";
import { RecordedIntentProvider } from "./recorded-intent.provider.js";
import { VoyageEmbeddingProvider } from "./voyage-embedding.provider.js";

/**
 * Tests never call the network, even when a developer's apps/api/.env holds real model keys:
 * vitest.config.ts pins the providers, and dotenv never overrides a variable that is already set.
 */
let app: INestApplication;
beforeAll(async () => {
  app = (await createTestApp()).app;
});
afterAll(() => app.close());

it("pins the test run to the recorded intent and the offline hash embeddings", () => {
  expect(process.env["INTENT_PROVIDER"]).toBe("recorded");
  expect(process.env["EMBEDDING_PROVIDER"]).toBe("hash");
});

it("keeps them even when the environment holds real keys", () => {
  const search = loadConfig({
    ...process.env,
    ANTHROPIC_API_KEY: "sk-ant-real-looking",
    VOYAGE_API_KEY: "pa-real-looking",
  }).search;
  expect(search.intentProvider).toBe("recorded");
  expect(search.embeddingProvider).toBe("hash");
});

it("is not overridden by a .env that selects the network providers", () => {
  const dir = mkdtempSync(join(tmpdir(), "darb-env-"));
  const file = join(dir, ".env");
  writeFileSync(file, "INTENT_PROVIDER=anthropic\nEMBEDDING_PROVIDER=voyage\n");
  dotenv({ path: file, quiet: true });
  expect(process.env["INTENT_PROVIDER"]).toBe("recorded");
  expect(process.env["EMBEDDING_PROVIDER"]).toBe("hash");
});

it("never selects the anthropic or voyage provider in the app under test", () => {
  const intent = app.get(INTENT_PROVIDER);
  const embeddings = app.get(EMBEDDING_PROVIDER);
  expect(intent).not.toBeInstanceOf(AnthropicIntentProvider);
  expect(embeddings).not.toBeInstanceOf(VoyageEmbeddingProvider);
  expect(intent).toBeInstanceOf(RecordedIntentProvider);
  expect(embeddings).toBeInstanceOf(HashEmbeddingProvider);
});
