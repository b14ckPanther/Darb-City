import "dotenv/config";
import { readFileSync, writeFileSync } from "node:fs";
import Anthropic from "@anthropic-ai/sdk";
import { AnthropicIntentProvider } from "../src/ai/anthropic-intent.provider.js";
import type { RecordedCase } from "../src/ai/recorded-intent.provider.js";
import { loadConfig } from "../src/config.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { intentCandidates } from "../src/search/filters.js";
import { InstantService } from "../src/search/instant.service.js";

/**
 * Decision 4: replays every case against the real model and rewrites `recorded`. Needs
 * ANTHROPIC_API_KEY and a seeded database. Never run in CI. Review the diff before committing.
 */
const FILE = "test/search-quality/cases.json";
const config = loadConfig(process.env);
if (!config.search.anthropicApiKey) throw new Error("search:record needs ANTHROPIC_API_KEY");
const prisma = new PrismaService(config);
const instant = new InstantService(prisma);
const kinds = [...(await instant.world()).kinds.keys()].sort();
const provider = new AnthropicIntentProvider(
  new Anthropic({ apiKey: config.search.anthropicApiKey, maxRetries: 2, timeout: 20_000 }),
  config.search.intentModel,
  kinds,
);
const cases = JSON.parse(readFileSync(FILE, "utf8")) as RecordedCase[];
let changed = 0;
for (const c of cases) {
  if (c.expect.blocked) continue;
  const lane1 = await instant.match(c.query);
  const answer = await provider.extract(
    { query: c.query, locale: c.locale, candidates: intentCandidates(lane1, c.locale) },
    AbortSignal.timeout(20_000),
  );
  if (!answer) {
    console.warn(`no answer: ${c.locale} "${c.query}"`);
    continue;
  }
  if (JSON.stringify(answer) !== JSON.stringify(c.recorded)) changed++;
  c.recorded = answer;
  c.source = config.search.intentModel;
}
writeFileSync(FILE, `[\n${cases.map((c) => `  ${JSON.stringify(c)}`).join(",\n")}\n]\n`);
await prisma.$disconnect();
console.log(
  `Recorded ${cases.length} cases with ${config.search.intentModel}; ${changed} differ from before.`,
);
