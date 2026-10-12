# Darb-City

Every halal business, in every city, town and village, one search away.
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
    pnpm typecheck && pnpm lint && pnpm format:check
