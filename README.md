# Darb-City

Every business, in every city, town and village, one search away.
Web (Next.js), API (NestJS + Prisma + PostgreSQL), mobile (Expo, later).

Design: `docs/superpowers/specs/2026-10-12-darb-city-v1-design.md`

## Run

Requires Node ≥ 22.12, pnpm 11 and Docker Desktop.

    pnpm install
    cp apps/api/.env.example apps/api/.env
    cp apps/web/.env.example apps/web/.env.local
    pnpm dev          # Postgres + Redis, migrations, seed, API on :4000, web on http://localhost:3000

    pnpm --filter @darb/api db:seed   # re-run the idempotent seed loader (~17s for the full dataset)

    pnpm test         # needs `pnpm infra:up`
    pnpm --filter @darb/web e2e   # Playwright; needs the seeded database
    # e2e starts its own servers on :3100, :3101 and :4100 (recorded intents, offline embeddings),
    # never the dev servers; override with WEB_URL, API_URL and WEB_API_DOWN_URL
    pnpm typecheck && pnpm lint && pnpm format:check

## Search

- Lane 1 (instant): `packages/search-text` normalizes Hebrew, Arabic, Latin and Arabizi and matches
  a static index of places and kinds in the browser (`apps/web/public/search-index/instant.<hash>.json`,
  built from `@darb/seed` by `next.config.ts`). Business names come from `GET /search/suggest`.
- Lane 2 (smart): `POST /search` asks Claude Haiku (`INTENT_MODEL`, default `claude-haiku-5-5`) for
  an intent through a strict tool, with a 1.5 s budget, a 7-day Redis cache and 30 searches per
  minute per IP. Blocked kinds never reach the model. Chip edits use `POST /search/results`, which
  never calls the model.
- Embeddings: Voyage (`VOYAGE_API_KEY`, `EMBEDDING_MODEL`, default `voyage-4-lite`, 512 dimensions).
  Without a key, an offline hash embedding is used (CI and local development).
- `pnpm --filter @darb/api search:reindex` rebuilds every search document;
  `pnpm --filter @darb/api search:quality` runs the quality set (89 queries in he, ar and en,
  plus 6 blocked ones) against the seeded database; `pnpm --filter @darb/api search:record`
  re-records the model's answers (needs a key; review the diff).
- The search log is anonymous (no IP, user or coordinates). `GET /search/report` (header
  `x-darb-report-key`) feeds Plan 4's Missing kinds and places screen.

When lane 1 alone fully explains a query (a known kind and place), the model is skipped. When the
model is slow, down or refuses, the page shows the same results lane 1 would, with no error copy.

### Search keys (`apps/api/.env`, unless noted)

| Key                  | What it does                                                                                                                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `INTENT_PROVIDER`    | `anthropic`, `recorded` (replays `test/search-quality/cases.json`; tests and CI) or `off` (lane 1 only). Default: `anthropic` with `ANTHROPIC_API_KEY`, else `off`. |
| `EMBEDDING_PROVIDER` | `voyage` or `hash` (offline, no network). Default: `voyage` with `VOYAGE_API_KEY`, else `hash`.                                                                     |
| `ANTHROPIC_API_KEY`  | Claude key for lane 2. Never committed, never set in CI.                                                                                                            |
| `VOYAGE_API_KEY`     | Voyage key for embeddings. Never committed, never set in CI.                                                                                                        |
| `SEARCH_PROXY_KEY`   | Shared with `apps/web/.env.local`: the web server forwards the visitor's IP with it. **Required in production** (see below).                                        |
| `SEARCH_REPORT_KEY`  | Unlocks `GET /search/report`; unset, the route answers 404.                                                                                                         |
| `TRUST_PROXY`        | Number of reverse proxies in front of the API (Railway: 1; default 0).                                                                                              |

To record intents, set `ANTHROPIC_API_KEY`, seed the database, run
`pnpm --filter @darb/api search:record`, then review the diff of `cases.json` and run
`search:quality` before committing. A case the model could not answer is marked `FAILED` and
the quality set refuses it.

Cost: intent uses Claude Haiku 5.5 ($0.10 / $0.50 per million input / output tokens, cache reads
about $0.01), roughly **$0.06–0.16 per 1,000 smart searches**. Searches lane 1 explains, cached
intents, blocked searches and chip edits cost nothing.

### Visitor IP and the proxy key

The web server calls the API's search routes for the visitor and forwards the visitor's IP in a
header that the API trusts only with the shared `SEARCH_PROXY_KEY` (set the same value in
`apps/api/.env` and `apps/web/.env.local`). The API rate-limits searches by that IP and keeps only
a salted hash for 60 seconds. `dev-proxy-key` is for development only: the API refuses to start in
production with it, so production must set one long random key on both sides.

The web server takes the visitor's IP from `x-vercel-forwarded-for` on Vercel, which Vercel sets
itself. Elsewhere it reads the first `X-Forwarded-For` hop, then `X-Real-IP`, so a self-hosted web
server must sit behind a reverse proxy that **overwrites** (never appends to) `X-Forwarded-For`
and `X-Real-IP`. Without one, a visitor could send any IP and dodge the rate limit.

## Map

The Zoomable City draws MapLibre GL over a Protomaps PMTiles extract of Israel, then a 2.5D plaza
inside each place. Both load after the list is interactive. Without WebGL2, or without tiles, the
list is the whole city.

    pnpm --filter @darb/web tiles:israel   # ~90 MB into apps/web/.tiles (git-ignored); needs network
    pnpm --filter @darb/web tiles:test     # regenerate the 1 KB e2e fixture in apps/web/e2e/tiles

`/api/tiles/[name]` serves `MAP_TILES_DIR` (default `apps/web/.tiles`) with HTTP Range for
development and self-hosting. In production `NEXT_PUBLIC_MAP_TILES_URL` points at the archive on R2.
`node apps/web/scripts/map/fetch-glyphs.mjs` re-downloads the committed glyphs.

Licences and attribution: map data © OpenStreetMap contributors (ODbL), tiles and basemap style by
Protomaps (BSD-3-Clause), MapLibre GL JS, pmtiles and go-pmtiles (BSD-3-Clause), and Noto Sans
glyphs (SIL OFL 1.1, `apps/web/map-assets/glyphs/OFL.txt`). The map always shows
"Map data: © OpenStreetMap · Protomaps".
