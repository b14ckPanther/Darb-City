# Environment variables

Values never live in the repo. "secret" means a random value of at least 32 characters, made with `openssl rand -base64 48`. What already exists in each provider (Neon project, R2 bucket, Clerk app, model keys) is in `accounts.md`.

## API (Railway service `api`)

| Variable | Production | Staging | Notes |
|---|---|---|---|
| `NODE_ENV` | production | production | |
| `DATABASE_URL` | Neon `main` pooled URL | Neon `staging` pooled URL | Neon project `Darb`, database `neondb`, role `neondb_owner` |
| `MIGRATE_DATABASE_URL` | Neon `main` direct URL | Neon `staging` direct URL | pre-deploy migrations |
| `REDIS_URL` | `${{Redis.REDIS_URL}}` (Railway reference) | same, staging Redis | |
| `PORT` | set by Railway | set by Railway | |
| `TRUST_PROXY` | 1 | 1 | Railway edge |
| `WEB_ORIGIN` | https://darb.co.il | the staging web origin | CORS |
| `SEARCH_PROXY_KEY` | secret (also on web) | another secret | ≥ 32 |
| `IP_HASH_SALT` | secret | secret | ≥ 32 |
| `INTENT_PROVIDER` | anthropic | anthropic or off | |
| `ANTHROPIC_API_KEY` | key | key or unset | |
| `INTENT_MODEL` | claude-haiku-5-5 | claude-haiku-5-5 | |
| `EMBEDDING_PROVIDER` | voyage | voyage or hash | |
| `VOYAGE_API_KEY` | key | key or unset | |
| `EMBEDDING_MODEL` | voyage-4-lite | voyage-4-lite | 512 dims (checked in Task 30) |
| `MODEL_CALLS_PER_MINUTE` / `MODEL_CALLS_PER_DAY` | 60 / 5000 | 10 / 500 | cost ceiling |
| `AUTH_VERIFIER` | clerk | clerk | never `fake` |
| `CLERK_SECRET_KEY` | Clerk production `sk_live_…` | Clerk development `sk_test_…` | app "Darb admin", Invite-only |
| `CLERK_JWT_KEY` | Clerk production PEM | Clerk development PEM | networkless verification |
| `CLERK_AUTHORIZED_PARTIES` | https://darb.co.il,https://www.darb.co.il | the staging web origin(s), e.g. `https://darb-city-git-staging-<team>.vercel.app` | required: staging runs `NODE_ENV=production` with Clerk, and the API refuses to start with this empty. See the note below. |
| `ADMIN_EMAILS` | founder@darb.co.il,nmcryptoinvest@gmail.com | founder@darb.co.il,nmcryptoinvest@gmail.com | first sign-in only; both are also granted with `admin:grant` (`accounts.md`) |
| `REVALIDATE_URL` | https://darb.co.il/api/revalidate | the staging web origin + /api/revalidate | |
| `REVALIDATE_SECRET` | secret (also on web) | secret | |
| `SEARCH_INDEX_WORKER` | true | true | |

**The staging web origin** is one stable URL: the Vercel branch URL of the `staging` branch (`https://darb-city-git-staging-<team>.vercel.app`), or a custom domain such as `https://staging.darb.co.il` if one is assigned. Use it for `WEB_ORIGIN` and `REVALIDATE_URL`, and list it in `CLERK_AUTHORIZED_PARTIES` (comma-separated, if staging admin is reached on more than one origin).

**Admin sign-in works only on the staging and production origins.** Per-PR Vercel preview URLs change with every deployment, so their Clerk session tokens carry an `azp` that is not in `CLERK_AUTHORIZED_PARTIES` and the API answers 401. Previews are for the public pages; test the admin on staging (or locally with `ADMIN_FAKE_AUTH`).

## Web (Vercel project `darb-city`, root `apps/web`)

| Variable | Production | Preview | Notes |
|---|---|---|---|
| `API_URL` | https://api.darb.co.il | the staging API URL | server only |
| `SITE_URL` | https://darb.co.il | unset (VERCEL_URL is used) | |
| `SEARCH_PROXY_KEY` | same as API production | same as API staging | |
| `REVALIDATE_SECRET` | same as API production | same as API staging | |
| `NEXT_PUBLIC_MAP_TILES_URL` | https://tiles.darb.co.il/israel-<build>.pmtiles | same file | build time |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_live_…` | `pk_test_…` | |
| `CLERK_SECRET_KEY` | `sk_live_…` | `sk_test_…` | |

Never set `ADMIN_FAKE_AUTH` or `NEXT_PUBLIC_LOCAL_TILES` on Vercel.

## Complete reference: every variable the code reads

The tables above show what to set per environment. This list is every variable read by `apps/api/src/config.ts` and `apps/web/src`, so nothing is missed. No values appear here.

### API (`apps/api/src/config.ts`)

Required in production (startup fails without them): `DATABASE_URL`; `SEARCH_PROXY_KEY` (secret, at least 32 characters, never the `.env.example` value); `IP_HASH_SALT` (secret, at least 32 characters); `CLERK_AUTHORIZED_PARTIES` (when `AUTH_VERIFIER` is `clerk`); `CLERK_SECRET_KEY` or `CLERK_JWT_KEY` (when `AUTH_VERIFIER` is `clerk`); `REVALIDATE_SECRET` (at least 32 characters, whenever `REVALIDATE_URL` is set, which must be `https`); `ANTHROPIC_API_KEY` when `INTENT_PROVIDER=anthropic`; `VOYAGE_API_KEY` when `EMBEDDING_PROVIDER=voyage`. `AUTH_VERIFIER=fake` is refused in production.

