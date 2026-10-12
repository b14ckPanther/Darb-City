# Darb-City

Every halal business, in every city, town and village, one search away.
Web (Next.js), API (NestJS + Prisma + PostgreSQL), mobile (Expo, later).

Design: `docs/superpowers/specs/2026-10-12-darb-city-v1-design.md`

## Run

Requires Node ≥ 22.12, pnpm 11 and Docker Desktop.

    pnpm install
    cp apps/api/.env.example apps/api/.env
    pnpm dev          # Postgres + Redis, migrations, seed, API on http://localhost:4000

    pnpm test         # needs `pnpm infra:up`
    pnpm typecheck && pnpm lint && pnpm format:check
