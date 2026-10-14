import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicIntentProvider } from "../src/ai/anthropic-intent.provider.js";
import { recordCases } from "../src/ai/record-cases.js";
import type { RecordedCase } from "../src/ai/recorded-intent.provider.js";
import { loadConfig } from "../src/config.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { InstantService } from "../src/search/instant.service.js";

/**
 * Decision 4: replays every case against the real model and rewrites `recorded`. Needs
 * ANTHROPIC_API_KEY and a seeded database. Never run in CI. Review the diff before committing.
 * A case the model fails is marked FAILED in `source` and the script exits 1.
 */
const FILE = "test/search-quality/cases.json";
const config = loadConfig(process.env);
if (!config.search.anthropicApiKey) throw new Error("search:record needs ANTHROPIC_API_KEY");
const prisma = new PrismaService(config);
try {
  const instant = new InstantService(prisma);
  const provider = new AnthropicIntentProvider(
    new Anthropic({ apiKey: config.search.anthropicApiKey, maxRetries: 2, timeout: 20_000 }),
    config.search.intentModel,
  );
  const activeKinds = [...(await instant.world()).kinds.keys()].sort();
  const cases = JSON.parse(readFileSync(FILE, "utf8")) as RecordedCase[];
  const { changed, failed } = await recordCases(
    cases,
    provider,
    (q) => instant.match(q),
    config.search.intentModel,
    activeKinds,
  );
  writeFileSync(FILE, `[\n${cases.map((c) => `  ${JSON.stringify(c)}`).join(",\n")}\n]\n`);
  console.log(
    `Recorded ${cases.length} cases with ${config.search.intentModel}; ${changed} differ from before.`,
  );
  if (failed.length) {
    console.error(`No answer for ${failed.length} case(s), marked FAILED:\n${failed.join("\n")}`);
    process.exitCode = 1;
  }
} finally {
  await prisma.$disconnect();
}
