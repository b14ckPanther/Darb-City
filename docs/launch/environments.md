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
| `WEB_ORIGIN` | https://darb.co.il | the staging web URL | CORS |
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
| `CLERK_AUTHORIZED_PARTIES` | https://darb.co.il,https://www.darb.co.il | unset (previews vary) | |
| `ADMIN_EMAILS` | founder@darb.co.il,nmcryptoinvest@gmail.com | founder@darb.co.il,nmcryptoinvest@gmail.com | first sign-in only; both are also granted with `admin:grant` (`accounts.md`) |
| `REVALIDATE_URL` | https://darb.co.il/api/revalidate | the staging web URL + /api/revalidate | |
| `REVALIDATE_SECRET` | secret (also on web) | secret | |
| `SEARCH_INDEX_WORKER` | true | true | |

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

## GitHub Environments (`staging`, `production`)

Secrets: `DATABASE_URL`, `MIGRATE_DATABASE_URL`, `VOYAGE_API_KEY`, `REVALIDATE_SECRET`, `SEARCH_PROXY_KEY`, `IP_HASH_SALT`. Variable: `REVALIDATE_URL`. `production` requires the owner as reviewer.

## CI (`.github/workflows/ci.yml`)

No real keys, ever. Intent is replayed (`recorded`), embeddings are offline (`hash`), and admin uses fake auth on localhost.
