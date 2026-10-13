import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import Anthropic from "@anthropic-ai/sdk";
import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AnthropicIntentProvider } from "./anthropic-intent.provider.js";
import { EMBEDDING_PROVIDER, embeddingProviderFor } from "./embeddings.js";
import { INTENT_PROVIDER, type IntentProvider } from "./intent.js";
import {
  OffIntentProvider,
  RecordedIntentProvider,
  type RecordedCase,
} from "./recorded-intent.provider.js";

/** Relative to the API package (pnpm --filter runs there). */
export const RECORDINGS = process.env["SEARCH_RECORDINGS"] ?? "test/search-quality/cases.json";

export async function intentProviderFor(
  config: AppConfig,
  prisma: PrismaService,
): Promise<IntentProvider> {
  const { search } = config;
  if (search.intentProvider === "recorded") {
    const cases = JSON.parse(readFileSync(resolve(RECORDINGS), "utf8")) as RecordedCase[];
    return new RecordedIntentProvider(cases);
  }
  if (search.intentProvider === "anthropic" && search.anthropicApiKey) {
    const kinds = await prisma.kind.findMany({
      where: { status: "active" },
      orderBy: { slug: "asc" },
      select: { slug: true },
    });
    const client = new Anthropic({
      apiKey: search.anthropicApiKey,
      maxRetries: 0,
      timeout: search.intentTimeoutMs,
    });
    return new AnthropicIntentProvider(
      client,
      search.intentModel,
      kinds.map((k) => k.slug),
    );
  }
  return new OffIntentProvider();
}

/** Spec §6.2: the intent and embeddings clients, behind interfaces. */
@Global()
@Module({
  providers: [
    {
      provide: INTENT_PROVIDER,
      inject: [APP_CONFIG, PrismaService],
      useFactory: intentProviderFor,
    },
    {
      provide: EMBEDDING_PROVIDER,
      inject: [APP_CONFIG],
      useFactory: (config: AppConfig) => embeddingProviderFor(config.search),
    },
  ],
  exports: [INTENT_PROVIDER, EMBEDDING_PROVIDER],
})
export class AiModule {}