| Variable | Default | Notes |
|---|---|---|
| `PORT` | 4000 | Railway sets it. |
| `WEB_ORIGIN` | `http://localhost:3000` | Set to the web origin (CORS). |
| `REDIS_URL` | `redis://localhost:6380` | Set in production. |
| `TRUST_PROXY` | 0 | Number of proxy hops, 0 to 5. Set 1 on Railway. |
| `SEARCH_RATE_LIMIT` | 30 | Search requests per minute per visitor. |
| `SEARCH_RESULTS_RATE_LIMIT` | 120 | Results requests per minute per visitor. |
| `SEARCH_CLICK_RATE_LIMIT` | 120 | Click events per minute per visitor. |
| `SUGGEST_RATE_LIMIT` | 240 | Suggest requests per minute per visitor. |
| `INTENT_PROVIDER` | unset, derived | `anthropic`, `recorded` or `off`. Anthropic when a key is set. |
| `INTENT_MODEL` | `claude-haiku-5-5` | |
| `INTENT_TIMEOUT_MS` | 1500 | 100 to 10000. Model call timeout before falling back. |
| `INTENT_NEGATIVE_CACHE_SECONDS` | 3600 | How long a failed intent is remembered. |
| `EMBEDDING_PROVIDER` | unset, derived | `voyage` or `hash`. |
| `EMBEDDING_MODEL` | `voyage-4-lite` | 512 dimensions. |
| `MODEL_CALLS_PER_MINUTE` | 60 | Cost ceiling. 0 stops model calls. |
| `MODEL_CALLS_PER_DAY` | 5000 | Cost ceiling. |
| `SEARCH_INDEX_WORKER` | on | `true`, `1` or `0`. Run the index worker in this process. |
| `SEARCH_LOG_RETENTION_DAYS` | 90 | 7 to 365. |
| `SEARCH_REPORT_KEY` | unset | Optional secret. Unlocks `GET /search/report` for the admin; unset, the route answers 404. Set it in production to use the search report. |
| `AUTH_VERIFIER` | `clerk` when a Clerk key is set | `clerk`, `fake` (tests only) or `off`. |
| `ADMIN_EMAILS` | unset | Comma-separated, lower-cased. |
| `REVALIDATE_URL` | unset | Unset turns web revalidation off. |
| `NODE_ENV` | unset | `production` switches on the checks above. |
| `MIGRATE_DATABASE_URL` | unset | Direct Neon URL, read by the pre-deploy migration and the `Seed and reindex` workflow, not by the app. |
| `SEARCH_RECORDINGS` | `test/search-quality/cases.json` | Tests and CI only (recorded intent). Never set in production. |

### Web (`apps/web/src`, `next.config.ts`)

Required in production (the web server refuses to start without them; `assertServerEnv` runs from `instrumentation.ts` at server start, not at build time, so a deployment missing one still builds and then answers 500; open the deployment before promoting it, and roll back if it fails): `API_URL`; `SEARCH_PROXY_KEY` (same value as the API, at least 32 characters); `REVALIDATE_SECRET` (same value as the API, at least 32 characters); `SITE_URL` outside Vercel (on Vercel `VERCEL_URL` is used when unset).

| Variable | Default | Notes |
|---|---|---|
| `NEXT_PUBLIC_MAP_TILES_URL` | unset | Build time. Public PMTiles URL; required for the map in production. |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | unset | Needed with `CLERK_SECRET_KEY` for admin sign-in. |
| `CLERK_SECRET_KEY` | unset | Server only. |
| `SITE_INDEXABLE` | unset | `1` lets a self-hosted production site be indexed. Vercel indexes only `VERCEL_ENV=production`. |
| `MAP_TILES_DIR` | `.tiles` | Self-hosting and e2e only; serves `/api/tiles`. Not needed with R2. |
| `NEXT_PUBLIC_SEARCH_INDEX_URL` | derived by `next.config.ts` | Do not set by hand. |
| `NEXT_PUBLIC_LOCAL_TILES`, `ADMIN_FAKE_AUTH` | unset | Local development only. Never set on Vercel. |
| `VERCEL`, `VERCEL_ENV`, `VERCEL_URL`, `NEXT_RUNTIME`, `NODE_ENV` | | Set by Vercel and Next.js. Do not set. |
| `VERCEL_AUTOMATION_BYPASS_SECRET` | unset | Optional. Vercel's Protection Bypass for Automation secret. Read by `apps/web/playwright.config.ts` only, to run the smoke e2e against a protected preview URL (sent as `x-vercel-protection-bypass`). Keep it in GitHub Environments or the local shell, not in the Vercel project. |
| `WEB_API_DOWN_URL` | `http://localhost:3101` | e2e only. |

## GitHub Environments (`staging`, `production`)

Secrets: `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `VOYAGE_API_KEY`, `REVALIDATE_SECRET`, `SEARCH_PROXY_KEY`, `IP_HASH_SALT`. Variable: `REVALIDATE_URL`. `production` requires the owner as reviewer.

## CI (`.github/workflows/ci.yml`)

No real keys, ever. Intent is replayed (`recorded`), embeddings are offline (`hash`), and admin uses fake auth on localhost.
