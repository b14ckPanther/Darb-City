import { z } from "zod";

export interface SearchConfig {
  redisUrl: string;
  trustProxy: number;
  proxyKey: string | null;
  ipSalt: string;
  rateLimit: number;
  resultsRateLimit: number;
  clickRateLimit: number;
  intentProvider: "anthropic" | "recorded" | "off";
  intentModel: string;
  intentTimeoutMs: number;
  anthropicApiKey: string | null;
  embeddingProvider: "voyage" | "hash";
  embeddingModel: string;
  voyageApiKey: string | null;
  indexWorker: boolean;
  /** SEARCH_REPORT_KEY: the shared secret for GET /search/report; unset, the endpoint is a 404. */
  reportKey: string | null;
}

export interface AppConfig {
  databaseUrl: string;
  port: number;
  webOrigin: string;
  search: SearchConfig;
}

export const APP_CONFIG = Symbol("APP_CONFIG");

const optional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() !== "" ? v : null));
const flag = z
  .enum(["true", "false", "1", "0"])
  .optional()
  .transform((v) => v === undefined || v === "true" || v === "1");

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
  REDIS_URL: z.string().url().default("redis://localhost:6380"),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  SEARCH_PROXY_KEY: optional,
  IP_HASH_SALT: optional,
  SEARCH_RATE_LIMIT: z.coerce.number().int().positive().default(30),
  SEARCH_RESULTS_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  SEARCH_CLICK_RATE_LIMIT: z.coerce.number().int().positive().default(120),
  INTENT_PROVIDER: z.enum(["anthropic", "recorded", "off"]).optional(),
  INTENT_MODEL: z.string().min(1).default("claude-haiku-5-5"),
  INTENT_TIMEOUT_MS: z.coerce.number().int().min(100).max(10_000).default(1500),
  ANTHROPIC_API_KEY: optional,
  EMBEDDING_PROVIDER: z.enum(["voyage", "hash"]).optional(),
  EMBEDDING_MODEL: z.string().min(1).default("voyage-4-lite"),
  VOYAGE_API_KEY: optional,
  SEARCH_INDEX_WORKER: flag,
  SEARCH_REPORT_KEY: optional,
  NODE_ENV: z.string().optional(),
});

/** The value apps/api/.env.example ships with; anyone could forward a fake client IP with it. */
export const EXAMPLE_PROXY_KEY = "dev-proxy-key";

/** 16 random bytes as hex, from Web Crypto (Node 22 has it globally). */
const randomSalt = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(
      `Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`,
    );
  }
  const e = parsed.data;
  const intentProvider = e.INTENT_PROVIDER ?? (e.ANTHROPIC_API_KEY ? "anthropic" : "off");
  const embeddingProvider = e.EMBEDDING_PROVIDER ?? (e.VOYAGE_API_KEY ? "voyage" : "hash");
  if (intentProvider === "anthropic" && !e.ANTHROPIC_API_KEY)
    throw new Error("Invalid environment: INTENT_PROVIDER=anthropic needs ANTHROPIC_API_KEY");
  if (embeddingProvider === "voyage" && !e.VOYAGE_API_KEY)
    throw new Error("Invalid environment: EMBEDDING_PROVIDER=voyage needs VOYAGE_API_KEY");
  if (e.NODE_ENV === "production" && e.SEARCH_PROXY_KEY === EXAMPLE_PROXY_KEY)
    throw new Error(
      "Invalid environment: SEARCH_PROXY_KEY is the .env.example value; set a long random secret in production",
    );
  return {
    databaseUrl: e.DATABASE_URL,
    port: e.PORT,
    webOrigin: e.WEB_ORIGIN,
    search: {
      redisUrl: e.REDIS_URL,
      trustProxy: e.TRUST_PROXY,
      proxyKey: e.SEARCH_PROXY_KEY,
      ipSalt: e.IP_HASH_SALT ?? randomSalt(),
      rateLimit: e.SEARCH_RATE_LIMIT,
      resultsRateLimit: e.SEARCH_RESULTS_RATE_LIMIT,
      clickRateLimit: e.SEARCH_CLICK_RATE_LIMIT,
      intentProvider,
      intentModel: e.INTENT_MODEL,
      intentTimeoutMs: e.INTENT_TIMEOUT_MS,
      anthropicApiKey: e.ANTHROPIC_API_KEY,
      embeddingProvider,
      embeddingModel: e.EMBEDDING_MODEL,
      voyageApiKey: e.VOYAGE_API_KEY,
      indexWorker: e.SEARCH_INDEX_WORKER,
      reportKey: e.SEARCH_REPORT_KEY,
    },
  };
}
