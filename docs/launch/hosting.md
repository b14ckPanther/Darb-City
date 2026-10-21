# Hosting

## Hosting decision (spec §6.4, follow-ups 2A and 3)

| Concern | (a) Web on Vercel, API + Redis on Railway | (b) Web self-hosted next to the API on Railway |
|---|---|---|
| Custom ISR cache handler (`apps/web/cache-handler.mjs`) | Not used. Vercel's platform cache replaces it. | Used. It is a private Next internal pinned to 16.3.6 and must be re-verified on every Next upgrade. |
| API down, page already cached | Kept, but only if the render **throws**: Vercel keeps the last good copy when regeneration fails. Task 18 makes `orUnavailable` rethrow on Vercel and raises the time-based revalidate to one day, so regeneration is rare (freshness comes from tag revalidation and client-side open state). | Kept. The handler refuses to store the retry view. |
| API down, page never cached | A 500 from the platform. Mitigated by a warm-up of the home and place pages (levels 0–1) in the sitemap, run by hand (Task 29). | A retry view (200, not cached). |
| Tiles on R2 | Same: browser to R2 directly, with CORS. | Same. |
| Edge cache | Global Vercel CDN, so cached HTML is served from the nearest PoP (Frankfurt or Paris for Israel). | One origin region (Amsterdam), about 70 ms RTT from Israel, with no HTML CDN unless Cloudflare proxying is added (another moving part). |
| Revalidation across instances | Platform-wide `revalidateTag`. | The file-system cache is per replica, so it is correct only with **one** web replica. |
| Cost (one founder, launch traffic) | Vercel Pro $20/mo (Hobby forbids commercial use) plus Railway API and Redis about $5–15. | Railway about $10–25 in total. |
| Simplicity for one founder | Git push gives previews and production. One-click instant rollback. Previews are protected and `noindex` by default. | Dockerfile for web too, preview environments to wire, and a cache handler to maintain. Railway's config-as-code (`railway.json`) is deprecated (read until 2026-12-01), and its replacement IaC (`.railway/railway.ts`) is new. |
| darb.co.il cut-over | The old site is a Vercel project (spec §12), so cut-over moves the domain between two projects in one dashboard. Rollback is moving it back, with no DNS TTL wait. | A DNS change to Railway. Rollback is another DNS change, so it waits on TTL. |
| Preview URLs | Automatic per PR, pointing at the Railway **staging** API. | Railway PR environments, which need extra setup for each service. |

**Recommendation: (a), web on Vercel, with the API and Redis on Railway (EU West) and Neon in the EU.** The deciding reasons are the cut-over and rollback inside one Vercel dashboard (spec §12 asks for a two-week rollback), global edge caching for speed (spec priority 1), and zero web ops for one founder. The one real loss, the never-cached page with the API down, is narrowed by rethrow on Vercel, a one-day time-based revalidate and a warm-up run by hand. Deploy tasks 29–31 follow (a).

**Fallback (b)**, documented in `docs/launch/hosting.md` (Task 29): build `apps/web/Dockerfile.selfhost` the same way as the API image, set `SITE_URL`, run one replica, and keep `cacheHandler` (enabled whenever `VERCEL` is unset). Switch only if Vercel cost or limits become a problem.

**Regions:** Vercel functions `fra1`; Railway `europe-west4` (Amsterdam); Neon `aws-eu-central-1` (Frankfurt); Clerk production instance on `clerk.darb.co.il`; R2 bucket `darb-tiles` with custom domain `tiles.darb.co.il` (needs the darb.co.il zone on Cloudflare; see the owner questions in Task 30).

## Release flow

1. PR: GitHub CI (typecheck, lint, unit, API integration, search quality, budgets, e2e and axe). Vercel builds a protected preview that talks to the **staging** API.
2. Merge to `main`, after CI is green (branch protection):
   - Railway production and staging run `pnpm --filter @darb/api exec prisma migrate deploy` once (pre-deploy), then start the new API. A failed migration keeps the old API running.
   - Vercel builds production. `warm.yml` renders the home and place pages (levels 0–1) when run by hand from the Actions tab; it no longer runs after every deploy, which spent the database's monthly network allowance. It needs the repository variable `WARM_SITE_URL=https://darb.co.il` (Settings → Secrets and variables → Actions → Variables).
3. Data: `Seed and reindex` (Actions → Run workflow) seeds and/or reindexes staging or production. Production needs the owner's approval in the GitHub Environment.
4. Migrations are expand/contract: add columns and endpoints first, deploy, then remove old ones in a later release. A preview web never needs an unreleased API change.

## Fallback (b): web self-hosted on Railway

Use this only if Vercel's cost or limits become a problem.
1. Add a `web` service to the Railway project. Use the same image recipe as `apps/api/Dockerfile`, but build with `pnpm exec turbo run build --filter=@darb/web` and start with `pnpm --filter @darb/web start -- --port $PORT`.
2. Run **one** replica only. `cache-handler.mjs` keeps the ISR cache on that instance's disk, and the handler is a private Next internal pinned to 16.3.6.
3. Set `SITE_INDEXABLE=1`, `SITE_URL=https://darb.co.il`, `API_URL` (Railway private URL), `MAP_TILES_DIR` (not needed with R2), `NEXT_PUBLIC_MAP_TILES_URL`, and every other web variable from `environments.md`.
4. DNS: point darb.co.il at the Railway domain (CNAME). Rollback is the reverse DNS change, and waits on the record's TTL.
5. Visitor IP: Railway's edge sets `X-Real-IP`. Confirm it overwrites `X-Forwarded-For`, or the suggest and search limits can be dodged (README, "Visitor IP and the proxy key").
