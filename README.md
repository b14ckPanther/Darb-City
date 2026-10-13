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
    pnpm --filter @darb/web e2e   # Playwright; needs the seeded API
    # beside running dev servers: WEB_URL=http://localhost:3100 API_URL=http://localhost:4100 WEB_API_DOWN_URL=http://localhost:3101
    pnpm typecheck && pnpm lint && pnpm format:check

## Search

The web server calls the API's search routes for the visitor and forwards the visitor's IP in a
header that the API trusts only with the shared `SEARCH_PROXY_KEY` (set the same value in
`apps/api/.env` and `apps/web/.env.local`). The API rate-limits searches by that IP and keeps only
a salted hash for 60 seconds. `dev-proxy-key` is for development only: the API refuses to start in
production with it, so production must set one long random key on both sides.

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
