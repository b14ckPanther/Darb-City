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
  modelCallsPerMinute: number;
  modelCallsPerDay: number;
  negativeCacheSeconds: number;
  suggestRateLimit: number;
  logRetentionDays: number;
}

export interface AuthConfig {
  /** "clerk" in production; "fake" only for tests and local e2e (refused when NODE_ENV=production). */
  verifier: "clerk" | "fake" | "off";
  clerkSecretKey: string | null;
  /** PEM public key: verifies without a network call when set. */
  clerkJwtKey: string | null;
  authorizedParties: string[];
  /** Lower-cased; granted admin when their User row is first created and the email is verified. */
  adminEmails: string[];
}
export interface AdminConfig {
  /** Web route the API posts tags to; null turns revalidation off (logged once). */
  revalidateUrl: string | null;
  revalidateSecret: string | null;
}

export interface AppConfig {
  databaseUrl: string;
  port: number;
  webOrigin: string;
  search: SearchConfig;
  auth: AuthConfig;
  admin: AdminConfig;
  production: boolean;
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
  MODEL_CALLS_PER_MINUTE: z.coerce.number().int().min(0).default(60),
  MODEL_CALLS_PER_DAY: z.coerce.number().int().min(0).default(5000),
  INTENT_NEGATIVE_CACHE_SECONDS: z.coerce.number().int().min(0).default(3600),
  SUGGEST_RATE_LIMIT: z.coerce.number().int().positive().default(240),
  SEARCH_LOG_RETENTION_DAYS: z.coerce.number().int().min(7).max(365).default(90),
  AUTH_VERIFIER: z.enum(["clerk", "fake", "off"]).optional(),
  CLERK_SECRET_KEY: optional,
  CLERK_JWT_KEY: optional,
  CLERK_AUTHORIZED_PARTIES: optional,
  ADMIN_EMAILS: optional,
  REVALIDATE_URL: z.string().url().optional(),
  REVALIDATE_SECRET: optional,
  NODE_ENV: z.string().optional(),
});

/** The value apps/api/.env.example ships with; anyone could forward a fake client IP with it. */
export const EXAMPLE_PROXY_KEY = "dev-proxy-key";

/** 16 random bytes as hex, from Web Crypto (Node 22 has it globally). */
const randomSalt = () =>
  Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) =>
    b.toString(16).padStart(2, "0"),
  ).join("");

/** A blank line such as `REVALIDATE_URL=` means unset (defaults apply), never a parse error. */
const withoutBlanks = (env: NodeJS.ProcessEnv): NodeJS.ProcessEnv =>
  Object.fromEntries(Object.entries(env).filter(([, v]) => v === undefined || v.trim() !== ""));

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = schema.safeParse(withoutBlanks(env));
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
  const production = e.NODE_ENV === "production";
  const list = (v: string | null) =>
    (v ?? "")
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s !== "");
  const verifier = e.AUTH_VERIFIER ?? (e.CLERK_SECRET_KEY || e.CLERK_JWT_KEY ? "clerk" : "off");
  const fail = (msg: string) => {
    throw new Error(`Invalid environment: ${msg}`);
  };
  if (production) {
    if ((e.SEARCH_PROXY_KEY ?? "").length < 32)
      fail("SEARCH_PROXY_KEY must be a random secret of at least 32 characters in production");
    if ((e.IP_HASH_SALT ?? "").length < 32)
      fail("IP_HASH_SALT must be a random secret of at least 32 characters in production");
    if (verifier === "fake") fail("AUTH_VERIFIER=fake is for tests only");
    if (e.REVALIDATE_URL && (e.REVALIDATE_SECRET ?? "").length < 32)
      fail("REVALIDATE_SECRET must be at least 32 characters when REVALIDATE_URL is set");
  }
  if (verifier === "clerk" && !e.CLERK_SECRET_KEY && !e.CLERK_JWT_KEY)
    fail("AUTH_VERIFIER=clerk needs CLERK_SECRET_KEY or CLERK_JWT_KEY");
  return {
    databaseUrl: e.DATABASE_URL,
    port: e.PORT,
    webOrigin: e.WEB_ORIGIN,
    production,
    auth: {
      verifier,
      clerkSecretKey: e.CLERK_SECRET_KEY,
      clerkJwtKey: e.CLERK_JWT_KEY,
      authorizedParties: list(e.CLERK_AUTHORIZED_PARTIES),
      adminEmails: list(e.ADMIN_EMAILS).map((m) => m.toLowerCase()),
    },
    admin: { revalidateUrl: e.REVALIDATE_URL ?? null, revalidateSecret: e.REVALIDATE_SECRET },
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
      modelCallsPerMinute: e.MODEL_CALLS_PER_MINUTE,
      modelCallsPerDay: e.MODEL_CALLS_PER_DAY,
      negativeCacheSeconds: e.INTENT_NEGATIVE_CACHE_SECONDS,
      suggestRateLimit: e.SUGGEST_RATE_LIMIT,
      logRetentionDays: e.SEARCH_LOG_RETENTION_DAYS,
    },
  };
}
