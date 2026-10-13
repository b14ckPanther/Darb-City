# Plan 4: Admin and launch, implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to carry out this plan task by task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship Darb-City v1 to darb.co.il. That means Clerk-guarded admin (API and `/admin` UI) with audited writes that respect seed ownership, the three real clients, the Plan 3 search blockers closed, production hardening, a reproducible deploy, and a cut-over with a rollback.

**Architecture:** The API gains an `auth` module (Clerk JWT verified with `@clerk/backend`, with the `User.isAdmin` flag as the authority) and an `admin` module. Every write goes through one `AdminWriter`: a transaction plus an `AuditLog` row, then non-blocking `SearchEvents.notify` and web revalidation by tag (immediate for takedowns). The seed loader skips rows that admins have touched (`editedAt IS NOT NULL`). The web gets a separate root layout at `app/admin/[locale]` with Clerk mounted only there, so public bundles and ISR are untouched. Web runs on Vercel, and API plus Redis run on Railway (EU). Neon is the database, R2 holds the tiles, and Clerk handles admin auth.

**Tech Stack:** pnpm 11 + Turborepo; NestJS 11 + Prisma 7 + PostgreSQL 17 (PostGIS, pgvector); Next.js 16.3.6 + React 19.3; ts-rest 3.52; Clerk (`@clerk/nextjs` 7.9.7, `@clerk/backend` 3.20.1); BullMQ 6 + ioredis 6; Vitest 5; Playwright 1.63 + axe.

**Spec:** `docs/superpowers/specs/2026-10-12-darb-city-v1-design.md` (§4.5, §6.2–6.4, §7, §9, §11, §12, §13). Follow-ups this plan closes: `docs/superpowers/plans/2026-10-12-plan-{1,2a,2b,3}-followups.md`.

## Global Constraints

- Every package is ESM, compiled `NodeNext`. Relative imports in `apps/api` and `packages/*` end in `.js`. `apps/web` uses `@/` paths with no extension.
- Exact versions only (`save-exact=true`). Shared versions live in the `catalog:` of `pnpm-workspace.yaml`. Every new version must have been published **at least 14 days before 2026-10-13**, so before 2026-09-29. Never add `minimumReleaseAgeExclude` or any other release-age exclusion. Transitive ranges that would resolve to younger releases are pinned with `overrides:`.
- Versions this plan adds (all verified with `npm view <pkg> time`): `@clerk/nextjs` 7.9.7 (2026-09-25), `@clerk/backend` 3.20.1 (2026-09-25), `@clerk/localizations` 4.20.0 (2026-09-25), `server-only` 0.0.1 (2022). The overrides are `@clerk/shared` 4.36.0 (2026-09-25), `@clerk/react` 6.17.2 (2026-09-25) and `@tanstack/query-core` 5.104.0 (2026-09-26).
- No secrets in the repo. Clerk, Anthropic, Voyage, Neon, R2 and Vercel keys come from the environment only. `.env.example` files carry names and comments, never values.
- Tests never touch the network. Admin auth in tests uses `FakeTokenVerifier` (API) and fake admin auth (web, localhost only). Intent stays `recorded` and embeddings stay `hash`.
- Never brand the app as halal (in copy, metadata, admin labels or README). Contact is `founder@darb.co.il`, and Instagram is `@darbco`.
- Model cost ceiling: Claude Haiku 5.5 (`claude-haiku-5-5`) at about $0.06–0.16 per 1,000 smart searches. The global budget defaults (Task 6) keep the worst case under $1 a day.
- Commit messages carry **no AI attribution** (no `Co-Authored-By`, no "Generated with"). A message ends with its last line of description.
- Public level routes keep their budgets (`apps/web/scripts/check-budget.mjs`: first-load ≤ 180 KB, route-specific ≤ 40 KB, stage ≤ 340 KB, search ≤ 30 KB). No Clerk code may reach a public chunk.
- Hebrew is unprefixed, and Arabic and English take `/ar` and `/en`. Admin follows the same scheme: `/admin`, `/ar/admin`, `/en/admin`. Hebrew and Arabic are RTL.
- **OWNER** tasks and steps are never performed by a worker. A worker stops at an `OWNER CHECKPOINT`, reports, and waits. Workers never create cloud projects, buckets, DNS records or keys, and never push, deploy or change domains.
- Workers read files in chunks of 150 lines or fewer and call `headroom_retrieve` on any compression marker.

## Review Focus

These are the failure modes most likely to hurt real people that the spec implies, ordered by likelihood. Each has a pinning test in the task that owns the code.

1. **A re-seed undoes an admin edit.** After an admin renames a seed business or hides a seed kind, `pnpm dev` (`db:seed`) must leave both untouched, and must neither suspend nor hide them. Pinned in Task 3 (`load.test.ts` "admin-edited rows are never overwritten, hidden or suspended").
2. **A takedown stays visible.** Suspending a business must remove it at once from its public page, its place lists (including parent places) and search. Pinned in Task 17 (status action sends `immediate: true` plus a search notify) and in the Task 27 e2e ("suspended business 404s on the next request").
3. **A signed-in non-admin reaches admin data.** Any Clerk user can hold a valid token. Only `User.isAdmin` (or a *verified* email in `ADMIN_EMAILS` at first sight) may pass. Pinned in Task 12 (`admin.guard.test.ts`: valid token without the flag gives 403; an unverified allowlisted email gives 403).
4. **Redis or the web is down during an admin write.** The write must still commit and answer quickly. Search notify and revalidation are fire-and-forget with timeouts. Pinned in Task 8 (`notify` resolves under 50 ms with Redis unreachable) and Task 14 (`AdminWriter` returns when the revalidator throws).
5. **The production CSP breaks the map or search.** The worker, tiles on R2, glyphs, and the search index must load under the real headers. Pinned in Task 21 (the e2e stage spec runs against `next start` with the CSP header present and fails on any console CSP violation, and a unit test asserts `worker-src 'self'` and the R2 origin in `connect-src`).

---

## Hosting decision (spec §6.4, follow-ups 2A and 3)

| Concern | (a) Web on Vercel, API + Redis on Railway | (b) Web self-hosted next to the API on Railway |
|---|---|---|
| Custom ISR cache handler (`apps/web/cache-handler.mjs`) | Not used. Vercel's platform cache replaces it. | Used. It is a private Next internal pinned to 16.3.6 and must be re-verified on every Next upgrade. |
| API down, page already cached | Kept, but only if the render **throws**: Vercel keeps the last good copy when regeneration fails. Task 18 makes `orUnavailable` rethrow on Vercel and raises the time-based revalidate to one day, so regeneration is rare (freshness comes from tag revalidation and client-side open state). | Kept. The handler refuses to store the retry view. |
| API down, page never cached | A 500 from the platform. Mitigated by a post-deploy warm-up of every level 0–2 URL in the sitemap (Task 29). | A retry view (200, not cached). |
| Tiles on R2 | Same: browser to R2 directly, with CORS. | Same. |
| Edge cache | Global Vercel CDN, so cached HTML is served from the nearest PoP (Frankfurt or Paris for Israel). | One origin region (Amsterdam), about 70 ms RTT from Israel, with no HTML CDN unless Cloudflare proxying is added (another moving part). |
| Revalidation across instances | Platform-wide `revalidateTag`. | The file-system cache is per replica, so it is correct only with **one** web replica. |
| Cost (one founder, launch traffic) | Vercel Pro $20/mo (Hobby forbids commercial use) plus Railway API and Redis about $5–15. | Railway about $10–25 in total. |
| Simplicity for one founder | Git push gives previews and production. One-click instant rollback. Previews are protected and `noindex` by default. | Dockerfile for web too, preview environments to wire, and a cache handler to maintain. Railway's config-as-code (`railway.json`) is deprecated (read until 2026-12-01), and its replacement IaC (`.railway/railway.ts`) is new. |
| darb.co.il cut-over | The old site is a Vercel project (spec §12), so cut-over moves the domain between two projects in one dashboard. Rollback is moving it back, with no DNS TTL wait. | A DNS change to Railway. Rollback is another DNS change, so it waits on TTL. |
| Preview URLs | Automatic per PR, pointing at the Railway **staging** API. | Railway PR environments, which need extra setup for each service. |

**Recommendation: (a), web on Vercel, with the API and Redis on Railway (EU West) and Neon in the EU.** The deciding reasons are the cut-over and rollback inside one Vercel dashboard (spec §12 asks for a two-week rollback), global edge caching for speed (spec priority 1), and zero web ops for one founder. The one real loss, the never-cached page with the API down, is narrowed by rethrow on Vercel, a one-day time-based revalidate and a post-deploy warm-up. Deploy tasks 29–31 follow (a).

**Fallback (b)**, documented in `docs/launch/hosting.md` (Task 29): build `apps/web/Dockerfile.selfhost` the same way as the API image, set `SITE_URL`, run one replica, and keep `cacheHandler` (enabled whenever `VERCEL` is unset). Switch only if Vercel cost or limits become a problem.

**Regions:** Vercel functions `fra1`; Railway `europe-west4` (Amsterdam); Neon `aws-eu-central-1` (Frankfurt); Clerk production instance on `clerk.darb.co.il`; R2 bucket `darb-tiles` with custom domain `tiles.darb.co.il` (needs the darb.co.il zone on Cloudflare; see the owner questions in Task 30).

## Decisions made in this plan (for owner review)

1. **CSP.** Next applies nonces only to dynamic renders, and nonces turn ISR off (`node_modules/next/dist/docs/01-app/02-guides/content-security-policy.md`, "Dynamic Rendering Requirement"). Public ISR pages therefore get a static policy: `script-src 'self' 'unsafe-inline'` (Next's inline flight scripts need it, and a hash would switch `'unsafe-inline'` off), with everything else strict (`object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, `form-action 'self'`, `worker-src 'self'` (MapLibre's module worker is same-origin), and `connect-src` limited to self and the R2 origin). `/admin` is dynamic, so it gets a per-request nonce with `'strict-dynamic'`.
2. **Seed ownership.** The seed owns a row while `editedAt IS NULL`. The first admin write stamps `editedAt`, and from then on the seed never updates, hides or suspends that row. Admin "Return to seed data" clears `editedAt`, and the next seed run overwrites the row. Admin-created businesses have `source = 'admin'` (a new enum value; spec §4.4 lists seed, self and claimed; `admin` marks rows the Darb team typed in).
3. **First admin.** It is granted either by `pnpm --filter @darb/api admin:grant <clerkUserId>` or by `ADMIN_EMAILS`. The allowlist applies only when the User row is first created, and only for a session token whose `email_verified` claim is true (an owner step in Clerk adds `email` and `email_verified` to the session token).
4. **Example businesses are `noindex`** and left out of the sitemap. They are fictional showroom content, and indexing about 10,600 of them risks a thin-content penalty. Places, sectors, nationwide kinds and real businesses are indexed.
5. **Admin structure edits.** Place slug, parent and type, and business slug and place, are read-only in admin v1, because slugs are permanent URLs and paths are materialized. A place can be created under any parent.
6. **Photos** (Media module, signed R2 uploads) stay out of Plan 4. Real clients launch with experience screens and no photos.

## File structure

API (`apps/api`):
- `prisma/schema.prisma`, plus a new migration `prisma/migrations/<ts>_admin/migration.sql`: `AuditLog`, `editedAt` on Place, Sector, Kind and Business, the `admin` value in `BusinessSource`, and `SearchDocument.embedHash`.
- `src/config.ts`: production guards and `auth`, `admin` and `budget` sections.
- `src/auth/token-verifier.ts`, `src/auth/clerk-token-verifier.ts`, `src/auth/fake-token-verifier.ts`, `src/auth/admin.guard.ts`, `src/auth/auth.module.ts`, `src/auth/grant.ts` (CLI).
- `src/admin/revalidator.ts`, `src/admin/admin-writer.ts`, `src/admin/tags.ts`, `src/admin/admin.module.ts`, `src/admin/places.admin.ts`, `src/admin/kinds.admin.ts`, `src/admin/businesses.admin.ts`, `src/admin/admin.controller.ts`, `src/admin/experience.ts`.
- `src/search/model-budget.ts`, `src/search/ip-bucket.ts`, `src/search/instant-invalidation.ts`, `src/search/retention.ts`, plus edits to `intent.service.ts`, `instant.service.ts`, `index-queue.ts`, `indexer.service.ts`, `rate-limiter.ts` and `search.controller.ts`.
- `src/ai/intent.ts`, `src/ai/anthropic-intent.provider.ts`, `src/ai/ai.module.ts`, `src/ai/voyage-embedding.provider.ts`.
- `src/seed/load.ts`, `src/seed/run.ts`; `src/sitemap/sitemap.controller.ts`.
- `Dockerfile`, `prisma.config.ts`.

Contracts (`packages/contracts`): `src/admin.ts` (new), `src/contract.ts` (adds `admin`, `sitemap` and `search.instantIndex`), `src/schemas.ts` (summary `hours`).

Seed (`packages/seed`): `data/clients.json` (new, owner input), `src/types.ts`, `src/index.ts`.

Web (`apps/web`):
- `src/proxy.ts` (admin routing, Clerk, CSP), `src/lib/csp.ts`, `src/lib/env.ts`, `src/instrumentation.ts`, `src/lib/site.ts`, `src/lib/api.ts`, `src/lib/unavailable.tsx`, `src/lib/rate-limit.ts`, `src/app/api/revalidate/route.ts`, `src/app/api/near/route.ts`, `src/app/api/search/suggest/route.ts`, `src/app/api/search/instant/route.ts`.
- `src/components/LiveOpenState.tsx`; `src/stage/vendor.ts`; `src/app/robots.ts`, `src/app/sitemap.ts`, `src/app/global-not-found.tsx`.
- Admin: `src/app/admin/[locale]/layout.tsx`, `sign-in/[[...sign-in]]/page.tsx`, `(app)/layout.tsx`, `(app)/page.tsx`, `(app)/places/…`, `(app)/kinds/…`, `(app)/sectors/…`, `(app)/businesses/…`, `(app)/report/page.tsx`; `src/admin/*` (copy, auth, api client, actions, components, CSS).
- `vercel.json`, `next.config.ts`, `vitest.config.ts`, `test/server-only.ts`, `e2e/admin.spec.ts`, `e2e/admin-a11y.spec.ts`.

Repo: `pnpm-workspace.yaml`, `.github/workflows/ci.yml`, `.github/workflows/reindex.yml`, `.github/workflows/warm.yml`, `infra/r2/tiles-cors.json`, `docs/launch/hosting.md`, `docs/launch/environments.md`, `docs/launch/runbook.md`, `README.md`.

## Task index

| # | Task | Owner input |
|---|---|---|
| 1 | Pin Clerk and `server-only` | |
| 2 | Admin schema migration | |
| 3 | Seed ownership: never overwrite admin edits | |
| 4 | API production guards and new config | |
| 5 | Rate limits: IPv6 /64 buckets and suggest limit | |
| 6 | Global model-call budget and negative cache | |
| 7 | Stable intent-cache key and live kind list | |
| 8 | Non-blocking search events and cross-replica instant invalidation | |
| 9 | Embedding content hash and Voyage backoff | |
| 10 | Search-log retention and seeding without embeddings | |
| 11 | Runtime instant index | |
| 12 | Clerk token verification and the admin guard | |
| 13 | Admin contracts | |
| 14 | Web revalidator, audit and `AdminWriter` | |
| 15 | Admin API: places and sectors | |
| 16 | Admin API: kinds | |
| 17 | Admin API: businesses, status, release, audit and report | |
| 18 | Web server hardening: env, `server-only`, `siteUrl`, revalidate, Vercel rethrow | |
| 19 | Open-now freshness on the client | |
| 20 | Near-me off the query string and suggest rate limit (web) | |
| 21 | Tiles env guard and the public CSP | |
| 22 | robots, sitemap, previews `noindex`, global-not-found | |
| 23 | Admin shell: routing, Clerk, nonce CSP, copy and sign-in | |
| 24 | Admin lists: places, sectors, kinds and businesses | |
| 25 | Admin editors: place, sector and kind | |
| 26 | Admin business editor | |
| 27 | Missing report screen, admin e2e, axe and budgets | |
| 28 | Real clients: Caramel, Raghad and Paz | **OWNER input** |
| 29 | Deploy as code: Dockerfile, Vercel config, workflows and env lists | |
| 30 | Cloud setup | **OWNER cloud actions** |
| 31 | Preview verification and darb.co.il cut-over runbook | **OWNER cloud actions** |

---

## Part A: Foundations

### Task 1: Pin Clerk and `server-only`

**Files:**
- Modify: `pnpm-workspace.yaml` (catalog plus a new `overrides:` block)
- Modify: `apps/api/package.json`, `apps/web/package.json`
- Create: `apps/web/test/server-only.ts`
- Modify: `apps/web/vitest.config.ts`
- Test: `apps/web/src/lib/server-only-stub.test.ts`

**Interfaces:**
- Produces: `@clerk/backend` importable in `apps/api`; `@clerk/nextjs`, `@clerk/localizations` and `server-only` importable in `apps/web`. Under Vitest, `import "server-only"` resolves to an empty module (`apps/web/test/server-only.ts`).

- [ ] **Step 1: Re-verify release ages (network read only)**

Run:
```bash
for p in @clerk/nextjs@7.9.7 @clerk/backend@3.20.1 @clerk/localizations@4.20.0 @clerk/shared@4.36.0 @clerk/react@6.17.2 @tanstack/query-core@5.104.0 server-only@0.0.1; do
  n=${p%@*}; v=${p##*@}; printf '%s ' "$p"; npm view "$n" time --json | node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>console.log(JSON.parse(s)['$v']))";
done
```
Expected: every date is on or before `2026-09-28`. If any is later (a re-publish), stop and report it. Never add an exclusion.

- [ ] **Step 2: Add catalog entries and overrides**

In `pnpm-workspace.yaml`, add these lines to `catalog:`, keeping the alphabetical order:
```yaml
  "@clerk/backend": 3.20.1
  "@clerk/localizations": 4.20.0
  "@clerk/nextjs": 7.9.7
  server-only: 0.0.1
```
Append a top-level block at the end of the file:
```yaml
# Transitive Clerk ranges (^) would resolve to releases younger than 14 days; pin them exactly.
overrides:
  "@clerk/backend": 3.20.1
  "@clerk/react": 6.17.2
  "@clerk/shared": 4.36.0
  "@tanstack/query-core": 5.104.0
```

- [ ] **Step 3: Add the dependencies**

In `apps/api/package.json` `dependencies`, add `"@clerk/backend": "catalog:"`. In `apps/web/package.json` `dependencies`, add `"@clerk/localizations": "catalog:"`, `"@clerk/nextjs": "catalog:"` and `"server-only": "catalog:"`. Keep the keys sorted.

Run: `pnpm install`
Expected: success. Then run `pnpm why -r @clerk/shared @clerk/backend @clerk/react @tanstack/query-core | grep -E '@clerk|tanstack' | sort -u`.
Expected: only `3.20.1`, `4.36.0`, `6.17.2` and `5.104.0` appear.

- [ ] **Step 4: Write the failing test**

`apps/web/src/lib/server-only-stub.test.ts`:
```ts
import { expect, it } from "vitest";

it("lets server modules import server-only under Vitest", async () => {
  await expect(import("server-only")).resolves.toBeDefined();
});
```
Run: `pnpm --filter @darb/web exec vitest run src/lib/server-only-stub.test.ts`
Expected: FAIL. The real package throws "This module cannot be imported from a Client Component module".

- [ ] **Step 5: Stub it for tests**

`apps/web/test/server-only.ts`:
```ts
// Vitest has no react-server condition; Next resolves the real "server-only" in builds.
export {};
```
In `apps/web/vitest.config.ts`, replace the `resolve` line with:
```ts
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
      "server-only": fileURLToPath(new URL("./test/server-only.ts", import.meta.url)),
    },
  },
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @darb/web exec vitest run src/lib/server-only-stub.test.ts && pnpm typecheck`
Expected: PASS, and typecheck is clean.

- [ ] **Step 7: Commit**

```bash
git add pnpm-workspace.yaml pnpm-lock.yaml apps/api/package.json apps/web/package.json apps/web/vitest.config.ts apps/web/test/server-only.ts apps/web/src/lib/server-only-stub.test.ts
git commit -m "build: pin Clerk 7.9.7/3.20.1 and server-only, with exact transitive overrides"
```

---

### Task 2: Admin schema migration

**Files:**
- Modify: `apps/api/prisma/schema.prisma`
- Create: `apps/api/prisma/migrations/20261013090000_admin/migration.sql`
- Modify: `apps/api/test/db.ts` (`resetDatabase` truncates `AuditLog`)
- Test: `apps/api/src/admin/schema.test.ts`

**Interfaces:**
- Produces: Prisma models and fields used by Tasks 3, 9, 12, 14–17:
  - `Place.editedAt`, `Sector.editedAt`, `Kind.editedAt` and `Business.editedAt`, each `DateTime?`. Null means the seed owns the row.
  - `BusinessSource` gains the value `admin`.
  - `enum AuditAction { create update status release delete }` and `enum AuditEntity { place sector kind business }`.
  - `model AuditLog { id, at, actorId (User), action AuditAction, entityType AuditEntity, entityId uuid, fields String[] }`.
  - `SearchDocument.embedHash String?`.

- [ ] **Step 1: Write the failing test**

`apps/api/src/admin/schema.test.ts`:
```ts
import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

it("stores audit rows and leaves seed rows unedited by default", async () => {
  const f = await seedFixtures(prisma);
  expect(f.abuSalim.editedAt).toBeNull();
  expect(f.sakhnin.editedAt).toBeNull();
  const user = await prisma.user.create({ data: { clerkUserId: "user_a", isAdmin: true } });
  const row = await prisma.auditLog.create({
    data: {
      actorId: user.id,
      action: "update",
      entityType: "business",
      entityId: f.abuSalim.id,
      fields: ["name"],
    },
  });
  expect(row.at).toBeInstanceOf(Date);
  const admin = await prisma.business.update({
    where: { id: f.abuSalim.id },
    data: { source: "admin", editedAt: new Date() },
  });
  expect(admin.source).toBe("admin");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @darb/api exec vitest run src/admin/schema.test.ts`
Expected: FAIL with a TypeScript or Prisma error: `auditLog` does not exist on `PrismaService`.

- [ ] **Step 3: Edit the schema**

In `apps/api/prisma/schema.prisma`:
- Add `admin` as the last value of `enum BusinessSource`.
- Add `editedAt DateTime?` as the last scalar field of `Place`, `Sector`, `Kind` and `Business`. Put it directly after `status` (for Sector, after `order`), with the doc comment `/// Set by every admin write; null means the seed loader owns the row (Plan 4).`
- In `model User`, add the relation `audits AuditLog[]`.
- In `model SearchDocument`, add `embedHash String?` after `embedding`, with the comment `/// sha256 of the embedded text and model; an unchanged hash keeps the stored vector (Plan 4).`
- Append:
```prisma
enum AuditAction {
  create
  update
  status
  release
  delete
}

enum AuditEntity {
  place
  sector
  kind
  business
}

/// Who changed what, and when. Field names only: values live in the rows themselves.
model AuditLog {
  id         String      @id @default(uuid(7)) @db.Uuid
  at         DateTime    @default(now())
  actorId    String      @db.Uuid
  actor      User        @relation(fields: [actorId], references: [id])
  action     AuditAction
  entityType AuditEntity
  entityId   String      @db.Uuid
  fields     String[]

  @@index([entityType, entityId, at])
  @@index([at])
}
```

- [ ] **Step 4: Generate the migration**

Run: `pnpm infra:up && pnpm --filter @darb/api exec prisma migrate dev --name admin --create-only`
Then rename the generated folder to `20261013090000_admin`, so the timestamp is stable. Its `migration.sql` must contain exactly these statements (Prisma's formatting may differ; the content must match):
```sql
ALTER TYPE "BusinessSource" ADD VALUE 'admin';
CREATE TYPE "AuditAction" AS ENUM ('create', 'update', 'status', 'release', 'delete');
CREATE TYPE "AuditEntity" AS ENUM ('place', 'sector', 'kind', 'business');
ALTER TABLE "Business" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Kind" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Place" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "Sector" ADD COLUMN "editedAt" TIMESTAMP(3);
ALTER TABLE "SearchDocument" ADD COLUMN "embedHash" TEXT;
CREATE TABLE "AuditLog" (
    "id" UUID NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "actorId" UUID NOT NULL,
    "action" "AuditAction" NOT NULL,
    "entityType" "AuditEntity" NOT NULL,
    "entityId" UUID NOT NULL,
    "fields" TEXT[],
    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "AuditLog_entityType_entityId_at_idx" ON "AuditLog"("entityType", "entityId", "at");
CREATE INDEX "AuditLog_at_idx" ON "AuditLog"("at");
ALTER TABLE "AuditLog" ADD CONSTRAINT "AuditLog_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
```
If Prisma also emits statements for the hand-written GIN, GiST or generated columns, the drift ruling in Plan 1 has broken. Stop and report it. Do not edit earlier migrations.

Run: `pnpm --filter @darb/api db:deploy && pnpm --filter @darb/api exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code`
Expected: exit code 0 and an empty diff (the migrated database matches the schema; exit code 2 means drift).

- [ ] **Step 5: Truncate the new table in tests**

In `apps/api/test/db.ts`, change the TRUNCATE list so it begins `"AuditLog", "SearchQuery", …` (AuditLog first).

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/admin/schema.test.ts src/seed/load.test.ts`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/api/prisma apps/api/test/db.ts apps/api/src/admin/schema.test.ts
git commit -m "feat(api): audit log, editedAt ownership stamps, admin source and embedding hash"
```

---

### Task 3: Seed ownership: never overwrite admin edits

**Files:**
- Modify: `apps/api/src/seed/load.ts` (whole file below)
- Test: `apps/api/src/seed/load.test.ts` (append)
- Modify: `README.md` (one paragraph under `## Run`)

**Interfaces:**
- Consumes: `editedAt` columns (Task 2).
- Produces: the rule that `loadSeed(prisma, data)` writes only rows whose `editedAt IS NULL`. It still creates missing rows, and it never hides, suspends or relinks an edited row. The signature is unchanged.

- [ ] **Step 1: Write the failing test**

Append to `apps/api/src/seed/load.test.ts`:
```ts
it("admin-edited rows are never overwritten, hidden or suspended", async () => {
  await loadSeed(prisma, data);
  const stamp = { editedAt: new Date() };
  await prisma.place.update({ where: { slug: "sakhnin" }, data: { name: { en: "Sakhnin (admin)" }, ...stamp } });
  await prisma.sector.update({ where: { slug: "beauty" }, data: { accent: "#123456", ...stamp } });
  await prisma.kind.update({ where: { slug: "kids-haircuts" }, data: { name: { en: "Kids (admin)" }, ...stamp } });
  const biz = await prisma.business.findFirstOrThrow({ where: { slug: "samer" } });
  await prisma.business.update({ where: { id: biz.id }, data: { name: { en: "Samer (admin)" }, ...stamp } });
  await prisma.businessKind.deleteMany({ where: { businessId: biz.id } });

  // The data drops the edited kind and business: the seed would hide and suspend them.
  await loadSeed(prisma, {
    ...data,
    kinds: data.kinds.filter((k) => k.slug !== "kids-haircuts"),
    businesses: [],
  });

  expect((await prisma.place.findUniqueOrThrow({ where: { slug: "sakhnin" } })).name).toEqual({ en: "Sakhnin (admin)" });
  expect((await prisma.sector.findUniqueOrThrow({ where: { slug: "beauty" } })).accent).toBe("#123456");
  const kids = await prisma.kind.findUniqueOrThrow({ where: { slug: "kids-haircuts" } });
  expect([kids.name, kids.status]).toEqual([{ en: "Kids (admin)" }, "active"]);
  const after = await prisma.business.findUniqueOrThrow({ where: { id: biz.id } });
  expect([after.name, after.status]).toEqual([{ en: "Samer (admin)" }, "published"]);
  expect(await prisma.businessKind.count({ where: { businessId: biz.id } })).toBe(0);
});

it("still places children under an edited parent and overwrites rows released back to the seed", async () => {
  await loadSeed(prisma, data);
  await prisma.place.update({ where: { slug: "northern-district" }, data: { editedAt: new Date() } });
  await prisma.business.updateMany({ data: { name: { en: "Local" }, editedAt: new Date() } });
  await prisma.business.updateMany({ data: { editedAt: null } }); // "Return to seed data"
  await loadSeed(prisma, data);
  const sakhnin = await prisma.place.findUniqueOrThrow({ where: { slug: "sakhnin" } });
  expect(sakhnin.path).toBe("/israel/northern-district/sakhnin/");
  expect((await prisma.business.findFirstOrThrow()).name).toEqual({ en: "Samer" });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @darb/api exec vitest run src/seed/load.test.ts`
Expected: FAIL. The first new test sees `{ en: "Sakhnin" }` instead of the admin name.

- [ ] **Step 3: Rewrite the loader**

Replace `apps/api/src/seed/load.ts` with:
```ts
// Seed ownership (Plan 4, decision 2): the seed owns a row while its editedAt is null. Each run
// creates missing rows and overwrites seed-owned ones from packages/seed/data, hides seed-owned
// kinds that left the data and suspends seed-owned businesses that left it. A row an admin has
// edited (editedAt set) is never updated, hidden, suspended or relinked; "Return to seed data" in
// the admin clears editedAt so the next run overwrites it again.
import type { SeedBrand, SeedBusiness, SeedKind, SeedPlace, SeedSector } from "@darb/seed";
import { SCREEN_SCHEMA } from "@darb/seed";
import { Ajv } from "ajv";
import type { Prisma } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";

/** Seed values are plain JSON already; this tells Prisma so. */
const json = (value: unknown) => value as Prisma.InputJsonValue;

export interface SeedData {
  places: SeedPlace[];
  sectors: SeedSector[];
  kinds: SeedKind[];
  brands: SeedBrand[];
  businesses: SeedBusiness[];
}
export interface SeedCounts {
  places: number;
  sectors: number;
  kinds: number;
  brands: number;
  businesses: number;
}

const validateScreen = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);

/** Interactive transactions default to a 5 s timeout; a group of seed writes can take longer. */
const TX = { maxWait: 10_000, timeout: 120_000 };
/** Businesses per transaction: big enough to save round trips, small enough to keep locks short. */
const BUSINESS_CHUNK = 1000;
const EDITED = { editedAt: { not: null } } as const;

export async function loadSeed(prisma: PrismaService, data: SeedData): Promise<SeedCounts> {
  for (const b of data.businesses) {
    if (!validateScreen(b.experience)) {
      throw new Error(
        `Invalid experience for ${b.place}/${b.slug}: ${JSON.stringify(validateScreen.errors)}`,
      );
    }
  }

  const placeIds = new Map<string, string>();
  const paths = new Map<string, string>();
  const editedPlaces = await prisma.place.findMany({
    where: EDITED,
    select: { id: true, slug: true, path: true, cbsCode: true },
  });
  const editedByCbs = new Map(editedPlaces.filter((p) => p.cbsCode).map((p) => [p.cbsCode!, p]));
  const editedBySlug = new Map(editedPlaces.map((p) => [p.slug, p]));
  await prisma.$transaction(async (tx) => {
    for (const p of data.places) {
      const edited = (p.cbsCode ? editedByCbs.get(p.cbsCode) : undefined) ?? editedBySlug.get(p.slug);
      if (edited) {
        placeIds.set(p.slug, edited.id);
        paths.set(p.slug, edited.path);
        continue;
      }
      const parentId = p.parent ? placeIds.get(p.parent) : null;
      if (p.parent && !parentId)
        throw new Error(`Place ${p.slug} comes before its parent ${p.parent}`);
      const path = `${p.parent ? paths.get(p.parent)! : "/"}${p.slug}/`;
      const fields = {
        slug: p.slug,
        type: p.type,
        parentId: parentId ?? null,
        path,
        name: json(p.name),
        aliases: p.aliases,
        lat: p.lat,
        lng: p.lng,
        cbsCode: p.cbsCode,
        status: p.status,
      };
      // A CBS code is the stable identity, so a renamed slug updates the row in place.
      const row = await tx.place.upsert({
        where: p.cbsCode ? { cbsCode: p.cbsCode } : { slug: p.slug },
        create: fields,
        update: fields,
      });
      placeIds.set(p.slug, row.id);
      paths.set(p.slug, path);
    }
  }, TX);

  const sectorIds = new Map<string, string>();
  const kindIds = new Map<string, string>();
  const editedSectors = new Map(
    (await prisma.sector.findMany({ where: EDITED, select: { id: true, slug: true } })).map((s) => [s.slug, s.id]),
  );
  const editedKinds = new Map(
    (await prisma.kind.findMany({ where: EDITED, select: { id: true, slug: true } })).map((k) => [k.slug, k.id]),
  );
  await prisma.$transaction(async (tx) => {
    for (const s of data.sectors) {
      const edited = editedSectors.get(s.slug);
      if (edited) {
        sectorIds.set(s.slug, edited);
        continue;
      }
      const fields = {
        name: json(s.name),
        tagline: json(s.tagline),
        accent: s.accent,
        order: s.order,
      };
      const row = await tx.sector.upsert({
        where: { slug: s.slug },
        create: { slug: s.slug, ...fields },
        update: fields,
      });
      sectorIds.set(s.slug, row.id);
    }

    const pending = [...data.kinds];
    while (pending.length > 0) {
      const index = pending.findIndex((k) => !k.parent || kindIds.has(k.parent));
      if (index === -1)
        throw new Error(
          `Kind parents form a cycle or are missing: ${pending.map((k) => k.slug).join(", ")}`,
        );
      const k = pending.splice(index, 1)[0]!;
      const edited = editedKinds.get(k.slug);
      if (edited) {
        kindIds.set(k.slug, edited);
        continue;
      }
      const fields = {
        sectorId: sectorIds.get(k.sector)!,
        parentKindId: k.parent ? kindIds.get(k.parent)! : null,
        name: json(k.name),
        synonyms: json(k.synonyms),
        template: k.template,
        contentSchema: json(SCREEN_SCHEMA),
        attributes: k.attributes,
        icon: k.icon,
        order: k.order,
        status: k.status,
      };
      const row = await tx.kind.upsert({
        where: { slug: k.slug },
        create: { slug: k.slug, ...fields },
        update: fields,
      });
      kindIds.set(k.slug, row.id);
    }
    await tx.kind.updateMany({
      where: { slug: { notIn: data.kinds.map((k) => k.slug) }, editedAt: null },
      data: { status: "hidden" },
    });
  }, TX);

  const brandIds = new Map<string, string>();
  await prisma.$transaction(async (tx) => {
    for (const b of data.brands) {
      const row = await tx.brand.upsert({
        where: { slug: b.slug },
        create: { slug: b.slug, name: json(b.name) },
        update: { name: json(b.name) },
      });
      brandIds.set(b.slug, row.id);
    }
  }, TX);

  const editedBusinesses = new Map(
    (
      await prisma.business.findMany({
        where: EDITED,
        select: { id: true, placeId: true, slug: true },
      })
    ).map((b) => [`${b.placeId}/${b.slug}`, b.id]),
  );
  const businessIds: string[] = [];
  for (let start = 0; start < data.businesses.length; start += BUSINESS_CHUNK) {
    const chunk = data.businesses.slice(start, start + BUSINESS_CHUNK);
    await prisma.$transaction(async (tx) => {
      const links: { businessId: string; kindId: string }[] = [];
      const ids: string[] = [];
      for (const b of chunk) {
        const placeId = placeIds.get(b.place);
        if (!placeId) throw new Error(`Business ${b.slug} is in unknown place ${b.place}`);
        const edited = editedBusinesses.get(`${placeId}/${b.slug}`);
        if (edited) {
          businessIds.push(edited); // kept: never suspended, never relinked
          continue;
        }
        const fields = {
          name: json(b.name),
          tagline: json(b.tagline),
          primaryKindId: kindIds.get(b.primaryKind)!,
          lat: b.lat,
          lng: b.lng,
          address: json(b.address),
          hours: json(b.hours),
          attributes: json(b.attributes),
          experience: json(b.experience),
          tier: b.tier,
          source: "seed" as const,
          status: "published" as const,
          brandId: b.brand ? brandIds.get(b.brand)! : null,
        };
        const row = await tx.business.upsert({
          where: { placeId_slug: { placeId, slug: b.slug } },
          create: { slug: b.slug, placeId, ...fields },
          update: fields,
          select: { id: true },
        });
        ids.push(row.id);
        for (const k of b.kinds) links.push({ businessId: row.id, kindId: kindIds.get(k)! });
      }
      await tx.businessKind.deleteMany({ where: { businessId: { in: ids } } });
      await tx.businessKind.createMany({ data: links });
      businessIds.push(...ids);
    }, TX);
  }
  // Seed businesses that left the data stay in place (claims may point at them) but go dark.
  await prisma.business.updateMany({
    where: { source: "seed", editedAt: null, id: { notIn: businessIds } },
    data: { status: "suspended" },
  });

  return {
    places: data.places.length,
    sectors: data.sectors.length,
    kinds: data.kinds.length,
    brands: data.brands.length,
    businesses: data.businesses.length,
  };
}
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/seed/load.test.ts`
Expected: PASS (all 9 tests).

- [ ] **Step 5: Document the rule**

In `README.md`, after the `pnpm --filter @darb/api db:seed` line in `## Run`, add this paragraph:
```markdown
Seed ownership: the seed owns a place, sector, kind or business while its `editedAt` is empty.
The first admin edit stamps `editedAt`, and from then on `db:seed` never overwrites, hides or
suspends that row. **Return to seed data** in `/admin` clears the stamp, so the next seed run
overwrites the row again.
```

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/seed/load.ts apps/api/src/seed/load.test.ts README.md
git commit -m "feat(api): the seed loader never overwrites, hides or suspends admin-edited rows"
```

---

### Task 4: API production guards and new config

**Files:**
- Modify: `apps/api/src/config.ts`
- Test: `apps/api/src/config.test.ts` (append)
- Modify: `apps/api/.env.example`

**Interfaces:**
- Produces: `AppConfig` gains the following, used by Tasks 5–17:
```ts
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
// SearchConfig gains:
//   modelCallsPerMinute: number; modelCallsPerDay: number; negativeCacheSeconds: number;
//   suggestRateLimit: number; logRetentionDays: number;
// AppConfig gains: auth: AuthConfig; admin: AdminConfig; production: boolean;
```
- Production (`NODE_ENV=production`) refuses to start when:
  - `SEARCH_PROXY_KEY` is unset or shorter than 32 characters;
  - `IP_HASH_SALT` is unset or shorter than 32 characters;
  - `AUTH_VERIFIER=fake`;
  - `AUTH_VERIFIER=clerk` is set without `CLERK_SECRET_KEY` or `CLERK_JWT_KEY`;
  - `REVALIDATE_URL` is set without a `REVALIDATE_SECRET` of at least 32 characters.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/config.test.ts`:
```ts
const long = "x".repeat(32);
const prod = {
  ...base,
  NODE_ENV: "production",
  SEARCH_PROXY_KEY: long,
  IP_HASH_SALT: long,
};

it("defaults the Plan 4 settings", () => {
  const config = loadConfig(base);
  expect(config.auth).toEqual({
    verifier: "off",
    clerkSecretKey: null,
    clerkJwtKey: null,
    authorizedParties: [],
    adminEmails: [],
  });
  expect(config.admin).toEqual({ revalidateUrl: null, revalidateSecret: null });
  expect(config.search).toMatchObject({
    modelCallsPerMinute: 60,
    modelCallsPerDay: 5000,
    negativeCacheSeconds: 3600,
    suggestRateLimit: 240,
    logRetentionDays: 90,
  });
  expect(config.production).toBe(false);
});

it("reads Clerk, the allowlist and revalidation", () => {
  const config = loadConfig({
    ...base,
    CLERK_SECRET_KEY: "sk_test_1",
    CLERK_AUTHORIZED_PARTIES: "https://darb.co.il, https://www.darb.co.il",
    ADMIN_EMAILS: "Founder@Darb.co.il ,ops@darb.co.il",
    REVALIDATE_URL: "http://localhost:3000/api/revalidate",
    REVALIDATE_SECRET: "s",
  });
  expect(config.auth.verifier).toBe("clerk");
  expect(config.auth.authorizedParties).toEqual(["https://darb.co.il", "https://www.darb.co.il"]);
  expect(config.auth.adminEmails).toEqual(["founder@darb.co.il", "ops@darb.co.il"]);
  expect(config.admin.revalidateUrl).toBe("http://localhost:3000/api/revalidate");
});

it("refuses weak or missing production secrets", () => {
  expect(loadConfig(prod).production).toBe(true);
  expect(() => loadConfig({ ...prod, SEARCH_PROXY_KEY: "short" })).toThrow(/SEARCH_PROXY_KEY/);
  expect(() => loadConfig({ ...prod, SEARCH_PROXY_KEY: undefined })).toThrow(/SEARCH_PROXY_KEY/);
  expect(() => loadConfig({ ...prod, IP_HASH_SALT: undefined })).toThrow(/IP_HASH_SALT/);
  expect(() => loadConfig({ ...prod, AUTH_VERIFIER: "fake" })).toThrow(/AUTH_VERIFIER/);
  expect(() => loadConfig({ ...prod, AUTH_VERIFIER: "clerk" })).toThrow(/CLERK_SECRET_KEY/);
  expect(() =>
    loadConfig({ ...prod, REVALIDATE_URL: "https://darb.co.il/api/revalidate", REVALIDATE_SECRET: "s" }),
  ).toThrow(/REVALIDATE_SECRET/);
});

it("allows the fake verifier outside production only", () => {
  expect(loadConfig({ ...base, AUTH_VERIFIER: "fake" }).auth.verifier).toBe("fake");
});
```
Also update the existing test "refuses the example proxy key in production": in its last expectation, replace `"a-real-secret"` with `long` in both places and add `IP_HASH_SALT: long` to that object. Move `const long` above that test if needed.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/config.test.ts`
Expected: FAIL. `config.auth` is undefined.

- [ ] **Step 3: Implement**

In `apps/api/src/config.ts`:

(a) Add these fields to `SearchConfig`:
```ts
  modelCallsPerMinute: number;
  modelCallsPerDay: number;
  negativeCacheSeconds: number;
  suggestRateLimit: number;
  logRetentionDays: number;
```
(b) Add the `AuthConfig` and `AdminConfig` interfaces exactly as in **Interfaces**, and extend `AppConfig` with `auth: AuthConfig; admin: AdminConfig; production: boolean;`.

(c) Add these to the zod `schema` object:
```ts
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
```
(d) After the existing `EXAMPLE_PROXY_KEY` check, add:
```ts
  const production = e.NODE_ENV === "production";
  const list = (v: string | null) =>
    (v ?? "").split(",").map((s) => s.trim()).filter((s) => s !== "");
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
```
(e) In the returned object, add `production`, the new search fields and the two sections:
```ts
    production,
    auth: {
      verifier,
      clerkSecretKey: e.CLERK_SECRET_KEY,
      clerkJwtKey: e.CLERK_JWT_KEY,
      authorizedParties: list(e.CLERK_AUTHORIZED_PARTIES),
      adminEmails: list(e.ADMIN_EMAILS).map((m) => m.toLowerCase()),
    },
    admin: { revalidateUrl: e.REVALIDATE_URL ?? null, revalidateSecret: e.REVALIDATE_SECRET },
```
and, inside `search: { … }`:
```ts
      modelCallsPerMinute: e.MODEL_CALLS_PER_MINUTE,
      modelCallsPerDay: e.MODEL_CALLS_PER_DAY,
      negativeCacheSeconds: e.INTENT_NEGATIVE_CACHE_SECONDS,
      suggestRateLimit: e.SUGGEST_RATE_LIMIT,
      logRetentionDays: e.SEARCH_LOG_RETENTION_DAYS,
```

- [ ] **Step 4: Document the variables**

Append to `apps/api/.env.example`:
```bash
# Admin auth (Clerk, admin only in v1). Without a key the admin API answers 401 to everyone.
# CLERK_SECRET_KEY=
# CLERK_JWT_KEY=  (PEM public key from Clerk > API keys; verifies with no network call)
# CLERK_AUTHORIZED_PARTIES=http://localhost:3000
# AUTH_VERIFIER=  (clerk | fake | off; fake = tests and local e2e only, refused in production)
# ADMIN_EMAILS=  (comma list; granted admin at first sign-in when the email is verified)
# The web route the API calls after each admin write (apps/web REVALIDATE_SECRET must match).
REVALIDATE_URL=http://localhost:3000/api/revalidate
REVALIDATE_SECRET=change-me
# Global model budget (lane 2 falls back to lane 1 beyond it), negative cache, suggest limit, log retention.
# MODEL_CALLS_PER_MINUTE=60
# MODEL_CALLS_PER_DAY=5000
# INTENT_NEGATIVE_CACHE_SECONDS=3600
# SUGGEST_RATE_LIMIT=240
# SEARCH_LOG_RETENTION_DAYS=90
```
Then edit the existing `# IP_HASH_SALT=` comment so it reads `(production: required, at least 32 random characters …)`.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/config.test.ts && pnpm --filter @darb/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/config.ts apps/api/src/config.test.ts apps/api/.env.example
git commit -m "feat(api): production refuses weak proxy keys and salts; admin auth, revalidation and budget settings"
```

---

## Part B: Search hardening (Plan 3 blockers, before the Anthropic or Voyage keys go live)

### Task 5: Rate limits: IPv6 /64 buckets and suggest limit

**Files:**
- Create: `apps/api/src/search/ip-bucket.ts`
- Test: `apps/api/src/search/ip-bucket.test.ts`
- Modify: `apps/api/src/search/rate-limiter.ts` (key by bucket, plus a `"suggest"` bucket)
- Modify: `apps/api/src/search/client-ip.ts` (export `proxied`)
- Modify: `apps/api/src/search/search.controller.ts` (suggest gate)
- Modify: `packages/contracts/src/contract.ts` (suggest declares 429)
- Modify: `apps/web/src/lib/api.ts` (`getSuggestions` sends the proxy key, with no IP)
- Test: `apps/api/src/search/suggest.test.ts` (append)

**Interfaces:**
- Produces:
  - `ipBucket(ip: string): string`. IPv4 is returned as is, IPv4-mapped IPv6 becomes IPv4, and IPv6 becomes `"<first four hextets>::/64"` (lower-case, zeros compressed per hextet).
  - `proxied(req: ClientRequest, proxyKey: string | null): boolean`. True when the request carries the right `x-darb-proxy-key`.
  - `RateLimiter` buckets: `"search" | "results" | "click" | "report" | "suggest"`.
  - Suggest rule: the web server (proxied) is never limited at the API, because it limits per visitor itself (Task 20). Anyone calling the API directly is limited to `SUGGEST_RATE_LIMIT` per minute per IP bucket.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/search/ip-bucket.test.ts`:
```ts
import { expect, it } from "vitest";
import { ipBucket } from "./ip-bucket.js";

it("keeps IPv4 as it is and unwraps IPv4-mapped IPv6", () => {
  expect(ipBucket("203.0.113.9")).toBe("203.0.113.9");
  expect(ipBucket("::ffff:203.0.113.9")).toBe("203.0.113.9");
});

it("groups IPv6 by /64", () => {
  const a = ipBucket("2001:db8:1:2:aaaa::1");
  expect(a).toBe("2001:db8:1:2::/64");
  expect(ipBucket("2001:DB8:0001:0002:ffff:ffff:ffff:ffff")).toBe(a);
  expect(ipBucket("[2001:db8:1:2::7]")).toBe(a);
  expect(ipBucket("2001:db8:1:3::1")).not.toBe(a);
  expect(ipBucket("::1")).toBe("0:0:0:0::/64");
  expect(ipBucket("fe80::1%eth0")).toBe("fe80:0:0:0::/64");
});

it("passes anything else through, bounded", () => {
  expect(ipBucket("unknown")).toBe("unknown");
  expect(ipBucket("x".repeat(100))).toHaveLength(64);
});
```
Append to `apps/api/src/search/suggest.test.ts`, using the file's existing app setup if it creates one. If it only tests the repository, create `apps/api/src/search/suggest-limit.test.ts` instead:
```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";

let app: INestApplication;
beforeAll(async () => {
  process.env["SUGGEST_RATE_LIMIT"] = "2";
  process.env["SEARCH_PROXY_KEY"] = "k".repeat(32);
  const redis = await createRedis(loadConfig(process.env).search.redisUrl);
  const keys = await redis.keys("darb:rl:suggest:*");
  if (keys.length) await redis.del(...keys);
  await redis.quit();
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  await seedFixtures(created.prisma);
});
afterAll(async () => {
  delete process.env["SUGGEST_RATE_LIMIT"];
  delete process.env["SEARCH_PROXY_KEY"];
  await app.close();
});

it("limits direct suggest callers and never the web server", async () => {
  const http = request(app.getHttpServer());
  // The test app trusts no proxy, so every direct call counts against the loopback address.
  const direct = () => http.get("/search/suggest?q=abu");
  expect((await direct()).status).toBe(200);
  expect((await direct()).status).toBe(200);
  expect((await direct()).status).toBe(429);
  const viaWeb = await http.get("/search/suggest?q=abu").set("x-darb-proxy-key", "k".repeat(32));
  expect(viaWeb.status).toBe(200);
});
```
- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/search/ip-bucket.test.ts src/search/suggest-limit.test.ts`
Expected: FAIL. The module `./ip-bucket.js` is not found, and suggest never returns 429.

- [ ] **Step 3: Implement**

`apps/api/src/search/ip-bucket.ts`:
```ts
import { isIPv4, isIPv6 } from "node:net";

/** Eight lower-case hextets without leading zeros; an embedded IPv4 tail becomes two hextets. */
function hextets(ip: string): string[] {
  let s = ip;
  const v4 = /(\d+\.\d+\.\d+\.\d+)$/.exec(s);
  if (v4) {
    const [a, b, c, d] = v4[1]!.split(".").map(Number) as [number, number, number, number];
    s = `${s.slice(0, -v4[1]!.length)}${((a << 8) | b).toString(16)}:${((c << 8) | d).toString(16)}`;
  }
  const [head, tail] = s.split("::") as [string, string | undefined];
  const h = head ? head.split(":") : [];
  const t = tail === undefined ? [] : tail ? tail.split(":") : [];
  const fill = tail === undefined ? [] : Array<string>(8 - h.length - t.length).fill("0");
  return [...h, ...fill, ...t].map((x) => parseInt(x, 16).toString(16));
}

/**
 * Who a rate limit counts: an IPv4 address, or an IPv6 /64 (one home or host gets a whole /64,
 * so per-address limits would be free to dodge).
 */
export function ipBucket(ip: string): string {
  const raw = ip.trim().replace(/^\[|\]$/g, "").split("%")[0]!;
  const mapped = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(raw);
  if (mapped) return mapped[1]!;
  if (isIPv4(raw)) return raw;
  if (!isIPv6(raw)) return raw.slice(0, 64);
  return `${hextets(raw).slice(0, 4).join(":")}::/64`;
}
```
In `apps/api/src/search/rate-limiter.ts`:
- Add `import { ipBucket } from "./ip-bucket.js";`.
- Change the type to `type Bucket = "search" | "results" | "click" | "report" | "suggest";`.
- In `key()`, hash `ipBucket(ip)` instead of `ip`:
```ts
    return `darb:rl:${bucket}:${ipHash(this.config.search.ipSalt, ipBucket(ip))}:${window}`;
```
In `apps/api/src/search/client-ip.ts`, append:
```ts
/** The request comes from the Darb web server (it holds the shared key). */
export function proxied(req: ClientRequest, proxyKey: string | null): boolean {
  const key = header(req.headers["x-darb-proxy-key"]);
  return Boolean(proxyKey && key && sameKey(key, proxyKey));
}
```
In `apps/api/src/search/search.controller.ts`, import `proxied` from `./client-ip.js` and replace the `suggest` handler with:
```ts
      suggest: async ({ query }) => {
        // The web server limits each visitor itself (it can cache); direct callers are limited here.
        if (!proxied(req, this.config.search.proxyKey)) {
          const gate = await this.limiter.hit("suggest", ip(), this.config.search.suggestRateLimit);
          if (!gate.ok) return tooMany(gate.retryAfter);
        }
        return {
          status: 200,
          body: await this.suggestions.suggest(query.q, { place: query.place, limit: query.limit }),
        };
      },
```
In `packages/contracts/src/contract.ts`, change suggest's responses to `{ 200: z.array(SuggestionSchema), 429: TooManySchema }`.
In `apps/web/src/lib/api.ts` `getSuggestions`, add `extraHeaders: { "x-darb-proxy-key": process.env.SEARCH_PROXY_KEY ?? "" },` to the `client().search.suggest({ … })` call. The value is constant, so the fetch cache is not split.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @darb/contracts build && pnpm --filter @darb/api exec vitest run src/search && pnpm --filter @darb/web exec vitest run src/lib/api.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/search packages/contracts/src/contract.ts apps/web/src/lib/api.ts
git commit -m "feat(api): rate-limit IPv6 by /64 and limit direct suggest callers"
```

---

### Task 6: Global model-call budget and negative cache

**Files:**
- Create: `apps/api/src/search/model-budget.ts`
- Test: `apps/api/src/search/model-budget.test.ts`
- Modify: `apps/api/src/search/intent.service.ts` (budget gate and negative cache)
- Modify: `apps/api/src/search/search.module.ts` (provide `ModelBudget`)
- Modify: `apps/api/src/search/intent.service.test.ts` (constructor gets a budget, plus new tests)

**Interfaces:**
- Consumes: `config.search.modelCallsPerMinute`, `modelCallsPerDay` and `negativeCacheSeconds` (Task 4).
- Produces:
  - `class ModelBudget { take(now?: Date): Promise<boolean> }`. It counts every model call across replicas in Redis (per-minute and per-UTC-day keys). If Redis fails, it falls back to an in-memory count per process with the same limits, so the system always fails closed to lane 1. A limit of 0 means never call the model.
  - `IntentService` constructor becomes `(instant, provider, redis, config, budget: ModelBudget)`.
  - Negative cache key: `${intentCacheKey(...)}:neg`, set to `"1"` for `negativeCacheSeconds` when the model answered but the answer was not useful. Transport failures and timeouts are never negative-cached.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/search/model-budget.test.ts`:
```ts
import type { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";
import { ModelBudget } from "./model-budget.js";

const config = (perMinute: number, perDay: number) => {
  const c = loadConfig({ ...process.env, MODEL_CALLS_PER_MINUTE: String(perMinute), MODEL_CALLS_PER_DAY: String(perDay) });
  return c;
};
let redis: Redis;
let down: Redis;
beforeAll(async () => {
  redis = await createRedis(loadConfig(process.env).search.redisUrl);
  down = await createRedis("redis://127.0.0.1:1");
});
beforeEach(async () => {
  const keys = await redis.keys("darb:model:calls:*");
  if (keys.length) await redis.del(...keys);
});
afterAll(async () => {
  await redis.quit();
  down.disconnect();
});

const at = new Date("2026-10-13T10:00:30Z");

it("allows calls up to the per-minute limit, shared through Redis", async () => {
  const a = new ModelBudget(redis, config(2, 100));
  const b = new ModelBudget(redis, config(2, 100));
  expect(await a.take(at)).toBe(true);
  expect(await b.take(at)).toBe(true);
  expect(await a.take(at)).toBe(false);
  expect(await a.take(new Date("2026-10-13T10:01:00Z"))).toBe(true);
});

it("enforces the daily limit", async () => {
  const budget = new ModelBudget(redis, config(100, 1));
  expect(await budget.take(at)).toBe(true);
  expect(await budget.take(new Date("2026-10-13T18:00:00Z"))).toBe(false);
  expect(await budget.take(new Date("2026-10-14T00:00:01Z"))).toBe(true);
});

it("fails closed with an in-memory budget when Redis is down", async () => {
  const budget = new ModelBudget(down, config(1, 100));
  expect(await budget.take(at)).toBe(true);
  expect(await budget.take(at)).toBe(false);
});

it("a zero limit never calls the model", async () => {
  expect(await new ModelBudget(redis, config(0, 100)).take(at)).toBe(false);
});
```
In `apps/api/src/search/intent.service.test.ts`:
- Import `ModelBudget` from `./model-budget.js`.
- Add `const open = { take: async () => true } as unknown as ModelBudget;`.
- Change every `new IntentService(instant, provider, redis, config)` to `new IntentService(instant, provider, redis, config, open)`.
- Change the `beforeEach` key pattern from `"darb:intent:v1:*"` to `"darb:intent:*"`.
- Append:
```ts
describe("budget and negative cache", () => {
  it("answers from lane 1 without calling the model when the budget is spent", async () => {
    const provider: IntentProvider = { name: "fake", extract: vi.fn(async () => answer) };
    const closed = { take: async () => false } as unknown as ModelBudget;
    const svc = new IntentService(instant, provider, redis, config, closed);
    const r = await svc.resolve(Q, "en");
    expect(r.lane).toBe("instant");
    expect(provider.extract).not.toHaveBeenCalled();
  });

  it("remembers an unhelpful answer and does not ask again", async () => {
    const empty: RawIntent = { ...answer, kinds: [], place: null, nearMe: false };
    const { svc, provider } = service(async () => empty);
    const q = "something lane one cannot explain at all";
    await svc.resolve(q, "en");
    await svc.resolve(q, "en");
    expect(provider.extract).toHaveBeenCalledTimes(1);
  });

  it("never remembers a failure", async () => {
    const { svc, provider } = service(async () => {
      throw new Error("boom");
    });
    const q = "another sentence lane one cannot explain";
    await svc.resolve(q, "en");
    await svc.resolve(q, "en");
    expect(provider.extract).toHaveBeenCalledTimes(2);
  });
});
```
(`service(...)` is the helper at the top of the file. Update it to pass `open` as well.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/search/model-budget.test.ts src/search/intent.service.test.ts`
Expected: FAIL. `./model-budget.js` is missing.

- [ ] **Step 3: Implement the budget**

`apps/api/src/search/model-budget.ts`:
```ts
import { Inject, Injectable } from "@nestjs/common";
import type { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { REDIS } from "../redis/redis.module.js";

const KEY = (window: string) => `darb:model:calls:${window}`;

/**
 * A ceiling on model calls across every API replica (cost guard, spec §5.4). Counted in Redis;
 * when Redis fails, each process counts for itself against the same limits, so a Redis outage can
 * never mean unlimited calls. Over the limit, search answers from lane 1.
 */
@Injectable()
export class ModelBudget {
  private readonly local = new Map<string, number>();

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async take(now: Date = new Date()): Promise<boolean> {
    const { modelCallsPerMinute: perMinute, modelCallsPerDay: perDay } = this.config.search;
    if (perMinute === 0 || perDay === 0) return false;
    const minute = `m:${Math.floor(now.getTime() / 60_000)}`;
    const day = `d:${now.toISOString().slice(0, 10)}`;
    try {
      const res = await this.redis
        .multi()
        .incr(KEY(minute))
        .expire(KEY(minute), 120)
        .incr(KEY(day))
        .expire(KEY(day), 2 * 86_400)
        .exec();
      if (!res || res.some(([err]) => err)) throw new Error("budget unavailable");
      return Number(res[0]![1]) <= perMinute && Number(res[2]![1]) <= perDay;
    } catch {
      return this.takeLocal(minute, day, perMinute, perDay);
    }
  }

  private takeLocal(minute: string, day: string, perMinute: number, perDay: number): boolean {
    for (const key of this.local.keys())
      if (key !== minute && key !== day) this.local.delete(key);
    const m = (this.local.get(minute) ?? 0) + 1;
    const d = (this.local.get(day) ?? 0) + 1;
    this.local.set(minute, m);
    this.local.set(day, d);
    return m <= perMinute && d <= perDay;
  }
}
```
Add `ModelBudget` to `providers` in `apps/api/src/search/search.module.ts`.

- [ ] **Step 4: Gate the model call and add the negative cache**

In `apps/api/src/search/intent.service.ts`:
- Import `ModelBudget` from `./model-budget.js`.
- Add the constructor parameter `private readonly budget: ModelBudget` as the last one.
- Replace everything from `const raw = await this.callModel(q, locale, instant);` to the end of `resolve` with:
```ts
    const negative = `${key}:neg`;
    if ((await this.redis.get(negative).catch(() => null)) !== null) return fallback;
    if (!(await this.budget.take())) return fallback;

    const raw = await this.callModel(q, locale, instant);
    if (raw === null) return fallback; // failure or timeout: transient, never remembered
    const validated = validateIntent(raw, allowed, instant.cues);
    if (!useful(validated)) {
      const ttl = this.config.search.negativeCacheSeconds;
      if (ttl > 0) await this.redis.set(negative, "1", "EX", ttl).catch(() => undefined);
      return fallback;
    }
    const intent = keepPlace(validated);
    await this.redis
      .set(key, JSON.stringify(intent), "EX", INTENT_CACHE_SECONDS)
      .catch(() => undefined);
    return { intent, lane: "smart", blocked: false, instant };
```
`validateIntent` returns an `IntentDto`. If its declared return type allows `null`, keep the original `validated` null check and treat null as unhelpful. Search the file for its signature first.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/search`
Expected: PASS. Fix any other `new IntentService(` call sites the same way (`grep -rn "new IntentService(" apps/api/src`).

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/search
git commit -m "feat(api): global model-call budget that falls back to lane 1, and a negative intent cache"
```

---

### Task 7: Stable intent-cache key and live kind list

**Files:**
- Modify: `apps/api/src/search/instant.service.ts` (`World.kindsVersion` and `World.index`)
- Modify: `apps/api/src/search/intent.service.ts` (key v2 from `kindsVersion`; pass `activeKinds`)
- Modify: `apps/api/src/ai/intent.ts` (`IntentRequest.activeKinds`)
- Modify: `apps/api/src/ai/anthropic-intent.provider.ts` (system prompt per kind list, memoized)
- Modify: `apps/api/src/ai/ai.module.ts` (no Prisma read at boot)
- Modify: `apps/api/src/ai/intent.test.ts` and `apps/api/src/search/intent.service.test.ts`

**Interfaces:**
- Produces:
  - `World.kindsVersion: string`: the first 12 hex characters of the sha256 of the sorted active kind slugs joined with `,`. It changes only when the active kind set changes. Place edits no longer invalidate cached intents, because cached answers are re-validated against the current world on read.
  - `World.index: InstantIndex` (used by Task 11).
  - `intentCacheKey(locale, normalized, kindsVersion)` is `darb:intent:v2:${kindsVersion}:${locale}:${sha256(normalized)}`.
  - `IntentRequest` gains `activeKinds: readonly string[]` (sorted).
  - `new AnthropicIntentProvider(client, model)` drops the third argument. The system prompt is built from `request.activeKinds` and kept byte-identical for the same list, so the prompt cache holds. Haiku 5.5's minimum cacheable prefix is 512 tokens, which the kind list exceeds.

- [ ] **Step 1: Write the failing tests**

In `apps/api/src/ai/intent.test.ts`:
- Change `new AnthropicIntentProvider(client, "claude-haiku-5-5", ["sweets", "cafes"])` to `new AnthropicIntentProvider(client, "claude-haiku-5-5")`, and add `activeKinds: ["cafes", "sweets"]` to that test's request object.
- Change the other two constructions to `new AnthropicIntentProvider(client, "m")`, and add `activeKinds: []` to their requests (search for `candidates:` to find each request literal).
- Append:
```ts
it("builds the system prompt from the request's kind list and reuses identical bytes", async () => {
  const calls: unknown[] = [];
  const client = {
    messages: {
      create: async (body: { system: unknown }) => {
        calls.push(body.system);
        return { stop_reason: "end_turn", content: [] };
      },
    },
  } as unknown as ConstructorParameters<typeof AnthropicIntentProvider>[0];
  const provider = new AnthropicIntentProvider(client, "m");
  const base = { query: "q", locale: "en" as const, candidates: { kinds: [], places: [] } };
  const signal = new AbortController().signal;
  await provider.extract({ ...base, activeKinds: ["a", "b"] }, signal);
  await provider.extract({ ...base, activeKinds: ["a", "b"] }, signal);
  await provider.extract({ ...base, activeKinds: ["a", "b", "c"] }, signal);
  expect(calls[0]).toBe(calls[1]); // same array instance: memoized
  expect(JSON.stringify(calls[2])).toContain("c");
  expect(calls[2]).not.toBe(calls[1]);
});
```
In `apps/api/src/search/intent.service.test.ts`, replace `(await instant.world()).version` and `world.version` with `.kindsVersion` throughout. Replace the test that expects the version to change after a change (around line 187) with:
```ts
  it("keeps the cache key when places change and moves it when active kinds change", async () => {
    const before = (await instant.world()).kindsVersion;
    await prisma.place.updateMany({ where: { slug: "tamra" }, data: { aliases: ["Tamra2"] } });
    instant.invalidate();
    expect((await instant.world()).kindsVersion).toBe(before);
    await prisma.kind.updateMany({ where: { slug: "barbershops" }, data: { status: "hidden" } });
    instant.invalidate();
    expect((await instant.world()).kindsVersion).not.toBe(before);
    await prisma.kind.updateMany({ where: { slug: "barbershops" }, data: { status: "active" } });
    instant.invalidate();
  });
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/ai/intent.test.ts src/search/intent.service.test.ts`
Expected: FAIL with type errors (`activeKinds` and `kindsVersion` are unknown).

- [ ] **Step 3: Implement**

`apps/api/src/ai/intent.ts`: add the field `activeKinds: readonly string[];` to `IntentRequest`, with the doc comment `/** Sorted active kind slugs; the system prompt lists them (refreshed without a restart). */`.

`apps/api/src/ai/anthropic-intent.provider.ts`: replace the class body's fields, constructor and the `system:` line:
```ts
export class AnthropicIntentProvider implements IntentProvider {
  readonly name = "anthropic";
  /** One entry: the same kind list reuses the same bytes, so the cached prefix holds. */
  private memo: { key: string; system: Anthropic.TextBlockParam[] } | null = null;

  constructor(
    private readonly client: Pick<Anthropic, "messages">,
    private readonly model: string,
  ) {}

  private system(kinds: readonly string[]): Anthropic.TextBlockParam[] {
    const key = kinds.join(",");
    if (this.memo?.key !== key)
      this.memo = {
        key,
        system: [{ type: "text", text: systemPrompt(kinds), cache_control: { type: "ephemeral" } }],
      };
    return this.memo.system;
  }
```
In `extract`, change `system: this.system,` to `system: this.system(request.activeKinds),`. Leave every other parameter as it is.

`apps/api/src/ai/ai.module.ts`: in `intentProviderFor`, delete the `prisma.kind.findMany` call and construct `new AnthropicIntentProvider(client, search.intentModel)`. Remove the `PrismaService` parameter and import, and change `inject: [APP_CONFIG, PrismaService]` to `inject: [APP_CONFIG]`. Update the function's signature to `export async function intentProviderFor(config: AppConfig): Promise<IntentProvider>`. Search for other callers: `grep -rn intentProviderFor apps/api` (the offline-providers test and `scripts/record-intents.ts`). Drop their prisma argument.

`apps/api/src/search/instant.service.ts`:
- Import `type InstantIndex` from `@darb/search-text`.
- Replace the `World` interface's `version` doc and field with:
```ts
  /** Changes only when the set of active kinds changes; part of the intent cache key. */
  kindsVersion: string;
  /** The lane-1 index this world was built from (served to browsers by GET /search/instant-index). */
  index: InstantIndex;
```
- In `build()`, replace the `version` computation with:
```ts
    const activeSlugs = kinds.filter((k) => k.status === "active").map((k) => k.slug).sort();
    const kindsVersion = createHash("sha256").update(activeSlugs.join(",")).digest("hex").slice(0, 12);
```
- Return `kindsVersion, index,` in place of `version,`.

`apps/api/src/search/intent.service.ts`:
- Replace `intentCacheKey` with:
```ts
/** Keyed by the active kind set only: a cached answer is re-validated against the world on read. */
export const intentCacheKey = (locale: Locale, normalized: string, kindsVersion: string) =>
  `darb:intent:v2:${kindsVersion}:${locale}:${createHash("sha256").update(normalized).digest("hex")}`;
```
- Use `world.kindsVersion` where `world.version` was.
- In `callModel`, get the world and pass the kinds. Change the signature to `callModel(q, locale, instant, activeKinds: readonly string[])`, and the call in `resolve` to `this.callModel(q, locale, instant, [...world.kinds.keys()].sort())`. In the provider request object, add `activeKinds`.
- Grep for other `.version` users of `World` (`grep -rn "\.version" apps/api/src/search`) and switch them to `kindsVersion`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @darb/api typecheck && pnpm --filter @darb/api exec vitest run src/ai src/search`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/ai apps/api/src/search apps/api/scripts
git commit -m "feat(api): intent cache keyed by active kinds; the model sees the live kind list without a restart"
```

---

### Task 8: Non-blocking search events and cross-replica instant invalidation

**Files:**
- Create: `apps/api/src/search/instant-invalidation.ts`
- Test: `apps/api/src/search/instant-invalidation.test.ts`
- Modify: `apps/api/src/search/index-queue.ts` (`SearchEvents` uses invalidation; adds `notify`)
- Modify: `apps/api/src/search/search-index.module.ts`
- Modify: `apps/api/src/search/index-queue.test.ts` (three manual constructions)

**Interfaces:**
- Produces:
  - `class InstantInvalidation { publish(): void }`. It invalidates this process's `InstantService` at once and publishes on the Redis channel `darb:instant:<db name>`. Every replica subscribed to that channel invalidates too. A Redis failure only logs.
  - `SearchEvents` constructor becomes `(config: AppConfig, invalidation: Pick<InstantInvalidation, "publish">)`, with `@Inject(InstantInvalidation)` on the second parameter.
  - `SearchEvents.notify(entity: SearchEntityName, ids: string[]): void`. This is fire-and-forget: it never throws, and it hands off in a few milliseconds even with Redis down. Jobs queue inside BullMQ's offline buffer until Redis returns, and an error is logged after `NOTIFY_TIMEOUT_MS = 3000`. Admin writes (Task 14) call this. `changed()` stays as it is for callers that need the jobs (tests and scripts).

- [ ] **Step 1: Write the failing tests**

`apps/api/src/search/instant-invalidation.test.ts`:
```ts
import "reflect-metadata";
import { afterAll, expect, it, vi } from "vitest";
import { testDatabaseUrl } from "../../test/db.js";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";
import { SearchEvents } from "./index-queue.js";
import { InstantInvalidation } from "./instant-invalidation.js";
import type { InstantService } from "./instant.service.js";

testDatabaseUrl();
const config = loadConfig(process.env);
const fakeInstant = () => ({ invalidate: vi.fn() }) as unknown as InstantService & { invalidate: ReturnType<typeof vi.fn> };
const opened: InstantInvalidation[] = [];
afterAll(async () => {
  for (const o of opened) await o.onModuleDestroy();
});

it("invalidates every replica through Redis", async () => {
  const [ra, rb] = [await createRedis(config.search.redisUrl), await createRedis(config.search.redisUrl)];
  const [ia, ib] = [fakeInstant(), fakeInstant()];
  const a = new InstantInvalidation(ra, config, ia);
  const b = new InstantInvalidation(rb, config, ib);
  opened.push(a, b);
  await a.onModuleInit();
  await b.onModuleInit();
  a.publish();
  expect(ia.invalidate).toHaveBeenCalled();
  await vi.waitFor(() => expect(ib.invalidate).toHaveBeenCalled(), { timeout: 2000 });
});

it("notify hands off at once even when Redis is unreachable", async () => {
  const down = { ...config, search: { ...config.search, redisUrl: "redis://127.0.0.1:1" } };
  const publish = vi.fn();
  const events = new SearchEvents(down, { publish });
  const started = performance.now();
  events.notify("kind", ["00000000-0000-7000-8000-000000000000"]);
  expect(performance.now() - started).toBeLessThan(50);
  expect(publish).toHaveBeenCalled();
  await events.onModuleDestroy();
});
```
In `apps/api/src/search/index-queue.test.ts`:
- replace the three occurrences of `new SearchEvents(config, new InstantService(prisma))` with `new SearchEvents(config, { publish: () => undefined })`;
- add `RedisModule` (`import { RedisModule } from "../redis/redis.module.js";`) to the `imports` of its `Test.createTestingModule`. `InstantInvalidation` now needs the `REDIS` provider, which `AppModule` supplies but this hand-built module does not.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/search/instant-invalidation.test.ts`
Expected: FAIL. The module is missing.

- [ ] **Step 3: Implement the invalidation**

`apps/api/src/search/instant-invalidation.ts`:
```ts
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import type { Redis } from "ioredis";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { REDIS } from "../redis/redis.module.js";
import { InstantService } from "./instant.service.js";

/** One channel per database, so test and dev databases never invalidate each other. */
export const instantChannel = (databaseUrl: string) =>
  `darb:instant:${new URL(databaseUrl).pathname.replace(/^\//, "") || "default"}`;

/** Keeps every API replica's lane-1 index in step after a place or kind changes. */
@Injectable()
export class InstantInvalidation implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(InstantInvalidation.name);
  private sub: Redis | null = null;
  private readonly channel: string;

  constructor(
    @Inject(REDIS) private readonly redis: Redis,
    @Inject(APP_CONFIG) config: AppConfig,
    private readonly instant: InstantService,
  ) {
    this.channel = instantChannel(config.databaseUrl);
  }

  async onModuleInit(): Promise<void> {
    const sub = this.redis.duplicate({ lazyConnect: true, enableOfflineQueue: true, commandTimeout: undefined });
    sub.on("error", () => undefined);
    sub.on("message", (channel: string) => {
      if (channel === this.channel) this.instant.invalidate();
    });
    this.sub = sub;
    // Without Redis this replica still invalidates itself; others refresh within the 10 min TTL.
    await sub
      .connect()
      .then(() => sub.subscribe(this.channel))
      .catch(() => this.logger.warn("Instant index invalidation is local only (Redis unavailable)"));
  }

  publish(): void {
    this.instant.invalidate();
    void this.redis.publish(this.channel, "1").catch(() => undefined);
  }

  async onModuleDestroy(): Promise<void> {
    await this.sub?.quit().catch(() => this.sub?.disconnect());
  }
}
```

- [ ] **Step 4: Wire it into SearchEvents**

In `apps/api/src/search/index-queue.ts`:
- Import `InstantInvalidation` from `./instant-invalidation.js`.
- Add `export const NOTIFY_TIMEOUT_MS = 3000;`.
- Change the `SearchEvents` constructor to:
```ts
  constructor(
    @Inject(APP_CONFIG) private readonly config: AppConfig,
    @Inject(InstantInvalidation) private readonly invalidation: Pick<InstantInvalidation, "publish">,
  ) {}
```
- In `changed()`, replace `if (feedsInstant(entity)) this.instant.invalidate();` with `if (feedsInstant(entity)) this.invalidation.publish();`.
- Add this method after `changed`:
```ts
  /**
   * For admin writes: hands the change to the queue and returns at once. It never throws; a Redis
   * outage keeps the job in BullMQ's offline buffer and is logged after NOTIFY_TIMEOUT_MS (a full
   * reindex job recovers anything lost with the process).
   */
  notify(entity: SearchEntityName, ids: string[]): void {
    let timer: NodeJS.Timeout | undefined;
    const late = new Promise<"late">((resolve) => {
      timer = setTimeout(() => resolve("late"), NOTIFY_TIMEOUT_MS);
      timer.unref();
    });
    void Promise.race([this.changed(entity, ids), late])
      .then((out) => {
        if (out === "late")
          this.logger.warn(`Search index change for ${ids.length} ${entity}(s) is waiting for Redis`);
      })
      .catch((err: Error) => this.logger.error(`Search index notify: ${describeError(err)}`))
      .finally(() => clearTimeout(timer));
  }
```
- In `SearchIndexWorker`, keep `this.instant.invalidate()`. The worker's own process invalidates locally, and the change's origin has already published.

In `apps/api/src/search/search-index.module.ts`, add `InstantInvalidation` to `providers` and `exports`.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/search/instant-invalidation.test.ts src/search/index-queue.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/search
git commit -m "feat(api): fire-and-forget search notify and cross-replica instant index invalidation"
```

---

### Task 9: Embedding content hash and Voyage backoff

**Files:**
- Modify: `apps/api/src/search/indexer.service.ts` (`write()`)
- Test: `apps/api/src/search/indexer.service.test.ts` (append)
- Modify: `apps/api/src/ai/voyage-embedding.provider.ts`
- Test: `apps/api/src/ai/embeddings.test.ts` (append)

**Interfaces:**
- Consumes: `SearchDocument.embedHash` (Task 2).
- Produces:
  - `embedHash = sha256(`${provider.name}\n${embedText}`).slice(0, 32)`. `write()` embeds only rows whose stored hash differs or whose embedding is null. Unchanged rows keep their stored vector.
  - `new VoyageEmbeddingProvider(apiKey, name, fetchImpl?, sleep?)`. Document embeddings retry a 429 or 5xx up to 4 times. The wait is `Retry-After` seconds (capped at 60 s), or otherwise 1 s, 2 s, 4 s, 8 s. Query embeddings (`purpose === "query"`) never retry, because they have an 800 ms deadline.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/search/indexer.service.test.ts`:
```ts
import { HashEmbeddingProvider } from "../ai/hash-embedding.provider.js";
import type { EmbeddingProvider } from "../ai/embeddings.js";

class CountingProvider implements EmbeddingProvider {
  readonly name = "hash";
  texts = 0;
  private readonly inner = new HashEmbeddingProvider();
  async embed(texts: string[], purpose: "document" | "query") {
    this.texts += texts.length;
    return this.inner.embed(texts, purpose);
  }
}

it("embeds only rows whose text changed", async () => {
  const counting = new CountingProvider();
  const indexer = new SearchIndexer(prisma, counting);
  await indexer.indexAll();
  const first = counting.texts;
  expect(first).toBeGreaterThan(0);
  counting.texts = 0;
  await indexer.indexAll();
  expect(counting.texts).toBe(0);
  const b = await prisma.business.findFirstOrThrow({ where: { slug: "abu-salim" } });
  await prisma.business.update({ where: { id: b.id }, data: { name: { ar: "أبو سليم الجديد" } } });
  await indexer.index("business", [b.id]);
  expect(counting.texts).toBe(1);
  const [doc] = await prisma.$queryRaw<{ has: boolean }[]>`
    SELECT embedding IS NOT NULL AS has FROM "SearchDocument" WHERE "entityId" = ${b.id}::uuid`;
  expect(doc?.has).toBe(true);
});
```
(Put the imports at the top of the file with the others. If the file's `beforeEach` does not reset and re-seed, add `await resetDatabase(prisma); await seedFixtures(prisma);` at the start of this test.)

Append to `apps/api/src/ai/embeddings.test.ts`:
```ts
import { VoyageEmbeddingProvider } from "./voyage-embedding.provider.js";

const ok = (n: number) =>
  new Response(
    JSON.stringify({ data: Array.from({ length: n }, (_, index) => ({ index, embedding: Array(512).fill(0.1) })) }),
    { status: 200, headers: { "content-type": "application/json" } },
  );

it("backs off on 429 for documents, honouring Retry-After", async () => {
  const sleeps: number[] = [];
  const responses = [new Response("", { status: 429, headers: { "retry-after": "2" } }), new Response("", { status: 503 }), ok(1)];
  const fetchImpl = (async () => responses.shift()!) as typeof fetch;
  const voyage = new VoyageEmbeddingProvider("k", "voyage-4-lite", fetchImpl, async (ms) => {
    sleeps.push(ms);
  });
  const out = await voyage.embed(["a"], "document");
  expect(out).toHaveLength(1);
  expect(sleeps).toEqual([2000, 2000]);
});

it("never retries a query embedding", async () => {
  let calls = 0;
  const fetchImpl = (async () => {
    calls += 1;
    return new Response("", { status: 429 });
  }) as typeof fetch;
  const voyage = new VoyageEmbeddingProvider("k", "m", fetchImpl, async () => undefined);
  await expect(voyage.embed(["a"], "query")).rejects.toThrow(/429/);
  expect(calls).toBe(1);
});

it("gives up after four retries", async () => {
  const fetchImpl = (async () => new Response("", { status: 429 })) as typeof fetch;
  const sleeps: number[] = [];
  const voyage = new VoyageEmbeddingProvider("k", "m", fetchImpl, async (ms) => {
    sleeps.push(ms);
  });
  await expect(voyage.embed(["a"], "document")).rejects.toThrow(/429/);
  expect(sleeps).toEqual([1000, 2000, 4000, 8000]);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/search/indexer.service.test.ts src/ai/embeddings.test.ts`
Expected: FAIL. The second `indexAll` re-embeds, and Voyage throws on the first 429.

- [ ] **Step 3: Implement the content hash**

In `apps/api/src/search/indexer.service.ts`, add `import { createHash } from "node:crypto";` and replace `write()` with:
```ts
  private async write(rows: DocumentRow[]): Promise<void> {
    for (let start = 0; start < rows.length; start += EMBED_BATCH) {
      const batch = rows.slice(start, start + EMBED_BATCH);
      const hashes = batch.map((r) =>
        createHash("sha256").update(`${this.embeddings.name}\n${r.embedText}`).digest("hex").slice(0, 32),
      );
      const stored = new Map(
        (
          await this.prisma.$queryRaw<{ entityId: string; embedHash: string | null }[]>`
            SELECT "entityId", "embedHash" FROM "SearchDocument"
            WHERE "entityType" = ${batch[0]!.entityType}::"SearchEntity"
              AND "entityId" = ANY(${batch.map((r) => r.entityId)}::uuid[])
              AND embedding IS NOT NULL`
        ).map((s) => [s.entityId, s.embedHash]),
      );
      const changed = batch.flatMap((r, i) => (stored.get(r.entityId) === hashes[i] ? [] : [i]));
      const fresh = await this.embeddings.embed(
        changed.map((i) => batch[i]!.embedText),
        "document",
      );
      const vectors = new Map(changed.map((i, n) => [i, fresh[n]]));
      const values = batch.map(
        (r, i) => Prisma.sql`(
        gen_random_uuid(), ${r.entityType}::"SearchEntity", ${r.entityId}::uuid, ${r.slug}, ${r.placePath},
        ${r.kindIds}::uuid[], ${JSON.stringify(r.attributes)}::jsonb, ${r.tier}::"Tier", ${r.lat}, ${r.lng},
        ${r.nameText}, ${r.text}, ${storedVector(vectors.get(i))}::vector, ${hashes[i]}, ${r.completeness}, now())`,
      );
      // An unchanged hash keeps the stored vector (no re-embedding); a changed one takes the new one.
      await this.prisma.$executeRaw`
        INSERT INTO "SearchDocument" ("id", "entityType", "entityId", "slug", "placePath", "kindIds",
          "attributes", "tier", "lat", "lng", "nameText", "text", "embedding", "embedHash", "completeness", "updatedAt")
        VALUES ${Prisma.join(values)}
        ON CONFLICT ("entityType", "entityId") DO UPDATE SET
          "slug" = EXCLUDED."slug", "placePath" = EXCLUDED."placePath", "kindIds" = EXCLUDED."kindIds",
          "attributes" = EXCLUDED."attributes", "tier" = EXCLUDED."tier", "lat" = EXCLUDED."lat",
          "lng" = EXCLUDED."lng", "nameText" = EXCLUDED."nameText", "text" = EXCLUDED."text",
          "embedding" = CASE
            WHEN "SearchDocument"."embedHash" = EXCLUDED."embedHash" AND "SearchDocument"."embedding" IS NOT NULL
            THEN "SearchDocument"."embedding" ELSE EXCLUDED."embedding" END,
          "embedHash" = EXCLUDED."embedHash",
          "completeness" = EXCLUDED."completeness", "updatedAt" = EXCLUDED."updatedAt"`;
    }
  }
```
A row whose vector is all zeros (see `storedVector`) stores NULL. Its hash still lands, but the `embedding IS NOT NULL` filter re-embeds it next time. That is intended and cheap.

- [ ] **Step 4: Implement the backoff**

Replace the class in `apps/api/src/ai/voyage-embedding.provider.ts` with:
```ts
const RETRIES = 4;
const retryable = (status: number) => status === 429 || status >= 500;

/** Voyage AI over plain fetch: no SDK to pin, and tests fake fetch and sleep. */
export class VoyageEmbeddingProvider implements EmbeddingProvider {
  constructor(
    private readonly apiKey: string,
    readonly name: string,
    private readonly fetchImpl: typeof fetch = fetch,
    private readonly sleep: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async embed(texts: string[], purpose: EmbedPurpose, signal?: AbortSignal): Promise<number[][]> {
    if (texts.length === 0) return [];
    for (let attempt = 0; ; attempt++) {
      const res = await this.fetchImpl(URL_EMBEDDINGS, {
        method: "POST",
        headers: { authorization: `Bearer ${this.apiKey}`, "content-type": "application/json" },
        body: JSON.stringify({
          input: texts,
          model: this.name,
          input_type: purpose,
          output_dimension: EMBEDDING_DIMENSIONS,
        }),
        signal: AbortSignal.any([AbortSignal.timeout(TIMEOUT_MS), ...(signal ? [signal] : [])]),
      });
      // A query has an 800 ms deadline: it fails fast and search ranks without the vector.
      if (!res.ok && retryable(res.status) && purpose === "document" && attempt < RETRIES) {
        const after = Number(res.headers.get("retry-after"));
        await this.sleep(after > 0 ? Math.min(after * 1000, 60_000) : 1000 * 2 ** attempt);
        continue;
      }
      if (!res.ok) throw new Error(`Voyage embeddings failed: ${res.status}`);
      const body = (await res.json()) as { data: { index: number; embedding: number[] }[] };
      const out = [...body.data].sort((a, b) => a.index - b.index).map((d) => d.embedding);
      if (out.length !== texts.length || out.some((v) => v.length !== EMBEDDING_DIMENSIONS))
        throw new Error(
          `Voyage returned the wrong count or dimensions (want ${EMBEDDING_DIMENSIONS})`,
        );
      return out;
    }
  }
}
```
Keep the existing `URL_EMBEDDINGS` and `TIMEOUT_MS` constants and the import line at the top.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/search src/ai`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/search/indexer.service.ts apps/api/src/search/indexer.service.test.ts apps/api/src/ai
git commit -m "feat(api): skip re-embedding unchanged documents and back off on Voyage 429s"
```

---

### Task 10: Search-log retention and seeding without embeddings

**Files:**
- Create: `apps/api/src/search/retention.ts`
- Test: `apps/api/src/search/retention.test.ts`
- Modify: `apps/api/src/search/search.module.ts`
- Modify: `apps/api/src/seed/run.ts` (`--no-index`)
- Modify: `README.md`

**Interfaces:**
- Produces:
  - `class SearchLogRetention { purge(now?: Date): Promise<number> }`. It deletes `SearchQuery` rows older than `logRetentionDays` and returns the count. When `config.search.indexWorker` is true, it runs once 60 s after boot and then every 24 h. The delete is idempotent, so several replicas running it is harmless.
  - `pnpm --filter @darb/api db:seed -- --no-index` loads data without indexing. Deploy pipelines then run `search:reindex`, which with the content hash embeds only what changed.

- [ ] **Step 1: Write the failing test**

`apps/api/src/search/retention.test.ts`:
```ts
import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { loadConfig } from "../config.js";
import { SearchLogRetention } from "./retention.js";

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

it("deletes search log rows older than the retention window", async () => {
  const now = new Date("2026-10-13T00:00:00Z");
  const day = 86_400_000;
  const row = (age: number) => ({
    normalized: `q${age}`,
    locale: "en",
    intent: {},
    unmatched: [],
    lane: "instant" as const,
    resultCount: 0,
    createdAt: new Date(now.getTime() - age * day),
  });
  await prisma.searchQuery.createMany({ data: [row(1), row(89), row(91), row(400)] });
  const retention = new SearchLogRetention(prisma, loadConfig({ ...process.env, SEARCH_INDEX_WORKER: "false" }));
  expect(await retention.purge(now)).toBe(2);
  expect((await prisma.searchQuery.findMany()).map((r) => r.normalized).sort()).toEqual(["q1", "q89"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @darb/api exec vitest run src/search/retention.test.ts`
Expected: FAIL. The module is missing.

- [ ] **Step 3: Implement**

`apps/api/src/search/retention.ts`:
```ts
import { Inject, Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";

const DAY_MS = 86_400_000;

/** Spec §4.7 search log, kept about 90 days (SEARCH_LOG_RETENTION_DAYS) and then deleted. */
@Injectable()
export class SearchLogRetention implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchLogRetention.name);
  private timers: NodeJS.Timeout[] = [];

  constructor(
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  onModuleInit(): void {
    if (!this.config.search.indexWorker) return;
    const run = () =>
      void this.purge()
        .then((n) => n > 0 && this.logger.log(`Deleted ${n} search log rows past retention`))
        .catch(() => this.logger.warn("Search log retention run failed; next run in 24 h"));
    const first = setTimeout(run, 60_000);
    const daily = setInterval(run, DAY_MS);
    first.unref();
    daily.unref();
    this.timers = [first, daily];
  }

  async purge(now: Date = new Date()): Promise<number> {
    const before = new Date(now.getTime() - this.config.search.logRetentionDays * DAY_MS);
    const { count } = await this.prisma.searchQuery.deleteMany({ where: { createdAt: { lt: before } } });
    return count;
  }

  onModuleDestroy(): void {
    for (const t of this.timers) clearTimeout(t);
  }
}
```
Add `SearchLogRetention` to `providers` in `apps/api/src/search/search.module.ts`.

In `apps/api/src/seed/run.ts`, replace everything from the `// Decision 8` comment to the end with:
```ts
// Decision 8: the seed indexes directly (not through the queue), in batches of 128 embeddings.
// Deploy pipelines pass --no-index and run search:reindex as its own job (Plan 4, Task 29).
if (process.argv.includes("--no-index")) {
  await prisma.$disconnect();
  console.log("Skipped indexing (--no-index); run `pnpm --filter @darb/api search:reindex` next");
} else {
  const embeddings = embeddingProviderFor(config.search);
  const indexed = await new SearchIndexer(prisma, embeddings).indexAll();
  await prisma.$disconnect();
  console.log(
    `Indexed ${JSON.stringify(indexed)} with ${embeddings.name} in ${((Date.now() - started) / 1000).toFixed(1)}s`,
  );
}
```
In `README.md` `## Search`, add one line: ``Search log rows are deleted after `SEARCH_LOG_RETENTION_DAYS` (default 90). `db:seed -- --no-index` loads data without embeddings; `search:reindex` then embeds only changed rows.``

- [ ] **Step 4: Run the test and a smoke run**

Run: `pnpm --filter @darb/api exec vitest run src/search/retention.test.ts && pnpm --filter @darb/api db:seed -- --no-index`
Expected: the test PASSES, and the seed prints `Seeded {...}` followed by `Skipped indexing (--no-index)…`.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/search/retention.ts apps/api/src/search/retention.test.ts apps/api/src/search/search.module.ts apps/api/src/seed/run.ts README.md
git commit -m "feat(api): delete search log rows after 90 days; seed without embeddings for deploys"
```

---

### Task 11: Runtime instant index

**Files:**
- Modify: `packages/contracts/src/search.ts` (`InstantIndexSchema`)
- Modify: `packages/contracts/src/contract.ts` (`search.instantIndex`)
- Modify: `apps/api/src/search/search.controller.ts`
- Test: `apps/api/src/search/search.controller.test.ts` (append)
- Create: `apps/web/src/app/api/search/instant/route.ts`
- Test: `apps/web/src/app/api/search/instant/route.test.ts`
- Modify: `apps/web/src/lib/api.ts` (`getInstantIndex`)
- Modify: `apps/web/src/search/engine.ts` (`loadPrepared(urls)` and `INDEX_URLS`)
- Modify: `apps/web/src/search/SearchPopup.tsx`, `apps/web/src/components/SearchFallback.tsx`
- Test: `apps/web/src/search/engine.test.ts` (append)

**Interfaces:**
- Produces:
  - API `GET /search/instant-index` returns `{ v: 1, places, kinds }` (the server's `World.index`), with `cache-control: public, max-age=60`.
  - Web `GET /api/search/instant` returns the same JSON, fetched with tags `taxonomy` and `places` (revalidated by admin writes) and served with `cache-control: public, s-maxage=300, stale-while-revalidate=86400`. When the API is down it answers 307 to the build-time file `NEXT_PUBLIC_SEARCH_INDEX_URL`.
  - `INDEX_URLS: readonly string[]` is `["/api/search/instant", <build-time file>]`. `loadPrepared(urls)` tries each URL in turn, memoizes on success, and forgets on total failure.

- [ ] **Step 1: Write the failing tests**

Append to `apps/api/src/search/search.controller.test.ts` (it already builds an app with fixtures):
```ts
describe("GET /search/instant-index", () => {
  it("serves the live lane-1 index, including a place added after boot", async () => {
    const res = await request(app.getHttpServer()).get("/search/instant-index");
    expect(res.status).toBe(200);
    expect(res.body.v).toBe(1);
    expect(res.body.places.some((p: { s: string }) => p.s === "sakhnin")).toBe(true);
    expect(res.headers["cache-control"]).toBe("public, max-age=60");
  });
});
```
(If the instant entry's slug key is not `s`, read `packages/search-text/src/instant-index.ts` `InstantEntry` and use its slug field. `intent.service.ts` reads `entry.s`, so `s` is expected.)

`apps/web/src/app/api/search/instant/route.test.ts`:
```ts
// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const getInstantIndex = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getInstantIndex,
}));
const { GET } = await import("./route");
const { ApiUnavailableError } = await import("@/lib/api");

afterEach(() => {
  getInstantIndex.mockReset();
  vi.unstubAllEnvs();
});

it("serves the API's index with an edge cache header", async () => {
  getInstantIndex.mockResolvedValue({ v: 1, places: [], kinds: [] });
  const res = await GET(new Request("http://web.test/api/search/instant"));
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("public, s-maxage=300, stale-while-revalidate=86400");
  expect(await res.json()).toEqual({ v: 1, places: [], kinds: [] });
});

it("redirects to the build-time index when the API is down", async () => {
  vi.stubEnv("NEXT_PUBLIC_SEARCH_INDEX_URL", "/search-index/instant.abc.json");
  getInstantIndex.mockRejectedValue(new ApiUnavailableError(new Error("down")));
  const res = await GET(new Request("http://web.test/api/search/instant"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("http://web.test/search-index/instant.abc.json");
});
```
Append to `apps/web/src/search/engine.test.ts`:
```ts
it("falls back to the next index URL", async () => {
  const { loadPrepared, resetPreparedForTests } = await import("./engine");
  resetPreparedForTests();
  const fetchMock = vi.fn(async (url: string) =>
    url === "/a" ? new Response("", { status: 503 }) : Response.json({ v: 1, places: [], kinds: [] }),
  );
  vi.stubGlobal("fetch", fetchMock);
  await expect(loadPrepared(["/a", "/b"])).resolves.toBeDefined();
  expect(fetchMock.mock.calls.map((c) => c[0])).toEqual(["/a", "/b"]);
  vi.unstubAllGlobals();
});
```
(Import `vi` at the top of the file if it is not already imported.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/search/search.controller.test.ts && pnpm --filter @darb/web exec vitest run src/app/api/search/instant src/search/engine.test.ts`
Expected: FAIL. There are 404s and missing exports.

- [ ] **Step 3: Contract and API**

In `packages/contracts/src/search.ts`, append:
```ts
/** The lane-1 index (packages/search-text InstantIndex); entries are checked by the matcher. */
export const InstantIndexSchema = z
  .object({ v: z.literal(1), places: z.array(z.unknown()), kinds: z.array(z.unknown()) })
  .passthrough();
export type InstantIndexDto = z.infer<typeof InstantIndexSchema>;
```
In `contract.ts`, import `InstantIndexSchema` and add this inside `search: { … }`:
```ts
    /** The live instant index (admin-added places and kinds appear without a web build). */
    instantIndex: {
      method: "GET",
      path: "/search/instant-index",
      responses: { 200: InstantIndexSchema },
    },
```
In `apps/api/src/search/search.controller.ts`:
- Inject `InstantService` (it is exported from `SearchIndexModule`, which `SearchModule` imports) as `private readonly instant: InstantService`.
- Add `@Res({ passthrough: true }) res: { setHeader(k: string, v: string): void }` to the handler parameters. Import `Res` from `@nestjs/common`.
- Add this route handler:
```ts
      instantIndex: async () => {
        res.setHeader("cache-control", "public, max-age=60");
        return { status: 200, body: (await this.instant.world()).index };
      },
```

- [ ] **Step 4: Web route and loader**

In `apps/web/src/lib/api.ts`, add `type InstantIndexDto` to the contracts import and append:
```ts
/** The live lane-1 index; refreshed when an admin write revalidates places or taxonomy. */
export async function getInstantIndex(): Promise<InstantIndexDto> {
  const res = await call(() =>
    client().search.instantIndex({
      fetchOptions: fetchOptions(cached(REVALIDATE.taxonomy, tags.taxonomy, tags.places)),
    }),
  );
  if (res.status !== 200) throw new ApiUnavailableError(res);
  return res.body;
}
```
`apps/web/src/app/api/search/instant/route.ts`:
```ts
import { ApiUnavailableError, getInstantIndex } from "@/lib/api";

const EDGE = { "cache-control": "public, s-maxage=300, stale-while-revalidate=86400" };

/** Spec §5.2 lane 1, at runtime: places and kinds added in /admin appear without a web build. */
export async function GET(request: Request): Promise<Response> {
  try {
    return Response.json(await getInstantIndex(), { headers: EDGE });
  } catch (error) {
    const fallback = process.env.NEXT_PUBLIC_SEARCH_INDEX_URL;
    if (error instanceof ApiUnavailableError && fallback)
      return Response.redirect(new URL(fallback, request.url), 307);
    throw error;
  }
}
```
In `apps/web/src/search/engine.ts`, replace `loadPrepared` with:
```ts
/** The live index first, then the one built with the app (works with the API down). */
export const INDEX_URLS: readonly string[] = [
  "/api/search/instant",
  process.env.NEXT_PUBLIC_SEARCH_INDEX_URL ?? "",
].filter((u) => u !== "");

async function fetchFirst(urls: readonly string[]): Promise<InstantIndex> {
  let last: unknown = new Error("No index URL");
  for (const url of urls) {
    try {
      const res = await fetch(url);
      if (res.ok) return (await res.json()) as InstantIndex;
      last = new Error(String(res.status));
    } catch (error) {
      last = error;
    }
  }
  throw last;
}

export function loadPrepared(urls: readonly string[] = INDEX_URLS): Promise<Prepared> {
  loading ??= fetchFirst(urls)
    .then(prepare)
    .catch((error: unknown) => {
      loading = null; // the next focus tries again
      throw error;
    });
  return loading;
}

/** Tests only: forget the memoized index. */
export function resetPreparedForTests(): void {
  loading = null;
}
```
In `SearchPopup.tsx`, delete the `INDEX_URL` constant and call `loadPrepared()`. In `SearchFallback.tsx`, call `loadPrepared()`. Update any existing test that calls `loadPrepared("…")` to pass an array instead.

- [ ] **Step 5: Run the tests and the budget**

Run: `pnpm --filter @darb/contracts build && pnpm --filter @darb/api exec vitest run src/search/search.controller.test.ts && pnpm --filter @darb/web exec vitest run src/search src/app/api/search && pnpm --filter @darb/web build && pnpm --filter @darb/web budget`
Expected: PASS, and the budget is unchanged (search group ≤ 30 KB).

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src apps/api/src/search apps/web/src/lib/api.ts apps/web/src/app/api/search/instant apps/web/src/search apps/web/src/components/SearchFallback.tsx
git commit -m "feat: runtime instant index from the API, with the build-time file as fallback"
```

---

## Part C: Auth and admin API

### Task 12: Clerk token verification and the admin guard

**Files:**
- Create: `apps/api/src/auth/token-verifier.ts`, `apps/api/src/auth/clerk-token-verifier.ts`, `apps/api/src/auth/fake-token-verifier.ts`, `apps/api/src/auth/admin.guard.ts`, `apps/api/src/auth/auth.module.ts`, `apps/api/src/auth/grant.ts`
- Test: `apps/api/src/auth/verifiers.test.ts`, `apps/api/src/auth/admin.guard.test.ts`
- Modify: `apps/api/package.json` (script `admin:grant`)
- Modify: `apps/api/vitest.config.ts` (`AUTH_VERIFIER: "fake"`, `ADMIN_EMAILS: "admin@darb.test"`)

**Interfaces:**
- Consumes: `AppConfig.auth` (Task 4).
- Produces:
```ts
// token-verifier.ts
export interface VerifiedToken { sub: string; email: string | null; emailVerified: boolean }
export interface TokenVerifier { verify(token: string): Promise<VerifiedToken> }
export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");
export class InvalidTokenError extends Error {}
export function verifierFor(auth: AuthConfig): TokenVerifier;
// fake-token-verifier.ts: tokens "fake.<sub>[.<email>[.unverified]]"
export class FakeTokenVerifier implements TokenVerifier {}
// admin.guard.ts
export interface AdminActor { userId: string; clerkUserId: string }
export interface AdminRequest { headers: Record<string, string | string[] | undefined>; admin?: AdminActor }
export class AdminGuard implements CanActivate {} // 401 without/with a bad token, 403 without isAdmin
// grant.ts
export async function grantAdmin(prisma: PrismaService, clerkUserId: string, isAdmin: boolean): Promise<void>;
```
- The CLI is `pnpm --filter @darb/api admin:grant <clerkUserId>` and `pnpm --filter @darb/api admin:grant <clerkUserId> --revoke`.
- Clerk session-token claims the API reads: `sub`, plus the custom `email` and `email_verified`. The owner adds the last two in Clerk (Task 30, step "session token").

- [ ] **Step 1: Write the failing tests**

`apps/api/src/auth/verifiers.test.ts`:
```ts
import { expect, it, vi } from "vitest";
import { ClerkTokenVerifier } from "./clerk-token-verifier.js";
import { FakeTokenVerifier } from "./fake-token-verifier.js";
import { InvalidTokenError, verifierFor } from "./token-verifier.js";

const auth = {
  verifier: "clerk" as const,
  clerkSecretKey: "sk_test_x",
  clerkJwtKey: null,
  authorizedParties: ["https://darb.co.il"],
  adminEmails: [],
};

it("verifies with Clerk's verifyToken and reads the email claims", async () => {
  const verify = vi.fn(async () => ({ sub: "user_1", email: "Founder@Darb.co.il", email_verified: true }));
  const v = new ClerkTokenVerifier(auth, verify as never);
  expect(await v.verify("t")).toEqual({ sub: "user_1", email: "founder@darb.co.il", emailVerified: true });
  expect(verify).toHaveBeenCalledWith("t", { secretKey: "sk_test_x", authorizedParties: ["https://darb.co.il"] });
});

it("prefers the networkless JWT key", async () => {
  const verify = vi.fn(async () => ({ sub: "user_1" }));
  await new ClerkTokenVerifier({ ...auth, clerkJwtKey: "PEM" }, verify as never).verify("t");
  expect(verify).toHaveBeenCalledWith("t", { jwtKey: "PEM", authorizedParties: ["https://darb.co.il"] });
});

it("turns any verification failure into InvalidTokenError", async () => {
  const v = new ClerkTokenVerifier(auth, (async () => {
    throw new Error("expired");
  }) as never);
  await expect(v.verify("t")).rejects.toBeInstanceOf(InvalidTokenError);
});

it("reads fake tokens for tests", async () => {
  const fake = new FakeTokenVerifier();
  expect(await fake.verify("fake.user_a.a@darb.test")).toEqual({ sub: "user_a", email: "a@darb.test", emailVerified: true });
  expect(await fake.verify("fake.user_b.b@darb.test.unverified")).toEqual({ sub: "user_b", email: "b@darb.test", emailVerified: false });
  expect(await fake.verify("fake.user_c")).toEqual({ sub: "user_c", email: null, emailVerified: false });
  await expect(fake.verify("real-looking.jwt.token")).rejects.toBeInstanceOf(InvalidTokenError);
});

it("picks the verifier from config; off rejects everyone", async () => {
  expect(verifierFor({ ...auth, verifier: "fake" })).toBeInstanceOf(FakeTokenVerifier);
  expect(verifierFor(auth)).toBeInstanceOf(ClerkTokenVerifier);
  await expect(verifierFor({ ...auth, verifier: "off" }).verify("x")).rejects.toBeInstanceOf(InvalidTokenError);
});
```
`apps/api/src/auth/admin.guard.test.ts`:
```ts
import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { loadConfig } from "../config.js";
import { AdminGuard, type AdminRequest } from "./admin.guard.js";
import { FakeTokenVerifier } from "./fake-token-verifier.js";
import { grantAdmin } from "./grant.js";

const prisma = testPrisma();
const config = loadConfig({ ...process.env, AUTH_VERIFIER: "fake", ADMIN_EMAILS: "admin@darb.test" });
const guard = new AdminGuard(new FakeTokenVerifier(), prisma, config);
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const ctx = (authorization?: string) => {
  const req: AdminRequest = { headers: authorization ? { authorization } : {} };
  return { req, ctx: { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext };
};

it("401s without a token or with a bad one", async () => {
  await expect(guard.canActivate(ctx().ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  await expect(guard.canActivate(ctx("Bearer nope").ctx)).rejects.toBeInstanceOf(UnauthorizedException);
});

it("403s a valid user without the admin flag, and records them as non-admin", async () => {
  await expect(guard.canActivate(ctx("Bearer fake.user_x.x@darb.test").ctx)).rejects.toBeInstanceOf(ForbiddenException);
  expect((await prisma.user.findUniqueOrThrow({ where: { clerkUserId: "user_x" } })).isAdmin).toBe(false);
});

it("grants an allowlisted, verified email at first sight", async () => {
  const { req, ctx: c } = ctx("Bearer fake.user_a.admin@darb.test");
  expect(await guard.canActivate(c)).toBe(true);
  expect(req.admin?.clerkUserId).toBe("user_a");
});

it("never grants an allowlisted email that is not verified", async () => {
  await expect(guard.canActivate(ctx("Bearer fake.user_b.admin@darb.test.unverified").ctx)).rejects.toBeInstanceOf(ForbiddenException);
});

it("does not promote an existing user later added to the allowlist; the CLI does", async () => {
  await prisma.user.create({ data: { clerkUserId: "user_c" } });
  const c = () => ctx("Bearer fake.user_c.admin@darb.test").ctx;
  await expect(guard.canActivate(c())).rejects.toBeInstanceOf(ForbiddenException);
  await grantAdmin(prisma, "user_c", true);
  expect(await guard.canActivate(c())).toBe(true);
  await grantAdmin(prisma, "user_c", false);
  await expect(guard.canActivate(c())).rejects.toBeInstanceOf(ForbiddenException);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/auth`
Expected: FAIL. The modules are missing.

- [ ] **Step 3: Implement the verifiers**

`apps/api/src/auth/token-verifier.ts`:
```ts
import type { AuthConfig } from "../config.js";
import { ClerkTokenVerifier } from "./clerk-token-verifier.js";
import { FakeTokenVerifier } from "./fake-token-verifier.js";

export interface VerifiedToken {
  sub: string;
  email: string | null;
  emailVerified: boolean;
}
export interface TokenVerifier {
  verify(token: string): Promise<VerifiedToken>;
}
export const TOKEN_VERIFIER = Symbol("TOKEN_VERIFIER");
export class InvalidTokenError extends Error {
  override name = "InvalidTokenError";
}

/** Without Clerk keys the admin API is closed: every token is refused. */
class OffVerifier implements TokenVerifier {
  async verify(): Promise<VerifiedToken> {
    throw new InvalidTokenError("Admin sign-in is not configured");
  }
}

export function verifierFor(auth: AuthConfig): TokenVerifier {
  if (auth.verifier === "fake") return new FakeTokenVerifier();
  if (auth.verifier === "clerk") return new ClerkTokenVerifier(auth);
  return new OffVerifier();
}
```
`apps/api/src/auth/clerk-token-verifier.ts`:
```ts
import { verifyToken } from "@clerk/backend";
import type { AuthConfig } from "../config.js";
import { InvalidTokenError, type TokenVerifier, type VerifiedToken } from "./token-verifier.js";

/** Clerk session JWTs (spec §6.4: Clerk is admin-only in v1). Never logs the token. */
export class ClerkTokenVerifier implements TokenVerifier {
  constructor(
    private readonly auth: AuthConfig,
    private readonly verifyImpl: typeof verifyToken = verifyToken,
  ) {}

  async verify(token: string): Promise<VerifiedToken> {
    const key = this.auth.clerkJwtKey
      ? { jwtKey: this.auth.clerkJwtKey }
      : { secretKey: this.auth.clerkSecretKey ?? "" };
    const parties = this.auth.authorizedParties.length
      ? { authorizedParties: this.auth.authorizedParties }
      : {};
    try {
      const claims = (await this.verifyImpl(token, { ...key, ...parties })) as Record<string, unknown>;
      const sub = typeof claims["sub"] === "string" ? claims["sub"] : "";
      if (!sub) throw new Error("no subject");
      const email = typeof claims["email"] === "string" ? claims["email"].toLowerCase() : null;
      return { sub, email, emailVerified: claims["email_verified"] === true };
    } catch {
      throw new InvalidTokenError("Invalid or expired session");
    }
  }
}
```
`apps/api/src/auth/fake-token-verifier.ts`:
```ts
import { InvalidTokenError, type TokenVerifier, type VerifiedToken } from "./token-verifier.js";

/**
 * Tests and local e2e only (config refuses AUTH_VERIFIER=fake in production):
 * "fake.<sub>[.<email>[.unverified]]". Emails here never contain a dot-separated "unverified".
 */
export class FakeTokenVerifier implements TokenVerifier {
  async verify(token: string): Promise<VerifiedToken> {
    const m = /^fake\.([A-Za-z0-9_]+)(?:\.(.+?))?(\.unverified)?$/.exec(token);
    if (!m) throw new InvalidTokenError("Not a fake token");
    const email = m[2] ? m[2].toLowerCase() : null;
    return { sub: m[1]!, email, emailVerified: email !== null && !m[3] };
  }
}
```

- [ ] **Step 4: Implement the guard, module and CLI**

`apps/api/src/auth/admin.guard.ts`:
```ts
import {
  ForbiddenException,
  Inject,
  Injectable,
  UnauthorizedException,
  type CanActivate,
  type ExecutionContext,
} from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TOKEN_VERIFIER, type TokenVerifier } from "./token-verifier.js";

export interface AdminActor {
  userId: string;
  clerkUserId: string;
}
export interface AdminRequest {
  headers: Record<string, string | string[] | undefined>;
  admin?: AdminActor;
}

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Spec §6.2: Clerk proves who someone is; User.isAdmin decides. ADMIN_EMAILS grants the flag only
 * when the User row is first created and only for a verified email; after that, the CLI decides.
 */
@Injectable()
export class AdminGuard implements CanActivate {
  constructor(
    @Inject(TOKEN_VERIFIER) private readonly verifier: TokenVerifier,
    private readonly prisma: PrismaService,
    @Inject(APP_CONFIG) private readonly config: AppConfig,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<AdminRequest>();
    const token = /^Bearer\s+(\S+)$/i.exec(first(req.headers["authorization"]))?.[1];
    if (!token) throw new UnauthorizedException("Sign in to continue");
    const claims = await this.verifier.verify(token).catch(() => {
      throw new UnauthorizedException("Your session has ended; sign in again");
    });
    const allowlisted =
      claims.email !== null &&
      claims.emailVerified &&
      this.config.auth.adminEmails.includes(claims.email);
    const user = await this.prisma.user.upsert({
      where: { clerkUserId: claims.sub },
      create: { clerkUserId: claims.sub, isAdmin: allowlisted },
      update: {},
    });
    if (!user.isAdmin) throw new ForbiddenException("This account is not a Darb admin");
    req.admin = { userId: user.id, clerkUserId: user.clerkUserId };
    return true;
  }
}
```
`apps/api/src/auth/auth.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { AdminGuard } from "./admin.guard.js";
import { TOKEN_VERIFIER, verifierFor } from "./token-verifier.js";

@Module({
  providers: [
    { provide: TOKEN_VERIFIER, inject: [APP_CONFIG], useFactory: (c: AppConfig) => verifierFor(c.auth) },
    AdminGuard,
  ],
  exports: [TOKEN_VERIFIER, AdminGuard],
})
export class AuthModule {}
```
`apps/api/src/auth/grant.ts`:
```ts
import "dotenv/config";
import { pathToFileURL } from "node:url";
import { loadConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";

/** Grants or revokes the admin flag for a Clerk user id (user_…). */
export async function grantAdmin(prisma: PrismaService, clerkUserId: string, isAdmin: boolean): Promise<void> {
  await prisma.user.upsert({
    where: { clerkUserId },
    create: { clerkUserId, isAdmin },
    update: { isAdmin },
  });
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  const args = process.argv.slice(2);
  const id = args.find((a) => !a.startsWith("--"));
  if (!id || !/^user_[A-Za-z0-9]+$/.test(id)) {
    console.error("Usage: pnpm --filter @darb/api admin:grant <user_…> [--revoke]");
    process.exit(1);
  }
  const prisma = new PrismaService(loadConfig(process.env));
  const revoke = args.includes("--revoke");
  await grantAdmin(prisma, id, !revoke);
  await prisma.$disconnect();
  console.log(`${revoke ? "Revoked" : "Granted"} admin for ${id}`);
}
```
In `apps/api/package.json` `scripts`, add `"admin:grant": "prisma generate && tsx src/auth/grant.ts"`.
In `apps/api/vitest.config.ts` `test.env`, add these keys with the comment `// Admin tests sign in with fake tokens (src/auth/fake-token-verifier.ts).`:
```ts
      AUTH_VERIFIER: "fake",
      ADMIN_EMAILS: "admin@darb.test",
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/auth src/config.test.ts`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src/auth apps/api/package.json apps/api/vitest.config.ts
git commit -m "feat(api): Clerk JWT verification, admin guard on User.isAdmin, admin:grant CLI"
```

---

### Task 13: Admin contracts

**Files:**
- Create: `packages/contracts/src/admin.ts`
- Modify: `packages/contracts/src/index.ts` (`export * from "./admin.js";`)
- Modify: `packages/contracts/src/contract.ts` (`admin: adminContract`)
- Test: `packages/contracts/src/admin.test.ts`

**Interfaces:**
- Produces (used by Tasks 15–17 and 23–27):
  - Schemas: `AdminPlaceSchema`, `AdminPlaceCreateSchema`, `AdminPlacePatchSchema`, `AdminSectorSchema`, `AdminSectorCreateSchema`, `AdminSectorPatchSchema`, `AdminKindSchema`, `AdminKindCreateSchema`, `AdminKindPatchSchema`, `AdminBusinessRowSchema`, `AdminBusinessSchema`, `AdminBusinessCreateSchema`, `AdminBusinessPatchSchema`, `AdminStatusSchema`, `AdminListQuerySchema`, `AdminBusinessListQuerySchema`, `AdminKindListQuerySchema`, `AuditRowSchema`, `AdminMeSchema`, `AdminErrorSchema` and `SynonymsSchema`. Each has a matching `…Dto` type.
  - `ADMIN_ENTITIES = ["place", "sector", "kind", "business"]` and `type AdminEntity`.
  - `adminContract`, a router of flat sub-routers:
    - `misc` (`me`, `audit`, `report`, `release`);
    - `places` (`list`, `get`, `create`, `update`);
    - `sectors` (`list`, `create`, `update`);
    - `kinds` (`list`, `get`, `create`, `update`);
    - `businesses` (`list`, `get`, `create`, `update`, `status`, `remove`).
  - `contract.admin` is mounted on the main contract.

- [ ] **Step 1: Write the failing test**

`packages/contracts/src/admin.test.ts`:
```ts
import { describe, expect, it } from "vitest";
import {
  AdminBusinessCreateSchema,
  AdminBusinessPatchSchema,
  AdminPlaceCreateSchema,
  AdminPlacePatchSchema,
  AdminStatusSchema,
  adminContract,
} from "./admin.js";
import { contract } from "./contract.js";

const hours = { weekly: { "0": [{ open: "09:00", close: "18:00" }] }, exceptions: [] };
const business = {
  slug: "caramel",
  placeId: "0190a000-0000-7000-8000-000000000001",
  name: { he: "קרמל" },
  tagline: { he: "מסעדה" },
  address: { he: "רחוב 1" },
  primaryKindId: "0190a000-0000-7000-8000-000000000002",
  kindIds: [],
  lat: 32.9,
  lng: 35.1,
  phone: "+972 4-123-4567",
  whatsapp: null,
  website: "https://caramel.darb.co.il",
  hours,
  attributes: { delivers: true },
  experience: { any: "thing" },
  tier: "darb",
  apps: { web: "https://caramel.darb.co.il" },
};

describe("admin schemas", () => {
  it("accepts a full business and defaults it to draft", () => {
    expect(AdminBusinessCreateSchema.parse(business).status).toBe("draft");
  });
  it("rejects non-http links, bad phones and reserved slugs", () => {
    expect(AdminBusinessCreateSchema.safeParse({ ...business, website: "javascript:alert(1)" }).success).toBe(false);
    expect(AdminBusinessCreateSchema.safeParse({ ...business, apps: { ios: "ftp://x" } }).success).toBe(false);
    expect(AdminBusinessCreateSchema.safeParse({ ...business, phone: "call me" }).success).toBe(false);
    expect(
      AdminPlaceCreateSchema.safeParse({ slug: "admin", type: "town", parentId: business.placeId, name: { en: "x" }, lat: 32.8, lng: 35.2 }).success,
    ).toBe(false);
  });
  it("keeps places inside Israel and refuses unknown patch fields", () => {
    const place = { slug: "new-town", type: "town", parentId: business.placeId, name: { en: "x" }, lat: 40, lng: 35.2 };
    expect(AdminPlaceCreateSchema.safeParse(place).success).toBe(false);
    expect(AdminPlacePatchSchema.safeParse({ slug: "renamed" }).success).toBe(false);
    expect(AdminPlacePatchSchema.safeParse({ status: "live" }).success).toBe(true);
    expect(AdminBusinessPatchSchema.safeParse({ placeId: business.placeId }).success).toBe(false);
  });
  it("status bodies take an optional immediate flag", () => {
    expect(AdminStatusSchema.parse({ status: "suspended" })).toEqual({ status: "suspended" });
  });
  it("is mounted on the main contract", () => {
    expect(contract.admin).toBe(adminContract);
    expect(contract.admin.businesses.status.path).toBe("/admin/businesses/:id/status");
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @darb/contracts exec vitest run src/admin.test.ts`
Expected: FAIL. The module is missing.

- [ ] **Step 3: Implement the schemas and router**

`packages/contracts/src/admin.ts`:
```ts
import { initContract } from "@ts-rest/core";
import { isReservedSlug, PLACE_STATUSES, PLACE_TYPES, TEMPLATES, TIERS } from "@darb/core";
import { z } from "zod";
import { HoursSchema, LocalizedSchema, SlugSchema } from "./schemas.js";
import { MissingReportSchema, ReportQuerySchema } from "./search.js";

const c = initContract();

export const ADMIN_ENTITIES = ["place", "sector", "kind", "business"] as const;
export type AdminEntity = (typeof ADMIN_ENTITIES)[number];

const id = z.string().uuid();
const stamp = z.string().nullable();
/** New slugs are permanent URLs: never a route the web app owns. */
const NewSlugSchema = SlugSchema.refine((s) => !isReservedSlug(s), { message: "This slug is reserved" });
const httpUrl = z
  .string()
  .trim()
  .url()
  .max(500)
  .refine((u) => /^https?:\/\//i.test(u), { message: "Links must start with http:// or https://" });
const phone = z
  .string()
  .trim()
  .regex(/^\+?[0-9][0-9 ()-]{5,19}$/, { message: "Use digits, spaces, dashes and an optional +" });
const accent = z.string().regex(/^#[0-9a-f]{6}$/, { message: "Use a lower-case hex colour like #d9a54c" });
/** Israel, generously: v1 has no other country (spec §13). */
const lat = z.number().min(29).max(33.6);
const lng = z.number().min(34).max(36);

export const SynonymsSchema = z.object({
  he: z.array(z.string().trim().min(1).max(80)).max(80),
  ar: z.array(z.string().trim().min(1).max(80)).max(80),
  en: z.array(z.string().trim().min(1).max(80)).max(80),
});
export const AdminErrorSchema = z
  .object({ message: z.union([z.string(), z.array(z.string())]), errors: z.array(z.string()).optional() })
  .passthrough();
const guarded = { 401: AdminErrorSchema, 403: AdminErrorSchema } as const;
const writeErrors = { 400: AdminErrorSchema, 404: AdminErrorSchema, 409: AdminErrorSchema, ...guarded } as const;

export const AdminListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.string().max(20).optional(),
  cursor: z.string().max(200).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});
export const AdminBusinessListQuerySchema = AdminListQuerySchema.extend({
  place: SlugSchema.optional(),
  kind: SlugSchema.optional(),
});
export const AdminKindListQuerySchema = z.object({
  q: z.string().trim().max(80).optional(),
  status: z.enum(["active", "hidden"]).optional(),
  sector: id.optional(),
});
const page = <T extends z.ZodTypeAny>(item: T) =>
  z.object({ items: z.array(item), nextCursor: z.string().nullable() });

// Places
export const AdminPlaceSchema = z.object({
  id,
  slug: SlugSchema,
  type: z.enum(PLACE_TYPES),
  parentId: id.nullable(),
  path: z.string(),
  name: LocalizedSchema,
  aliases: z.array(z.string()),
  lat: z.number(),
  lng: z.number(),
  population: z.number().int().nullable(),
  cbsCode: z.string().nullable(),
  status: z.enum(PLACE_STATUSES),
  editedAt: stamp,
});
const placeFields = z.object({
  name: LocalizedSchema,
  aliases: z.array(z.string().trim().min(1).max(80)).max(50),
  lat,
  lng,
  population: z.number().int().nonnegative().nullable(),
  status: z.enum(PLACE_STATUSES),
});
export const AdminPlaceCreateSchema = placeFields.extend({
  slug: NewSlugSchema,
  type: z.enum(["region", "city", "town", "village", "neighbourhood"]),
  parentId: id,
  aliases: placeFields.shape.aliases.default([]),
  population: placeFields.shape.population.default(null),
  status: placeFields.shape.status.default("soon"),
});
export const AdminPlacePatchSchema = placeFields.partial().strict();

// Sectors
export const AdminSectorSchema = z.object({
  id,
  slug: SlugSchema,
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  accent: z.string(),
  order: z.number().int(),
  editedAt: stamp,
});
const sectorFields = z.object({
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  accent,
  order: z.number().int().min(0).max(999),
});
export const AdminSectorCreateSchema = sectorFields.extend({ slug: NewSlugSchema });
export const AdminSectorPatchSchema = sectorFields.partial().strict();

// Kinds
export const AdminKindSchema = z.object({
  id,
  slug: SlugSchema,
  sectorId: id,
  parentKindId: id.nullable(),
  name: LocalizedSchema,
  synonyms: SynonymsSchema,
  template: z.enum(TEMPLATES),
  attributes: z.array(z.string()),
  icon: z.string().nullable(),
  order: z.number().int(),
  status: z.enum(["active", "hidden"]),
  businessCount: z.number().int().nonnegative(),
  editedAt: stamp,
});
const kindFields = z.object({
  sectorId: id,
  parentKindId: id.nullable(),
  name: LocalizedSchema,
  synonyms: SynonymsSchema,
  template: z.enum(TEMPLATES),
  attributes: z.array(SlugSchema).max(20),
  icon: z.string().max(40).nullable(),
  order: z.number().int().min(0).max(9999),
  status: z.enum(["active", "hidden"]),
});
export const AdminKindCreateSchema = kindFields.extend({
  slug: NewSlugSchema,
  parentKindId: kindFields.shape.parentKindId.default(null),
  attributes: kindFields.shape.attributes.default([]),
  icon: kindFields.shape.icon.default(null),
  /** New kinds start hidden: they are reviewed before anyone can see them (spec §4.3). */
  status: kindFields.shape.status.default("hidden"),
});
export const AdminKindPatchSchema = kindFields.partial().strict();

// Businesses
const BusinessStatus = z.enum(["draft", "published", "suspended"]);
export const AdminBusinessRowSchema = z.object({
  id,
  slug: SlugSchema,
  placeId: id,
  placeSlug: SlugSchema,
  name: LocalizedSchema,
  primaryKindId: id,
  tier: z.enum(TIERS),
  status: BusinessStatus,
  source: z.enum(["seed", "self", "claimed", "admin"]),
  editedAt: stamp,
  updatedAt: z.string(),
});
const AppsSchema = z
  .object({ web: httpUrl.optional(), ios: httpUrl.optional(), android: httpUrl.optional() })
  .strict();
const businessFields = z.object({
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  address: LocalizedSchema,
  primaryKindId: id,
  kindIds: z.array(id).max(10),
  lat,
  lng,
  phone: phone.nullable(),
  whatsapp: phone.nullable(),
  website: httpUrl.nullable(),
  hours: HoursSchema,
  attributes: z.record(z.string().max(40), z.union([z.boolean(), z.string().max(200), z.number()])),
  experience: z.record(z.string(), z.unknown()),
  tier: z.enum(TIERS),
  apps: AppsSchema,
});
export const AdminBusinessSchema = AdminBusinessRowSchema.extend(businessFields.shape).extend({
  brandId: id.nullable(),
});
export const AdminBusinessCreateSchema = businessFields.extend({
  slug: NewSlugSchema,
  placeId: id,
  status: z.enum(["draft", "published"]).default("draft"),
});
export const AdminBusinessPatchSchema = businessFields.partial().strict();
export const AdminStatusSchema = z.object({ status: BusinessStatus, immediate: z.boolean().optional() });

// Audit and identity
export const AuditRowSchema = z.object({
  id,
  at: z.string(),
  actor: z.string(),
  action: z.enum(["create", "update", "status", "release", "delete"]),
  entityType: z.enum(ADMIN_ENTITIES),
  entityId: id,
  fields: z.array(z.string()),
});
export const AdminMeSchema = z.object({ clerkUserId: z.string(), userId: id });

export type AdminPlaceDto = z.infer<typeof AdminPlaceSchema>;
export type AdminPlaceCreateDto = z.infer<typeof AdminPlaceCreateSchema>;
export type AdminPlacePatchDto = z.infer<typeof AdminPlacePatchSchema>;
export type AdminSectorDto = z.infer<typeof AdminSectorSchema>;
export type AdminSectorCreateDto = z.infer<typeof AdminSectorCreateSchema>;
export type AdminSectorPatchDto = z.infer<typeof AdminSectorPatchSchema>;
export type AdminKindDto = z.infer<typeof AdminKindSchema>;
export type AdminKindCreateDto = z.infer<typeof AdminKindCreateSchema>;
export type AdminKindPatchDto = z.infer<typeof AdminKindPatchSchema>;
export type AdminBusinessRowDto = z.infer<typeof AdminBusinessRowSchema>;
export type AdminBusinessDto = z.infer<typeof AdminBusinessSchema>;
export type AdminBusinessCreateDto = z.infer<typeof AdminBusinessCreateSchema>;
export type AdminBusinessPatchDto = z.infer<typeof AdminBusinessPatchSchema>;
export type AdminStatusDto = z.infer<typeof AdminStatusSchema>;
export type AdminListQueryDto = z.infer<typeof AdminListQuerySchema>;
export type AdminBusinessListQueryDto = z.infer<typeof AdminBusinessListQuerySchema>;
export type AdminKindListQueryDto = z.infer<typeof AdminKindListQuerySchema>;
export type AuditRowDto = z.infer<typeof AuditRowSchema>;
export type AdminErrorDto = z.infer<typeof AdminErrorSchema>;

const byId = z.object({ id });
const empty = z.object({}).strict();

export const adminContract = c.router({
  misc: c.router({
    me: { method: "GET", path: "/admin/me", responses: { 200: AdminMeSchema, ...guarded } },
    audit: {
      method: "GET",
      path: "/admin/audit",
      query: z.object({ entityType: z.enum(ADMIN_ENTITIES), entityId: id }),
      responses: { 200: z.array(AuditRowSchema), ...guarded },
    },
    /** Raw visitor search terms: sensitive (Plan 3 note). Admin only, never cached, never logged. */
    report: {
      method: "GET",
      path: "/admin/report",
      query: ReportQuerySchema,
      responses: { 200: MissingReportSchema, ...guarded },
    },
    /** Clears editedAt: the next seed run overwrites the row again. */
    release: {
      method: "POST",
      path: "/admin/release/:entity/:id",
      pathParams: z.object({ entity: z.enum(ADMIN_ENTITIES), id }),
      body: empty,
      responses: { 200: z.object({ released: z.literal(true) }), ...writeErrors },
    },
  }),
  places: c.router({
    list: { method: "GET", path: "/admin/places", query: AdminListQuerySchema, responses: { 200: page(AdminPlaceSchema), ...guarded } },
    get: { method: "GET", path: "/admin/places/:id", pathParams: byId, responses: { 200: AdminPlaceSchema, 404: AdminErrorSchema, ...guarded } },
    create: { method: "POST", path: "/admin/places", body: AdminPlaceCreateSchema, responses: { 201: AdminPlaceSchema, ...writeErrors } },
    update: { method: "PATCH", path: "/admin/places/:id", pathParams: byId, body: AdminPlacePatchSchema, responses: { 200: AdminPlaceSchema, ...writeErrors } },
  }),
  sectors: c.router({
    list: { method: "GET", path: "/admin/sectors", responses: { 200: z.array(AdminSectorSchema), ...guarded } },
    create: { method: "POST", path: "/admin/sectors", body: AdminSectorCreateSchema, responses: { 201: AdminSectorSchema, ...writeErrors } },
    update: { method: "PATCH", path: "/admin/sectors/:id", pathParams: byId, body: AdminSectorPatchSchema, responses: { 200: AdminSectorSchema, ...writeErrors } },
  }),
  kinds: c.router({
    list: { method: "GET", path: "/admin/kinds", query: AdminKindListQuerySchema, responses: { 200: z.array(AdminKindSchema), ...guarded } },
    get: { method: "GET", path: "/admin/kinds/:id", pathParams: byId, responses: { 200: AdminKindSchema, 404: AdminErrorSchema, ...guarded } },
    create: { method: "POST", path: "/admin/kinds", body: AdminKindCreateSchema, responses: { 201: AdminKindSchema, ...writeErrors } },
    update: { method: "PATCH", path: "/admin/kinds/:id", pathParams: byId, body: AdminKindPatchSchema, responses: { 200: AdminKindSchema, ...writeErrors } },
  }),
  businesses: c.router({
    list: { method: "GET", path: "/admin/businesses", query: AdminBusinessListQuerySchema, responses: { 200: page(AdminBusinessRowSchema), ...guarded } },
    get: { method: "GET", path: "/admin/businesses/:id", pathParams: byId, responses: { 200: AdminBusinessSchema, 404: AdminErrorSchema, ...guarded } },
    create: { method: "POST", path: "/admin/businesses", body: AdminBusinessCreateSchema, responses: { 201: AdminBusinessSchema, ...writeErrors } },
    update: { method: "PATCH", path: "/admin/businesses/:id", pathParams: byId, body: AdminBusinessPatchSchema, responses: { 200: AdminBusinessSchema, ...writeErrors } },
    status: { method: "POST", path: "/admin/businesses/:id/status", pathParams: byId, body: AdminStatusSchema, responses: { 200: AdminBusinessSchema, ...writeErrors } },
    /** Only drafts the admin created; everything else is suspended instead. */
    remove: { method: "POST", path: "/admin/businesses/:id/delete", pathParams: byId, body: empty, responses: { 200: z.object({ deleted: z.literal(true) }), ...writeErrors } },
  }),
});
```
In `packages/contracts/src/contract.ts`, add `import { adminContract } from "./admin.js";` and the key `admin: adminContract,` as the last entry of `c.router({ … })`. In `src/index.ts`, add `export * from "./admin.js";`.

- [ ] **Step 4: Run the tests and build**

Run: `pnpm --filter @darb/contracts exec vitest run && pnpm --filter @darb/contracts build && pnpm typecheck`
Expected: PASS. Typecheck is clean, because the web and API clients gain `admin` without breaking anything.

- [ ] **Step 5: Commit**

```bash
git add packages/contracts/src
git commit -m "feat(contracts): admin schemas and router"
```

---

### Task 14: Web revalidator, audit and `AdminWriter`

**Files:**
- Create: `apps/api/src/admin/tags.ts`, `apps/api/src/admin/revalidator.ts`, `apps/api/src/admin/admin-writer.ts`, `apps/api/src/admin/outcome.ts`, `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/src/app.module.ts` (import `AdminModule`)
- Test: `apps/api/src/admin/revalidator.test.ts`, `apps/api/src/admin/admin-writer.test.ts`

**Interfaces:**
- Consumes: `SearchEvents.notify` (Task 8), `AdminActor` (Task 12), `AuditLog` (Task 2), `config.admin` (Task 4).
- Produces:
```ts
// tags.ts: the web cache tags (apps/web/src/lib/api.ts `tags`) an entity's change touches
export const webTags: {
  place(slug: string): string[];           // ["places", "place:<slug>"]
  sector(): string[];                       // ["taxonomy"]
  kind(): string[];                         // ["taxonomy", "businesses"]
  business(placeSlug: string, slug: string): string[]; // ["businesses", "business:<place>/<slug>", "place:<place>"]
};
// revalidator.ts
export class WebRevalidator {
  fetchImpl: typeof fetch;                                    // tests replace it
  revalidate(tags: string[], options?: { immediate?: boolean }): Promise<boolean>; // never rejects
}
// admin-writer.ts
export interface WriteResult<T> {
  row: T; entityId: string; fields: string[]; tags: string[];
  search?: { entity: SearchEntityName; ids: string[] }[]; immediate?: boolean;
}
export class AdminWriter {
  write<T>(actor: AdminActor, action: AuditAction, entity: AuditEntity,
           run: (tx: Prisma.TransactionClient) => Promise<WriteResult<T>>): Promise<T>;
  settled(): Promise<void>; // tests: wait for revalidation calls
}
// outcome.ts
export const notFound: (what: string) => { status: 404; body: { message: string } };
export const conflict: (message: string) => { status: 409; body: { message: string } };
export const invalid: (message: string, errors?: string[]) => { status: 400; body: { message: string; errors?: string[] } };
```
- Revalidation request: `POST config.admin.revalidateUrl` with header `x-revalidate-secret` and body `{ tags, immediate }`. It times out after 5 s and retries once after 1 s.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/admin/revalidator.test.ts`:
```ts
import { expect, it, vi } from "vitest";
import { loadConfig } from "../config.js";
import { WebRevalidator } from "./revalidator.js";

const config = loadConfig({
  DATABASE_URL: "postgresql://a/b",
  REVALIDATE_URL: "http://web.test/api/revalidate",
  REVALIDATE_SECRET: "s".repeat(32),
});

it("posts unique tags and the immediate flag with the secret", async () => {
  const r = new WebRevalidator(config);
  const fetchImpl = vi.fn(async () => new Response("{}", { status: 200 }));
  r.fetchImpl = fetchImpl as unknown as typeof fetch;
  expect(await r.revalidate(["businesses", "businesses", "place:haifa"], { immediate: true })).toBe(true);
  const [url, init] = fetchImpl.mock.calls[0] as unknown as [string, RequestInit];
  expect(url).toBe("http://web.test/api/revalidate");
  expect((init.headers as Record<string, string>)["x-revalidate-secret"]).toBe("s".repeat(32));
  expect(JSON.parse(String(init.body))).toEqual({ tags: ["businesses", "place:haifa"], immediate: true });
});

it("retries once and never rejects", async () => {
  const r = new WebRevalidator(config);
  const fetchImpl = vi.fn(async () => {
    throw new Error("down");
  });
  r.fetchImpl = fetchImpl as unknown as typeof fetch;
  r.retryDelayMs = 0;
  expect(await r.revalidate(["taxonomy"])).toBe(false);
  expect(fetchImpl).toHaveBeenCalledTimes(2);
});

it("is a no-op without a URL", async () => {
  const r = new WebRevalidator(loadConfig({ DATABASE_URL: "postgresql://a/b" }));
  expect(await r.revalidate(["taxonomy"])).toBe(false);
});
```
`apps/api/src/admin/admin-writer.test.ts`:
```ts
import { afterAll, beforeEach, expect, it, vi } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { SearchEvents } from "../search/index-queue.js";
import { AdminWriter } from "./admin-writer.js";
import type { WebRevalidator } from "./revalidator.js";

const prisma = testPrisma();
let f: Fixtures;
let actor: { userId: string; clerkUserId: string };
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  const u = await prisma.user.create({ data: { clerkUserId: "user_admin", isAdmin: true } });
  actor = { userId: u.id, clerkUserId: u.clerkUserId };
});
afterAll(() => prisma.$disconnect());

it("commits, audits, notifies search and revalidates, even when revalidation fails", async () => {
  const notify = vi.fn();
  const revalidate = vi.fn(async () => {
    throw new Error("web down");
  });
  const writer = new AdminWriter(
    prisma,
    { notify } as unknown as SearchEvents,
    { revalidate } as unknown as WebRevalidator,
  );
  const row = await writer.write(actor, "update", "business", async (tx) => {
    const b = await tx.business.update({
      where: { id: f.abuSalim.id },
      data: { name: { en: "Abu Salim" }, editedAt: new Date() },
    });
    return {
      row: b,
      entityId: b.id,
      fields: ["name"],
      tags: ["businesses"],
      search: [{ entity: "business", ids: [b.id] }],
    };
  });
  await writer.settled();
  expect(row.name).toEqual({ en: "Abu Salim" });
  expect(notify).toHaveBeenCalledWith("business", [f.abuSalim.id]);
  expect(revalidate).toHaveBeenCalledWith(["businesses"], { immediate: undefined });
  const audit = await prisma.auditLog.findMany();
  expect(audit.map((a) => [a.action, a.entityType, a.entityId, a.fields])).toEqual([
    ["update", "business", f.abuSalim.id, ["name"]],
  ]);
});

it("rolls back the change and the audit row together, and notifies nobody", async () => {
  const notify = vi.fn();
  const revalidate = vi.fn(async () => true);
  const writer = new AdminWriter(prisma, { notify } as never, { revalidate } as never);
  await expect(
    writer.write(actor, "update", "business", async (tx) => {
      await tx.business.update({ where: { id: f.abuSalim.id }, data: { name: { en: "Gone" } } });
      throw new Error("validation failed late");
    }),
  ).rejects.toThrow(/late/);
  expect((await prisma.business.findUniqueOrThrow({ where: { id: f.abuSalim.id } })).name).not.toEqual({ en: "Gone" });
  expect(await prisma.auditLog.count()).toBe(0);
  expect(notify).not.toHaveBeenCalled();
  expect(revalidate).not.toHaveBeenCalled();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/admin/revalidator.test.ts src/admin/admin-writer.test.ts`
Expected: FAIL. The modules are missing.

- [ ] **Step 3: Implement**

`apps/api/src/admin/tags.ts`:
```ts
/**
 * The web cache tags (apps/web/src/lib/api.ts `tags`) an entity's change touches. "businesses"
 * covers every list, count and detail, including a business opened under a parent place.
 */
export const webTags = {
  place: (slug: string) => ["places", `place:${slug}`],
  sector: () => ["taxonomy"],
  kind: () => ["taxonomy", "businesses"],
  business: (placeSlug: string, slug: string) => [
    "businesses",
    `business:${placeSlug}/${slug}`,
    `place:${placeSlug}`,
  ],
};
```
`apps/api/src/admin/outcome.ts`:
```ts
export const notFound = (what: string) => ({ status: 404 as const, body: { message: `No ${what}` } });
export const conflict = (message: string) => ({ status: 409 as const, body: { message } });
export const invalid = (message: string, errors?: string[]) => ({
  status: 400 as const,
  body: errors ? { message, errors } : { message },
});
```
`apps/api/src/admin/revalidator.ts`:
```ts
import { Inject, Injectable, Logger } from "@nestjs/common";
import { APP_CONFIG, type AppConfig } from "../config.js";

/** Spec §6.2: after a write, the API asks the web to refresh the affected cached pages. */
@Injectable()
export class WebRevalidator {
  private readonly logger = new Logger(WebRevalidator.name);
  private warned = false;
  fetchImpl: typeof fetch = fetch;
  retryDelayMs = 1000;

  constructor(@Inject(APP_CONFIG) private readonly config: AppConfig) {}

  async revalidate(tags: string[], options: { immediate?: boolean } = {}): Promise<boolean> {
    const { revalidateUrl: url, revalidateSecret: secret } = this.config.admin;
    if (!url || !secret) {
      if (!this.warned) this.logger.warn("REVALIDATE_URL is not set: web pages refresh on their own timer");
      this.warned = true;
      return false;
    }
    const body = JSON.stringify({ tags: [...new Set(tags)], immediate: options.immediate === true });
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        const res = await this.fetchImpl(url, {
          method: "POST",
          headers: { "content-type": "application/json", "x-revalidate-secret": secret },
          body,
          signal: AbortSignal.timeout(5000),
        });
        if (res.ok) return true;
        this.logger.warn(`Web revalidation answered ${res.status}`);
      } catch {
        this.logger.warn("Web revalidation failed");
      }
      if (attempt === 0) await new Promise((r) => setTimeout(r, this.retryDelayMs));
    }
    return false;
  }
}
```
`apps/api/src/admin/admin-writer.ts`:
```ts
import { Injectable } from "@nestjs/common";
import type { AdminActor } from "../auth/admin.guard.js";
import type { Prisma } from "../generated/prisma/client.js";
import type { AuditAction, AuditEntity } from "../generated/prisma/enums.js";
import { PrismaService } from "../prisma/prisma.service.js";
import type { SearchEntityName } from "../search/documents.js";
import { SearchEvents } from "../search/index-queue.js";
import { WebRevalidator } from "./revalidator.js";

export interface WriteResult<T> {
  row: T;
  entityId: string;
  fields: string[];
  tags: string[];
  search?: { entity: SearchEntityName; ids: string[] }[];
  /** Takedowns: the web expires the tags at once instead of serving stale while revalidating. */
  immediate?: boolean;
}

/**
 * Every admin write goes through here: the change and its audit row commit together; then search
 * reindexing and web revalidation are started without waiting (a slow Redis or web never holds
 * the admin's request).
 */
@Injectable()
export class AdminWriter {
  private readonly pending = new Set<Promise<unknown>>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly events: SearchEvents,
    private readonly revalidator: WebRevalidator,
  ) {}

  async write<T>(
    actor: AdminActor,
    action: AuditAction,
    entity: AuditEntity,
    run: (tx: Prisma.TransactionClient) => Promise<WriteResult<T>>,
  ): Promise<T> {
    const result = await this.prisma.$transaction(async (tx) => {
      const r = await run(tx);
      await tx.auditLog.create({
        data: { actorId: actor.userId, action, entityType: entity, entityId: r.entityId, fields: r.fields },
      });
      return r;
    });
    for (const s of result.search ?? []) if (s.ids.length > 0) this.events.notify(s.entity, s.ids);
    const job: Promise<unknown> = this.revalidator
      .revalidate(result.tags, { immediate: result.immediate })
      .catch(() => false)
      .finally(() => this.pending.delete(job));
    this.pending.add(job);
    return result.row;
  }

  async settled(): Promise<void> {
    await Promise.all([...this.pending]);
  }
}
```
If `../generated/prisma/enums.js` does not export the `AuditAction` and `AuditEntity` types, import them as `import type { $Enums } from "../generated/prisma/client.js"` and use `$Enums.AuditAction` and `$Enums.AuditEntity`. Check with `grep -n "AuditAction" apps/api/src/generated/prisma/enums.ts`.

`apps/api/src/admin/admin.module.ts`:
```ts
import { Module } from "@nestjs/common";
import { AuthModule } from "../auth/auth.module.js";
import { SearchIndexModule } from "../search/search-index.module.js";
import { AdminWriter } from "./admin-writer.js";
import { WebRevalidator } from "./revalidator.js";

/** Spec §6.2 Admin: guarded by Clerk and the admin flag. Tasks 15–17 add services and controllers. */
@Module({
  imports: [AuthModule, SearchIndexModule],
  providers: [AdminWriter, WebRevalidator],
  exports: [AdminWriter, WebRevalidator],
})
export class AdminModule {}
```
In `apps/api/src/app.module.ts`, import `AdminModule` and add it to `imports` after `SearchModule`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/admin && pnpm --filter @darb/api typecheck`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/src/admin apps/api/src/app.module.ts
git commit -m "feat(api): AdminWriter commits with an audit row, then notifies search and revalidates the web"
```

---

### Task 15: Admin API: places and sectors

**Files:**
- Modify: `apps/api/test/app.ts` (an optional `configure` hook)
- Create: `apps/api/test/admin.ts` (admin test app and tokens)
- Create: `apps/api/src/admin/json.ts`, `apps/api/src/admin/places.admin.ts`, `apps/api/src/admin/sectors.admin.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Test: `apps/api/src/admin/places.admin.test.ts`

**Interfaces:**
- Consumes: `contract.admin.places` and `contract.admin.sectors` (Task 13), `AdminWriter`, `webTags`, `notFound`, `conflict` and `invalid` (Task 14), `AdminGuard` and `AdminRequest` (Task 12), and `decodeCursor`/`encodeCursor` from `apps/api/src/businesses/cursor.ts`.
- Produces:
  - `createTestApp(configure?: (b: TestingModuleBuilder) => TestingModuleBuilder)`.
  - `createAdminTestApp(): Promise<{ app; prisma; notify: Mock; revalidate: Mock }>`, plus `ADMIN = "Bearer fake.user_admin.admin@darb.test"` and `STRANGER = "Bearer fake.user_other.other@darb.test"` in `test/admin.ts`.
  - `json(value: unknown): Prisma.InputJsonValue` in `src/admin/json.ts`.
  - `PlacesAdmin` (`list`, `get`, `create`, `update`) and `toAdminPlace(row)`; `SectorsAdmin` (`list`, `create`, `update`).
  - The controllers `AdminPlacesController` and `AdminSectorsController`, under `@UseGuards(AdminGuard)`.
- Rules:
  - Every write stamps `editedAt`.
  - A place's `path` is `parent.path + slug + "/"`.
  - Taking a live place to `soon` is a takedown (`immediate: true`).
  - Sector writes revalidate `taxonomy` only. Sector text is not in search documents.

- [ ] **Step 1: Test helpers**

Replace `apps/api/test/app.ts` with:
```ts
import "reflect-metadata";
import { Test, type TestingModuleBuilder } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { testDatabaseUrl } from "./db.js";

export async function createTestApp(
  configure: (builder: TestingModuleBuilder) => TestingModuleBuilder = (b) => b,
): Promise<{ app: INestApplication; prisma: PrismaService }> {
  testDatabaseUrl();
  const moduleRef = await configure(Test.createTestingModule({ imports: [AppModule] })).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
```
Create `apps/api/test/admin.ts`:
```ts
import { vi } from "vitest";
import { WebRevalidator } from "../src/admin/revalidator.js";
import { SearchEvents } from "../src/search/index-queue.js";
import { createTestApp } from "./app.js";

/** ADMIN_EMAILS=admin@darb.test in vitest.config.ts makes this user an admin at first sight. */
export const ADMIN = "Bearer fake.user_admin.admin@darb.test";
export const STRANGER = "Bearer fake.user_other.other@darb.test";

/** The real app with search events and web revalidation recorded instead of sent. */
export async function createAdminTestApp() {
  const notify = vi.fn();
  const revalidate = vi.fn(async (_tags: string[], _options?: { immediate?: boolean }) => true);
  const created = await createTestApp((b) =>
    b
      .overrideProvider(SearchEvents)
      .useValue({ notify, changed: vi.fn(async () => []), onModuleDestroy: async () => undefined })
      .overrideProvider(WebRevalidator)
      .useValue({ revalidate }),
  );
  return { ...created, notify, revalidate };
}
```

- [ ] **Step 2: Write the failing test**

`apps/api/src/admin/places.admin.test.ts`:
```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type Mock } from "vitest";
import { ADMIN, STRANGER, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { PrismaService } from "../prisma/prisma.service.js";

let app: INestApplication;
let prisma: PrismaService;
let notify: Mock;
let revalidate: Mock;
let f: Fixtures;
beforeAll(async () => {
  ({ app, prisma, notify, revalidate } = await createAdminTestApp());
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  notify.mockClear();
  revalidate.mockClear();
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());

describe("guard", () => {
  it("401s without a token and 403s a non-admin", async () => {
    expect((await http().get("/admin/places")).status).toBe(401);
    expect((await http().get("/admin/places").set("authorization", STRANGER)).status).toBe(403);
  });
});

describe("places", () => {
  it("lists and searches by slug or name", async () => {
    const res = await http().get("/admin/places?q=sakh").set("authorization", ADMIN);
    expect(res.status).toBe(200);
    expect(res.body.items.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
    const byName = await http().get(`/admin/places?q=${encodeURIComponent("سخنين")}`).set("authorization", ADMIN);
    expect(byName.body.items.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
  });

  it("creates a place under a parent, audited, indexed and revalidated", async () => {
    const res = await http()
      .post("/admin/places")
      .set("authorization", ADMIN)
      .send({ slug: "wadi-salameh", type: "neighbourhood", parentId: f.sakhnin.id, name: { ar: "وادي سلامة" }, lat: 32.86, lng: 35.3 });
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ path: "/israel/northern-district/sakhnin/wadi-salameh/", status: "soon" });
    expect(res.body.editedAt).not.toBeNull();
    expect(notify).toHaveBeenCalledWith("place", [res.body.id]);
    expect(revalidate).toHaveBeenCalledWith(["places", "place:wadi-salameh"], { immediate: undefined });
    const audit = await prisma.auditLog.findFirstOrThrow({ include: { actor: true } });
    expect([audit.action, audit.entityType, audit.actor.clerkUserId]).toEqual(["create", "place", "user_admin"]);
  });

  it("refuses a taken slug (409), a reserved slug (400) and an unknown parent (404)", async () => {
    const base = { type: "town", parentId: f.north.id, name: { en: "x" }, lat: 32.8, lng: 35.2 };
    expect((await http().post("/admin/places").set("authorization", ADMIN).send({ ...base, slug: "tamra" })).status).toBe(409);
    expect((await http().post("/admin/places").set("authorization", ADMIN).send({ ...base, slug: "search" })).status).toBe(400);
    expect(
      (await http().post("/admin/places").set("authorization", ADMIN).send({ ...base, slug: "new-town", parentId: "0190a000-0000-7000-8000-00000000dead" })).status,
    ).toBe(404);
  });

  it("taking a live place to soon is an immediate takedown, and stamps editedAt", async () => {
    const res = await http().patch(`/admin/places/${f.sakhnin.id}`).set("authorization", ADMIN).send({ status: "soon" });
    expect(res.status).toBe(200);
    expect(revalidate).toHaveBeenCalledWith(["places", "place:sakhnin"], { immediate: true });
    expect((await prisma.place.findUniqueOrThrow({ where: { id: f.sakhnin.id } })).editedAt).not.toBeNull();
  });

  it("refuses an empty patch", async () => {
    expect((await http().patch(`/admin/places/${f.sakhnin.id}`).set("authorization", ADMIN).send({})).status).toBe(400);
  });
});

describe("sectors", () => {
  it("lists in order and updates the accent", async () => {
    const list = await http().get("/admin/sectors").set("authorization", ADMIN);
    expect(list.body.map((s: { slug: string }) => s.slug)).toEqual(["beauty", "food"]);
    const res = await http().patch(`/admin/sectors/${f.beauty.id}`).set("authorization", ADMIN).send({ accent: "#aa8877" });
    expect([res.status, res.body.accent]).toEqual([200, "#aa8877"]);
    expect(revalidate).toHaveBeenCalledWith(["taxonomy"], { immediate: undefined });
  });
});
```
(If the fixtures' sector order puts `food` first, adjust the expected order to the fixtures' `order` values. Read `test/fixtures.ts` lines 60–90.)

- [ ] **Step 3: Run the test to verify it fails**

Run: `pnpm --filter @darb/api exec vitest run src/admin/places.admin.test.ts`
Expected: FAIL. `/admin/places` returns 404.

- [ ] **Step 4: Implement**

`apps/api/src/admin/json.ts`:
```ts
import type { Prisma } from "../generated/prisma/client.js";

/** Validated DTO values are plain JSON already; this tells Prisma so. */
export const json = (value: unknown) => value as Prisma.InputJsonValue;
```
`apps/api/src/admin/places.admin.ts`:
```ts
import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminListQueryDto,
  type AdminPlaceCreateDto,
  type AdminPlaceDto,
  type AdminPlacePatchDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { decodeCursor, encodeCursor } from "../businesses/cursor.js";
import type { Place, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { webTags } from "./tags.js";

const STATUSES = new Set(["live", "soon"]);

export const toAdminPlace = (p: Place): AdminPlaceDto => ({
  id: p.id,
  slug: p.slug,
  type: p.type,
  parentId: p.parentId,
  path: p.path,
  name: p.name as Localized,
  aliases: p.aliases,
  lat: p.lat,
  lng: p.lng,
  population: p.population,
  cbsCode: p.cbsCode,
  status: p.status,
  editedAt: p.editedAt?.toISOString() ?? null,
});

/** Name text in any language, or the slug. */
export const nameOrSlug = (q: string): Prisma.PlaceWhereInput[] => [
  { slug: { contains: q.toLowerCase() } },
  ...(["he", "ar", "en"] as const).map((l) => ({ name: { path: [l], string_contains: q } })),
  { aliases: { has: q } },
];

@Injectable()
export class PlacesAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  async list(query: AdminListQueryDto) {
    const offset = decodeCursor(query.cursor) ?? 0;
    const where: Prisma.PlaceWhereInput = {
      ...(query.q ? { OR: nameOrSlug(query.q) } : {}),
      ...(query.status && STATUSES.has(query.status) ? { status: query.status as "live" | "soon" } : {}),
    };
    const rows = await this.prisma.place.findMany({ where, orderBy: { slug: "asc" }, skip: offset, take: query.limit + 1 });
    return {
      items: rows.slice(0, query.limit).map(toAdminPlace),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async get(id: string) {
    const p = await this.prisma.place.findUnique({ where: { id } });
    return p ? { status: 200 as const, body: toAdminPlace(p) } : notFound("place");
  }

  async create(actor: AdminActor, dto: AdminPlaceCreateDto) {
    const parent = await this.prisma.place.findUnique({ where: { id: dto.parentId } });
    if (!parent) return notFound("parent place");
    if (await this.prisma.place.findUnique({ where: { slug: dto.slug } }))
      return conflict(`The address "${dto.slug}" is already used by another place`);
    const row = await this.writer.write(actor, "create", "place", async (tx) => {
      const p = await tx.place.create({
        data: {
          slug: dto.slug,
          type: dto.type,
          parentId: parent.id,
          path: `${parent.path}${dto.slug}/`,
          name: json(dto.name),
          aliases: dto.aliases,
          lat: dto.lat,
          lng: dto.lng,
          population: dto.population,
          status: dto.status,
          editedAt: new Date(),
        },
      });
      return {
        row: p,
        entityId: p.id,
        fields: Object.keys(dto).sort(),
        tags: webTags.place(p.slug),
        search: [{ entity: "place" as const, ids: [p.id] }],
      };
    });
    return { status: 201 as const, body: toAdminPlace(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminPlacePatchDto) {
    const before = await this.prisma.place.findUnique({ where: { id } });
    if (!before) return notFound("place");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    const row = await this.writer.write(actor, "update", "place", async (tx) => {
      const p = await tx.place.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.name ? { name: json(patch.name) } : {}),
          editedAt: new Date(),
        },
      });
      return {
        row: p,
        entityId: id,
        fields,
        tags: webTags.place(p.slug),
        search: [{ entity: "place" as const, ids: [id] }],
        immediate: before.status === "live" && p.status !== "live" ? true : undefined,
      };
    });
    return { status: 200 as const, body: toAdminPlace(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminPlacesController {
  constructor(private readonly places: PlacesAdmin) {}

  @TsRestHandler(contract.admin.places)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.places, {
      list: async ({ query }) => ({ status: 200, body: await this.places.list(query) }),
      get: async ({ params }) => this.places.get(params.id),
      create: async ({ body }) => this.places.create(actor, body),
      update: async ({ params, body }) => this.places.update(actor, params.id, body),
    });
  }
}
```
`apps/api/src/admin/sectors.admin.ts`:
```ts
import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminSectorCreateDto,
  type AdminSectorDto,
  type AdminSectorPatchDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import type { Sector } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { webTags } from "./tags.js";

export const toAdminSector = (s: Sector): AdminSectorDto => ({
  id: s.id,
  slug: s.slug,
  name: s.name as Localized,
  tagline: s.tagline as Localized,
  accent: s.accent,
  order: s.order,
  editedAt: s.editedAt?.toISOString() ?? null,
});

@Injectable()
export class SectorsAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  async list() {
    return (await this.prisma.sector.findMany({ orderBy: { order: "asc" } })).map(toAdminSector);
  }

  async create(actor: AdminActor, dto: AdminSectorCreateDto) {
    if (await this.prisma.sector.findUnique({ where: { slug: dto.slug } }))
      return conflict(`The address "${dto.slug}" is already used by another sector`);
    const row = await this.writer.write(actor, "create", "sector", async (tx) => {
      const s = await tx.sector.create({
        data: { ...dto, name: json(dto.name), tagline: json(dto.tagline), editedAt: new Date() },
      });
      return { row: s, entityId: s.id, fields: Object.keys(dto).sort(), tags: webTags.sector() };
    });
    return { status: 201 as const, body: toAdminSector(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminSectorPatchDto) {
    if (!(await this.prisma.sector.findUnique({ where: { id } }))) return notFound("sector");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    const row = await this.writer.write(actor, "update", "sector", async (tx) => {
      const s = await tx.sector.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.name ? { name: json(patch.name) } : {}),
          ...(patch.tagline ? { tagline: json(patch.tagline) } : {}),
          editedAt: new Date(),
        },
      });
      return { row: s, entityId: id, fields, tags: webTags.sector() };
    });
    return { status: 200 as const, body: toAdminSector(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminSectorsController {
  constructor(private readonly sectors: SectorsAdmin) {}

  @TsRestHandler(contract.admin.sectors)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.sectors, {
      list: async () => ({ status: 200, body: await this.sectors.list() }),
      create: async ({ body }) => this.sectors.create(actor, body),
      update: async ({ params, body }) => this.sectors.update(actor, params.id, body),
    });
  }
}
```
In `apps/api/src/admin/admin.module.ts`, add `controllers: [AdminPlacesController, AdminSectorsController]` and add `PlacesAdmin` and `SectorsAdmin` to `providers`.

A type error from ts-rest about the union of `{status, body}` returns usually comes from a literal type widening to `number`. Every outcome helper above uses `as const`, so keep it that way. If the guard runs after ts-rest validation, an unauthenticated invalid body gets 400 instead of 401. Nest runs guards before handlers, so this does not happen.

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/admin`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/api/test/app.ts apps/api/test/admin.ts apps/api/src/admin
git commit -m "feat(api): admin places and sectors, audited, indexed and revalidated"
```

---

### Task 16: Admin API: kinds

**Files:**
- Create: `apps/api/src/admin/kinds.admin.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Modify: `apps/api/package.json` (move `@darb/seed` from `devDependencies` to `dependencies`, because the runtime needs `SCREEN_SCHEMA`)
- Test: `apps/api/src/admin/kinds.admin.test.ts`

**Interfaces:**
- Consumes: as in Task 15; `SCREEN_SCHEMA` from `@darb/seed`.
- Produces: `KindsAdmin` (`list(query)`, `get(id)`, `create(actor, dto)`, `update(actor, id, patch)`), `toAdminKind(row)` and `AdminKindsController`.
- Rules:
  - New kinds get `contentSchema = SCREEN_SCHEMA` (the v1 shape every template shares) and default to `hidden`.
  - The parent must be in the same sector and must not be the kind itself or one of its descendants (400).
  - Hiding an active kind is a takedown (`immediate: true`).
  - Every write notifies search (`kind`, `[id]`); the indexer cascades to that kind's businesses.

- [ ] **Step 1: Write the failing test**

`apps/api/src/admin/kinds.admin.test.ts`:
```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { PrismaService } from "../prisma/prisma.service.js";

let app: INestApplication;
let prisma: PrismaService;
let notify: Mock;
let revalidate: Mock;
let f: Fixtures;
beforeAll(async () => {
  ({ app, prisma, notify, revalidate } = await createAdminTestApp());
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  notify.mockClear();
  revalidate.mockClear();
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());
const synonyms = { he: ["ספרית ילדים"], ar: ["حلاق اطفال"], en: ["kids barber"] };

it("lists kinds with business counts, filtered by status and text", async () => {
  const res = await http().get("/admin/kinds?status=active&q=barber").set("authorization", ADMIN);
  expect(res.status).toBe(200);
  const barbers = res.body.find((k: { slug: string }) => k.slug === "barbershops");
  expect(barbers.businessCount).toBeGreaterThan(0);
  expect(res.body.every((k: { status: string }) => k.status === "active")).toBe(true);
});

it("creates a hidden kind with the shared content schema", async () => {
  const res = await http()
    .post("/admin/kinds")
    .set("authorization", ADMIN)
    .send({ slug: "beard-studios", sectorId: f.beauty.id, name: { en: "Beard studios" }, synonyms, template: "booking", order: 50 });
  expect(res.status).toBe(201);
  expect(res.body.status).toBe("hidden");
  const row = await prisma.kind.findUniqueOrThrow({ where: { slug: "beard-studios" } });
  expect((row.contentSchema as { required: string[] }).required).toContain("items");
  expect(notify).toHaveBeenCalledWith("kind", [row.id]);
  expect(revalidate).toHaveBeenCalledWith(["taxonomy", "businesses"], { immediate: undefined });
});

it("refuses a parent from another sector and a parent cycle", async () => {
  const other = await http()
    .patch(`/admin/kinds/${f.barbershops.id}`)
    .set("authorization", ADMIN)
    .send({ parentKindId: f.hidden.id });
  expect(other.status).toBe(400);
  const cycle = await http()
    .patch(`/admin/kinds/${f.barbershops.id}`)
    .set("authorization", ADMIN)
    .send({ parentKindId: f.kidsCuts.id });
  expect(cycle.status).toBe(400);
});

it("hiding an active kind is an immediate takedown", async () => {
  const res = await http().patch(`/admin/kinds/${f.barbershops.id}`).set("authorization", ADMIN).send({ status: "hidden" });
  expect(res.status).toBe(200);
  expect(revalidate).toHaveBeenCalledWith(["taxonomy", "businesses"], { immediate: true });
});
```
(Fixture check: `f.hidden` must be in a different sector from `f.barbershops`, and `f.kidsCuts.parentKindId` must be `f.barbershops.id`. Read `test/fixtures.ts` lines 90–130. If `hidden` is in the same sector, create a kind in `f.food` inside the test instead and use it as the parent.)

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @darb/api exec vitest run src/admin/kinds.admin.test.ts`
Expected: FAIL with 404s.

- [ ] **Step 3: Implement**

In `apps/api/package.json`, move `"@darb/seed": "workspace:*"` from `devDependencies` to `dependencies`. Run `pnpm install`.

`apps/api/src/admin/kinds.admin.ts`:
```ts
import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminKindCreateDto,
  type AdminKindDto,
  type AdminKindListQueryDto,
  type AdminKindPatchDto,
} from "@darb/contracts";
import type { Localized } from "@darb/core";
import { SCREEN_SCHEMA } from "@darb/seed";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import type { Kind, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { json } from "./json.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { webTags } from "./tags.js";

type Synonyms = AdminKindDto["synonyms"];
type KindRow = Kind & { _count: { primaryFor: number } };

export const toAdminKind = (k: KindRow): AdminKindDto => ({
  id: k.id,
  slug: k.slug,
  sectorId: k.sectorId,
  parentKindId: k.parentKindId,
  name: k.name as Localized,
  synonyms: k.synonyms as Synonyms,
  template: k.template,
  attributes: k.attributes,
  icon: k.icon,
  order: k.order,
  status: k.status,
  businessCount: k._count.primaryFor,
  editedAt: k.editedAt?.toISOString() ?? null,
});
const withCount = { _count: { select: { primaryFor: true } } } as const;

@Injectable()
export class KindsAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  async list(query: AdminKindListQueryDto) {
    const q = query.q;
    const where: Prisma.KindWhereInput = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.sector ? { sectorId: query.sector } : {}),
      ...(q
        ? {
            OR: [
              { slug: { contains: q.toLowerCase() } },
              ...(["he", "ar", "en"] as const).map((l) => ({ name: { path: [l], string_contains: q } })),
            ],
          }
        : {}),
    };
    const rows = await this.prisma.kind.findMany({ where, include: withCount, orderBy: [{ sectorId: "asc" }, { order: "asc" }] });
    return rows.map(toAdminKind);
  }

  async get(id: string) {
    const k = await this.prisma.kind.findUnique({ where: { id }, include: withCount });
    return k ? { status: 200 as const, body: toAdminKind(k) } : notFound("kind");
  }

  /** A parent must sit in the same sector and must not be the kind or one of its descendants. */
  private async parentProblem(kindId: string | null, sectorId: string, parentId: string): Promise<string | null> {
    let cursor = await this.prisma.kind.findUnique({ where: { id: parentId } });
    if (!cursor) return "The parent kind does not exist";
    if (cursor.sectorId !== sectorId) return "The parent kind must be in the same sector";
    for (let depth = 0; cursor && depth < 10; depth++) {
      if (cursor.id === kindId) return "A kind cannot sit under itself or its own sub-kinds";
      cursor = cursor.parentKindId ? await this.prisma.kind.findUnique({ where: { id: cursor.parentKindId } }) : null;
    }
    return null;
  }

  async create(actor: AdminActor, dto: AdminKindCreateDto) {
    if (!(await this.prisma.sector.findUnique({ where: { id: dto.sectorId } }))) return notFound("sector");
    if (await this.prisma.kind.findUnique({ where: { slug: dto.slug } }))
      return conflict(`The address "${dto.slug}" is already used by another kind`);
    if (dto.parentKindId) {
      const problem = await this.parentProblem(null, dto.sectorId, dto.parentKindId);
      if (problem) return invalid(problem);
    }
    const row = await this.writer.write(actor, "create", "kind", async (tx) => {
      const k = await tx.kind.create({
        data: {
          ...dto,
          name: json(dto.name),
          synonyms: json(dto.synonyms),
          contentSchema: json(SCREEN_SCHEMA),
          editedAt: new Date(),
        },
        include: withCount,
      });
      return {
        row: k,
        entityId: k.id,
        fields: Object.keys(dto).sort(),
        tags: webTags.kind(),
        search: [{ entity: "kind" as const, ids: [k.id] }],
      };
    });
    return { status: 201 as const, body: toAdminKind(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminKindPatchDto) {
    const before = await this.prisma.kind.findUnique({ where: { id } });
    if (!before) return notFound("kind");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    const sectorId = patch.sectorId ?? before.sectorId;
    if (patch.sectorId && !(await this.prisma.sector.findUnique({ where: { id: patch.sectorId } })))
      return notFound("sector");
    const parentId = patch.parentKindId === undefined ? before.parentKindId : patch.parentKindId;
    if (parentId) {
      const problem = await this.parentProblem(id, sectorId, parentId);
      if (problem) return invalid(problem);
    }
    const row = await this.writer.write(actor, "update", "kind", async (tx) => {
      const k = await tx.kind.update({
        where: { id },
        data: {
          ...patch,
          ...(patch.name ? { name: json(patch.name) } : {}),
          ...(patch.synonyms ? { synonyms: json(patch.synonyms) } : {}),
          editedAt: new Date(),
        },
        include: withCount,
      });
      return {
        row: k,
        entityId: id,
        fields,
        tags: webTags.kind(),
        search: [{ entity: "kind" as const, ids: [id] }],
        immediate: before.status === "active" && k.status === "hidden" ? true : undefined,
      };
    });
    return { status: 200 as const, body: toAdminKind(row) };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminKindsController {
  constructor(private readonly kinds: KindsAdmin) {}

  @TsRestHandler(contract.admin.kinds)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.kinds, {
      list: async ({ query }) => ({ status: 200, body: await this.kinds.list(query) }),
      get: async ({ params }) => this.kinds.get(params.id),
      create: async ({ body }) => this.kinds.create(actor, body),
      update: async ({ params, body }) => this.kinds.update(actor, params.id, body),
    });
  }
}
```
Register `AdminKindsController` and `KindsAdmin` in `admin.module.ts`.

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @darb/api exec vitest run src/admin`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add apps/api/package.json pnpm-lock.yaml apps/api/src/admin
git commit -m "feat(api): admin kinds: new kinds start hidden, parents stay in sector and acyclic"
```

---

### Task 17: Admin API: businesses, status, release, audit and report

**Files:**
- Create: `apps/api/src/admin/experience.ts`, `apps/api/src/admin/businesses.admin.ts`, `apps/api/src/admin/misc.admin.ts`
- Modify: `apps/api/src/admin/admin.module.ts`
- Test: `apps/api/src/admin/businesses.admin.test.ts`, `apps/api/src/admin/misc.admin.test.ts`

**Interfaces:**
- Consumes: as in Task 15; `ReportRepository` from `apps/api/src/search/report.repository.ts`.
- Produces:
  - `ExperienceValidator.validate(contentSchema: unknown, experience: unknown): string[]`. It returns an empty array when valid, and messages such as `"/items must NOT have fewer than 1 items"` otherwise. Compiled validators are cached by schema text.
  - `BusinessesAdmin` (`list`, `get`, `create`, `update`, `status`, `remove`), `toAdminBusiness(row)` and `AdminBusinessesController`.
  - `MiscAdmin` and `AdminMiscController` (`me`, `audit`, `report` and `release`).
- Rules:
  - Admin-created businesses have `source: "admin"`, and every write stamps `editedAt`.
  - App links are only allowed on the `darb` tier (400).
  - `experience` must fit the primary kind's `contentSchema` (400 with `errors`).
  - `kindIds` always include the primary kind.
  - The status change is audited as `status`. `immediate` defaults to `true` for anything but `published`.
  - Only admin-created drafts can be deleted (409 otherwise).
  - Release clears `editedAt`, is audited as `release`, and revalidates.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/admin/businesses.admin.test.ts`:
```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { PrismaService } from "../prisma/prisma.service.js";

let app: INestApplication;
let prisma: PrismaService;
let notify: Mock;
let revalidate: Mock;
let f: Fixtures;
const strict = {
  type: "object",
  required: ["title"],
  properties: { title: { type: "object" } },
  additionalProperties: false,
};
beforeAll(async () => {
  ({ app, prisma, notify, revalidate } = await createAdminTestApp());
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  await prisma.kind.update({ where: { id: f.barbershops.id }, data: { contentSchema: strict } });
  notify.mockClear();
  revalidate.mockClear();
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());
const as = <T extends request.Test>(t: T) => t.set("authorization", ADMIN);
const draft = () => ({
  slug: "fade-lab",
  placeId: f.sakhnin.id,
  name: { ar: "فيد لاب" },
  tagline: { ar: "قص شعر" },
  address: { ar: "سخنين" },
  primaryKindId: f.barbershops.id,
  kindIds: [],
  lat: 32.864,
  lng: 35.302,
  phone: "+972 50-000-0000",
  whatsapp: null,
  website: null,
  hours: { weekly: { "0": [{ open: "09:00", close: "19:00" }] }, exceptions: [] },
  attributes: {},
  experience: { title: { ar: "احجز" } },
  tier: "basic",
  apps: {},
});

describe("create", () => {
  it("validates experience against the primary kind's schema", async () => {
    const res = await as(http().post("/admin/businesses")).send({ ...draft(), experience: { nope: 1 } });
    expect(res.status).toBe(400);
    expect(res.body.errors.join(" ")).toMatch(/title/);
  });

  it("refuses app links below the darb tier", async () => {
    const res = await as(http().post("/admin/businesses")).send({ ...draft(), apps: { web: "https://x.darb.co.il" } });
    expect(res.status).toBe(400);
  });

  it("creates an admin-sourced draft with its primary kind linked", async () => {
    const res = await as(http().post("/admin/businesses")).send(draft());
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ source: "admin", status: "draft", placeSlug: "sakhnin", kindIds: [f.barbershops.id] });
    expect(notify).toHaveBeenCalledWith("business", [res.body.id]);
    expect(revalidate).toHaveBeenCalledWith(["businesses", "business:sakhnin/fade-lab", "place:sakhnin"], { immediate: undefined });
    expect((await as(http().post("/admin/businesses")).send(draft())).status).toBe(409);
  });
});

describe("edit and status", () => {
  it("patches a seed business, stamps editedAt, and suspends it as an immediate takedown", async () => {
    const patched = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({ name: { ar: "أبو سليم للحلاقة" } });
    expect(patched.status).toBe(200);
    expect(patched.body.editedAt).not.toBeNull();
    const res = await as(http().post(`/admin/businesses/${f.abuSalim.id}/status`)).send({ status: "suspended" });
    expect([res.status, res.body.status]).toEqual([200, "suspended"]);
    expect(revalidate).toHaveBeenLastCalledWith(expect.arrayContaining(["businesses"]), { immediate: true });
    expect(notify).toHaveBeenLastCalledWith("business", [f.abuSalim.id]);
    const actions = (await prisma.auditLog.findMany({ orderBy: { at: "asc" } })).map((a) => a.action);
    expect(actions).toEqual(["update", "status"]);
  });

  it("re-validates the stored experience when the primary kind changes", async () => {
    await prisma.kind.update({ where: { id: f.kidsCuts.id }, data: { contentSchema: { type: "object", required: ["items"] } } });
    const res = await as(http().patch(`/admin/businesses/${f.abuSalim.id}`)).send({ primaryKindId: f.kidsCuts.id });
    expect(res.status).toBe(400);
  });

  it("lists by place and text, newest first", async () => {
    const res = await as(http().get("/admin/businesses?place=sakhnin&q=little"));
    expect(res.body.items.map((b: { slug: string }) => b.slug)).toEqual(["little-cuts"]);
  });
});

describe("delete", () => {
  it("deletes admin drafts only", async () => {
    expect((await as(http().post(`/admin/businesses/${f.abuSalim.id}/delete`)).send({})).status).toBe(409);
    const created = await as(http().post("/admin/businesses")).send(draft());
    const res = await as(http().post(`/admin/businesses/${created.body.id}/delete`)).send({});
    expect(res.status).toBe(200);
    expect(await prisma.business.count({ where: { id: created.body.id } })).toBe(0);
  });
});
```
`apps/api/src/admin/misc.admin.test.ts`:
```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { ADMIN, STRANGER, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import type { PrismaService } from "../prisma/prisma.service.js";

let app: INestApplication;
let prisma: PrismaService;
let f: Fixtures;
beforeAll(async () => {
  ({ app, prisma } = await createAdminTestApp());
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
});
afterAll(() => app.close());
const http = () => request(app.getHttpServer());

it("says who is signed in", async () => {
  const res = await http().get("/admin/me").set("authorization", ADMIN);
  expect(res.body.clerkUserId).toBe("user_admin");
});

it("lists an entity's audit trail newest first, then releases it to the seed", async () => {
  await http().patch(`/admin/places/${f.tamra.id}`).set("authorization", ADMIN).send({ aliases: ["Tamra"] });
  const rel = await http().post(`/admin/release/place/${f.tamra.id}`).set("authorization", ADMIN).send({});
  expect(rel.status).toBe(200);
  expect((await prisma.place.findUniqueOrThrow({ where: { id: f.tamra.id } })).editedAt).toBeNull();
  const audit = await http().get(`/admin/audit?entityType=place&entityId=${f.tamra.id}`).set("authorization", ADMIN);
  expect(audit.body.map((a: { action: string }) => a.action)).toEqual(["release", "update"]);
  expect(audit.body[0].actor).toBe("user_admin");
});

it("serves the Missing report to admins only, with no-store", async () => {
  await prisma.searchQuery.create({
    data: { normalized: "ice skating", locale: "en", intent: { kinds: [], place: null, nearMe: false, openNow: false, attributes: { delivers: false }, freeText: "" }, unmatched: [], lane: "instant", resultCount: 0 },
  });
  const res = await http().get("/admin/report?days=30").set("authorization", ADMIN);
  expect(res.status).toBe(200);
  expect(res.headers["cache-control"]).toBe("no-store");
  expect(res.body.missingKinds).toEqual([{ term: "ice skating", count: 1 }]);
  expect((await http().get("/admin/report").set("authorization", STRANGER)).status).toBe(403);
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/admin/businesses.admin.test.ts src/admin/misc.admin.test.ts`
Expected: FAIL with 404s.

- [ ] **Step 3: Implement the experience validator**

`apps/api/src/admin/experience.ts`:
```ts
import { Injectable } from "@nestjs/common";
import { Ajv, type ValidateFunction } from "ajv";

/** Spec §4.3/§4.4: Business.experience is validated against its primary kind's contentSchema. */
@Injectable()
export class ExperienceValidator {
  private readonly ajv = new Ajv({ allErrors: true });
  private readonly cache = new Map<string, ValidateFunction>();

  validate(contentSchema: unknown, experience: unknown): string[] {
    const key = JSON.stringify(contentSchema);
    let check = this.cache.get(key);
    if (!check) {
      check = this.ajv.compile(contentSchema as object);
      this.cache.set(key, check);
    }
    if (check(experience)) return [];
    return (check.errors ?? []).map((e) => `${e.instancePath || "/"} ${e.message ?? "is invalid"}`.trim());
  }
}
```

- [ ] **Step 4: Implement businesses**

`apps/api/src/admin/businesses.admin.ts`:
```ts
import { Controller, Injectable, Req, UseGuards } from "@nestjs/common";
import {
  contract,
  type AdminBusinessCreateDto,
  type AdminBusinessDto,
  type AdminBusinessListQueryDto,
  type AdminBusinessPatchDto,
  type AdminBusinessRowDto,
  type AdminStatusDto,
} from "@darb/contracts";
import type { Hours, Localized } from "@darb/core";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { decodeCursor, encodeCursor } from "../businesses/cursor.js";
import type { Business, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { AdminWriter } from "./admin-writer.js";
import { ExperienceValidator } from "./experience.js";
import { json } from "./json.js";
import { conflict, invalid, notFound } from "./outcome.js";
import { webTags } from "./tags.js";

type Row = Business & { place: { slug: string }; kinds: { kindId: string }[] };
const include = { place: { select: { slug: true } }, kinds: { select: { kindId: true } } } as const;
const STATUSES = new Set(["draft", "published", "suspended"]);

export const toAdminBusinessRow = (b: Row): AdminBusinessRowDto => ({
  id: b.id,
  slug: b.slug,
  placeId: b.placeId,
  placeSlug: b.place.slug,
  name: b.name as Localized,
  primaryKindId: b.primaryKindId,
  tier: b.tier,
  status: b.status,
  source: b.source,
  editedAt: b.editedAt?.toISOString() ?? null,
  updatedAt: b.updatedAt.toISOString(),
});
export const toAdminBusiness = (b: Row): AdminBusinessDto => ({
  ...toAdminBusinessRow(b),
  tagline: b.tagline as Localized,
  address: b.address as Localized,
  kindIds: b.kinds.map((k) => k.kindId),
  lat: b.lat,
  lng: b.lng,
  phone: b.phone,
  whatsapp: b.whatsapp,
  website: b.website,
  hours: b.hours as unknown as Hours as AdminBusinessDto["hours"],
  attributes: b.attributes as AdminBusinessDto["attributes"],
  experience: b.experience as AdminBusinessDto["experience"],
  tier: b.tier,
  apps: b.apps as AdminBusinessDto["apps"],
  brandId: b.brandId,
});

const hasApps = (apps: AdminBusinessDto["apps"] | undefined) => Boolean(apps && Object.keys(apps).length > 0);

@Injectable()
export class BusinessesAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
    private readonly experience: ExperienceValidator,
  ) {}

  async list(query: AdminBusinessListQueryDto) {
    const offset = decodeCursor(query.cursor) ?? 0;
    const place = query.place ? await this.prisma.place.findUnique({ where: { slug: query.place } }) : null;
    const kind = query.kind ? await this.prisma.kind.findUnique({ where: { slug: query.kind } }) : null;
    if ((query.place && !place) || (query.kind && !kind)) return { items: [], nextCursor: null };
    const q = query.q;
    const where: Prisma.BusinessWhereInput = {
      ...(place ? { placeId: place.id } : {}),
      ...(kind ? { primaryKindId: kind.id } : {}),
      ...(query.status && STATUSES.has(query.status) ? { status: query.status as Business["status"] } : {}),
      ...(q
        ? {
            OR: [
              { slug: { contains: q.toLowerCase() } },
              ...(["he", "ar", "en"] as const).map((l) => ({ name: { path: [l], string_contains: q } })),
            ],
          }
        : {}),
    };
    const rows = await this.prisma.business.findMany({
      where,
      include,
      orderBy: [{ updatedAt: "desc" }, { id: "asc" }],
      skip: offset,
      take: query.limit + 1,
    });
    return {
      items: rows.slice(0, query.limit).map(toAdminBusinessRow),
      nextCursor: rows.length > query.limit ? encodeCursor(offset + query.limit) : null,
    };
  }

  async get(id: string) {
    const b = await this.prisma.business.findUnique({ where: { id }, include });
    return b ? { status: 200 as const, body: toAdminBusiness(b) } : notFound("business");
  }

  /** Shared checks for create and update; null when the values are fine. */
  private async problem(values: {
    primaryKindId: string;
    kindIds: string[] | undefined;
    tier: string;
    apps: AdminBusinessDto["apps"] | undefined;
    experience: unknown;
    checkExperience: boolean;
  }) {
    const kind = await this.prisma.kind.findUnique({ where: { id: values.primaryKindId } });
    if (!kind) return notFound("kind");
    if (values.kindIds) {
      const found = await this.prisma.kind.count({ where: { id: { in: values.kindIds } } });
      if (found !== new Set(values.kindIds).size) return invalid("One of the extra kinds does not exist");
    }
    if (values.tier !== "darb" && hasApps(values.apps))
      return invalid("App links are only for businesses on the darb tier");
    if (values.checkExperience) {
      const errors = this.experience.validate(kind.contentSchema, values.experience);
      if (errors.length) return invalid("The experience content does not fit this kind's template", errors);
    }
    return null;
  }

  async create(actor: AdminActor, dto: AdminBusinessCreateDto) {
    const place = await this.prisma.place.findUnique({ where: { id: dto.placeId } });
    if (!place) return notFound("place");
    const problem = await this.problem({ ...dto, checkExperience: true });
    if (problem) return problem;
    if (await this.prisma.business.findUnique({ where: { placeId_slug: { placeId: place.id, slug: dto.slug } } }))
      return conflict(`The address "${dto.slug}" is already used in this place`);
    const kindIds = [...new Set([dto.primaryKindId, ...dto.kindIds])];
    const { kindIds: _k, ...data } = dto;
    const row = await this.writer.write(actor, "create", "business", async (tx) => {
      const b = await tx.business.create({
        data: {
          ...data,
          name: json(dto.name),
          tagline: json(dto.tagline),
          address: json(dto.address),
          hours: json(dto.hours),
          attributes: json(dto.attributes),
          experience: json(dto.experience),
          apps: json(dto.apps),
          source: "admin",
          editedAt: new Date(),
          kinds: { create: kindIds.map((kindId) => ({ kindId })) },
        },
        include,
      });
      return {
        row: b,
        entityId: b.id,
        fields: Object.keys(dto).sort(),
        tags: webTags.business(place.slug, b.slug),
        search: [{ entity: "business" as const, ids: [b.id] }],
      };
    });
    return { status: 201 as const, body: toAdminBusiness(row) };
  }

  async update(actor: AdminActor, id: string, patch: AdminBusinessPatchDto) {
    const before = await this.prisma.business.findUnique({ where: { id }, include });
    if (!before) return notFound("business");
    const fields = Object.keys(patch).sort();
    if (fields.length === 0) return invalid("Nothing to change");
    const primaryKindId = patch.primaryKindId ?? before.primaryKindId;
    const problem = await this.problem({
      primaryKindId,
      kindIds: patch.kindIds,
      tier: patch.tier ?? before.tier,
      apps: patch.apps ?? (before.apps as AdminBusinessDto["apps"]),
      experience: patch.experience ?? before.experience,
      checkExperience: patch.experience !== undefined || patch.primaryKindId !== undefined,
    });
    if (problem) return problem;
    const { kindIds, ...rest } = patch;
    const jsonFields = ["name", "tagline", "address", "hours", "attributes", "experience", "apps"] as const;
    const data: Prisma.BusinessUpdateInput = { ...(rest as Prisma.BusinessUpdateInput), editedAt: new Date() };
    for (const k of jsonFields) if (rest[k] !== undefined) data[k] = json(rest[k]);
    if (patch.primaryKindId) {
      delete (data as Record<string, unknown>)["primaryKindId"];
      data.primaryKind = { connect: { id: patch.primaryKindId } };
    }
    const row = await this.writer.write(actor, "update", "business", async (tx) => {
      if (kindIds || patch.primaryKindId) {
        const links = [...new Set([primaryKindId, ...(kindIds ?? before.kinds.map((k) => k.kindId))])];
        await tx.businessKind.deleteMany({ where: { businessId: id } });
        await tx.businessKind.createMany({ data: links.map((kindId) => ({ businessId: id, kindId })) });
      }
      const b = await tx.business.update({ where: { id }, data, include });
      return {
        row: b,
        entityId: id,
        fields,
        tags: webTags.business(b.place.slug, b.slug),
        search: [{ entity: "business" as const, ids: [id] }],
      };
    });
    return { status: 200 as const, body: toAdminBusiness(row) };
  }

  async status(actor: AdminActor, id: string, body: AdminStatusDto) {
    const before = await this.prisma.business.findUnique({ where: { id }, include });
    if (!before) return notFound("business");
    const row = await this.writer.write(actor, "status", "business", async (tx) => {
      const b = await tx.business.update({ where: { id }, data: { status: body.status, editedAt: new Date() }, include });
      return {
        row: b,
        entityId: id,
        fields: ["status"],
        tags: webTags.business(b.place.slug, b.slug),
        search: [{ entity: "business" as const, ids: [id] }],
        immediate: body.immediate ?? body.status !== "published",
      };
    });
    return { status: 200 as const, body: toAdminBusiness(row) };
  }

  async remove(actor: AdminActor, id: string) {
    const before = await this.prisma.business.findUnique({ where: { id }, include });
    if (!before) return notFound("business");
    if (before.source !== "admin" || before.status !== "draft")
      return conflict("Only drafts created in admin can be deleted; suspend this business instead");
    await this.writer.write(actor, "delete", "business", async (tx) => {
      await tx.business.delete({ where: { id } });
      return {
        row: null,
        entityId: id,
        fields: [],
        tags: webTags.business(before.place.slug, before.slug),
        search: [{ entity: "business" as const, ids: [id] }],
        immediate: true,
      };
    });
    return { status: 200 as const, body: { deleted: true as const } };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminBusinessesController {
  constructor(private readonly businesses: BusinessesAdmin) {}

  @TsRestHandler(contract.admin.businesses)
  handler(@Req() req: AdminRequest) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.businesses, {
      list: async ({ query }) => ({ status: 200, body: await this.businesses.list(query) }),
      get: async ({ params }) => this.businesses.get(params.id),
      create: async ({ body }) => this.businesses.create(actor, body),
      update: async ({ params, body }) => this.businesses.update(actor, params.id, body),
      status: async ({ params, body }) => this.businesses.status(actor, params.id, body),
      remove: async ({ params }) => this.businesses.remove(actor, params.id),
    });
  }
}
```

- [ ] **Step 5: Implement me, audit, report and release**

`apps/api/src/admin/misc.admin.ts`:
```ts
import { Controller, Injectable, Req, Res, UseGuards } from "@nestjs/common";
import { contract, type AdminEntity, type AuditRowDto } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { AdminGuard, type AdminActor, type AdminRequest } from "../auth/admin.guard.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { ReportRepository } from "../search/report.repository.js";
import { AdminWriter } from "./admin-writer.js";
import { notFound } from "./outcome.js";
import { webTags } from "./tags.js";

@Injectable()
export class MiscAdmin {
  constructor(
    private readonly prisma: PrismaService,
    private readonly writer: AdminWriter,
  ) {}

  async audit(entityType: AdminEntity, entityId: string): Promise<AuditRowDto[]> {
    const rows = await this.prisma.auditLog.findMany({
      where: { entityType, entityId },
      orderBy: { at: "desc" },
      take: 50,
      include: { actor: { select: { clerkUserId: true } } },
    });
    return rows.map((r) => ({
      id: r.id,
      at: r.at.toISOString(),
      actor: r.actor.clerkUserId,
      action: r.action,
      entityType: r.entityType,
      entityId: r.entityId,
      fields: r.fields,
    }));
  }

  /** "Return to seed data": the next seed run overwrites this row again (Task 3). */
  async release(actor: AdminActor, entity: AdminEntity, id: string) {
    const tagsFor = async (): Promise<string[] | null> => {
      if (entity === "place") {
        const p = await this.prisma.place.findUnique({ where: { id } });
        return p ? webTags.place(p.slug) : null;
      }
      if (entity === "sector") return (await this.prisma.sector.findUnique({ where: { id } })) ? webTags.sector() : null;
      if (entity === "kind") return (await this.prisma.kind.findUnique({ where: { id } })) ? webTags.kind() : null;
      const b = await this.prisma.business.findUnique({ where: { id }, include: { place: { select: { slug: true } } } });
      return b ? webTags.business(b.place.slug, b.slug) : null;
    };
    const tags = await tagsFor();
    if (!tags) return notFound(entity);
    await this.writer.write(actor, "release", entity, async (tx) => {
      const data = { editedAt: null };
      if (entity === "place") await tx.place.update({ where: { id }, data });
      else if (entity === "sector") await tx.sector.update({ where: { id }, data });
      else if (entity === "kind") await tx.kind.update({ where: { id }, data });
      else await tx.business.update({ where: { id }, data });
      return { row: null, entityId: id, fields: ["editedAt"], tags };
    });
    return { status: 200 as const, body: { released: true as const } };
  }
}

@Controller()
@UseGuards(AdminGuard)
export class AdminMiscController {
  constructor(
    private readonly misc: MiscAdmin,
    private readonly reports: ReportRepository,
  ) {}

  @TsRestHandler(contract.admin.misc)
  handler(@Req() req: AdminRequest, @Res({ passthrough: true }) res: { setHeader(k: string, v: string): void }) {
    const actor = req.admin!;
    return tsRestHandler(contract.admin.misc, {
      me: async () => ({ status: 200, body: { clerkUserId: actor.clerkUserId, userId: actor.userId } }),
      audit: async ({ query }) => ({ status: 200, body: await this.misc.audit(query.entityType, query.entityId) }),
      report: async ({ query }) => {
        // Raw visitor search terms (Plan 3 note): never cached anywhere.
        res.setHeader("cache-control", "no-store");
        return { status: 200, body: await this.reports.report(query.days, query.limit, new Date()) };
      },
      release: async ({ params }) => this.misc.release(actor, params.entity, params.id),
    });
  }
}
```
In `admin.module.ts`:
- `controllers`: add `AdminBusinessesController` and `AdminMiscController`;
- `providers`: add `BusinessesAdmin`, `ExperienceValidator`, `MiscAdmin` and `ReportRepository` (import it from `../search/report.repository.js`; it only needs `PrismaService`).

- [ ] **Step 6: Run the whole API suite**

Run: `pnpm --filter @darb/api typecheck && pnpm --filter @darb/api test`
Expected: PASS, every API test.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/admin
git commit -m "feat(api): admin businesses with experience validation, takedowns, release, audit trail and report"
```

---

## Part D: Web production hardening

### Task 18: Web server hardening: env, `server-only`, `siteUrl`, revalidate, Vercel rethrow

**Files:**
- Create: `apps/web/src/lib/env.ts`, `apps/web/src/instrumentation.ts`
- Test: `apps/web/src/lib/env.test.ts`, `apps/web/src/lib/site.test.ts`
- Modify: `apps/web/src/lib/site.ts`, `apps/web/src/lib/api.ts` (`server-only` and `REVALIDATE`)
- Modify: `apps/web/src/app/api/revalidate/route.ts` and its test
- Modify: `apps/web/src/lib/unavailable.tsx` and `apps/web/src/lib/unavailable.test.tsx`
- Modify: every page that sets `export const revalidate = 300` (listed in Step 5)
- Modify: `apps/web/.env.example`

**Interfaces:**
- Produces:
  - `siteUrl(env?: NodeJS.ProcessEnv): string`. It returns `SITE_URL`, then `https://${VERCEL_URL}` on Vercel previews, then localhost in development. In production it throws when none is set.
  - `isLocalSite(env?): boolean`. True when the site URL's host is `localhost` or `127.0.0.1`.
  - `indexable(env?): boolean`. `VERCEL_ENV === "production"` on Vercel; otherwise `SITE_INDEXABLE === "1"`.
  - `assertServerEnv(env?): void`. In production on a non-local site it throws unless `API_URL` is set and `SEARCH_PROXY_KEY` and `REVALIDATE_SECRET` are each at least 32 characters.
  - `POST /api/revalidate` accepts `{ tags, immediate? }`. It compares secrets in constant time. `immediate` calls `revalidateTag(tag, { expire: 0 })`; otherwise it calls `revalidateTag(tag, "max")`.
  - `REVALIDATE = { lists: 86400, taxonomy: 86400 }`. Freshness comes from tag revalidation (admin writes) and client-side open state (Task 19).
  - On Vercel (`process.env.VERCEL`), `orUnavailable` and `metadataOrUnavailable` rethrow `ApiUnavailableError`. Vercel then keeps the last good copy instead of caching the retry view (see the hosting decision).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/site.test.ts`:
```ts
// @vitest-environment node
import { expect, it } from "vitest";
import { indexable, isLocalSite, siteUrl } from "./site";

it("prefers SITE_URL, then the Vercel preview URL, then localhost in development", () => {
  expect(siteUrl({ SITE_URL: "https://darb.co.il/", NODE_ENV: "production" })).toBe("https://darb.co.il");
  expect(siteUrl({ VERCEL_ENV: "preview", VERCEL_URL: "darb-city-git-x.vercel.app", NODE_ENV: "production" })).toBe(
    "https://darb-city-git-x.vercel.app",
  );
  expect(siteUrl({ NODE_ENV: "development" })).toBe("http://localhost:3000");
});

it("throws in production without an origin", () => {
  expect(() => siteUrl({ NODE_ENV: "production" })).toThrow(/SITE_URL/);
});

it("knows local sites and indexable deployments", () => {
  expect(isLocalSite({ SITE_URL: "http://localhost:3100" })).toBe(true);
  expect(isLocalSite({ SITE_URL: "https://darb.co.il" })).toBe(false);
  expect(indexable({ VERCEL_ENV: "production" })).toBe(true);
  expect(indexable({ VERCEL_ENV: "preview", SITE_INDEXABLE: "1" })).toBe(false);
  expect(indexable({ SITE_INDEXABLE: "1" })).toBe(true);
  expect(indexable({})).toBe(false);
});
```
`apps/web/src/lib/env.test.ts`:
```ts
// @vitest-environment node
import { expect, it } from "vitest";
import { assertServerEnv } from "./env";

const long = "x".repeat(32);
const prod = {
  NODE_ENV: "production",
  SITE_URL: "https://darb.co.il",
  API_URL: "https://api.darb.co.il",
  SEARCH_PROXY_KEY: long,
  REVALIDATE_SECRET: long,
};

it("accepts a complete production environment", () => {
  expect(() => assertServerEnv(prod)).not.toThrow();
});

it("names every weak or missing production secret", () => {
  expect(() => assertServerEnv({ ...prod, SEARCH_PROXY_KEY: "dev-proxy-key" })).toThrow(/SEARCH_PROXY_KEY/);
  expect(() => assertServerEnv({ ...prod, REVALIDATE_SECRET: "change-me" })).toThrow(/REVALIDATE_SECRET/);
  expect(() => assertServerEnv({ ...prod, API_URL: undefined })).toThrow(/API_URL/);
});

it("lets local production runs (e2e) use short development keys", () => {
  expect(() =>
    assertServerEnv({ ...prod, SITE_URL: "http://localhost:3100", SEARCH_PROXY_KEY: "e2e-proxy-key", REVALIDATE_SECRET: "e2e" }),
  ).not.toThrow();
  expect(() => assertServerEnv({ NODE_ENV: "development" })).not.toThrow();
});
```
Add to `apps/web/src/app/api/revalidate/route.test.ts`:
```ts
it("expires tags at once for takedowns", async () => {
  const res = await post({ tags: ["businesses"], immediate: true }, "s3cret");
  expect(res.status).toBe(200);
  expect(revalidateTag.mock.calls).toEqual([["businesses", { expire: 0 }]]);
});

it("refuses a secret of another length without throwing", async () => {
  expect((await post({ tags: ["places"] }, "s3cret-and-more")).status).toBe(401);
});
```
Add to `apps/web/src/lib/unavailable.test.tsx`. Use its existing imports, and mock pattern for `unstable_cache` if the file already mocks it:
```ts
it("rethrows on Vercel so the platform keeps the last good page", async () => {
  vi.stubEnv("VERCEL", "1");
  const Level = orUnavailable(async () => {
    throw new ApiUnavailableError(new Error("down"));
  });
  await expect(Level({})).rejects.toBeInstanceOf(ApiUnavailableError);
  vi.unstubAllEnvs();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/lib/site.test.ts src/lib/env.test.ts src/app/api/revalidate src/lib/unavailable.test.tsx`
Expected: FAIL. The exports are missing, the `immediate` flag is ignored, and the error is not rethrown.

- [ ] **Step 3: Implement site and env**

Replace `apps/web/src/lib/site.ts`:
```ts
import "server-only";

type Env = Partial<Record<string, string | undefined>>;

/** The public origin, without a trailing slash. Production must say it (or be a Vercel preview). */
export function siteUrl(env: Env = process.env): string {
  const explicit = env.SITE_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  if (env.VERCEL_ENV === "preview" && env.VERCEL_URL) return `https://${env.VERCEL_URL}`;
  if (env.NODE_ENV === "production")
    throw new Error("SITE_URL is not set: production needs the public origin (https://darb.co.il)");
  return "http://localhost:3000";
}

export function isLocalSite(env: Env = process.env): boolean {
  const url = env.SITE_URL?.trim();
  if (!url) return env.NODE_ENV !== "production";
  const host = new URL(url).hostname;
  return host === "localhost" || host === "127.0.0.1";
}

/** Only the production deployment is indexed; previews and staging are noindex (Task 22). */
export function indexable(env: Env = process.env): boolean {
  if (env.VERCEL_ENV) return env.VERCEL_ENV === "production";
  return env.SITE_INDEXABLE === "1";
}
```
`apps/web/src/lib/env.ts`:
```ts
import "server-only";
import { isLocalSite, siteUrl } from "./site";

type Env = Partial<Record<string, string | undefined>>;

/** Refuses to serve production with development secrets (Plan 3 blocker; Plan 4 Task 18). */
export function assertServerEnv(env: Env = process.env): void {
  if (env.NODE_ENV !== "production" || isLocalSite(env)) return;
  const problems: string[] = [];
  try {
    siteUrl(env);
  } catch (e) {
    problems.push((e as Error).message);
  }
  if (!env.API_URL) problems.push("API_URL is not set");
  if ((env.SEARCH_PROXY_KEY ?? "").length < 32)
    problems.push("SEARCH_PROXY_KEY must be the API's random secret of at least 32 characters");
  if ((env.REVALIDATE_SECRET ?? "").length < 32)
    problems.push("REVALIDATE_SECRET must be a random secret of at least 32 characters");
  if (problems.length) throw new Error(`Invalid web environment: ${problems.join("; ")}`);
}
```
`apps/web/src/instrumentation.ts`:
```ts
/** Runs once when a server instance starts: a misconfigured production server fails loudly. */
export async function register(): Promise<void> {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const { assertServerEnv } = await import("./lib/env");
  assertServerEnv();
}
```
Add `import "server-only";` as the first line of `apps/web/src/lib/api.ts`. Before that, confirm no client component imports it: `grep -rl '"use client"' apps/web/src | xargs grep -l '@/lib/api"' ` must print nothing. Do the same check for `@/lib/site`.

- [ ] **Step 4: Revalidate route and Vercel rethrow**

Replace `apps/web/src/app/api/revalidate/route.ts`:
```ts
import { createHash, timingSafeEqual } from "node:crypto";
import { revalidateTag } from "next/cache";
import { z } from "zod";

const Body = z.object({
  tags: z.array(z.string().min(1).max(256)).min(1).max(64),
  /** Takedowns: expire now instead of serving the old page while a new one renders. */
  immediate: z.boolean().optional(),
});
const digest = (s: string) => createHash("sha256").update(s).digest();
/** Equal-length digests: constant time, and the secret's length never leaks. */
const same = (a: string, b: string) => timingSafeEqual(digest(a), digest(b));

/** The API calls this after a write (spec §6.2) so cached pages refresh without waiting. */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || !same(request.headers.get("x-revalidate-secret") ?? "", secret)) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success)
    return Response.json({ message: "Expected { tags: string[], immediate?: boolean }" }, { status: 400 });
  const profile = parsed.data.immediate ? { expire: 0 } : "max";
  for (const tag of parsed.data.tags) revalidateTag(tag, profile);
  return Response.json({ revalidated: parsed.data.tags, immediate: parsed.data.immediate === true });
}
```
In `apps/web/src/lib/unavailable.tsx`, inside both `catch` blocks and directly after `if (!(error instanceof ApiUnavailableError)) throw error;`, add:
```ts
      // Vercel keeps the last good page when a regeneration throws; caching the retry view would
      // replace it. Self-hosting keeps the retry view, and cache-handler.mjs refuses to store it.
      if (process.env.VERCEL) throw error;
```

- [ ] **Step 5: One-day time-based revalidate**

In `apps/web/src/lib/api.ts`, set `export const REVALIDATE = { lists: 86400, taxonomy: 86400 } as const;` and update its comment to: `/** Admin writes revalidate by tag; open-now is computed in the browser (Task 19), so a day is safe. */`.
In each of these files, change `export const revalidate = 300;` to `export const revalidate = 86400;`. It must stay a literal, because Next reads it statically:
`app/[locale]/page.tsx`, `app/[locale]/[place]/page.tsx`, `app/[locale]/[place]/[sector]/page.tsx`, `app/[locale]/[place]/[sector]/[kind]/page.tsx`, `app/[locale]/[place]/[sector]/[kind]/[business]/page.tsx`, `app/[locale]/[place]/[sector]/[kind]/[business]/[...rest]/page.tsx`, `app/[locale]/[place]/k/[kind]/page.tsx`, `app/[locale]/k/[kind]/page.tsx`. Leave `search/page.tsx` at `0`.
Grep for tests that assert 300: `grep -rn "300" apps/web/src --include=*.test.*`. Update any that check `REVALIDATE` or page revalidate values.

In `apps/web/.env.example`, replace `REVALIDATE_SECRET=change-me` with:
```bash
# Shared with apps/api REVALIDATE_SECRET. Production: at least 32 random characters (the server refuses less).
REVALIDATE_SECRET=change-me
# SITE_INDEXABLE=1  (self-hosted production only; Vercel indexes only VERCEL_ENV=production)
```

- [ ] **Step 6: Run the tests**

Run: `pnpm --filter @darb/web exec vitest run && pnpm --filter @darb/web typecheck`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src apps/web/.env.example
git commit -m "fix(web): constant-time revalidate with immediate takedowns, server-only, strict production env and siteUrl"
```

---

### Task 19: Open-now freshness on the client

**Files:**
- Modify: `packages/contracts/src/schemas.ts` (`BusinessSummarySchema.hours`)
- Modify: `apps/api/src/businesses/business.mapper.ts`, `apps/api/src/search/summary.ts`
- Modify: `apps/web/src/lib/rows.ts` (`BusinessRowData.hours`)
- Create: `apps/web/src/components/LiveOpenState.tsx`
- Test: `apps/web/src/components/LiveOpenState.test.tsx`
- Modify: `apps/web/src/components/BusinessRow.tsx`, `apps/web/src/components/ExperienceView.tsx`

**Interfaces:**
- Consumes: `isOpenAt(hours: Hours, at: Date): boolean` from `@darb/core`.
- Produces:
  - `BusinessSummaryDto.hours: Hours`.
  - `BusinessRowData.hours: Hours | null` (null when the business has no hours at all).
  - `<LiveOpenState openNow hours labels />`. It renders the server's value first (no hydration mismatch, no layout shift), then recomputes on mount and every 60 s.

- [ ] **Step 1: Write the failing test**

`apps/web/src/components/LiveOpenState.test.tsx`:
```tsx
import { act, render, screen } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { LiveOpenState } from "./LiveOpenState";

afterEach(() => vi.useRealTimers());
const labels = { open: "Open", closed: "Closed" };
// Tuesday (2), 09:00–19:00 Asia/Jerusalem.
const hours = { weekly: { "2": [{ open: "09:00", close: "19:00" }] }, exceptions: [] };

it("corrects a stale cached Open to Closed in the browser and keeps ticking", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-13T16:30:00Z")); // 19:30 in Jerusalem: closed
  render(<LiveOpenState openNow={true} hours={hours} labels={labels} />);
  expect(await screen.findByText("Closed")).toBeTruthy();
  vi.setSystemTime(new Date("2026-10-20T06:59:30Z")); // next Tuesday 09:59:30
  await act(async () => {
    vi.advanceTimersByTime(60_000);
  });
  expect(screen.getByText("Open")).toBeTruthy();
});

it("renders nothing for a business without hours", () => {
  const { container } = render(<LiveOpenState openNow={null} hours={null} labels={labels} />);
  expect(container.textContent).toBe("");
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @darb/web exec vitest run src/components/LiveOpenState.test.tsx`
Expected: FAIL. The module is missing.

- [ ] **Step 3: Carry hours in summaries**

In `packages/contracts/src/schemas.ts` `BusinessSummarySchema`, add after `openNow`:
```ts
  /** Weekly hours, so browsers recompute open-now on cached pages (Plan 4). */
  hours: HoursSchema,
```
`BusinessDetailSchema` already declares `hours`, so its `.extend` keeps working.
In `apps/api/src/businesses/business.mapper.ts` `toBusinessSummary`, add `hours: row.hours as unknown as BusinessSummaryDto["hours"],`.
In `apps/api/src/search/summary.ts` `candidateSummary`, add `hours: row.hours as BusinessSummaryDto["hours"],`.
In `apps/web/src/lib/rows.ts`:
- import `type Hours` from `@darb/core`;
- add `hours: Hours | null;` to `BusinessRowData`;
- in `toBusinessRow`, add `hours: b.openNow === null ? null : b.hours,`.

Fix the test fixtures that build `BusinessSummaryDto` or `BusinessRowData` literals (`grep -rln "openNow:" apps/web/src apps/api/src --include=*.test.*`). Add `hours: { weekly: {}, exceptions: [] }` to summaries and `hours: null` to rows.

- [ ] **Step 4: Implement the component**

`apps/web/src/components/LiveOpenState.tsx`:
```tsx
"use client";

import { useEffect, useState } from "react";
import { isOpenAt, type Hours } from "@darb/core";
import { OpenState } from "./Badges";

/**
 * Cached pages carry the open state of the moment they rendered. The browser recomputes it from
 * the hours (same isOpenAt as the API), so a page cached for a day never shows a stale "Open".
 */
export function LiveOpenState({
  openNow,
  hours,
  labels,
}: {
  openNow: boolean | null;
  hours: Hours | null;
  labels: { open: string; closed: string };
}) {
  const [open, setOpen] = useState(openNow);
  useEffect(() => {
    if (!hours) return;
    const tick = () => setOpen(isOpenAt(hours, new Date()));
    tick();
    const timer = window.setInterval(tick, 60_000);
    return () => window.clearInterval(timer);
  }, [hours]);
  return <OpenState openNow={open} labels={labels} />;
}
```
In `apps/web/src/components/BusinessRow.tsx`, import `LiveOpenState` and replace the `<OpenState …/>` element with:
```tsx
          <LiveOpenState
            openNow={row.openNow}
            hours={row.hours}
            labels={{ open: labels.openNow, closed: labels.closed }}
          />
```
Drop `OpenState` from the Badges import there. In `apps/web/src/components/ExperienceView.tsx`, make the same replacement with `openNow={business.openNow}` and `hours={business.openNow === null ? null : business.hours}`.

- [ ] **Step 5: Run the tests and budgets**

Run: `pnpm --filter @darb/contracts build && pnpm --filter @darb/api exec vitest run src/businesses src/search && pnpm --filter @darb/web exec vitest run && pnpm --filter @darb/web build && pnpm --filter @darb/web budget`
Expected: PASS. Level routes stay within 180 KB first-load and 40 KB route-specific; `isOpenAt` adds under 2 KB gzip.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts/src/schemas.ts apps/api/src apps/web/src
git commit -m "fix(web): recompute open-now in the browser from hours, so cached pages stay true"
```

---

### Task 20: Near-me off the query string and suggest rate limit (web)

**Files:**
- Modify: `apps/web/src/app/api/near/route.ts` (POST only) and `apps/web/src/app/api/near/route.test.ts`
- Modify: `apps/web/src/components/NearMe.tsx` and `apps/web/src/components/NearMe.test.tsx`
- Create: `apps/web/src/lib/rate-limit.ts`
- Test: `apps/web/src/lib/rate-limit.test.ts`
- Modify: `apps/web/src/app/api/search/suggest/route.ts`

**Interfaces:**
- Produces:
  - `POST /api/near` with JSON `{ locale, lat, lng, kind? }`. Coordinates are rounded to about 110 m (`roundPoint`) before reaching the API. `GET` answers 405. Access logs (Vercel, Railway) record paths only, so no position appears in any log.
  - `createLimiter(limit: number, windowMs?: number): (key: string, now?: number) => boolean`. It is an in-memory fixed window per process and is cleared above 50,000 keys.
  - `GET /api/search/suggest` allows 120 requests a minute per visitor IP (`clientIpFrom`) per instance, and returns 429 `{ options: [] }` with `retry-after` beyond that.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/rate-limit.test.ts`:
```ts
import { expect, it } from "vitest";
import { createLimiter } from "./rate-limit";

it("allows up to the limit per key per window", () => {
  const allow = createLimiter(2, 60_000);
  expect([allow("a", 0), allow("a", 1), allow("a", 2), allow("b", 3)]).toEqual([true, true, false, true]);
  expect(allow("a", 60_000)).toBe(true);
});
```
In `apps/web/src/app/api/near/route.test.ts`, change every request to a POST with a JSON body. Read the file first, and keep its mocks. Use this shape:
```ts
const near = (body: unknown) =>
  POST(new Request("http://web.test/api/near", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) }));
```
Add:
```ts
it("rounds the position before it reaches the API", async () => {
  await near({ locale: "en", lat: 32.8486259, lng: 35.3358268 });
  expect(getNearestPlace).toHaveBeenCalledWith(32.849, 35.336, "no-store");
});

it("refuses GET, so positions never sit in a URL", async () => {
  const { GET } = await import("./route");
  expect(GET).toBeUndefined();
});
```
(Use the mocked function names the file already defines. If the mock is named differently, use that name.)
In `apps/web/src/components/NearMe.test.tsx`, change the fetch assertion to expect `("/api/near", expect.objectContaining({ method: "POST" }))` and check that the request URL holds no `lat=`.

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/lib/rate-limit.test.ts src/app/api/near src/components/NearMe.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Implement**

`apps/web/src/lib/rate-limit.ts`:
```ts
/**
 * A per-process fixed-window limiter. On Vercel each function instance counts on its own, so this
 * is a soft guard against one visitor hammering suggest; the API limits direct callers itself.
 */
export function createLimiter(limit: number, windowMs = 60_000) {
  const hits = new Map<string, { window: number; count: number }>();
  return (key: string, now: number = Date.now()): boolean => {
    const window = Math.floor(now / windowMs);
    const entry = hits.get(key);
    if (!entry || entry.window !== window) {
      if (hits.size > 50_000) hits.clear();
      hits.set(key, { window, count: 1 });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  };
}
```
In `apps/web/src/app/api/near/route.ts`:
- rename `GET` to `POST`;
- parse `await request.json().catch(() => null)` instead of the search params;
- change the coordinate schema to `z.number().min(min).max(max)`;
- round before calling: `const { lat, lng } = roundPoint(parsed.data);` (import `roundPoint` from `@/lib/client-ip`);
- update the doc comment to `/** A person's position: in the body (never a URL or a log), rounded, never cached. */`.

In `apps/web/src/components/NearMe.tsx`, replace `fetch(\`/api/near?${query}\`)` with:
```ts
          const res = await fetch("/api/near", {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify(payload),
          });
```
Here `payload` is the object the component previously turned into `query` (`{ locale, lat, lng, kind? }`), with numbers rather than strings. Remove the `URLSearchParams` construction.

In `apps/web/src/app/api/search/suggest/route.ts`, add:
```ts
import { clientIpFrom } from "@/lib/client-ip";
import { createLimiter } from "@/lib/rate-limit";

const allow = createLimiter(120);
```
At the start of `GET`, add:
```ts
  if (!allow(clientIpFrom(request.headers)))
    return Response.json({ options: [] }, { status: 429, headers: { "retry-after": "60" } });
```

- [ ] **Step 4: Run the tests**

Run: `pnpm --filter @darb/web exec vitest run`
Expected: PASS.

- [ ] **Step 5: Run the e2e near-me spec**

Run: `pnpm --filter @darb/web build && pnpm --filter @darb/web exec playwright test e2e/nearme.spec.ts`
Expected: PASS. If the spec intercepted `/api/near?…` with `page.route`, update the route glob to `**/api/near` and assert `request.method() === "POST"`.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src apps/web/e2e/nearme.spec.ts
git commit -m "fix(web): near-me sends a rounded position in a POST body; suggest is rate-limited per visitor"
```

---

### Task 21: Tiles env guard and the public CSP

**Files:**
- Modify: `apps/web/src/stage/vendor.ts` (`tilesUrl()`, nullable `TILES_URL`) and `apps/web/src/stage/vendor.test.ts`
- Modify: `apps/web/src/stage/city-map.ts` (non-null at use)
- Modify: `apps/web/src/app/[locale]/layout.tsx` (no boot script or stage without tiles)
- Create: `apps/web/src/lib/csp.ts`
- Test: `apps/web/src/lib/csp.test.ts`, `apps/web/src/proxy.test.ts`
- Modify: `apps/web/src/proxy.ts` (security headers on every page)
- Modify: `apps/web/e2e/stage.spec.ts` (CSP test)
- Modify: `apps/web/.env.example`, `.github/workflows/ci.yml` (`NEXT_PUBLIC_LOCAL_TILES: "1"`)
- Create: `infra/r2/tiles-cors.json`

**Interfaces:**
- Produces:
  - `tilesUrl(env?): string | null`. It returns `NEXT_PUBLIC_MAP_TILES_URL`; otherwise the local `/api/tiles/israel.pmtiles` outside production or when `NEXT_PUBLIC_LOCAL_TILES === "1"`; otherwise `null`. When it is null, the stage never boots and the list is the city.
  - `TILES_URL: string | null`.
  - `tilesOrigin(): string | null`. The origin of an absolute tiles URL.
  - `publicCsp(opts: { tilesOrigin: string | null; dev: boolean }): string`.
  - `adminCsp(opts: { nonce: string; clerkOrigin: string | null; dev: boolean }): string`. It is used by Task 23.
  - `securityHeaders(): Record<string, string>`. `X-Content-Type-Options`, `Referrer-Policy` and `Permissions-Policy`.
  - `infra/r2/tiles-cors.json`. The CORS rules the owner applies to the R2 bucket in Task 30.

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/csp.test.ts`:
```ts
import { expect, it } from "vitest";
import { adminCsp, publicCsp } from "./csp";

const directive = (csp: string, name: string) => csp.split("; ").find((d) => d.startsWith(`${name} `)) ?? "";

it("public pages: workers from self, tiles from R2, nothing framed or embedded", () => {
  const csp = publicCsp({ tilesOrigin: "https://tiles.darb.co.il", dev: false });
  expect(directive(csp, "worker-src")).toBe("worker-src 'self'");
  expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://tiles.darb.co.il");
  expect(directive(csp, "frame-ancestors")).toBe("frame-ancestors 'none'");
  expect(directive(csp, "object-src")).toBe("object-src 'none'");
  expect(directive(csp, "script-src")).toBe("script-src 'self' 'unsafe-inline'");
  expect(csp).not.toContain("nonce-");
});

it("development adds eval and the HMR socket only", () => {
  const csp = publicCsp({ tilesOrigin: null, dev: true });
  expect(directive(csp, "script-src")).toContain("'unsafe-eval'");
  expect(directive(csp, "connect-src")).toBe("connect-src 'self' ws:");
});

it("admin pages: a nonce with strict-dynamic, and Clerk's origin", () => {
  const csp = adminCsp({ nonce: "abc", clerkOrigin: "https://clerk.darb.co.il", dev: false });
  expect(directive(csp, "script-src")).toBe("script-src 'self' 'nonce-abc' 'strict-dynamic' https://clerk.darb.co.il https://challenges.cloudflare.com");
  expect(directive(csp, "connect-src")).toBe("connect-src 'self' https://clerk.darb.co.il");
  expect(directive(csp, "frame-src")).toBe("frame-src https://challenges.cloudflare.com");
  expect(directive(csp, "img-src")).toBe("img-src 'self' data: https://img.clerk.com");
});
```
`apps/web/src/proxy.test.ts`:
```ts
// @vitest-environment node
import { NextRequest } from "next/server";
import { expect, it } from "vitest";
import { proxy } from "./proxy";

it("puts the CSP and security headers on city pages", async () => {
  const res = await proxy(new NextRequest("http://localhost:3000/sakhnin"));
  expect(res.headers.get("content-security-policy")).toContain("worker-src 'self'");
  expect(res.headers.get("x-content-type-options")).toBe("nosniff");
});
```
Append to `apps/web/src/stage/vendor.test.ts`:
```ts
import { tilesUrl } from "./vendor";

it("never boots the stage in production without a tiles URL", () => {
  expect(tilesUrl({ url: "https://tiles.darb.co.il/israel-20261001.pmtiles", local: undefined, nodeEnv: "production" })).toBe(
    "https://tiles.darb.co.il/israel-20261001.pmtiles",
  );
  expect(tilesUrl({ url: undefined, local: undefined, nodeEnv: "production" })).toBeNull();
  expect(tilesUrl({ url: undefined, local: "1", nodeEnv: "production" })).toBe("/api/tiles/israel.pmtiles");
  expect(tilesUrl({ url: "", local: undefined, nodeEnv: "development" })).toBe("/api/tiles/israel.pmtiles");
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/lib/csp.test.ts src/proxy.test.ts src/stage/vendor.test.ts`
Expected: FAIL.

- [ ] **Step 3: Tiles guard**

In `apps/web/src/stage/vendor.ts`, replace the `TILES_URL` declaration and its comment with:
```ts
/**
 * The Israel PMTiles archive: R2 in production (NEXT_PUBLIC_MAP_TILES_URL), the local route in
 * development, e2e and self-hosting (NEXT_PUBLIC_LOCAL_TILES=1). A production build with neither
 * gets null and never boots the stage: the list is the whole city (spec §7). Inlined at build.
 */
export function tilesUrl(
  env: { url: string | undefined; local: string | undefined; nodeEnv: string | undefined } = {
    url: process.env.NEXT_PUBLIC_MAP_TILES_URL,
    local: process.env.NEXT_PUBLIC_LOCAL_TILES,
    nodeEnv: process.env.NODE_ENV,
  },
): string | null {
  if (env.url) return env.url;
  if (env.nodeEnv !== "production" || env.local === "1") return "/api/tiles/israel.pmtiles";
  return null;
}
export const TILES_URL = tilesUrl();

/** The tiles origin for connect-src, when tiles live on another origin (R2). */
export function tilesOrigin(url: string | null = TILES_URL): string | null {
  return url && /^https?:\/\//.test(url) ? new URL(url).origin : null;
}
```
In `apps/web/src/stage/city-map.ts`, change `tilesUrl: TILES_URL,` to `tilesUrl: TILES_URL ?? "",`. The stage only mounts when it is non-null.
In `apps/web/src/app/[locale]/layout.tsx`, import `TILES_URL` from `@/stage/vendor` and add `const stage = TILES_URL !== null;` in `RootLayout`. Render the `<script id="darb-stage-boot" …>` only when `stage` is true (`{stage ? <script … /> : null}`), and render `<StageMount …/>` the same way.
In `apps/web/.env.example`, add this under the tiles comment:
```bash
# A production build (next build) without NEXT_PUBLIC_MAP_TILES_URL shows no map unless this is 1
# (local `next start`, e2e, self-hosting with MAP_TILES_DIR).
NEXT_PUBLIC_LOCAL_TILES=1
```
In `.github/workflows/ci.yml` job `env:`, add `NEXT_PUBLIC_LOCAL_TILES: "1"` with the comment `# e2e serves the 1 KB fixture through /api/tiles (no R2 in CI)`.

- [ ] **Step 4: CSP and the proxy**

`apps/web/src/lib/csp.ts`:
```ts
type Directives = Record<string, string[]>;

const serialize = (d: Directives) =>
  Object.entries(d)
    .map(([k, v]) => (v.length ? `${k} ${v.join(" ")}` : k))
    .join("; ");

const base = (dev: boolean): Directives => ({
  "default-src": ["'self'"],
  "style-src": ["'self'", "'unsafe-inline'"],
  "img-src": ["'self'", "data:"],
  "font-src": ["'self'"],
  "worker-src": ["'self'"],
  "manifest-src": ["'self'"],
  "object-src": ["'none'"],
  "base-uri": ["'self'"],
  "form-action": ["'self'"],
  "frame-ancestors": ["'none'"],
  ...(dev ? {} : { "upgrade-insecure-requests": [] }),
});

/**
 * ISR pages cannot carry a per-request nonce (Next applies nonces only to dynamic renders), so
 * scripts are 'self' plus 'unsafe-inline' for Next's flight scripts and the stage boot script; a
 * hash would switch 'unsafe-inline' off and block them. Everything else is locked down.
 */
export function publicCsp({ tilesOrigin, dev }: { tilesOrigin: string | null; dev: boolean }): string {
  return serialize({
    ...base(dev),
    "script-src": ["'self'", "'unsafe-inline'", ...(dev ? ["'unsafe-eval'"] : [])],
    "connect-src": ["'self'", ...(tilesOrigin ? [tilesOrigin] : []), ...(dev ? ["ws:"] : [])],
  });
}

/** /admin renders per request, so it gets a real nonce (Clerk's script loads under strict-dynamic). */
export function adminCsp({ nonce, clerkOrigin, dev }: { nonce: string; clerkOrigin: string | null; dev: boolean }): string {
  const clerk = clerkOrigin ? [clerkOrigin] : [];
  return serialize({
    ...base(dev),
    "script-src": [
      "'self'",
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      ...clerk,
      "https://challenges.cloudflare.com",
      ...(dev ? ["'unsafe-eval'"] : []),
    ],
    "connect-src": ["'self'", ...clerk, ...(dev ? ["ws:"] : [])],
    "img-src": ["'self'", "data:", "https://img.clerk.com"],
    "frame-src": ["https://challenges.cloudflare.com"],
    "worker-src": ["'self'", "blob:"],
  });
}

export function securityHeaders(): Record<string, string> {
  return {
    "x-content-type-options": "nosniff",
    "referrer-policy": "strict-origin-when-cross-origin",
    "permissions-policy": "geolocation=(self), camera=(), microphone=(), payment=()",
  };
}
```
Replace `apps/web/src/proxy.ts`:
```ts
import { NextResponse, type NextRequest } from "next/server";
import { publicCsp, securityHeaders } from "./lib/csp";
import { routeLocale } from "./lib/locale-path";
import { tilesOrigin } from "./stage/vendor";

const DEV = process.env.NODE_ENV !== "production";
const PUBLIC_CSP = publicCsp({ tilesOrigin: tilesOrigin(), dev: DEV });

function withHeaders(res: NextResponse): NextResponse {
  res.headers.set("content-security-policy", PUBLIC_CSP);
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  return res;
}

export async function proxy(request: NextRequest): Promise<NextResponse> {
  const route = routeLocale(request.nextUrl.pathname);
  if (route.action === "next") return withHeaders(NextResponse.next());
  const url = request.nextUrl.clone();
  url.pathname = route.pathname;
  return withHeaders(route.action === "redirect" ? NextResponse.redirect(url, 308) : NextResponse.rewrite(url));
}

export const config = {
  // Route handlers, Next internals, brand files and anything with a file extension skip the proxy.
  matcher: ["/((?!api/|_next/|brand/|.*\\..*).*)"],
};
```
`infra/r2/tiles-cors.json` (the R2 API's CORS rule format, applied with `wrangler r2 bucket cors set` in Task 30):
```json
{
  "rules": [
    {
      "allowed": {
        "origins": ["*"],
        "methods": ["GET", "HEAD"],
        "headers": ["Range", "If-Match", "If-None-Match", "If-Range"]
      },
      "exposeHeaders": ["ETag", "Content-Range", "Content-Length", "Accept-Ranges"],
      "maxAgeSeconds": 86400
    }
  ]
}
```
(Public, read-only, uncredentialed tiles. `*` also covers Vercel preview origins.)

- [ ] **Step 5: An e2e test under the real header**

Append to `apps/web/e2e/stage.spec.ts`. Import `settleStage` from `./fixtures` if it is not imported yet:
```ts
test("the city and its map load under the production CSP", async ({ page }) => {
  const violations: string[] = [];
  page.on("console", (m) => {
    if (/Content Security Policy|Refused to/i.test(m.text())) violations.push(m.text());
  });
  const res = await page.goto("/sakhnin");
  expect(res?.headers()["content-security-policy"]).toContain("worker-src 'self'");
  await settleStage(page);
  expect(violations).toEqual([]);
});
```

- [ ] **Step 6: Run everything for the web**

Run: `pnpm --filter @darb/web exec vitest run && NEXT_PUBLIC_LOCAL_TILES=1 pnpm --filter @darb/web build && pnpm --filter @darb/web budget && pnpm --filter @darb/web e2e`
Expected: PASS. The whole e2e suite passes with the CSP on, and the budgets are unchanged.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src apps/web/e2e/stage.spec.ts apps/web/.env.example .github/workflows/ci.yml infra/r2/tiles-cors.json
git commit -m "feat(web): CSP and security headers, no stage without a tiles URL, R2 CORS rules"
```

---

### Task 22: robots, sitemap, previews `noindex`, global-not-found

**Files:**
- Create: `apps/api/src/businesses/sitemap.controller.ts`; modify `apps/api/src/businesses/businesses.module.ts`
- Modify: `packages/contracts/src/contract.ts` (`sitemap.businesses`) and `packages/contracts/src/schemas.ts` (`SitemapBusinessSchema`)
- Test: `apps/api/src/businesses/sitemap.controller.test.ts`
- Modify: `apps/web/src/lib/api.ts` (`getSitemapBusinesses`)
- Create: `apps/web/src/app/robots.ts`, `apps/web/src/app/sitemap.ts`, `apps/web/src/app/global-not-found.tsx`
- Test: `apps/web/src/app/robots.test.ts`, `apps/web/src/app/sitemap.test.ts`
- Modify: `apps/web/next.config.ts` (`experimental.globalNotFound`)
- Modify: `apps/web/src/proxy.ts` (`x-robots-tag` when not indexable)
- Modify: `apps/web/src/components/BusinessLevelView.tsx` (example businesses are `noindex`)

**Interfaces:**
- Produces:
  - API `GET /sitemap/businesses` returns `{ placeSlug, slug, primaryKindId, updatedAt }[]`. It covers published, non-example businesses in live places whose primary kind is active.
  - Web `/robots.txt`. Production allows everything except `/admin`, `/ar/admin`, `/en/admin`, `/api/` and the search pages, and lists `/sitemap/0.xml`, `/sitemap/1.xml` and `/sitemap/2.xml`. Every other deployment gets `Disallow: /`.
  - `/sitemap/{0,1,2}.xml` (he, ar, en) list home, live places, place × sector, nationwide kinds and real businesses, with language alternates.
  - `x-robots-tag: noindex, nofollow` on every proxied page when `!indexable()`.

- [ ] **Step 1: Write the failing tests**

`apps/api/src/businesses/sitemap.controller.test.ts`:
```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";

let app: INestApplication;
beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  const f = await seedFixtures(created.prisma);
  await created.prisma.business.update({ where: { id: f.abuSalim.id }, data: { tier: "darb" } });
});
afterAll(() => app.close());

it("lists only real (non-example) published businesses", async () => {
  const res = await request(app.getHttpServer()).get("/sitemap/businesses");
  expect(res.status).toBe(200);
  expect(res.body.map((b: { slug: string }) => b.slug)).toEqual(["abu-salim"]);
});
```
(Fixture check: the fixture businesses' `tier` must be `example`. If `base` in `test/fixtures.ts` uses another tier, set every other fixture business to `example` in this test's `beforeAll`.)

`apps/web/src/app/robots.test.ts`:
```ts
// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";
import robots from "./robots";

afterEach(() => vi.unstubAllEnvs());

it("blocks everything off production", () => {
  vi.stubEnv("VERCEL_ENV", "preview");
  vi.stubEnv("VERCEL_URL", "x.vercel.app");
  expect(robots().rules).toEqual([{ userAgent: "*", disallow: "/" }]);
});

it("opens production except admin, api and search, and lists the sitemaps", () => {
  vi.stubEnv("VERCEL_ENV", "production");
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  const r = robots();
  expect(r.rules).toEqual([
    { userAgent: "*", allow: "/", disallow: ["/admin", "/ar/admin", "/en/admin", "/api/", "/search", "/ar/search", "/en/search"] },
  ]);
  expect(r.sitemap).toEqual([0, 1, 2].map((i) => `https://darb.co.il/sitemap/${i}.xml`));
});
```
`apps/web/src/app/sitemap.test.ts`:
```ts
// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

vi.mock("@/lib/api", () => ({
  getPlaces: async () => [{ id: "p", slug: "sakhnin", type: "city", name: { en: "Sakhnin" }, status: "live", lat: 0, lng: 0, parentId: null }],
  getTaxonomy: async () => ({
    sectors: [{ id: "s", slug: "food", name: { en: "Food" }, tagline: { en: "" }, accent: "#000000", order: 1, kinds: [{ id: "k", slug: "restaurants", sectorId: "s", parentKindId: null, name: { en: "Restaurants" }, template: "menu", attributes: [], icon: null, order: 1 }] }],
  }),
  getSitemapBusinesses: async () => [{ placeSlug: "sakhnin", slug: "caramel", primaryKindId: "k", updatedAt: "2026-10-13T00:00:00.000Z" }],
}));
const { default: sitemap, generateSitemaps } = await import("./sitemap");
afterEach(() => vi.unstubAllEnvs());

it("has one sitemap per locale with places, sectors, kinds and real businesses", async () => {
  vi.stubEnv("SITE_URL", "https://darb.co.il");
  expect(await generateSitemaps()).toEqual([{ id: 0 }, { id: 1 }, { id: 2 }]);
  const en = await sitemap({ id: Promise.resolve("2") });
  const urls = en.map((e) => e.url);
  expect(urls).toEqual([
    "https://darb.co.il/en",
    "https://darb.co.il/en/sakhnin",
    "https://darb.co.il/en/sakhnin/food",
    "https://darb.co.il/en/k/restaurants",
    "https://darb.co.il/en/sakhnin/food/restaurants/caramel",
  ]);
  expect(en[1]?.alternates?.languages).toMatchObject({ he: "https://darb.co.il/sakhnin" });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/api exec vitest run src/businesses/sitemap.controller.test.ts && pnpm --filter @darb/web exec vitest run src/app/robots.test.ts src/app/sitemap.test.ts`
Expected: FAIL.

- [ ] **Step 3: API endpoint**

In `packages/contracts/src/schemas.ts`, append:
```ts
export const SitemapBusinessSchema = z.object({
  placeSlug: SlugSchema,
  slug: SlugSchema,
  primaryKindId: z.string(),
  updatedAt: z.string(),
});
export type SitemapBusinessDto = z.infer<typeof SitemapBusinessSchema>;
```
In `contract.ts`, import it and add a router key:
```ts
  sitemap: {
    businesses: {
      method: "GET",
      path: "/sitemap/businesses",
      responses: { 200: z.array(SitemapBusinessSchema) },
    },
  },
```
`apps/api/src/businesses/sitemap.controller.ts`:
```ts
import { Controller } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { PrismaService } from "../prisma/prisma.service.js";

/** Real businesses for the web sitemap; showroom examples are noindex (Plan 4 decision 4). */
@Controller()
export class SitemapController {
  constructor(private readonly prisma: PrismaService) {}

  @TsRestHandler(contract.sitemap)
  handler() {
    return tsRestHandler(contract.sitemap, {
      businesses: async () => {
        const rows = await this.prisma.business.findMany({
          where: {
            status: "published",
            tier: { not: "example" },
            place: { is: { status: "live" } },
            primaryKind: { is: { status: "active" } },
          },
          select: { slug: true, primaryKindId: true, updatedAt: true, place: { select: { slug: true } } },
          orderBy: [{ placeId: "asc" }, { slug: "asc" }],
          take: 40_000,
        });
        return {
          status: 200,
          body: rows.map((r) => ({
            placeSlug: r.place.slug,
            slug: r.slug,
            primaryKindId: r.primaryKindId,
            updatedAt: r.updatedAt.toISOString(),
          })),
        };
      },
    });
  }
}
```
Add `SitemapController` to `controllers` in `businesses.module.ts`.

- [ ] **Step 4: Web robots, sitemap and noindex**

In `apps/web/src/lib/api.ts`, import `type SitemapBusinessDto` and append:
```ts
export async function getSitemapBusinesses(): Promise<SitemapBusinessDto[]> {
  const res = await call(() =>
    client().sitemap.businesses({ fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses)) }),
  );
  return res.status === 200 ? res.body : [];
}
```
`apps/web/src/app/robots.ts`:
```ts
import type { MetadataRoute } from "next";
import { LOCALES } from "@darb/core";
import { indexable, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: [{ userAgent: "*", disallow: "/" }] };
  const site = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/admin", "/ar/admin", "/en/admin", "/api/", "/search", "/ar/search", "/en/search"],
      },
    ],
    sitemap: LOCALES.map((_, i) => `${site}/sitemap/${i}.xml`),
  };
}
```
`apps/web/src/app/sitemap.ts`:
```ts
import type { MetadataRoute } from "next";
import { LOCALES } from "@darb/core";
import { getPlaces, getSitemapBusinesses, getTaxonomy } from "@/lib/api";
import { href, languageAlternates, paths } from "@/lib/routes";
import { siteUrl } from "@/lib/site";

export const revalidate = 86400;

export async function generateSitemaps() {
  return LOCALES.map((_, id) => ({ id }));
}

/** One sitemap per locale: places, place × sector, nationwide kinds, and real businesses. */
export default async function sitemap(props: { id: Promise<string> }): Promise<MetadataRoute.Sitemap> {
  const locale = LOCALES[Number(await props.id)] ?? "he";
  const site = siteUrl();
  const [places, taxonomy, businesses] = await Promise.all([getPlaces("live"), getTaxonomy(), getSitemapBusinesses()]);
  const kinds = new Map(taxonomy.sectors.flatMap((s) => s.kinds.map((k) => [k.id, { kind: k.slug, sector: s.slug }])));
  const absolute = (segments: string[]) => `${site}${href(locale, segments) === "/" ? "" : href(locale, segments)}`;
  const entry = (segments: string[], lastModified?: string): MetadataRoute.Sitemap[number] => ({
    url: segments.length === 0 && locale === "he" ? `${site}/` : absolute(segments),
    ...(lastModified ? { lastModified } : {}),
    alternates: {
      languages: Object.fromEntries(
        Object.entries(languageAlternates(segments)).map(([l, u]) => [l, `${site}${u === "/" ? "" : u}`]),
      ),
    },
  });
  return [
    entry(paths.home()),
    ...places.map((p) => entry(paths.place(p.slug))),
    ...places.flatMap((p) => taxonomy.sectors.map((s) => entry(paths.sector(p.slug, s.slug)))),
    ...[...kinds.values()].map((k) => entry(["k", k.kind])),
    ...businesses.flatMap((b) => {
      const k = kinds.get(b.primaryKindId);
      return k ? [entry(paths.business(b.placeSlug, k.sector, k.kind, b.slug), b.updatedAt)] : [];
    }),
  ];
}
```
(Check `languageAlternates(segments)` in `src/lib/routes.ts`: its keys are locale codes and its values are site-relative paths, which the test relies on for `he: "https://darb.co.il/sakhnin"`. If it returns absolute URLs or uses `x-default`, adapt the mapping and keep the test's expectation. The home URL rules in the test are: `/en` for English home and `https://darb.co.il/` for Hebrew home.)

In `apps/web/src/proxy.ts`, import `indexable` from `./lib/site`. Inside `withHeaders`, add:
```ts
  if (!indexable()) res.headers.set("x-robots-tag", "noindex, nofollow");
```
`site.ts` imports `server-only`, and the proxy runs on the server, so this is fine. If the proxy build rejects `server-only`, move `indexable` into `src/lib/indexable.ts` without that import and re-export it from `site.ts`.

In `apps/web/src/components/BusinessLevelView.tsx` `businessLevelMetadata`, wrap the return value:
```ts
  const meta = pageMetadata({ … unchanged … });
  // Showroom examples are fictional: kept out of search engines (Plan 4 decision 4).
  return business.tier === "example" ? { ...meta, robots: { index: false, follow: true } } : meta;
```

- [ ] **Step 5: global-not-found**

In `apps/web/next.config.ts`, add `experimental: { globalNotFound: true },` to `config`.
`apps/web/src/app/global-not-found.tsx`:
```tsx
import type { Metadata } from "next";
import { colors } from "@darb/tokens";
import "./globals.css";

export const metadata: Metadata = { title: "404 · Darb", robots: { index: false } };

/** Unmatched URLs outside every root layout (e.g. /api/nope). Bilingual, links home. */
export default function GlobalNotFound() {
  return (
    <html lang="he" dir="rtl">
      <body style={{ background: colors.night, color: colors.ivory, fontFamily: "system-ui, sans-serif", display: "grid", placeItems: "center", minHeight: "100dvh", margin: 0 }}>
        <main style={{ textAlign: "center", padding: 24 }}>
          <h1 style={{ fontSize: 28, margin: 0 }}>הדף לא נמצא · الصفحة غير موجودة</h1>
          <p lang="en" dir="ltr">This page does not exist.</p>
          <p>
            <a href="/" style={{ color: colors.gold }}>דרב · درب · Darb</a>
          </p>
        </main>
      </body>
    </html>
  );
}
```
(Check the token names in `packages/tokens/src/index.ts`. If `colors.ivory` or `colors.gold` are named differently, for example `ivory1` or `gold3`, use the existing names.)

- [ ] **Step 6: Run the tests and a smoke build**

Run: `pnpm --filter @darb/contracts build && pnpm --filter @darb/api exec vitest run src/businesses && pnpm --filter @darb/web exec vitest run && NEXT_PUBLIC_LOCAL_TILES=1 pnpm --filter @darb/web build`
Expected: PASS. The build lists `/robots.txt`, `/sitemap/[__metadata_id__]` and the global not-found.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src/businesses packages/contracts/src apps/web/src apps/web/next.config.ts
git commit -m "feat(web): robots, per-locale sitemaps of real pages, noindex off production and for examples, global 404"
```

---

## Part E: Admin UI (`/admin`, spec §6.3)

Admin lives in its own root layout at `app/admin/[locale]`, so the public `[locale]` layout, its stage, its fonts budget and its ISR never see Clerk. Public URLs are `/admin`, `/ar/admin` and `/en/admin`, and the proxy rewrites them to `/admin/{he|ar|en}/…`. Every admin response is `no-store` and `noindex`.

### Task 23: Admin shell: routing, Clerk, nonce CSP, copy and sign-in

**Files:**
- Create: `apps/web/src/admin/mode.ts`, `apps/web/src/admin/routes.ts`, `apps/web/src/admin/copy.ts`, `apps/web/src/admin/auth.ts`, `apps/web/src/admin/api.ts`, `apps/web/src/admin/session-actions.ts`, `apps/web/src/admin/AdminShell.tsx`, `apps/web/src/admin/SignOut.tsx`, `apps/web/src/admin/admin.module.css`
- Create: `apps/web/src/app/admin/[locale]/layout.tsx`, `apps/web/src/app/admin/[locale]/sign-in/[[...sign-in]]/page.tsx`, `apps/web/src/app/admin/[locale]/(app)/layout.tsx`, `apps/web/src/app/admin/[locale]/(app)/page.tsx`
- Modify: `apps/web/src/proxy.ts` (admin branch)
- Test: `apps/web/src/admin/routes.test.ts`, `apps/web/src/admin/mode.test.ts`, `apps/web/src/admin/copy.test.ts`, `apps/web/src/proxy.test.ts` (append)
- Modify: `apps/web/.env.example`

**Interfaces:**
- Consumes: `contract.admin` (Task 13), `adminCsp` and `securityHeaders` (Task 21), `ClerkProvider`, `SignIn` and `SignOutButton` from `@clerk/nextjs`, `clerkMiddleware` and `auth` from `@clerk/nextjs/server`, and `heIL`, `arSA` and `enUS` from `@clerk/localizations`.
- Produces:
```ts
// mode.ts (no server-only: the proxy imports it)
export type AdminAuthMode = "clerk" | "fake" | "off";
export const FAKE_COOKIE = "darb_admin_fake";
export function adminAuthMode(env?): AdminAuthMode;  // fake only with ADMIN_FAKE_AUTH=1 on a localhost SITE_URL
export function clerkOrigin(publishableKey: string | undefined): string | null; // pk_… → https://<frontend api host>
// routes.ts
export function adminRoute(pathname: string): { locale: Locale; rest: string } | null;
export function adminHref(locale: Locale, path?: string): string; // ("ar", "/places") → "/ar/admin/places"
// copy.ts
export type AdminKey = keyof typeof en;
export function at(locale: Locale, key: AdminKey, vars?: Record<string, string | number>): string;
// auth.ts (server-only)
export function adminToken(): Promise<string | null>;
// api.ts (server-only)
export function adminApi(): Promise<AdminClient>; // ts-rest client for contract.admin, Bearer token, no-store
export type AdminSession = { status: "ok"; clerkUserId: string } | { status: "signed-out" } | { status: "forbidden" } | { status: "off" };
export function adminSession(): Promise<AdminSession>;
export function okOr<T>(res: { status: number; body: unknown }, locale: Locale): T; // 200/201 body, else redirect or notFound
// AdminShell.tsx
export function AdminShell(props: { locale: Locale; path: string; mode: AdminAuthMode; children: ReactNode }): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

`apps/web/src/admin/routes.test.ts`:
```ts
import { expect, it } from "vitest";
import { adminHref, adminRoute } from "./routes";

it("maps public admin URLs to their locale and rest", () => {
  expect(adminRoute("/admin")).toEqual({ locale: "he", rest: "" });
  expect(adminRoute("/admin/places/123")).toEqual({ locale: "he", rest: "/places/123" });
  expect(adminRoute("/ar/admin/kinds")).toEqual({ locale: "ar", rest: "/kinds" });
  expect(adminRoute("/en/admin")).toEqual({ locale: "en", rest: "" });
  expect(adminRoute("/administration")).toBeNull();
  expect(adminRoute("/sakhnin/admin")).toBeNull();
  expect(adminRoute("/he/admin")).toBeNull(); // the locale proxy redirects /he/… to /…
});

it("builds public admin URLs", () => {
  expect(adminHref("he")).toBe("/admin");
  expect(adminHref("ar", "/places")).toBe("/ar/admin/places");
});
```
`apps/web/src/admin/mode.test.ts`:
```ts
import { expect, it } from "vitest";
import { adminAuthMode, clerkOrigin } from "./mode";

it("uses Clerk when both keys are set", () => {
  expect(adminAuthMode({ NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "pk_test_x", CLERK_SECRET_KEY: "sk_test_x" })).toBe("clerk");
  expect(adminAuthMode({})).toBe("off");
});

it("allows fake auth on localhost only", () => {
  expect(adminAuthMode({ ADMIN_FAKE_AUTH: "1", SITE_URL: "http://localhost:3100" })).toBe("fake");
  expect(adminAuthMode({ ADMIN_FAKE_AUTH: "1", SITE_URL: "https://darb.co.il" })).toBe("off");
  expect(adminAuthMode({ ADMIN_FAKE_AUTH: "1" })).toBe("off");
});

it("derives Clerk's frontend API origin from the publishable key", () => {
  const key = `pk_live_${Buffer.from("clerk.darb.co.il$").toString("base64")}`;
  expect(clerkOrigin(key)).toBe("https://clerk.darb.co.il");
  expect(clerkOrigin(undefined)).toBeNull();
  expect(clerkOrigin("garbage")).toBeNull();
});
```
`apps/web/src/admin/copy.test.ts`:
```ts
import { expect, it } from "vitest";
import { adminCopy, at } from "./copy";

it("has every key in every locale, never empty, and never the word halal", () => {
  const keys = Object.keys(adminCopy.en).sort();
  for (const locale of ["he", "ar", "en"] as const) {
    expect(Object.keys(adminCopy[locale]).sort()).toEqual(keys);
    for (const v of Object.values(adminCopy[locale])) {
      expect(v.trim()).not.toBe("");
      expect(v).not.toMatch(/halal|חלאל|حلال/i);
    }
  }
});

it("fills variables", () => {
  expect(at("en", "reportDays", { days: 30 })).toBe("Last 30 days");
});
```
Append to `apps/web/src/proxy.test.ts`:
```ts
import { NextFetchEvent } from "next/server";

it("rewrites admin URLs with a nonce CSP, noindex and no-store", async () => {
  const req = new NextRequest("http://localhost:3000/ar/admin/places");
  const res = await proxy(req, new NextFetchEvent({ request: req, page: "/" }));
  expect(res.headers.get("x-middleware-rewrite")).toBe("http://localhost:3000/admin/ar/places");
  expect(res.headers.get("content-security-policy")).toMatch(/'nonce-[A-Za-z0-9+/=]+' 'strict-dynamic'/);
  expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  expect(res.headers.get("cache-control")).toBe("no-store");
});
```
(If the `NextFetchEvent` constructor signature differs in Next 16.3.6, check `node_modules/next/dist/server/web/spec-extension/fetch-event.d.ts` and build it the way its typings ask. The proxy only passes the event to Clerk.)

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/admin src/proxy.test.ts`
Expected: FAIL. The modules are missing.

- [ ] **Step 3: Mode, routes and copy**

`apps/web/src/admin/mode.ts`:
```ts
type Env = Partial<Record<string, string | undefined>>;

export type AdminAuthMode = "clerk" | "fake" | "off";
export const FAKE_COOKIE = "darb_admin_fake";

const localHost = (url: string | undefined) => {
  try {
    const host = new URL(url ?? "").hostname;
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
};

/** Clerk in every deployment; fake sign-in only for local e2e (never on a public host). */
export function adminAuthMode(env: Env = process.env): AdminAuthMode {
  if (env.ADMIN_FAKE_AUTH === "1") return localHost(env.SITE_URL) ? "fake" : "off";
  return env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY && env.CLERK_SECRET_KEY ? "clerk" : "off";
}

/** A publishable key is pk_<env>_<base64 of "<frontend api host>$">. */
export function clerkOrigin(publishableKey: string | undefined): string | null {
  const encoded = publishableKey?.split("_")[2];
  if (!encoded) return null;
  try {
    const host = atob(encoded).replace(/\$$/, "");
    return /^[a-z0-9.-]+$/i.test(host) ? `https://${host}` : null;
  } catch {
    return null;
  }
}
```
`apps/web/src/admin/routes.ts`:
```ts
import type { Locale } from "@darb/core";

/** /admin… (Hebrew), /ar/admin…, /en/admin… → the locale and the path after "admin". */
export function adminRoute(pathname: string): { locale: Locale; rest: string } | null {
  const m = /^\/(?:(ar|en)\/)?admin(\/.*)?$/.exec(pathname);
  return m ? { locale: (m[1] ?? "he") as Locale, rest: m[2] ?? "" } : null;
}

export function adminHref(locale: Locale, path = ""): string {
  return `${locale === "he" ? "" : `/${locale}`}/admin${path}`;
}
```
`apps/web/src/admin/copy.ts`:
```ts
import type { Locale } from "@darb/core";

const en = {
  title: "Darb admin",
  navHome: "Overview",
  navPlaces: "Places",
  navSectors: "Sectors",
  navKinds: "Kinds",
  navBusinesses: "Businesses",
  navReport: "Missing kinds and places",
  signIn: "Sign in",
  signInTitle: "Sign in to Darb admin",
  signOut: "Sign out",
  notAdmin: "This account is not a Darb admin. Ask the founder to grant access.",
  notConfigured: "Admin sign-in is not set up on this deployment.",
  fakeUser: "Test user (local only)",
  search: "Search",
  searchPlaceholder: "Name or address",
  status: "Status",
  all: "All",
  save: "Save",
  saved: "Saved.",
  create: "Create",
  edit: "Edit",
  nextPage: "Next page",
  empty: "Nothing here yet.",
  newPlace: "New place",
  newSector: "New sector",
  newKind: "New kind",
  newBusiness: "New business",
  fieldSlug: "Web address (slug)",
  fieldSlugHint: "Lower-case Latin letters, digits and dashes. It becomes part of the URL and never changes.",
  fieldName: "Name",
  fieldTagline: "Tagline",
  fieldAddress: "Street address",
  fieldAliases: "Other spellings, one per line",
  fieldLat: "Latitude",
  fieldLng: "Longitude",
  fieldPopulation: "Population",
  fieldParent: "Inside (place address)",
  fieldType: "Type",
  fieldAccent: "Accent colour",
  fieldOrder: "Order",
  fieldSector: "Sector",
  fieldParentKind: "Sub-kind of",
  fieldTemplate: "Template",
  fieldAttributes: "Filters, one per line",
  fieldIcon: "Icon",
  fieldSynonyms: "Words people use, one per line",
  fieldPlace: "Place",
  fieldPrimaryKind: "Kind",
  fieldKinds: "Also listed as",
  fieldPhone: "Phone",
  fieldWhatsapp: "WhatsApp",
  fieldWebsite: "Website",
  fieldTier: "Tier",
  fieldApps: "Apps (darb tier only)",
  fieldAppWeb: "Web app",
  fieldAppIos: "App Store",
  fieldAppAndroid: "Google Play",
  fieldHours: "Opening hours",
  fieldExceptions: "Special days, one per line: 2026-12-25 closed, or 2026-12-31 09:00-13:00",
  fieldExperience: "Experience content (JSON)",
  fieldDelivers: "Delivers",
  none: "None",
  langHe: "Hebrew",
  langAr: "Arabic",
  langEn: "English",
  statusLive: "Live",
  statusSoon: "Soon",
  statusActive: "Active",
  statusHidden: "Hidden",
  statusDraft: "Draft",
  statusPublished: "Published",
  statusSuspended: "Suspended",
  publish: "Publish",
  suspend: "Suspend now",
  suspendHint: "Takes it off the city and search at once.",
  toDraft: "Back to draft",
  deleteDraft: "Delete draft",
  edited: "Edited in admin",
  seedOwned: "From seed data",
  release: "Return to seed data",
  releaseHint: "The next seed run will overwrite this with the seed data.",
  history: "History",
  historyEmpty: "No changes yet.",
  kindsHiddenHint: "New kinds start hidden. Review a kind before you make it active.",
  closed: "Closed",
  addHours: "Add hours",
  opens: "Opens",
  closes: "Closes",
  remove: "Remove",
  day0: "Sunday",
  day1: "Monday",
  day2: "Tuesday",
  day3: "Wednesday",
  day4: "Thursday",
  day5: "Friday",
  day6: "Saturday",
  reportTitle: "Missing kinds and places",
  reportSensitive: "These are the words visitors typed. Treat them as private and keep them inside Darb.",
  reportMissingKinds: "Searches that matched no kind",
  reportMissingPlaces: "Places people asked for that are not live",
  reportNoResults: "Searches with no results",
  reportDays: "Last {days} days",
  term: "Words",
  count: "Searches",
  errorGeneric: "Something went wrong. Nothing was saved.",
  errorFix: "Fix these and save again:",
  openPublic: "Open the public page",
  businessesCount: "{count} businesses",
} as const;

export type AdminKey = keyof typeof en;
type Messages = Record<AdminKey, string>;

const he: Messages = {
  title: "ניהול דרב",
  navHome: "סקירה",
  navPlaces: "מקומות",
  navSectors: "רחובות",
  navKinds: "סוגי עסקים",
  navBusinesses: "עסקים",
  navReport: "סוגים ומקומות חסרים",
  signIn: "כניסה",
  signInTitle: "כניסה לניהול דרב",
  signOut: "יציאה",
  notAdmin: "החשבון הזה אינו מנהל בדרב. בקשו גישה מהמייסד.",
  notConfigured: "הכניסה לניהול לא הוגדרה בפריסה הזו.",
  fakeUser: "משתמש בדיקה (מקומי בלבד)",
  search: "חיפוש",
  searchPlaceholder: "שם או כתובת",
  status: "מצב",
  all: "הכול",
  save: "שמירה",
  saved: "נשמר.",
  create: "יצירה",
  edit: "עריכה",
  nextPage: "לעמוד הבא",
  empty: "אין כאן עדיין כלום.",
  newPlace: "מקום חדש",
  newSector: "רחוב חדש",
  newKind: "סוג חדש",
  newBusiness: "עסק חדש",
  fieldSlug: "כתובת אינטרנט (slug)",
  fieldSlugHint: "אותיות לטיניות קטנות, ספרות ומקפים. היא נכנסת לכתובת ואינה משתנה.",
  fieldName: "שם",
  fieldTagline: "שורת תיאור",
  fieldAddress: "כתובת",
  fieldAliases: "איותים נוספים, אחד בכל שורה",
  fieldLat: "קו רוחב",
  fieldLng: "קו אורך",
  fieldPopulation: "אוכלוסייה",
  fieldParent: "בתוך (כתובת המקום)",
  fieldType: "סוג",
  fieldAccent: "צבע הדגשה",
  fieldOrder: "סדר",
  fieldSector: "רחוב",
  fieldParentKind: "תת־סוג של",
  fieldTemplate: "תבנית",
  fieldAttributes: "מסננים, אחד בכל שורה",
  fieldIcon: "סמל",
  fieldSynonyms: "מילים שאנשים משתמשים בהן, אחת בכל שורה",
  fieldPlace: "מקום",
  fieldPrimaryKind: "סוג",
  fieldKinds: "מופיע גם תחת",
  fieldPhone: "טלפון",
  fieldWhatsapp: "וואטסאפ",
  fieldWebsite: "אתר",
  fieldTier: "דרגה",
  fieldApps: "אפליקציות (דרגת darb בלבד)",
  fieldAppWeb: "אפליקציית ווב",
  fieldAppIos: "App Store",
  fieldAppAndroid: "Google Play",
  fieldHours: "שעות פתיחה",
  fieldExceptions: "ימים מיוחדים, אחד בכל שורה: 2026-12-25 closed או 2026-12-31 09:00-13:00",
  fieldExperience: "תוכן החוויה (JSON)",
  fieldDelivers: "משלוחים",
  none: "ללא",
  langHe: "עברית",
  langAr: "ערבית",
  langEn: "אנגלית",
  statusLive: "פעיל",
  statusSoon: "בקרוב",
  statusActive: "פעיל",
  statusHidden: "מוסתר",
  statusDraft: "טיוטה",
  statusPublished: "מפורסם",
  statusSuspended: "מושעה",
  publish: "פרסום",
  suspend: "השעיה מיידית",
  suspendHint: "מוריד אותו מהעיר ומהחיפוש מיד.",
  toDraft: "החזרה לטיוטה",
  deleteDraft: "מחיקת הטיוטה",
  edited: "נערך בניהול",
  seedOwned: "מנתוני הבסיס",
  release: "החזרה לנתוני הבסיס",
  releaseHint: "טעינת הבסיס הבאה תדרוס את זה בנתוני הבסיס.",
  history: "היסטוריה",
  historyEmpty: "אין שינויים עדיין.",
  kindsHiddenHint: "סוגים חדשים מתחילים מוסתרים. בדקו סוג לפני שהופכים אותו לפעיל.",
  closed: "סגור",
  addHours: "הוספת שעות",
  opens: "פתיחה",
  closes: "סגירה",
  remove: "הסרה",
  day0: "ראשון",
  day1: "שני",
  day2: "שלישי",
  day3: "רביעי",
  day4: "חמישי",
  day5: "שישי",
  day6: "שבת",
  reportTitle: "סוגים ומקומות חסרים",
  reportSensitive: "אלה המילים שמבקרים הקלידו. התייחסו אליהן כפרטיות והשאירו אותן בתוך דרב.",
  reportMissingKinds: "חיפושים שלא התאימו לאף סוג",
  reportMissingPlaces: "מקומות שביקשו ואינם פעילים",
  reportNoResults: "חיפושים בלי תוצאות",
  reportDays: "{days} הימים האחרונים",
  term: "מילים",
  count: "חיפושים",
  errorGeneric: "משהו השתבש. שום דבר לא נשמר.",
  errorFix: "תקנו את אלה ושמרו שוב:",
  openPublic: "פתיחת הדף הציבורי",
  businessesCount: "{count} עסקים",
};

const ar: Messages = {
  title: "إدارة درب",
  navHome: "نظرة عامة",
  navPlaces: "الأماكن",
  navSectors: "الشوارع",
  navKinds: "أنواع المصالح",
  navBusinesses: "المصالح",
  navReport: "أنواع وأماكن ناقصة",
  signIn: "تسجيل الدخول",
  signInTitle: "الدخول إلى إدارة درب",
  signOut: "تسجيل الخروج",
  notAdmin: "هذا الحساب ليس مديرًا في درب. اطلب الوصول من المؤسس.",
  notConfigured: "لم يُضبط دخول الإدارة في هذا النشر.",
  fakeUser: "مستخدم تجريبي (محلي فقط)",
  search: "بحث",
  searchPlaceholder: "الاسم أو العنوان",
  status: "الحالة",
  all: "الكل",
  save: "حفظ",
  saved: "تم الحفظ.",
  create: "إنشاء",
  edit: "تعديل",
  nextPage: "الصفحة التالية",
  empty: "لا شيء هنا بعد.",
  newPlace: "مكان جديد",
  newSector: "شارع جديد",
  newKind: "نوع جديد",
  newBusiness: "مصلحة جديدة",
  fieldSlug: "عنوان الويب (slug)",
  fieldSlugHint: "أحرف لاتينية صغيرة وأرقام وشرطات. يصبح جزءًا من الرابط ولا يتغير.",
  fieldName: "الاسم",
  fieldTagline: "سطر الوصف",
  fieldAddress: "العنوان",
  fieldAliases: "كتابات أخرى، واحدة في كل سطر",
  fieldLat: "خط العرض",
  fieldLng: "خط الطول",
  fieldPopulation: "عدد السكان",
  fieldParent: "داخل (عنوان المكان)",
  fieldType: "النوع",
  fieldAccent: "لون التمييز",
  fieldOrder: "الترتيب",
  fieldSector: "الشارع",
  fieldParentKind: "نوع فرعي من",
  fieldTemplate: "القالب",
  fieldAttributes: "عوامل التصفية، واحد في كل سطر",
  fieldIcon: "الأيقونة",
  fieldSynonyms: "كلمات يستعملها الناس، واحدة في كل سطر",
  fieldPlace: "المكان",
  fieldPrimaryKind: "النوع",
  fieldKinds: "يظهر أيضًا تحت",
  fieldPhone: "الهاتف",
  fieldWhatsapp: "واتساب",
  fieldWebsite: "الموقع",
  fieldTier: "الفئة",
  fieldApps: "التطبيقات (فئة darb فقط)",
  fieldAppWeb: "تطبيق الويب",
  fieldAppIos: "App Store",
  fieldAppAndroid: "Google Play",
  fieldHours: "ساعات العمل",
  fieldExceptions: "أيام خاصة، واحد في كل سطر: 2026-12-25 closed أو 2026-12-31 09:00-13:00",
  fieldExperience: "محتوى التجربة (JSON)",
  fieldDelivers: "توصيل",
  none: "لا شيء",
  langHe: "العبرية",
  langAr: "العربية",
  langEn: "الإنجليزية",
  statusLive: "فعّال",
  statusSoon: "قريبًا",
  statusActive: "فعّال",
  statusHidden: "مخفي",
  statusDraft: "مسودة",
  statusPublished: "منشور",
  statusSuspended: "موقوف",
  publish: "نشر",
  suspend: "إيقاف فوري",
  suspendHint: "يزيله من المدينة ومن البحث فورًا.",
  toDraft: "إرجاع إلى مسودة",
  deleteDraft: "حذف المسودة",
  edited: "عُدّل في الإدارة",
  seedOwned: "من البيانات الأساسية",
  release: "إرجاع إلى البيانات الأساسية",
  releaseHint: "التحميل الأساسي القادم سيكتب فوق هذا بالبيانات الأساسية.",
  history: "السجل",
  historyEmpty: "لا تغييرات بعد.",
  kindsHiddenHint: "الأنواع الجديدة تبدأ مخفية. راجع النوع قبل أن تجعله فعّالًا.",
  closed: "مغلق",
  addHours: "إضافة ساعات",
  opens: "يفتح",
  closes: "يغلق",
  remove: "إزالة",
  day0: "الأحد",
  day1: "الاثنين",
  day2: "الثلاثاء",
  day3: "الأربعاء",
  day4: "الخميس",
  day5: "الجمعة",
  day6: "السبت",
  reportTitle: "أنواع وأماكن ناقصة",
  reportSensitive: "هذه كلمات كتبها الزوار. عاملها كمعلومات خاصة وأبقها داخل درب.",
  reportMissingKinds: "عمليات بحث لم تطابق أي نوع",
  reportMissingPlaces: "أماكن طلبها الناس وليست فعّالة",
  reportNoResults: "عمليات بحث بلا نتائج",
  reportDays: "آخر {days} يومًا",
  term: "الكلمات",
  count: "عمليات البحث",
  errorGeneric: "حدث خطأ. لم يُحفظ شيء.",
  errorFix: "صحّح ما يلي واحفظ من جديد:",
  openPublic: "فتح الصفحة العامة",
  businessesCount: "{count} مصلحة",
};

export const adminCopy: Record<Locale, Messages> = { he, ar, en };

export function at(locale: Locale, key: AdminKey, vars: Record<string, string | number> = {}): string {
  return adminCopy[locale][key].replace(/\{(\w+)\}/g, (m, name: string) =>
    Object.hasOwn(vars, name) ? String(vars[name]) : m,
  );
}
```

- [ ] **Step 4: Auth, API client and session actions**

`apps/web/src/admin/auth.ts`:
```ts
import "server-only";
import { auth } from "@clerk/nextjs/server";
import { cookies } from "next/headers";
import { adminAuthMode, FAKE_COOKIE } from "./mode";

/** The bearer token the API's AdminGuard verifies: a Clerk session JWT, or a fake one locally. */
export async function adminToken(): Promise<string | null> {
  const mode = adminAuthMode();
  if (mode === "fake") return (await cookies()).get(FAKE_COOKIE)?.value ?? null;
  if (mode === "clerk") return (await auth()).getToken();
  return null;
}
```
`apps/web/src/admin/api.ts`:
```ts
import "server-only";
import { contract } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { initClient, type ApiFetcher } from "@ts-rest/core";
import { notFound, redirect } from "next/navigation";
import { adminToken } from "./auth";
import { adminAuthMode } from "./mode";
import { adminHref } from "./routes";

/** Admin reads are never cached: every request sees the database. */
const noStore: ApiFetcher = async ({ path, method, headers, body }) => {
  const res = await fetch(path, { method, headers, body, cache: "no-store" });
  const type = res.headers.get("content-type") ?? "";
  return { status: res.status, body: type.includes("json") ? await res.json() : await res.text(), headers: res.headers };
};

export async function adminApi() {
  const base = (process.env.API_URL ?? "").replace(/\/+$/, "");
  const token = (await adminToken()) ?? "";
  return initClient(contract.admin, {
    baseUrl: base,
    baseHeaders: { authorization: `Bearer ${token}` },
    api: noStore,
    throwOnUnknownStatus: true,
  });
}
export type AdminClient = Awaited<ReturnType<typeof adminApi>>;

export type AdminSession =
  | { status: "ok"; clerkUserId: string }
  | { status: "signed-out" }
  | { status: "forbidden" }
  | { status: "off" };

export async function adminSession(): Promise<AdminSession> {
  if (adminAuthMode() === "off") return { status: "off" };
  if (!(await adminToken())) return { status: "signed-out" };
  const res = await (await adminApi()).misc.me();
  if (res.status === 200) return { status: "ok", clerkUserId: res.body.clerkUserId };
  return res.status === 403 ? { status: "forbidden" } : { status: "signed-out" };
}

/** The body of a 200/201, or the right navigation for anything else. */
export function okOr<T>(res: { status: number; body: unknown }, locale: Locale): T {
  if (res.status === 200 || res.status === 201) return res.body as T;
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  notFound();
}
```
`apps/web/src/admin/session-actions.ts`:
```ts
"use server";

import { isLocale } from "@/lib/locale";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuthMode, FAKE_COOKIE } from "./mode";
import { adminHref } from "./routes";

/** Local e2e only: adminAuthMode() is "fake" only on a localhost SITE_URL with ADMIN_FAKE_AUTH=1. */
export async function fakeSignIn(formData: FormData): Promise<void> {
  const raw = String(formData.get("locale") ?? "he");
  const locale = isLocale(raw) ? raw : "he";
  if (adminAuthMode() !== "fake") redirect(adminHref(locale, "/sign-in"));
  const user = String(formData.get("user") ?? "").replace(/[^A-Za-z0-9_]/g, "");
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  (await cookies()).set(FAKE_COOKIE, `fake.${user}.${email}`, { httpOnly: true, sameSite: "lax", path: "/" });
  redirect(adminHref(locale));
}

export async function fakeSignOut(formData: FormData): Promise<void> {
  const raw = String(formData.get("locale") ?? "he");
  (await cookies()).delete(FAKE_COOKIE);
  redirect(adminHref(isLocale(raw) ? raw : "he", "/sign-in"));
}
```

- [ ] **Step 5: Proxy admin branch**

In `apps/web/src/proxy.ts`:
- Add these imports:
```ts
import { clerkMiddleware } from "@clerk/nextjs/server";
import type { NextFetchEvent } from "next/server";
import { adminAuthMode, clerkOrigin } from "./admin/mode";
import { adminRoute } from "./admin/routes";
import { adminCsp } from "./lib/csp";
```
- Add before `proxy`:
```ts
/** /admin renders per request: a fresh nonce, noindex, no-store, rewritten to app/admin/[locale]. */
function adminResponse(request: NextRequest): NextResponse {
  const route = adminRoute(request.nextUrl.pathname)!;
  const nonce = btoa(crypto.randomUUID());
  const csp = adminCsp({ nonce, clerkOrigin: clerkOrigin(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY), dev: DEV });
  const headers = new Headers(request.headers);
  headers.set("x-nonce", nonce);
  headers.set("content-security-policy", csp);
  const url = request.nextUrl.clone();
  url.pathname = `/admin/${route.locale}${route.rest}`;
  const res = NextResponse.rewrite(url, { request: { headers } });
  res.headers.set("content-security-policy", csp);
  res.headers.set("x-robots-tag", "noindex, nofollow");
  res.headers.set("cache-control", "no-store");
  for (const [k, v] of Object.entries(securityHeaders())) res.headers.set(k, v);
  return res;
}
const clerkAdmin = clerkMiddleware(async (_auth, request) => adminResponse(request));
```
- Change `proxy` to take the event and route admin first:
```ts
export async function proxy(request: NextRequest, event?: NextFetchEvent): Promise<NextResponse | Response> {
  if (adminRoute(request.nextUrl.pathname)) {
    // Clerk runs only on admin requests: public pages never load or call Clerk.
    if (adminAuthMode() === "clerk" && event) return (await clerkAdmin(request, event)) ?? adminResponse(request);
    return adminResponse(request);
  }
  const route = routeLocale(request.nextUrl.pathname);
  …unchanged…
}
```
- Add `"/__clerk/(.*)"` to `config.matcher`. Clerk's frontend API proxy path is kept for later and is harmless.

- [ ] **Step 6: Layouts, sign-in, shell and overview**

`apps/web/src/app/admin/[locale]/layout.tsx`:
```tsx
import { ClerkProvider } from "@clerk/nextjs";
import { arSA, enUS, heIL } from "@clerk/localizations";
import type { Metadata } from "next";
import { Cairo, Heebo, Ubuntu } from "next/font/google";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { dir } from "@darb/i18n";
import { adminAuthMode } from "@/admin/mode";
import { at } from "@/admin/copy";
import { isLocale } from "@/lib/locale";
import { tokensCss } from "@/lib/tokens-css";
import styles from "@/admin/admin.module.css";

const ubuntu = Ubuntu({ weight: ["400", "500", "700"], subsets: ["latin"], display: "swap", variable: "--font-latin" });
const heebo = Heebo({ subsets: ["hebrew"], display: "swap", variable: "--font-hebrew" });
const cairo = Cairo({ subsets: ["arabic"], display: "swap", variable: "--font-arabic" });
const CLERK_LOCALES = { he: heIL, ar: arSA, en: enUS } as const;

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params;
  return { title: at(isLocale(locale) ? locale : "he", "title"), robots: { index: false, follow: false } };
}

export default async function AdminRootLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ locale: string }>;
}) {
  const { locale: raw } = await params;
  const locale: Locale = isLocale(raw) ? raw : "he";
  const html = (
    <html lang={locale} dir={dir(locale)} className={[ubuntu.variable, heebo.variable, cairo.variable].join(" ")}>
      <head>
        <style dangerouslySetInnerHTML={{ __html: tokensCss() }} />
      </head>
      <body className={styles.body}>{children}</body>
    </html>
  );
  return adminAuthMode() === "clerk" ? (
    <ClerkProvider dynamic localization={CLERK_LOCALES[locale]}>
      {html}
    </ClerkProvider>
  ) : (
    html
  );
}
```
`apps/web/src/app/admin/[locale]/sign-in/[[...sign-in]]/page.tsx`:
```tsx
import { SignIn } from "@clerk/nextjs";
import { notFound } from "next/navigation";
import { at } from "@/admin/copy";
import { adminAuthMode } from "@/admin/mode";
import { adminHref } from "@/admin/routes";
import { fakeSignIn } from "@/admin/session-actions";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function SignInPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const mode = adminAuthMode();
  return (
    <main className={styles.center}>
      <h1 className={styles.brand}>{at(locale, "signInTitle")}</h1>
      {mode === "clerk" ? (
        <SignIn routing="path" path={adminHref(locale, "/sign-in")} forceRedirectUrl={adminHref(locale)} />
      ) : mode === "fake" ? (
        <form action={fakeSignIn} className={styles.card}>
          <input type="hidden" name="locale" value={locale} />
          <label className={styles.field}>
            <span>{at(locale, "fakeUser")}</span>
            <input name="user" defaultValue="user_e2e" required />
          </label>
          <label className={styles.field}>
            <span>Email</span>
            <input name="email" type="email" defaultValue="e2e-admin@darb.test" required dir="ltr" />
          </label>
          <button className={styles.primary} type="submit">
            {at(locale, "signIn")}
          </button>
        </form>
      ) : (
        <p className={styles.notice}>{at(locale, "notConfigured")}</p>
      )}
    </main>
  );
}
```
`apps/web/src/admin/SignOut.tsx`:
```tsx
"use client";

import { SignOutButton } from "@clerk/nextjs";
import type { Locale } from "@darb/core";
import { adminHref } from "./routes";
import styles from "./admin.module.css";

export function ClerkSignOut({ locale, label }: { locale: Locale; label: string }) {
  return (
    <SignOutButton redirectUrl={adminHref(locale, "/sign-in")}>
      <button className={styles.ghost} type="button">
        {label}
      </button>
    </SignOutButton>
  );
}
```
`apps/web/src/admin/AdminShell.tsx`:
```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { at, type AdminKey } from "./copy";
import type { AdminAuthMode } from "./mode";
import { adminHref } from "./routes";
import { fakeSignOut } from "./session-actions";
import { ClerkSignOut } from "./SignOut";
import styles from "./admin.module.css";

const NAV: [string, AdminKey][] = [
  ["", "navHome"],
  ["/places", "navPlaces"],
  ["/sectors", "navSectors"],
  ["/kinds", "navKinds"],
  ["/businesses", "navBusinesses"],
  ["/report", "navReport"],
];
const LOCALE_NAMES: Record<Locale, string> = { he: "עברית", ar: "العربية", en: "English" };

/** `path` is the admin path after the locale ("/places/…"), for active links and the locale switch. */
export function AdminShell({ locale, path, mode, children }: { locale: Locale; path: string; mode: AdminAuthMode; children: ReactNode }) {
  return (
    <div className={styles.shell}>
      <header className={styles.top}>
        <Link href={adminHref(locale)} className={styles.brand}>
          {at(locale, "title")}
        </Link>
        <nav aria-label={at(locale, "title")} className={styles.nav}>
          {NAV.map(([href, key]) => {
            const active = href === "" ? path === "" : path.startsWith(href);
            return (
              <Link key={href} href={adminHref(locale, href)} aria-current={active ? "page" : undefined} className={styles.navLink}>
                {at(locale, key)}
              </Link>
            );
          })}
        </nav>
        <div className={styles.tools}>
          {(["he", "ar", "en"] as const)
            .filter((l) => l !== locale)
            .map((l) => (
              <Link key={l} href={adminHref(l, path)} lang={l} hrefLang={l} className={styles.ghost}>
                {LOCALE_NAMES[l]}
              </Link>
            ))}
          {mode === "clerk" ? (
            <ClerkSignOut locale={locale} label={at(locale, "signOut")} />
          ) : (
            <form action={fakeSignOut}>
              <input type="hidden" name="locale" value={locale} />
              <button className={styles.ghost} type="submit">
                {at(locale, "signOut")}
              </button>
            </form>
          )}
        </div>
      </header>
      <main id="main" className={styles.main}>
        {children}
      </main>
    </div>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/layout.tsx`:
```tsx
import { headers } from "next/headers";
import { notFound, redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AdminShell } from "@/admin/AdminShell";
import { adminSession } from "@/admin/api";
import { at } from "@/admin/copy";
import { adminAuthMode } from "@/admin/mode";
import { adminHref, adminRoute } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

/** Every admin screen: signed in with Clerk, and an admin by the API's say (User.isAdmin). */
export default async function AdminAppLayout({ children, params }: { children: ReactNode; params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const session = await adminSession();
  if (session.status === "signed-out") redirect(adminHref(locale, "/sign-in"));
  if (session.status !== "ok")
    return (
      <main className={styles.center}>
        <p className={styles.notice}>{at(locale, session.status === "forbidden" ? "notAdmin" : "notConfigured")}</p>
      </main>
    );
  // The proxy rewrote /ar/admin/x to /admin/ar/x; the original path is in next-url when present.
  const original = (await headers()).get("x-darb-admin-path") ?? "";
  return (
    <AdminShell locale={locale} path={adminRoute(original)?.rest ?? ""} mode={adminAuthMode()}>
      {children}
    </AdminShell>
  );
}
```
In `adminResponse` (the proxy), also set the request header `headers.set("x-darb-admin-path", request.nextUrl.pathname);` before the rewrite, so the shell knows the public path.

`apps/web/src/app/admin/[locale]/(app)/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import type { MissingReportDto } from "@darb/contracts";
import styles from "@/admin/admin.module.css";

export default async function AdminHome({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const report = okOr<MissingReportDto>(await (await adminApi()).misc.report({ query: { days: 7, limit: 5 } }), locale);
  const cards = [
    ["/places", "navPlaces"],
    ["/kinds", "navKinds"],
    ["/businesses", "navBusinesses"],
    ["/sectors", "navSectors"],
  ] as const;
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "navHome")}</h1>
      <div className={styles.grid}>
        {cards.map(([href, key]) => (
          <Link key={href} href={adminHref(locale, href)} className={styles.tile}>
            {at(locale, key)}
          </Link>
        ))}
      </div>
      <section className={styles.card} aria-labelledby="missing">
        <h2 id="missing" className={styles.h2}>
          {at(locale, "reportMissingKinds")} · {at(locale, "reportDays", { days: 7 })}
        </h2>
        {report.missingKinds.length === 0 ? (
          <p>{at(locale, "empty")}</p>
        ) : (
          <ul className={styles.plain}>
            {report.missingKinds.map((r) => (
              <li key={r.term}>
                <bdi>{r.term}</bdi> · {r.count}
              </li>
            ))}
          </ul>
        )}
        <Link href={adminHref(locale, "/report")}>{at(locale, "navReport")}</Link>
      </section>
    </>
  );
}
```
`apps/web/src/admin/admin.module.css`:
```css
.body {
  margin: 0;
  min-height: 100dvh;
  background: var(--forest-950);
  color: var(--ivory);
  font-family: var(--font-latin), var(--font-hebrew), var(--font-arabic), system-ui, sans-serif;
  line-height: 1.5;
}
.body a { color: var(--gold-300); }
.body :focus-visible { outline: 2px solid var(--gold-300); outline-offset: 2px; }
.shell { display: grid; grid-template-rows: auto 1fr; min-height: 100dvh; }
.top {
  display: flex; flex-wrap: wrap; align-items: center; gap: 12px 24px;
  padding-block: 12px; padding-inline: 24px;
  background: var(--night); border-block-end: 1px solid var(--forest-800);
  position: sticky; inset-block-start: 0; z-index: 2;
}
.brand { font-weight: 700; font-size: 1.125rem; color: var(--gold); text-decoration: none; }
.nav { display: flex; flex-wrap: wrap; gap: 4px; }
.navLink {
  display: inline-flex; align-items: center; min-block-size: 44px; padding-inline: 12px;
  border-radius: 10px; color: var(--ivory-200); text-decoration: none;
}
.navLink[aria-current="page"] { background: var(--forest-800); color: var(--ivory); }
.tools { display: flex; gap: 8px; margin-inline-start: auto; align-items: center; }
.main { padding-block: 24px 64px; padding-inline: 24px; max-inline-size: 1200px; inline-size: 100%; margin-inline: auto; box-sizing: border-box; }
.center { display: grid; place-items: center; gap: 16px; min-height: 100dvh; padding: 16px; }
.h1 { font-size: 1.75rem; margin-block: 0 16px; }
.h2 { font-size: 1.125rem; margin-block: 0 12px; }
.grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; margin-block-end: 24px; }
.tile {
  display: grid; place-items: center; min-block-size: 96px; border-radius: 16px;
  background: var(--forest-900); border: 1px solid var(--forest-800);
  color: var(--ivory) !important; text-decoration: none; font-weight: 500;
  transition: transform 200ms var(--ease-out), border-color 200ms var(--ease-out);
}
.tile:hover { transform: translateY(-2px); border-color: var(--gold-600); }
.card { background: var(--forest-900); border: 1px solid var(--forest-800); border-radius: 16px; padding: 20px; margin-block-end: 16px; }
.notice { background: var(--forest-900); border-inline-start: 4px solid var(--gold); padding: 12px 16px; border-radius: 8px; max-inline-size: 60ch; }
.error { background: #3a1410; border-inline-start: 4px solid #f0a08a; padding: 12px 16px; border-radius: 8px; }
.plain { list-style: none; padding: 0; margin: 0 0 12px; display: grid; gap: 4px; }
.field { display: grid; gap: 6px; margin-block-end: 14px; }
.field > span { font-size: 0.875rem; color: var(--ivory-200); }
.field input, .field select, .field textarea {
  font: inherit; color: var(--ivory); background: var(--night);
  border: 1px solid var(--forest-600); border-radius: 10px; padding: 10px 12px; min-block-size: 44px; box-sizing: border-box;
}
.field textarea { min-block-size: 120px; }
.hint { font-size: 0.8125rem; color: var(--ivory-200); }
.row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; }
.actions { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; margin-block: 16px; }
.primary, .ghost, .danger {
  font: inherit; min-block-size: 44px; padding-inline: 18px; border-radius: 12px; cursor: pointer;
  display: inline-flex; align-items: center; text-decoration: none;
}
.primary { background: var(--gold); color: var(--ink); border: 0; font-weight: 700; }
.ghost { background: transparent; color: var(--ivory) !important; border: 1px solid var(--forest-600); }
.danger { background: transparent; color: #f6b8a8; border: 1px solid #a24a36; }
.table { inline-size: 100%; border-collapse: collapse; }
.table th, .table td { text-align: start; padding: 10px 8px; border-block-end: 1px solid var(--forest-800); vertical-align: top; }
.table th { font-size: 0.8125rem; color: var(--ivory-200); font-weight: 500; }
.badge { display: inline-block; padding: 2px 10px; border-radius: 999px; font-size: 0.8125rem; background: var(--forest-800); color: var(--ivory); }
.badgeGold { background: var(--gold-900); color: var(--gold-100); }
.toolbar { display: flex; flex-wrap: wrap; gap: 8px; align-items: end; margin-block-end: 16px; }
.toolbar .field { margin: 0; }
@media (max-width: 640px) {
  .main, .top { padding-inline: 16px; }
  .table thead { display: none; }
  .table tr { display: grid; padding-block: 8px; border-block-end: 1px solid var(--forest-800); }
  .table td { border: 0; padding: 2px 0; }
}
@media (prefers-reduced-motion: reduce) { .tile { transition: none; } .tile:hover { transform: none; } }
```
In `apps/web/.env.example`, append:
```bash
# Admin (Clerk, admin only). Without these keys /admin says sign-in is not set up.
# NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
# CLERK_SECRET_KEY=
# Local e2e only (refused unless SITE_URL is localhost): fake admin sign-in.
# ADMIN_FAKE_AUTH=1
```

- [ ] **Step 7: Run the tests and build**

Run: `pnpm --filter @darb/web exec vitest run && NEXT_PUBLIC_LOCAL_TILES=1 pnpm --filter @darb/web build && pnpm --filter @darb/web budget`
Expected: PASS. The build lists `/admin/[locale]` routes, and the public budgets are unchanged, because Clerk only appears in admin chunks.

- [ ] **Step 8: Commit**

```bash
git add apps/web/src/admin apps/web/src/app/admin apps/web/src/proxy.ts apps/web/src/proxy.test.ts apps/web/.env.example
git commit -m "feat(web): admin shell with Clerk only on /admin, nonce CSP, three locales and sign-in"
```

---

### Task 24: Admin lists: places, sectors, kinds and businesses

**Files:**
- Create: `apps/web/src/admin/params.ts`, `apps/web/src/admin/Badges.tsx`, `apps/web/src/admin/Toolbar.tsx`
- Test: `apps/web/src/admin/params.test.ts`, `apps/web/src/admin/Badges.test.tsx`
- Create: `apps/web/src/app/admin/[locale]/(app)/places/page.tsx`, `apps/web/src/app/admin/[locale]/(app)/sectors/page.tsx`, `apps/web/src/app/admin/[locale]/(app)/kinds/page.tsx`, `apps/web/src/app/admin/[locale]/(app)/businesses/page.tsx`

**Interfaces:**
- Consumes: `adminApi` and `okOr` (Task 23), the admin DTOs (Task 13), and `pickText` from `@darb/core`.
- Produces:
```ts
// params.ts
export type SearchParams = Record<string, string | string[] | undefined>;
export function one(v: string | string[] | undefined): string | undefined; // first non-empty value
export function withParams(href: string, params: Record<string, string | undefined>): string; // drops empty values
// Badges.tsx
export function StatusBadge(p: { locale: Locale; status: "live"|"soon"|"active"|"hidden"|"draft"|"published"|"suspended" }): JSX.Element;
export function OwnerBadge(p: { locale: Locale; editedAt: string | null }): JSX.Element;
// Toolbar.tsx: a GET search form (q plus optional selects), and the next-page link
export function Toolbar(p: { locale: Locale; action: string; q?: string; selects?: { name: string; label: string; value?: string; options: [string, string][] }[] }): JSX.Element;
export function Pager(p: { locale: Locale; href: string | null }): JSX.Element | null;
```

- [ ] **Step 1: Write the failing tests**

`apps/web/src/admin/params.test.ts`:
```ts
import { expect, it } from "vitest";
import { one, withParams } from "./params";

it("reads one value and builds query strings without empties", () => {
  expect(one(["a", "b"])).toBe("a");
  expect(one("")).toBeUndefined();
  expect(withParams("/ar/admin/places", { q: "سخ", status: "", cursor: "x" })).toBe(
    `/ar/admin/places?q=${encodeURIComponent("سخ")}&cursor=x`,
  );
  expect(withParams("/admin", {})).toBe("/admin");
});
```
`apps/web/src/admin/Badges.test.tsx`:
```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { OwnerBadge, StatusBadge } from "./Badges";

it("names status and ownership in the admin's language", () => {
  render(
    <>
      <StatusBadge locale="ar" status="suspended" />
      <OwnerBadge locale="en" editedAt="2026-10-13T10:00:00.000Z" />
      <OwnerBadge locale="en" editedAt={null} />
    </>,
  );
  expect(screen.getByText("موقوف")).toBeTruthy();
  expect(screen.getByText("Edited in admin")).toBeTruthy();
  expect(screen.getByText("From seed data")).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/admin/params.test.ts src/admin/Badges.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Helpers and shared pieces**

`apps/web/src/admin/params.ts`:
```ts
export type SearchParams = Record<string, string | string[] | undefined>;

export function one(v: string | string[] | undefined): string | undefined {
  const value = Array.isArray(v) ? v[0] : v;
  return value ? value : undefined;
}

export function withParams(href: string, params: Record<string, string | undefined>): string {
  const qs = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
  const s = qs.toString().replace(/\+/g, "%20");
  return s ? `${href}?${s}` : href;
}
```
(Check the test's `encodeURIComponent` expectation against `URLSearchParams` encoding. Both percent-encode Arabic the same way, and the `+` replacement covers spaces.)

`apps/web/src/admin/Badges.tsx`:
```tsx
import type { Locale } from "@darb/core";
import { at, type AdminKey } from "./copy";
import styles from "./admin.module.css";

const STATUS: Record<string, AdminKey> = {
  live: "statusLive",
  soon: "statusSoon",
  active: "statusActive",
  hidden: "statusHidden",
  draft: "statusDraft",
  published: "statusPublished",
  suspended: "statusSuspended",
};
const GOLD = new Set(["live", "active", "published"]);

export function StatusBadge({ locale, status }: { locale: Locale; status: keyof typeof STATUS }) {
  return (
    <span className={GOLD.has(status) ? `${styles.badge} ${styles.badgeGold}` : styles.badge}>
      {at(locale, STATUS[status]!)}
    </span>
  );
}

export function OwnerBadge({ locale, editedAt }: { locale: Locale; editedAt: string | null }) {
  return <span className={styles.badge}>{at(locale, editedAt ? "edited" : "seedOwned")}</span>;
}
```
`apps/web/src/admin/Toolbar.tsx`:
```tsx
import Link from "next/link";
import type { Locale } from "@darb/core";
import { at } from "./copy";
import styles from "./admin.module.css";

export interface ToolbarSelect {
  name: string;
  label: string;
  value?: string;
  options: [string, string][];
}

/** A plain GET form: works without JavaScript, and the URL is the state (shareable, reloadable). */
export function Toolbar({ locale, action, q, selects = [] }: { locale: Locale; action: string; q?: string; selects?: ToolbarSelect[] }) {
  return (
    <form method="get" action={action} className={styles.toolbar} role="search">
      <label className={styles.field}>
        <span>{at(locale, "search")}</span>
        <input type="search" name="q" defaultValue={q} placeholder={at(locale, "searchPlaceholder")} dir="auto" />
      </label>
      {selects.map((s) => (
        <label key={s.name} className={styles.field}>
          <span>{s.label}</span>
          <select name={s.name} defaultValue={s.value ?? ""}>
            <option value="">{at(locale, "all")}</option>
            {s.options.map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
      ))}
      <button type="submit" className={styles.ghost}>
        {at(locale, "search")}
      </button>
    </form>
  );
}

export function Pager({ locale, href }: { locale: Locale; href: string | null }) {
  return href ? (
    <p className={styles.actions}>
      <Link href={href} className={styles.ghost}>
        {at(locale, "nextPage")}
      </Link>
    </p>
  ) : null;
}
```

- [ ] **Step 4: The four list pages**

`apps/web/src/app/admin/[locale]/(app)/places/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminPlaceDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge, StatusBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Pager, Toolbar } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

type Page = { items: AdminPlaceDto[]; nextCursor: string | null };

export default async function PlacesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const q = one(sp.q);
  const status = one(sp.status);
  const page = okOr<Page>(await (await adminApi()).places.list({ query: { q, status, cursor: one(sp.cursor) } }), locale);
  const base = adminHref(locale, "/places");
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navPlaces")}</h1>
        <Link href={adminHref(locale, "/places/new")} className={styles.primary}>
          {at(locale, "newPlace")}
        </Link>
      </div>
      <Toolbar
        locale={locale}
        action={base}
        q={q}
        selects={[{ name: "status", label: at(locale, "status"), value: status, options: [["live", at(locale, "statusLive")], ["soon", at(locale, "statusSoon")]] }]}
      />
      {page.items.length === 0 ? (
        <p>{at(locale, "empty")}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{at(locale, "fieldName")}</th>
              <th scope="col">{at(locale, "fieldSlug")}</th>
              <th scope="col">{at(locale, "fieldType")}</th>
              <th scope="col">{at(locale, "status")}</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((p) => (
              <tr key={p.id}>
                <td>
                  <Link href={adminHref(locale, `/places/${p.id}`)}>{pickText(p.name, locale)}</Link>
                </td>
                <td dir="ltr">{p.slug}</td>
                <td>{p.type}</td>
                <td>
                  <StatusBadge locale={locale} status={p.status} /> <OwnerBadge locale={locale} editedAt={p.editedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager locale={locale} href={page.nextCursor ? withParams(base, { q, status, cursor: page.nextCursor }) : null} />
    </>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/sectors/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { adminHref } from "@/admin/routes";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function SectorsPage({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sectors = okOr<AdminSectorDto[]>(await (await adminApi()).sectors.list(), locale);
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navSectors")}</h1>
        <Link href={adminHref(locale, "/sectors/new")} className={styles.primary}>
          {at(locale, "newSector")}
        </Link>
      </div>
      <table className={styles.table}>
        <thead>
          <tr>
            <th scope="col">{at(locale, "fieldOrder")}</th>
            <th scope="col">{at(locale, "fieldName")}</th>
            <th scope="col">{at(locale, "fieldAccent")}</th>
            <th scope="col">{at(locale, "status")}</th>
          </tr>
        </thead>
        <tbody>
          {sectors.map((s) => (
            <tr key={s.id}>
              <td>{s.order}</td>
              <td>
                <Link href={adminHref(locale, `/sectors/${s.id}`)}>{pickText(s.name, locale)}</Link>
              </td>
              <td>
                <span aria-hidden="true" style={{ display: "inline-block", inlineSize: 16, blockSize: 16, borderRadius: 4, background: s.accent, verticalAlign: "middle" }} />{" "}
                <span dir="ltr">{s.accent}</span>
              </td>
              <td>
                <OwnerBadge locale={locale} editedAt={s.editedAt} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/kinds/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge, StatusBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { one, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Toolbar } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function KindsPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const q = one(sp.q);
  const rawStatus = one(sp.status);
  const status = rawStatus === "active" || rawStatus === "hidden" ? rawStatus : undefined;
  const sector = one(sp.sector);
  const api = await adminApi();
  const [kinds, sectors] = await Promise.all([
    api.kinds.list({ query: { q, status, sector } }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
  ]);
  const sectorName = new Map(sectors.map((s) => [s.id, pickText(s.name, locale)]));
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navKinds")}</h1>
        <Link href={adminHref(locale, "/kinds/new")} className={styles.primary}>
          {at(locale, "newKind")}
        </Link>
      </div>
      <p className={styles.notice}>{at(locale, "kindsHiddenHint")}</p>
      <Toolbar
        locale={locale}
        action={adminHref(locale, "/kinds")}
        q={q}
        selects={[
          { name: "status", label: at(locale, "status"), value: status, options: [["active", at(locale, "statusActive")], ["hidden", at(locale, "statusHidden")]] },
          { name: "sector", label: at(locale, "fieldSector"), value: sector, options: sectors.map((s) => [s.id, pickText(s.name, locale)]) },
        ]}
      />
      {kinds.length === 0 ? (
        <p>{at(locale, "empty")}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{at(locale, "fieldName")}</th>
              <th scope="col">{at(locale, "fieldSector")}</th>
              <th scope="col">{at(locale, "fieldTemplate")}</th>
              <th scope="col">{at(locale, "navBusinesses")}</th>
              <th scope="col">{at(locale, "status")}</th>
            </tr>
          </thead>
          <tbody>
            {kinds.map((k) => (
              <tr key={k.id}>
                <td>
                  <Link href={adminHref(locale, `/kinds/${k.id}`)}>{pickText(k.name, locale)}</Link>
                  <div className={styles.hint} dir="ltr">{k.slug}</div>
                </td>
                <td>{sectorName.get(k.sectorId)}</td>
                <td>{k.template}</td>
                <td>{k.businessCount}</td>
                <td>
                  <StatusBadge locale={locale} status={k.status} /> <OwnerBadge locale={locale} editedAt={k.editedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/businesses/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminBusinessRowDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { OwnerBadge, StatusBadge } from "@/admin/Badges";
import { at } from "@/admin/copy";
import { one, withParams, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Pager, Toolbar } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

type Page = { items: AdminBusinessRowDto[]; nextCursor: string | null };

export default async function BusinessesPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;
  const filters = { q: one(sp.q), status: one(sp.status), place: one(sp.place), kind: one(sp.kind) };
  const page = okOr<Page>(await (await adminApi()).businesses.list({ query: { ...filters, cursor: one(sp.cursor) } }), locale);
  const base = adminHref(locale, "/businesses");
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{at(locale, "navBusinesses")}</h1>
        <Link href={adminHref(locale, "/businesses/new")} className={styles.primary}>
          {at(locale, "newBusiness")}
        </Link>
      </div>
      <Toolbar
        locale={locale}
        action={base}
        q={filters.q}
        selects={[
          {
            name: "status",
            label: at(locale, "status"),
            value: filters.status,
            options: [["draft", at(locale, "statusDraft")], ["published", at(locale, "statusPublished")], ["suspended", at(locale, "statusSuspended")]],
          },
        ]}
      />
      {page.items.length === 0 ? (
        <p>{at(locale, "empty")}</p>
      ) : (
        <table className={styles.table}>
          <thead>
            <tr>
              <th scope="col">{at(locale, "fieldName")}</th>
              <th scope="col">{at(locale, "fieldPlace")}</th>
              <th scope="col">{at(locale, "fieldTier")}</th>
              <th scope="col">{at(locale, "status")}</th>
            </tr>
          </thead>
          <tbody>
            {page.items.map((b) => (
              <tr key={b.id}>
                <td>
                  <Link href={adminHref(locale, `/businesses/${b.id}`)}>{pickText(b.name, locale)}</Link>
                  <div className={styles.hint} dir="ltr">{b.slug}</div>
                </td>
                <td dir="ltr">{b.placeSlug}</td>
                <td>{b.tier}</td>
                <td>
                  <StatusBadge locale={locale} status={b.status} /> <OwnerBadge locale={locale} editedAt={b.editedAt} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <Pager locale={locale} href={page.nextCursor ? withParams(base, { ...filters, cursor: page.nextCursor }) : null} />
    </>
  );
}
```
The place and kind filters work from the URL (`?place=sakhnin&kind=restaurants`). The editor links to them in Task 26.

- [ ] **Step 5: Run the tests and build**

Run: `pnpm --filter @darb/web exec vitest run src/admin && pnpm --filter @darb/web typecheck && NEXT_PUBLIC_LOCAL_TILES=1 pnpm --filter @darb/web build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add apps/web/src/admin apps/web/src/app/admin
git commit -m "feat(web): admin lists for places, sectors, kinds and businesses with search and paging"
```

---

### Task 25: Admin editors: place, sector and kind

**Files:**
- Create: `apps/web/src/admin/form-data.ts`, `apps/web/src/admin/action-state.ts`, `apps/web/src/admin/actions.ts`, `apps/web/src/admin/ActionForm.tsx`, `apps/web/src/admin/fields.tsx`, `apps/web/src/admin/EntityMeta.tsx`
- Test: `apps/web/src/admin/form-data.test.ts`, `apps/web/src/admin/ActionForm.test.tsx`
- Create pages: `(app)/places/new/page.tsx`, `(app)/places/[id]/page.tsx`, `(app)/sectors/new/page.tsx`, `(app)/sectors/[id]/page.tsx`, `(app)/kinds/new/page.tsx` and `(app)/kinds/[id]/page.tsx`, all under `apps/web/src/app/admin/[locale]/`

**Interfaces:**
- Consumes: Tasks 13, 23 and 24.
- Produces:
```ts
// action-state.ts (shared by client and server)
export interface ActionState { ok: boolean; message: string | null; errors: string[] }
export const idle: ActionState;
// form-data.ts (pure)
export const text: (fd: FormData, key: string) => string;
export const lines: (fd: FormData, key: string) => string[];
export const localized: (fd: FormData, key: string) => Localized; // reads key.he / key.ar / key.en, drops blanks
export const numberOrNull: (fd: FormData, key: string) => number | null;
export function placeFields(fd: FormData): { name; aliases; lat; lng; population; status };
export function sectorFields(fd: FormData): { name; tagline; accent; order };
export function kindFields(fd: FormData): { sectorId; parentKindId; name; synonyms; template; attributes; icon; order; status };
export function zodErrors(error: { issues: { path: (string | number)[]; message: string }[] }): string[];
// actions.ts ("use server"); every action reads hidden "locale" and optional "id" inputs
export async function savePlace(prev: ActionState, fd: FormData): Promise<ActionState>;
export async function saveSector(prev: ActionState, fd: FormData): Promise<ActionState>;
export async function saveKind(prev: ActionState, fd: FormData): Promise<ActionState>;
export async function releaseEntity(fd: FormData): Promise<void>; // reads "entity" and "id"
// fields.tsx
export function TextField(p: { label: string; name: string; defaultValue?: string | number | null; type?: string; hint?: string; dir?: "ltr" | "rtl" | "auto"; required?: boolean; step?: string }): JSX.Element;
export function TextArea(p: { label: string; name: string; defaultValue?: string; hint?: string; dir?: "ltr" | "rtl" | "auto"; rows?: number }): JSX.Element;
export function SelectField(p: { label: string; name: string; defaultValue?: string; options: [string, string][]; allowEmpty?: string }): JSX.Element;
export function LocalizedFields(p: { locale: Locale; label: string; name: string; value?: Localized }): JSX.Element;
// EntityMeta.tsx: ownership badge, release form, audit history
export function EntityMeta(p: { locale: Locale; entity: AdminEntity; id: string; editedAt: string | null }): Promise<JSX.Element>;
```

- [ ] **Step 1: Write the failing tests**

`apps/web/src/admin/form-data.test.ts`:
```ts
import { expect, it } from "vitest";
import { kindFields, lines, localized, placeFields, sectorFields, zodErrors } from "./form-data";

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
};

it("reads localized text, dropping blank languages", () => {
  expect(localized(fd({ "name.he": " סח'נין ", "name.ar": "", "name.en": "Sakhnin" }), "name")).toEqual({ he: "סח'נין", en: "Sakhnin" });
});

it("reads lines and place fields", () => {
  expect(lines(fd({ a: "x\r\n\n y \n" }), "a")).toEqual(["x", "y"]);
  expect(
    placeFields(fd({ "name.en": "Tamra", aliases: "Tamra\nTamrah", lat: "32.853", lng: "35.198", population: "", status: "live" })),
  ).toEqual({ name: { en: "Tamra" }, aliases: ["Tamra", "Tamrah"], lat: 32.853, lng: 35.198, population: null, status: "live" });
});

it("reads sector and kind fields", () => {
  expect(sectorFields(fd({ "name.en": "Food", "tagline.en": "Eat", accent: "#D9A54C", order: "3" }))).toEqual({
    name: { en: "Food" },
    tagline: { en: "Eat" },
    accent: "#d9a54c",
    order: 3,
  });
  const k = kindFields(
    fd({ sectorId: "s", parentKindId: "", "name.en": "Cafes", "synonyms.he": "קפה\nבית קפה", "synonyms.ar": "", "synonyms.en": "coffee", template: "menu", attributes: "delivers", icon: "", order: "2", status: "hidden" }),
  );
  expect(k).toMatchObject({ parentKindId: null, icon: null, synonyms: { he: ["קפה", "בית קפה"], ar: [], en: ["coffee"] }, attributes: ["delivers"] });
});

it("flattens zod issues", () => {
  expect(zodErrors({ issues: [{ path: ["name"], message: "At least one language must have text" }] })).toEqual([
    "name: At least one language must have text",
  ]);
});
```
`apps/web/src/admin/ActionForm.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { ActionForm } from "./ActionForm";

it("shows the action's errors in an alert and keeps the fields", async () => {
  const action = async () => ({ ok: false, message: "Fix these", errors: ["slug: Invalid slug"] });
  render(
    <ActionForm action={action} submit="Save" labels={{ fix: "Fix these and save again:" }}>
      <input aria-label="slug" name="slug" defaultValue="Bad Slug" />
    </ActionForm>,
  );
  fireEvent.click(screen.getByRole("button", { name: "Save" }));
  expect(await screen.findByRole("alert")).toBeTruthy();
  expect(screen.getByText("slug: Invalid slug")).toBeTruthy();
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/admin/form-data.test.ts src/admin/ActionForm.test.tsx`
Expected: FAIL.

- [ ] **Step 3: Pure helpers and the form**

`apps/web/src/admin/action-state.ts`:
```ts
export interface ActionState {
  ok: boolean;
  message: string | null;
  errors: string[];
}
export const idle: ActionState = { ok: false, message: null, errors: [] };
```
`apps/web/src/admin/form-data.ts`:
```ts
import type { Localized } from "@darb/core";

export const text = (fd: FormData, key: string): string => String(fd.get(key) ?? "").trim();
export const lines = (fd: FormData, key: string): string[] =>
  text(fd, key).split(/\r?\n/).map((s) => s.trim()).filter((s) => s !== "");
export const localized = (fd: FormData, key: string): Localized =>
  Object.fromEntries(
    (["he", "ar", "en"] as const).flatMap((l) => {
      const v = text(fd, `${key}.${l}`);
      return v ? [[l, v]] : [];
    }),
  );
export const numberOrNull = (fd: FormData, key: string): number | null => {
  const v = text(fd, key);
  return v === "" ? null : Number(v);
};
const orNull = (v: string) => (v === "" ? null : v);

export function placeFields(fd: FormData) {
  return {
    name: localized(fd, "name"),
    aliases: lines(fd, "aliases"),
    lat: Number(text(fd, "lat")),
    lng: Number(text(fd, "lng")),
    population: numberOrNull(fd, "population"),
    status: text(fd, "status"),
  };
}

export function sectorFields(fd: FormData) {
  return {
    name: localized(fd, "name"),
    tagline: localized(fd, "tagline"),
    accent: text(fd, "accent").toLowerCase(),
    order: Number(text(fd, "order")),
  };
}

export function kindFields(fd: FormData) {
  return {
    sectorId: text(fd, "sectorId"),
    parentKindId: orNull(text(fd, "parentKindId")),
    name: localized(fd, "name"),
    synonyms: { he: lines(fd, "synonyms.he"), ar: lines(fd, "synonyms.ar"), en: lines(fd, "synonyms.en") },
    template: text(fd, "template"),
    attributes: lines(fd, "attributes"),
    icon: orNull(text(fd, "icon")),
    order: Number(text(fd, "order")),
    status: text(fd, "status"),
  };
}

export function zodErrors(error: { issues: { path: (string | number)[]; message: string }[] }): string[] {
  return error.issues.map((i) => (i.path.length ? `${i.path.join(".")}: ${i.message}` : i.message));
}
```
`apps/web/src/admin/ActionForm.tsx`:
```tsx
"use client";

import { useActionState, type ReactNode } from "react";
import { idle, type ActionState } from "./action-state";
import styles from "./admin.module.css";

/** A server-action form that keeps what was typed and announces the outcome (role=alert). */
export function ActionForm({
  action,
  submit,
  labels,
  children,
}: {
  action: (state: ActionState, fd: FormData) => Promise<ActionState>;
  submit: string;
  labels: { fix: string };
  children: ReactNode;
}) {
  const [state, formAction, pending] = useActionState(action, idle);
  return (
    <form action={formAction} aria-busy={pending} className={styles.card}>
      {children}
      {state.message ? (
        <div role="alert" className={state.ok ? styles.notice : styles.error}>
          <p>{state.message}</p>
          {state.errors.length > 0 ? (
            <>
              <p>{labels.fix}</p>
              <ul>
                {state.errors.map((e) => (
                  <li key={e}>
                    <bdi>{e}</bdi>
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </div>
      ) : null}
      <div className={styles.actions}>
        <button className={styles.primary} type="submit" disabled={pending}>
          {submit}
        </button>
      </div>
    </form>
  );
}
```

- [ ] **Step 4: Fields, meta and actions**

`apps/web/src/admin/fields.tsx`:
```tsx
import type { Locale, Localized } from "@darb/core";
import { at } from "./copy";
import styles from "./admin.module.css";

export function TextField(p: {
  label: string;
  name: string;
  defaultValue?: string | number | null;
  type?: string;
  hint?: string;
  dir?: "ltr" | "rtl" | "auto";
  required?: boolean;
  step?: string;
}) {
  const hintId = p.hint ? `${p.name}-hint` : undefined;
  return (
    <label className={styles.field}>
      <span>{p.label}</span>
      <input
        name={p.name}
        type={p.type ?? "text"}
        defaultValue={p.defaultValue ?? ""}
        dir={p.dir}
        required={p.required}
        step={p.step}
        aria-describedby={hintId}
      />
      {p.hint ? (
        <small id={hintId} className={styles.hint}>
          {p.hint}
        </small>
      ) : null}
    </label>
  );
}

export function TextArea(p: { label: string; name: string; defaultValue?: string; hint?: string; dir?: "ltr" | "rtl" | "auto"; rows?: number }) {
  const hintId = p.hint ? `${p.name}-hint` : undefined;
  return (
    <label className={styles.field}>
      <span>{p.label}</span>
      <textarea name={p.name} defaultValue={p.defaultValue ?? ""} dir={p.dir} rows={p.rows ?? 4} aria-describedby={hintId} />
      {p.hint ? (
        <small id={hintId} className={styles.hint}>
          {p.hint}
        </small>
      ) : null}
    </label>
  );
}

export function SelectField(p: { label: string; name: string; defaultValue?: string; options: [string, string][]; allowEmpty?: string }) {
  return (
    <label className={styles.field}>
      <span>{p.label}</span>
      <select name={p.name} defaultValue={p.defaultValue ?? ""}>
        {p.allowEmpty !== undefined ? <option value="">{p.allowEmpty}</option> : null}
        {p.options.map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </label>
  );
}

/** One input per language, each in its own direction, so Arabic and Hebrew type naturally. */
export function LocalizedFields({ locale, label, name, value = {} }: { locale: Locale; label: string; name: string; value?: Localized }) {
  const langs = [
    ["he", "langHe", "rtl"],
    ["ar", "langAr", "rtl"],
    ["en", "langEn", "ltr"],
  ] as const;
  return (
    <fieldset className={styles.row} style={{ border: 0, padding: 0, margin: 0 }}>
      <legend className={styles.hint}>{label}</legend>
      {langs.map(([l, key, dir]) => (
        <TextField key={l} label={`${label} · ${at(locale, key)}`} name={`${name}.${l}`} defaultValue={value[l]} dir={dir} />
      ))}
    </fieldset>
  );
}
```
`apps/web/src/admin/EntityMeta.tsx`:
```tsx
import type { AdminEntity, AuditRowDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { adminApi, okOr } from "./api";
import { releaseEntity } from "./actions";
import { OwnerBadge } from "./Badges";
import { at } from "./copy";
import styles from "./admin.module.css";

/** Who owns the row (seed or admin), "Return to seed data", and the audit trail. */
export async function EntityMeta({ locale, entity, id, editedAt }: { locale: Locale; entity: AdminEntity; id: string; editedAt: string | null }) {
  const audit = okOr<AuditRowDto[]>(await (await adminApi()).misc.audit({ query: { entityType: entity, entityId: id } }), locale);
  const when = new Intl.DateTimeFormat(locale === "ar" ? "ar-IL-u-nu-latn" : `${locale}-IL`, { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Jerusalem" });
  return (
    <section className={styles.card} aria-labelledby="history">
      <p>
        <OwnerBadge locale={locale} editedAt={editedAt} />
      </p>
      {editedAt ? (
        <form action={releaseEntity} className={styles.actions}>
          <input type="hidden" name="locale" value={locale} />
          <input type="hidden" name="entity" value={entity} />
          <input type="hidden" name="id" value={id} />
          <button type="submit" className={styles.ghost}>
            {at(locale, "release")}
          </button>
          <small className={styles.hint}>{at(locale, "releaseHint")}</small>
        </form>
      ) : null}
      <h2 id="history" className={styles.h2}>
        {at(locale, "history")}
      </h2>
      {audit.length === 0 ? (
        <p>{at(locale, "historyEmpty")}</p>
      ) : (
        <ul className={styles.plain}>
          {audit.map((a) => (
            <li key={a.id}>
              {when.format(new Date(a.at))} · <bdi dir="ltr">{a.actor}</bdi> · {a.action}
              {a.fields.length ? ` · ${a.fields.join(", ")}` : ""}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
```
`apps/web/src/admin/actions.ts`:
```ts
"use server";

import {
  AdminKindCreateSchema,
  AdminKindPatchSchema,
  AdminPlaceCreateSchema,
  AdminPlacePatchSchema,
  AdminSectorCreateSchema,
  AdminSectorPatchSchema,
  ADMIN_ENTITIES,
  type AdminEntity,
  type AdminErrorDto,
  type AdminPlaceDto,
} from "@darb/contracts";
import type { Locale } from "@darb/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/locale";
import type { ActionState } from "./action-state";
import { adminApi } from "./api";
import { at } from "./copy";
import { kindFields, placeFields, sectorFields, text, zodErrors } from "./form-data";
import { adminHref } from "./routes";

const localeOf = (fd: FormData): Locale => {
  const l = text(fd, "locale");
  return isLocale(l) ? l : "he";
};

/** Runs an API write and turns its answer into form state, or navigates on success. */
async function send(
  locale: Locale,
  res: { status: number; body: unknown },
  onOk: (body: { id?: string }) => string | null,
): Promise<ActionState> {
  if (res.status === 200 || res.status === 201) {
    revalidatePath("/admin/[locale]", "layout");
    const to = onOk(res.body as { id?: string });
    if (to) redirect(to);
    return { ok: true, message: at(locale, "saved"), errors: [] };
  }
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  const body = res.body as AdminErrorDto | undefined;
  const message = typeof body?.message === "string" ? body.message : at(locale, "errorGeneric");
  return { ok: false, message, errors: body?.errors ?? [] };
}
const invalid = (locale: Locale, errors: string[]): ActionState => ({ ok: false, message: at(locale, "errorGeneric"), errors });

export async function savePlace(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const api = await adminApi();
  if (id) {
    const parsed = AdminPlacePatchSchema.safeParse(placeFields(fd));
    if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
    return send(locale, await api.places.update({ params: { id }, body: parsed.data }), () => null);
  }
  // A new place names its parent by address; resolve it to an id.
  const parentSlug = text(fd, "parent");
  const found = await api.places.list({ query: { q: parentSlug, limit: 100 } });
  const parent = found.status === 200 ? found.body.items.find((p: AdminPlaceDto) => p.slug === parentSlug) : undefined;
  const parsed = AdminPlaceCreateSchema.safeParse({
    ...placeFields(fd),
    slug: text(fd, "slug"),
    type: text(fd, "type"),
    parentId: parent?.id ?? "",
  });
  if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
  return send(locale, await api.places.create({ body: parsed.data }), (b) => adminHref(locale, `/places/${b.id}`));
}

export async function saveSector(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const api = await adminApi();
  if (id) {
    const parsed = AdminSectorPatchSchema.safeParse(sectorFields(fd));
    if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
    return send(locale, await api.sectors.update({ params: { id }, body: parsed.data }), () => null);
  }
  const parsed = AdminSectorCreateSchema.safeParse({ ...sectorFields(fd), slug: text(fd, "slug") });
  if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
  return send(locale, await api.sectors.create({ body: parsed.data }), () => adminHref(locale, "/sectors"));
}

export async function saveKind(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const api = await adminApi();
  if (id) {
    const parsed = AdminKindPatchSchema.safeParse(kindFields(fd));
    if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
    return send(locale, await api.kinds.update({ params: { id }, body: parsed.data }), () => null);
  }
  const parsed = AdminKindCreateSchema.safeParse({ ...kindFields(fd), slug: text(fd, "slug") });
  if (!parsed.success) return invalid(locale, zodErrors(parsed.error));
  return send(locale, await api.kinds.create({ body: parsed.data }), (b) => adminHref(locale, `/kinds/${b.id}`));
}

export async function releaseEntity(fd: FormData): Promise<void> {
  const entity = text(fd, "entity") as AdminEntity;
  if (!(ADMIN_ENTITIES as readonly string[]).includes(entity)) return;
  await (await adminApi()).misc.release({ params: { entity, id: text(fd, "id") }, body: {} });
  revalidatePath("/admin/[locale]", "layout");
}
```

- [ ] **Step 5: Editor pages**

`apps/web/src/app/admin/[locale]/(app)/places/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminPlaceDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { savePlace } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { LocalizedFields, SelectField, TextArea, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import { href } from "@/lib/routes";
import styles from "@/admin/admin.module.css";

export default async function EditPlace({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const p = okOr<AdminPlaceDto>(await (await adminApi()).places.get({ params: { id } }), locale);
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{pickText(p.name, locale)}</h1>
        <Link className={styles.ghost} href={href(locale, [p.slug])} target="_blank" rel="noopener">
          {at(locale, "openPublic")}
        </Link>
      </div>
      <p className={styles.hint} dir="ltr">
        {p.path} · {p.type}
        {p.cbsCode ? ` · CBS ${p.cbsCode}` : ""}
      </p>
      <ActionForm action={savePlace} submit={at(locale, "save")} labels={{ fix: at(locale, "errorFix") }}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={p.id} />
        <LocalizedFields locale={locale} label={at(locale, "fieldName")} name="name" value={p.name} />
        <TextArea label={at(locale, "fieldAliases")} name="aliases" defaultValue={p.aliases.join("\n")} dir="auto" />
        <div className={styles.row}>
          <TextField label={at(locale, "fieldLat")} name="lat" type="number" step="any" defaultValue={p.lat} dir="ltr" />
          <TextField label={at(locale, "fieldLng")} name="lng" type="number" step="any" defaultValue={p.lng} dir="ltr" />
          <TextField label={at(locale, "fieldPopulation")} name="population" type="number" defaultValue={p.population} dir="ltr" />
          <SelectField
            label={at(locale, "status")}
            name="status"
            defaultValue={p.status}
            options={[["live", at(locale, "statusLive")], ["soon", at(locale, "statusSoon")]]}
          />
        </div>
      </ActionForm>
      <EntityMeta locale={locale} entity="place" id={p.id} editedAt={p.editedAt} />
    </>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/places/new/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import { savePlace } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { at } from "@/admin/copy";
import { LocalizedFields, SelectField, TextArea, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function NewPlace({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "newPlace")}</h1>
      <ActionForm action={savePlace} submit={at(locale, "create")} labels={{ fix: at(locale, "errorFix") }}>
        <input type="hidden" name="locale" value={locale} />
        <div className={styles.row}>
          <TextField label={at(locale, "fieldSlug")} name="slug" dir="ltr" required hint={at(locale, "fieldSlugHint")} />
          <TextField label={at(locale, "fieldParent")} name="parent" dir="ltr" required />
          <SelectField
            label={at(locale, "fieldType")}
            name="type"
            defaultValue="neighbourhood"
            options={[["neighbourhood", "neighbourhood"], ["village", "village"], ["town", "town"], ["city", "city"], ["region", "region"]]}
          />
        </div>
        <LocalizedFields locale={locale} label={at(locale, "fieldName")} name="name" />
        <TextArea label={at(locale, "fieldAliases")} name="aliases" dir="auto" />
        <div className={styles.row}>
          <TextField label={at(locale, "fieldLat")} name="lat" type="number" step="any" dir="ltr" required />
          <TextField label={at(locale, "fieldLng")} name="lng" type="number" step="any" dir="ltr" required />
          <TextField label={at(locale, "fieldPopulation")} name="population" type="number" dir="ltr" />
          <SelectField label={at(locale, "status")} name="status" defaultValue="soon" options={[["soon", at(locale, "statusSoon")], ["live", at(locale, "statusLive")]]} />
        </div>
      </ActionForm>
    </>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/sectors/[id]/page.tsx`. There is no single-sector GET, so read it from the list:
```tsx
import { notFound } from "next/navigation";
import type { AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { saveSector } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { LocalizedFields, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function EditSector({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const s = okOr<AdminSectorDto[]>(await (await adminApi()).sectors.list(), locale).find((x) => x.id === id);
  if (!s) notFound();
  return (
    <>
      <h1 className={styles.h1}>{pickText(s.name, locale)}</h1>
      <ActionForm action={saveSector} submit={at(locale, "save")} labels={{ fix: at(locale, "errorFix") }}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={s.id} />
        <LocalizedFields locale={locale} label={at(locale, "fieldName")} name="name" value={s.name} />
        <LocalizedFields locale={locale} label={at(locale, "fieldTagline")} name="tagline" value={s.tagline} />
        <div className={styles.row}>
          <TextField label={at(locale, "fieldAccent")} name="accent" defaultValue={s.accent} dir="ltr" />
          <TextField label={at(locale, "fieldOrder")} name="order" type="number" defaultValue={s.order} dir="ltr" />
        </div>
      </ActionForm>
      <EntityMeta locale={locale} entity="sector" id={s.id} editedAt={s.editedAt} />
    </>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/sectors/new/page.tsx`: the same form without `id` and `EntityMeta`. Add `<TextField label={at(locale, "fieldSlug")} name="slug" dir="ltr" required hint={at(locale, "fieldSlugHint")} />` as the first field, render empty `LocalizedFields`, and use `submit={at(locale, "create")}` and the heading `at(locale, "newSector")`.

`apps/web/src/app/admin/[locale]/(app)/kinds/[id]/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import type { AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText, TEMPLATES } from "@darb/core";
import { saveKind } from "@/admin/actions";
import { ActionForm } from "@/admin/ActionForm";
import { adminApi, okOr } from "@/admin/api";
import { at } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { LocalizedFields, SelectField, TextArea, TextField } from "@/admin/fields";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function EditKind({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [k, sectors, kinds] = await Promise.all([
    api.kinds.get({ params: { id } }).then((r) => okOr<AdminKindDto>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
  ]);
  const siblings = kinds.filter((x) => x.sectorId === k.sectorId && x.id !== k.id);
  return (
    <>
      <h1 className={styles.h1}>{pickText(k.name, locale)}</h1>
      <p className={styles.hint} dir="ltr">
        {k.slug} · {at(locale, "businessesCount", { count: k.businessCount })}
      </p>
      <ActionForm action={saveKind} submit={at(locale, "save")} labels={{ fix: at(locale, "errorFix") }}>
        <input type="hidden" name="locale" value={locale} />
        <input type="hidden" name="id" value={k.id} />
        <LocalizedFields locale={locale} label={at(locale, "fieldName")} name="name" value={k.name} />
        <div className={styles.row}>
          <TextArea label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langHe")}`} name="synonyms.he" defaultValue={k.synonyms.he.join("\n")} dir="rtl" />
          <TextArea label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langAr")}`} name="synonyms.ar" defaultValue={k.synonyms.ar.join("\n")} dir="rtl" />
          <TextArea label={`${at(locale, "fieldSynonyms")} · ${at(locale, "langEn")}`} name="synonyms.en" defaultValue={k.synonyms.en.join("\n")} dir="ltr" />
        </div>
        <div className={styles.row}>
          <SelectField label={at(locale, "fieldSector")} name="sectorId" defaultValue={k.sectorId} options={sectors.map((s) => [s.id, pickText(s.name, locale)])} />
          <SelectField
            label={at(locale, "fieldParentKind")}
            name="parentKindId"
            defaultValue={k.parentKindId ?? ""}
            allowEmpty={at(locale, "none")}
            options={siblings.map((s) => [s.id, pickText(s.name, locale)])}
          />
          <SelectField label={at(locale, "fieldTemplate")} name="template" defaultValue={k.template} options={TEMPLATES.map((t) => [t, t])} />
          <SelectField label={at(locale, "status")} name="status" defaultValue={k.status} options={[["active", at(locale, "statusActive")], ["hidden", at(locale, "statusHidden")]]} />
          <TextField label={at(locale, "fieldOrder")} name="order" type="number" defaultValue={k.order} dir="ltr" />
          <TextField label={at(locale, "fieldIcon")} name="icon" defaultValue={k.icon} dir="ltr" />
        </div>
        <TextArea label={at(locale, "fieldAttributes")} name="attributes" defaultValue={k.attributes.join("\n")} dir="ltr" />
      </ActionForm>
      <EntityMeta locale={locale} entity="kind" id={k.id} editedAt={k.editedAt} />
    </>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/kinds/new/page.tsx` is the same form without `id` and `EntityMeta`, with these changes:
- a `slug` field first (`dir="ltr" required hint={at(locale, "fieldSlugHint")}`);
- the parent options are all kinds (the API checks the sector);
- status defaults to `hidden`, with `<p className={styles.notice}>{at(locale, "kindsHiddenHint")}</p>` above the form;
- `submit={at(locale, "create")}` and the heading `at(locale, "newKind")`.

- [ ] **Step 6: Run the tests and build**

Run: `pnpm --filter @darb/web exec vitest run src/admin && pnpm --filter @darb/web typecheck && NEXT_PUBLIC_LOCAL_TILES=1 pnpm --filter @darb/web build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/admin apps/web/src/app/admin
git commit -m "feat(web): admin editors for places, sectors and kinds with history and return-to-seed"
```

---

### Task 26: Admin business editor

**Files:**
- Create: `apps/web/src/admin/hours-form.ts`, `apps/web/src/admin/HoursEditor.tsx`, `apps/web/src/admin/business-form.ts`, `apps/web/src/admin/business-actions.ts`, `apps/web/src/admin/BusinessForm.tsx`, `apps/web/src/admin/StatusActions.tsx`
- Test: `apps/web/src/admin/hours-form.test.ts`, `apps/web/src/admin/HoursEditor.test.tsx`, `apps/web/src/admin/business-form.test.ts`
- Create pages: `apps/web/src/app/admin/[locale]/(app)/businesses/new/page.tsx` and `apps/web/src/app/admin/[locale]/(app)/businesses/[id]/page.tsx`

**Interfaces:**
- Consumes: Tasks 13, 23, 24 and 25 (`ActionForm`, the fields, `EntityMeta`, `text`, `lines`, `localized`, `zodErrors` and `ActionState`), and `Hours` from `@darb/core`.
- Produces:
```ts
// hours-form.ts
export type Weekly = Hours["weekly"];
export function exceptionsToText(ex: Hours["exceptions"]): string;          // "2026-12-25 closed\n2026-12-31 09:00-13:00"
export function parseExceptions(text: string): { ok: true; value: Hours["exceptions"] } | { ok: false; line: string };
// business-form.ts
export const EMPTY_EXPERIENCE: Record<string, unknown>; // a minimal screen that passes SCREEN_SCHEMA
export function businessFromForm(fd: FormData): { data: BusinessFormData; kindSlugs: string[]; errors: string[] };
//   BusinessFormData = everything in AdminBusinessPatchDto except kindIds
// business-actions.ts ("use server")
export async function saveBusiness(prev: ActionState, fd: FormData): Promise<ActionState>;
export async function setBusinessStatus(fd: FormData): Promise<void>; // "status": published | suspended | draft
export async function deleteBusiness(fd: FormData): Promise<void>;
// HoursEditor.tsx (client): writes JSON into hidden input "hours.weekly"
export function HoursEditor(p: { weekly: Weekly; labels: { days: string[]; closed: string; add: string; remove: string; open: string; close: string } }): JSX.Element;
```

- [ ] **Step 1: Write the failing tests**

`apps/web/src/admin/hours-form.test.ts`:
```ts
import { expect, it } from "vitest";
import { exceptionsToText, parseExceptions } from "./hours-form";

it("round-trips special days", () => {
  const ex = [
    { date: "2026-12-25", intervals: [] },
    { date: "2026-12-31", intervals: [{ open: "09:00", close: "13:00" }, { open: "16:00", close: "20:00" }] },
  ];
  const text = exceptionsToText(ex);
  expect(text).toBe("2026-12-25 closed\n2026-12-31 09:00-13:00 16:00-20:00");
  expect(parseExceptions(text)).toEqual({ ok: true, value: ex });
});

it("names the first line it cannot read", () => {
  expect(parseExceptions("2026-12-25 closed\nchristmas eve")).toEqual({ ok: false, line: "christmas eve" });
  expect(parseExceptions("")).toEqual({ ok: true, value: [] });
});
```
`apps/web/src/admin/HoursEditor.test.tsx`:
```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { HoursEditor } from "./HoursEditor";

const labels = { days: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"], closed: "Closed", add: "Add hours", remove: "Remove", open: "Opens", close: "Closes" };

it("edits intervals and writes the weekly JSON into the form", () => {
  const { container } = render(<HoursEditor weekly={{ "0": [{ open: "09:00", close: "18:00" }] }} labels={labels} />);
  const hidden = () => JSON.parse((container.querySelector('input[name="hours.weekly"]') as HTMLInputElement).value);
  expect(hidden()["0"]).toEqual([{ open: "09:00", close: "18:00" }]);
  fireEvent.click(screen.getAllByRole("button", { name: "Add hours" })[1]!); // Monday
  expect(hidden()["1"]).toEqual([{ open: "09:00", close: "17:00" }]);
  fireEvent.change(screen.getByLabelText("Mon · Closes 1"), { target: { value: "23:00" } });
  expect(hidden()["1"]).toEqual([{ open: "09:00", close: "23:00" }]);
  fireEvent.click(screen.getByRole("button", { name: "Sun · Remove 1" }));
  expect(hidden()["0"]).toEqual([]);
});
```
`apps/web/src/admin/business-form.test.ts`:
```ts
import { expect, it } from "vitest";
import { businessFromForm, EMPTY_EXPERIENCE } from "./business-form";

const form = (over: Record<string, string> = {}) => {
  const f = new FormData();
  const base: Record<string, string> = {
    "name.ar": "كراميل",
    "tagline.ar": "مطعم",
    "address.ar": "شارع ١",
    primaryKindId: "0190a000-0000-7000-8000-000000000002",
    kinds: "cafes\ndesserts",
    lat: "32.92",
    lng: "35.08",
    phone: "+972 4-000-0000",
    whatsapp: "",
    website: "https://caramel.darb.co.il",
    "hours.weekly": JSON.stringify({ "0": [{ open: "12:00", close: "23:00" }] }),
    "hours.exceptions": "2026-12-31 12:00-18:00",
    "attributes.base": JSON.stringify({ parking: true }),
    delivers: "on",
    experience: JSON.stringify(EMPTY_EXPERIENCE),
    tier: "darb",
    "apps.web": "https://caramel.darb.co.il",
    "apps.ios": "",
    "apps.android": "",
  };
  for (const [k, v] of Object.entries({ ...base, ...over })) f.append(k, v);
  return f;
};

it("reads a full business, merging the delivers checkbox into the attributes", () => {
  const { data, kindSlugs, errors } = businessFromForm(form());
  expect(errors).toEqual([]);
  expect(kindSlugs).toEqual(["cafes", "desserts"]);
  expect(data).toMatchObject({
    whatsapp: null,
    attributes: { parking: true, delivers: true },
    apps: { web: "https://caramel.darb.co.il" },
    hours: { weekly: { "0": [{ open: "12:00", close: "23:00" }] }, exceptions: [{ date: "2026-12-31", intervals: [{ open: "12:00", close: "18:00" }] }] },
  });
});

it("reports bad JSON and unreadable special days instead of throwing", () => {
  const { errors } = businessFromForm(form({ experience: "{nope", "hours.exceptions": "someday" }));
  expect(errors).toEqual(["experience: not valid JSON", "hours: cannot read “someday”"]);
});

it("an unchecked delivers box removes the attribute", () => {
  const f = form();
  f.delete("delivers");
  expect(businessFromForm(f).data.attributes).toEqual({ parking: true, delivers: false });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/admin/hours-form.test.ts src/admin/HoursEditor.test.tsx src/admin/business-form.test.ts`
Expected: FAIL.

- [ ] **Step 3: Hours helpers and editor**

`apps/web/src/admin/hours-form.ts`:
```ts
import type { Hours } from "@darb/core";

export type Weekly = Hours["weekly"];
const TIME = /^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/;

export function exceptionsToText(ex: Hours["exceptions"]): string {
  return ex
    .map((e) => `${e.date} ${e.intervals.length ? e.intervals.map((i) => `${i.open}-${i.close}`).join(" ") : "closed"}`)
    .join("\n");
}

export function parseExceptions(text: string): { ok: true; value: Hours["exceptions"] } | { ok: false; line: string } {
  const value: Hours["exceptions"] = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) continue;
    const [date, ...rest] = line.split(/\s+/);
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date) || rest.length === 0) return { ok: false, line };
    if (rest.length === 1 && rest[0] === "closed") {
      value.push({ date, intervals: [] });
      continue;
    }
    const intervals = rest.map((r) => r.split("-"));
    if (intervals.some(([o, c]) => !o || !c || !TIME.test(o) || !TIME.test(c))) return { ok: false, line };
    value.push({ date, intervals: intervals.map(([open, close]) => ({ open: open!, close: close! })) });
  }
  return { ok: true, value };
}
```
`apps/web/src/admin/HoursEditor.tsx`:
```tsx
"use client";

import { useState } from "react";
import type { Weekly } from "./hours-form";
import styles from "./admin.module.css";

const DAYS = ["0", "1", "2", "3", "4", "5", "6"] as const;
type Day = (typeof DAYS)[number];

/** Weekly hours in Asia/Jerusalem; an interval may cross midnight (close earlier than open). */
export function HoursEditor({
  weekly,
  labels,
}: {
  weekly: Weekly;
  labels: { days: string[]; closed: string; add: string; remove: string; open: string; close: string };
}) {
  const [week, setWeek] = useState<Record<Day, { open: string; close: string }[]>>(
    () => Object.fromEntries(DAYS.map((d) => [d, [...(weekly[d] ?? [])]])) as Record<Day, { open: string; close: string }[]>,
  );
  const update = (day: Day, list: { open: string; close: string }[]) => setWeek((w) => ({ ...w, [day]: list }));
  return (
    <fieldset className={styles.card} style={{ display: "grid", gap: 8 }}>
      <input type="hidden" name="hours.weekly" value={JSON.stringify(week)} />
      {DAYS.map((day, d) => {
        const name = labels.days[d]!;
        return (
          <div key={day} className={styles.actions} style={{ margin: 0 }}>
            <strong style={{ minInlineSize: 96 }}>{name}</strong>
            {week[day].length === 0 ? <span className={styles.hint}>{labels.closed}</span> : null}
            {week[day].map((iv, i) => (
              <span key={i} className={styles.actions} style={{ margin: 0 }}>
                <input
                  type="time"
                  aria-label={`${name} · ${labels.open} ${i + 1}`}
                  value={iv.open}
                  onChange={(e) => update(day, week[day].map((x, j) => (j === i ? { ...x, open: e.target.value } : x)))}
                />
                <span aria-hidden="true">–</span>
                <input
                  type="time"
                  aria-label={`${name} · ${labels.close} ${i + 1}`}
                  value={iv.close}
                  onChange={(e) => update(day, week[day].map((x, j) => (j === i ? { ...x, close: e.target.value } : x)))}
                />
                <button
                  type="button"
                  className={styles.ghost}
                  aria-label={`${name} · ${labels.remove} ${i + 1}`}
                  onClick={() => update(day, week[day].filter((_, j) => j !== i))}
                >
                  ×
                </button>
              </span>
            ))}
            <button type="button" className={styles.ghost} onClick={() => update(day, [...week[day], { open: "09:00", close: "17:00" }])}>
              {labels.add}
            </button>
          </div>
        );
      })}
    </fieldset>
  );
}
```

- [ ] **Step 4: Business form parsing, actions and status buttons**

`apps/web/src/admin/business-form.ts`:
```ts
import type { AdminBusinessPatchDto } from "@darb/contracts";
import { lines, localized, text } from "./form-data";
import { parseExceptions } from "./hours-form";

export type BusinessFormData = Omit<AdminBusinessPatchDto, "kindIds">;

/** A minimal screen that passes the shared content schema: the starting point for a new business. */
export const EMPTY_EXPERIENCE: Record<string, unknown> = {
  brand: { en: "Business name" },
  title: { en: "Welcome" },
  items: [{ label: { en: "First item" } }],
  cta: { en: "Contact us" },
  palette: { bg: "#08241a", surface: "#0e3527", ink: "#fbf7ec", accent: "#d9a54c" },
  font: "Heebo",
};

const json = (raw: string): unknown => {
  try {
    return JSON.parse(raw);
  } catch {
    return undefined;
  }
};
const orNull = (v: string) => (v === "" ? null : v);

export function businessFromForm(fd: FormData): { data: BusinessFormData; kindSlugs: string[]; errors: string[] } {
  const errors: string[] = [];
  const experience = json(text(fd, "experience"));
  if (experience === undefined || typeof experience !== "object" || experience === null)
    errors.push("experience: not valid JSON");
  const weekly = json(text(fd, "hours.weekly") || "{}");
  const ex = parseExceptions(text(fd, "hours.exceptions"));
  if (!ex.ok) errors.push(`hours: cannot read “${ex.line}”`);
  const base = (json(text(fd, "attributes.base") || "{}") ?? {}) as Record<string, boolean | string | number>;
  const apps = Object.fromEntries(
    (["web", "ios", "android"] as const).flatMap((k) => {
      const v = text(fd, `apps.${k}`);
      return v ? [[k, v]] : [];
    }),
  );
  return {
    errors,
    kindSlugs: lines(fd, "kinds"),
    data: {
      name: localized(fd, "name"),
      tagline: localized(fd, "tagline"),
      address: localized(fd, "address"),
      primaryKindId: text(fd, "primaryKindId"),
      lat: Number(text(fd, "lat")),
      lng: Number(text(fd, "lng")),
      phone: orNull(text(fd, "phone")),
      whatsapp: orNull(text(fd, "whatsapp")),
      website: orNull(text(fd, "website")),
      hours: { weekly: (weekly ?? {}) as NonNullable<BusinessFormData["hours"]>["weekly"], exceptions: ex.ok ? ex.value : [] },
      attributes: { ...base, delivers: fd.get("delivers") === "on" },
      experience: (experience ?? {}) as Record<string, unknown>,
      tier: text(fd, "tier") as BusinessFormData["tier"],
      apps,
    },
  };
}
```
`apps/web/src/admin/business-actions.ts`:
```ts
"use server";

import {
  AdminBusinessCreateSchema,
  AdminBusinessPatchSchema,
  type AdminBusinessRowDto,
  type AdminErrorDto,
  type AdminKindDto,
  type AdminPlaceDto,
} from "@darb/contracts";
import type { Locale } from "@darb/core";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isLocale } from "@/lib/locale";
import type { ActionState } from "./action-state";
import { adminApi } from "./api";
import { businessFromForm } from "./business-form";
import { at } from "./copy";
import { text, zodErrors } from "./form-data";
import { adminHref } from "./routes";

const localeOf = (fd: FormData): Locale => {
  const l = text(fd, "locale");
  return isLocale(l) ? l : "he";
};
const fail = (locale: Locale, errors: string[], message?: string): ActionState => ({
  ok: false,
  message: message ?? at(locale, "errorGeneric"),
  errors,
});

export async function saveBusiness(_prev: ActionState, fd: FormData): Promise<ActionState> {
  const locale = localeOf(fd);
  const id = text(fd, "id");
  const { data, kindSlugs, errors } = businessFromForm(fd);
  if (errors.length) return fail(locale, errors);
  const api = await adminApi();
  const kinds = await api.kinds.list({ query: {} });
  const bySlug = new Map(kinds.status === 200 ? kinds.body.map((k: AdminKindDto) => [k.slug, k.id]) : []);
  const unknown = kindSlugs.filter((s) => !bySlug.has(s));
  if (unknown.length) return fail(locale, unknown.map((s) => `kinds: no kind “${s}”`));
  const kindIds = kindSlugs.map((s) => bySlug.get(s)!);

  const res = id
    ? await (() => {
        const parsed = AdminBusinessPatchSchema.safeParse({ ...data, kindIds });
        return parsed.success ? api.businesses.update({ params: { id }, body: parsed.data }) : Promise.resolve(parsed);
      })()
    : await (async () => {
        const placeSlug = text(fd, "place");
        const found = await api.places.list({ query: { q: placeSlug, limit: 100 } });
        const place = found.status === 200 ? found.body.items.find((p: AdminPlaceDto) => p.slug === placeSlug) : undefined;
        const parsed = AdminBusinessCreateSchema.safeParse({ ...data, kindIds, slug: text(fd, "slug"), placeId: place?.id ?? "", status: "draft" });
        return parsed.success ? api.businesses.create({ body: parsed.data }) : parsed;
      })();
  if ("success" in res) return fail(locale, zodErrors(res.error));
  if (res.status === 200 || res.status === 201) {
    revalidatePath("/admin/[locale]", "layout");
    if (!id) redirect(adminHref(locale, `/businesses/${(res.body as AdminBusinessRowDto).id}`));
    return { ok: true, message: at(locale, "saved"), errors: [] };
  }
  if (res.status === 401) redirect(adminHref(locale, "/sign-in"));
  const body = res.body as AdminErrorDto;
  return fail(locale, body.errors ?? [], typeof body.message === "string" ? body.message : undefined);
}

export async function setBusinessStatus(fd: FormData): Promise<void> {
  const status = text(fd, "status");
  if (status !== "published" && status !== "suspended" && status !== "draft") return;
  await (await adminApi()).businesses.status({ params: { id: text(fd, "id") }, body: { status } });
  revalidatePath("/admin/[locale]", "layout");
}

export async function deleteBusiness(fd: FormData): Promise<void> {
  const locale = localeOf(fd);
  const res = await (await adminApi()).businesses.remove({ params: { id: text(fd, "id") }, body: {} });
  if (res.status === 200) redirect(adminHref(locale, "/businesses"));
}
```
`apps/web/src/admin/StatusActions.tsx`:
```tsx
import type { AdminBusinessDto } from "@darb/contracts";
import type { Locale } from "@darb/core";
import { deleteBusiness, setBusinessStatus } from "./business-actions";
import { at } from "./copy";
import styles from "./admin.module.css";

/** Publish, suspend now (an immediate takedown), back to draft, and delete for admin drafts. */
export function StatusActions({ locale, business }: { locale: Locale; business: AdminBusinessDto }) {
  const button = (status: "published" | "suspended" | "draft", label: string, cls: string) => (
    <form action={setBusinessStatus}>
      <input type="hidden" name="id" value={business.id} />
      <input type="hidden" name="status" value={status} />
      <button type="submit" className={cls}>
        {label}
      </button>
    </form>
  );
  return (
    <section className={styles.card} aria-label={at(locale, "status")}>
      <div className={styles.actions}>
        {business.status !== "published" ? button("published", at(locale, "publish"), styles.primary!) : null}
        {business.status !== "suspended" ? button("suspended", at(locale, "suspend"), styles.danger!) : null}
        {business.status === "published" ? button("draft", at(locale, "toDraft"), styles.ghost!) : null}
        {business.source === "admin" && business.status === "draft" ? (
          <form action={deleteBusiness}>
            <input type="hidden" name="id" value={business.id} />
            <input type="hidden" name="locale" value={locale} />
            <button type="submit" className={styles.danger}>
              {at(locale, "deleteDraft")}
            </button>
          </form>
        ) : null}
      </div>
      <p className={styles.hint}>{at(locale, "suspendHint")}</p>
    </section>
  );
}
```

- [ ] **Step 5: The form and its two pages**

`apps/web/src/admin/BusinessForm.tsx` (a server component shared by new and edit):
```tsx
import type { AdminBusinessDto, AdminKindDto } from "@darb/contracts";
import { pickText, TIERS, type Locale } from "@darb/core";
import { ActionForm } from "./ActionForm";
import { saveBusiness } from "./business-actions";
import { EMPTY_EXPERIENCE } from "./business-form";
import { at } from "./copy";
import { LocalizedFields, SelectField, TextArea, TextField } from "./fields";
import { exceptionsToText } from "./hours-form";
import { HoursEditor } from "./HoursEditor";
import styles from "./admin.module.css";

export function BusinessForm({ locale, kinds, business }: { locale: Locale; kinds: AdminKindDto[]; business?: AdminBusinessDto }) {
  const b = business;
  const kindSlug = new Map(kinds.map((k) => [k.id, k.slug]));
  const { delivers: _d, ...otherAttributes } = b?.attributes ?? {};
  const days = (["day0", "day1", "day2", "day3", "day4", "day5", "day6"] as const).map((d) => at(locale, d));
  return (
    <ActionForm action={saveBusiness} submit={at(locale, b ? "save" : "create")} labels={{ fix: at(locale, "errorFix") }}>
      <input type="hidden" name="locale" value={locale} />
      {b ? <input type="hidden" name="id" value={b.id} /> : null}
      {b ? null : (
        <div className={styles.row}>
          <TextField label={at(locale, "fieldSlug")} name="slug" dir="ltr" required hint={at(locale, "fieldSlugHint")} />
          <TextField label={at(locale, "fieldPlace")} name="place" dir="ltr" required />
        </div>
      )}
      <LocalizedFields locale={locale} label={at(locale, "fieldName")} name="name" value={b?.name} />
      <LocalizedFields locale={locale} label={at(locale, "fieldTagline")} name="tagline" value={b?.tagline} />
      <LocalizedFields locale={locale} label={at(locale, "fieldAddress")} name="address" value={b?.address} />
      <div className={styles.row}>
        <SelectField
          label={at(locale, "fieldPrimaryKind")}
          name="primaryKindId"
          defaultValue={b?.primaryKindId}
          options={kinds.map((k) => [k.id, `${pickText(k.name, locale)} (${k.slug})`])}
        />
        <TextArea
          label={at(locale, "fieldKinds")}
          name="kinds"
          dir="ltr"
          rows={2}
          defaultValue={(b?.kindIds ?? []).filter((id) => id !== b?.primaryKindId).map((id) => kindSlug.get(id) ?? "").join("\n")}
        />
        <TextField label={at(locale, "fieldLat")} name="lat" type="number" step="any" defaultValue={b?.lat} dir="ltr" required />
        <TextField label={at(locale, "fieldLng")} name="lng" type="number" step="any" defaultValue={b?.lng} dir="ltr" required />
      </div>
      <div className={styles.row}>
        <TextField label={at(locale, "fieldPhone")} name="phone" type="tel" defaultValue={b?.phone} dir="ltr" />
        <TextField label={at(locale, "fieldWhatsapp")} name="whatsapp" type="tel" defaultValue={b?.whatsapp} dir="ltr" />
        <TextField label={at(locale, "fieldWebsite")} name="website" type="url" defaultValue={b?.website} dir="ltr" />
        <SelectField label={at(locale, "fieldTier")} name="tier" defaultValue={b?.tier ?? "basic"} options={TIERS.map((t) => [t, t])} />
      </div>
      <fieldset className={styles.row} style={{ border: 0, padding: 0, margin: 0 }}>
        <legend className={styles.hint}>{at(locale, "fieldApps")}</legend>
        <TextField label={at(locale, "fieldAppWeb")} name="apps.web" type="url" defaultValue={b?.apps.web} dir="ltr" />
        <TextField label={at(locale, "fieldAppIos")} name="apps.ios" type="url" defaultValue={b?.apps.ios} dir="ltr" />
        <TextField label={at(locale, "fieldAppAndroid")} name="apps.android" type="url" defaultValue={b?.apps.android} dir="ltr" />
      </fieldset>
      <h2 className={styles.h2}>{at(locale, "fieldHours")}</h2>
      <HoursEditor
        weekly={b?.hours.weekly ?? {}}
        labels={{ days, closed: at(locale, "closed"), add: at(locale, "addHours"), remove: at(locale, "remove"), open: at(locale, "opens"), close: at(locale, "closes") }}
      />
      <TextArea label={at(locale, "fieldExceptions")} name="hours.exceptions" dir="ltr" defaultValue={exceptionsToText(b?.hours.exceptions ?? [])} />
      <input type="hidden" name="attributes.base" value={JSON.stringify(otherAttributes)} />
      <label className={styles.actions}>
        <input type="checkbox" name="delivers" defaultChecked={b?.attributes.delivers === true} style={{ inlineSize: 24, blockSize: 24 }} />
        {at(locale, "fieldDelivers")}
      </label>
      <TextArea
        label={at(locale, "fieldExperience")}
        name="experience"
        dir="ltr"
        rows={14}
        defaultValue={JSON.stringify(b?.experience ?? EMPTY_EXPERIENCE, null, 2)}
      />
    </ActionForm>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/businesses/[id]/page.tsx`:
```tsx
import Link from "next/link";
import { notFound } from "next/navigation";
import type { AdminBusinessDto, AdminKindDto, AdminSectorDto } from "@darb/contracts";
import { pickText } from "@darb/core";
import { adminApi, okOr } from "@/admin/api";
import { StatusBadge } from "@/admin/Badges";
import { BusinessForm } from "@/admin/BusinessForm";
import { at } from "@/admin/copy";
import { EntityMeta } from "@/admin/EntityMeta";
import { StatusActions } from "@/admin/StatusActions";
import { isLocale } from "@/lib/locale";
import { href, paths } from "@/lib/routes";
import styles from "@/admin/admin.module.css";

export default async function EditBusiness({ params }: { params: Promise<{ locale: string; id: string }> }) {
  const { locale, id } = await params;
  if (!isLocale(locale)) notFound();
  const api = await adminApi();
  const [b, kinds, sectors] = await Promise.all([
    api.businesses.get({ params: { id } }).then((r) => okOr<AdminBusinessDto>(r, locale)),
    api.kinds.list({ query: {} }).then((r) => okOr<AdminKindDto[]>(r, locale)),
    api.sectors.list().then((r) => okOr<AdminSectorDto[]>(r, locale)),
  ]);
  const kind = kinds.find((k) => k.id === b.primaryKindId);
  const sector = sectors.find((s) => s.id === kind?.sectorId);
  return (
    <>
      <div className={styles.actions}>
        <h1 className={styles.h1}>{pickText(b.name, locale)}</h1>
        <StatusBadge locale={locale} status={b.status} />
        {kind && sector && b.status === "published" ? (
          <Link className={styles.ghost} href={href(locale, paths.business(b.placeSlug, sector.slug, kind.slug, b.slug))} target="_blank" rel="noopener">
            {at(locale, "openPublic")}
          </Link>
        ) : null}
      </div>
      <p className={styles.hint} dir="ltr">
        {b.placeSlug}/{b.slug} · {b.source} · {b.tier}
      </p>
      <StatusActions locale={locale} business={b} />
      <BusinessForm locale={locale} kinds={kinds} business={b} />
      <EntityMeta locale={locale} entity="business" id={b.id} editedAt={b.editedAt} />
    </>
  );
}
```
`apps/web/src/app/admin/[locale]/(app)/businesses/new/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import type { AdminKindDto } from "@darb/contracts";
import { adminApi, okOr } from "@/admin/api";
import { BusinessForm } from "@/admin/BusinessForm";
import { at } from "@/admin/copy";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

export default async function NewBusiness({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const kinds = okOr<AdminKindDto[]>(await (await adminApi()).kinds.list({ query: { status: "active" } }), locale);
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "newBusiness")}</h1>
      <BusinessForm locale={locale} kinds={kinds} />
    </>
  );
}
```

- [ ] **Step 6: Run the tests and build**

Run: `pnpm --filter @darb/web exec vitest run src/admin && pnpm --filter @darb/web typecheck && NEXT_PUBLIC_LOCAL_TILES=1 pnpm --filter @darb/web build`
Expected: PASS.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/admin apps/web/src/app/admin
git commit -m "feat(web): business editor with hours, contact, tier, app links, experience and takedowns"
```

---

### Task 27: Missing report screen, admin e2e, axe and budgets

**Files:**
- Create: `apps/web/src/app/admin/[locale]/(app)/report/page.tsx`
- Create: `apps/web/e2e/admin.spec.ts`, `apps/web/e2e/admin-a11y.spec.ts`
- Modify: `apps/web/playwright.config.ts` (admin and revalidation env for the e2e servers)
- Modify: `apps/web/scripts/check-budget.mjs` (no Clerk in public chunks)
- Modify: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: everything in Part E, and the API admin (Tasks 12–17).
- Produces:
  - e2e coverage of the auth guard (signed out, non-admin, the local sign-in form);
  - CRUD through the UI;
  - the audit trail;
  - revalidation (a published business appears publicly, and a suspended one 404s on the next request);
  - the report;
  - axe at 0 on every admin screen in he, ar and en;
  - a budget guard that fails if `clerk` appears in any public first-load chunk.

- [ ] **Step 1: The report screen**

`apps/web/src/app/admin/[locale]/(app)/report/page.tsx`:
```tsx
import { notFound } from "next/navigation";
import type { MissingReportDto } from "@darb/contracts";
import { adminApi, okOr } from "@/admin/api";
import { at, type AdminKey } from "@/admin/copy";
import { one, type SearchParams } from "@/admin/params";
import { adminHref } from "@/admin/routes";
import { Toolbar } from "@/admin/Toolbar";
import { isLocale } from "@/lib/locale";
import styles from "@/admin/admin.module.css";

const DAYS = ["7", "30", "90"];

/** Spec §4.7: what people searched for and did not find. Raw visitor text: private (Plan 3 note). */
export default async function ReportPage({ params, searchParams }: { params: Promise<{ locale: string }>; searchParams: Promise<SearchParams> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const raw = one((await searchParams).days);
  const days = DAYS.includes(raw ?? "") ? Number(raw) : 30;
  const report = okOr<MissingReportDto>(await (await adminApi()).misc.report({ query: { days, limit: 100 } }), locale);
  const sections: [AdminKey, MissingReportDto["missingKinds"]][] = [
    ["reportMissingKinds", report.missingKinds],
    ["reportMissingPlaces", report.missingPlaces],
    ["reportNoResults", report.noResults],
  ];
  return (
    <>
      <h1 className={styles.h1}>{at(locale, "reportTitle")}</h1>
      <p className={styles.notice} role="note">
        {at(locale, "reportSensitive")}
      </p>
      <form method="get" action={adminHref(locale, "/report")} className={styles.toolbar}>
        <label className={styles.field}>
          <span>{at(locale, "reportDays", { days })}</span>
          <select name="days" defaultValue={String(days)}>
            {DAYS.map((d) => (
              <option key={d} value={d}>
                {at(locale, "reportDays", { days: d })}
              </option>
            ))}
          </select>
        </label>
        <button type="submit" className={styles.ghost}>
          {at(locale, "search")}
        </button>
      </form>
      {sections.map(([key, rows]) => (
        <section key={key} className={styles.card} aria-labelledby={key}>
          <h2 id={key} className={styles.h2}>
            {at(locale, key)}
          </h2>
          {rows.length === 0 ? (
            <p>{at(locale, "empty")}</p>
          ) : (
            <table className={styles.table}>
              <thead>
                <tr>
                  <th scope="col">{at(locale, "term")}</th>
                  <th scope="col">{at(locale, "count")}</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.term}>
                    <td>
                      <bdi>{r.term}</bdi>
                    </td>
                    <td>{r.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </>
  );
}
```
(The `Toolbar` import is not used on this page. Remove it if lint flags it.)

- [ ] **Step 2: e2e servers know admin and revalidation**

In `apps/web/playwright.config.ts`:
- add `const REVALIDATE_SECRET = "e2e-revalidate-secret";`;
- add to the API server `env`:
```ts
        AUTH_VERIFIER: "fake",
        ADMIN_EMAILS: "e2e-admin@darb.test",
        REVALIDATE_URL: `${WEB}/api/revalidate`,
        REVALIDATE_SECRET,
```
- add `ADMIN_FAKE_AUTH: "1", REVALIDATE_SECRET` to both web servers' `env`.

- [ ] **Step 3: Write the admin e2e**

`apps/web/e2e/admin.spec.ts`:
```ts
import { expect, test, type BrowserContext } from "@playwright/test";

const ADMIN = "fake.user_e2e.e2e-admin@darb.test";
const signInAs = (context: BrowserContext, baseURL: string, value: string) =>
  context.addCookies([{ name: "darb_admin_fake", value, url: baseURL }]);

/** amqa and upholstery appear in no other spec, so this business never disturbs their pages. */
const PLACE = "amqa";
const PUBLIC = (slug: string) => `/en/${PLACE}/home/upholstery/${slug}`;

test.describe("admin", () => {
  test("signed out goes to sign-in; a signed-in non-admin is refused", async ({ page, context, baseURL }) => {
    await page.goto("/en/admin/places");
    await expect(page).toHaveURL(/\/en\/admin\/sign-in$/);
    await signInAs(context, baseURL!, "fake.user_nobody.nobody@darb.test");
    await page.goto("/en/admin");
    await expect(page.getByText("This account is not a Darb admin")).toBeVisible();
  });

  test("the local sign-in form signs an admin in", async ({ page }) => {
    await page.goto("/en/admin/sign-in");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByRole("heading", { name: "Overview" })).toBeVisible();
  });

  test("admin pages are noindex, uncached and nonce-protected", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, ADMIN);
    const res = await page.goto("/admin");
    expect(res?.headers()["x-robots-tag"]).toBe("noindex, nofollow");
    expect(res?.headers()["cache-control"]).toContain("no-store");
    expect(res?.headers()["content-security-policy"]).toMatch(/'nonce-[^']+' 'strict-dynamic'/);
  });

  test("lists search places and kinds", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, ADMIN);
    await page.goto("/en/admin/places?q=sakhnin");
    await expect(page.getByRole("link", { name: "Sakhnin", exact: true })).toBeVisible();
    await page.goto("/en/admin/kinds?q=barber&status=active");
    await expect(page.getByRole("link", { name: "Barbershops" })).toBeVisible();
  });

  test("create, publish, edit and suspend a business; the public city follows at once", async ({ page, context, baseURL, request }) => {
    test.slow();
    await signInAs(context, baseURL!, ADMIN);
    const slug = `e2e-${Date.now().toString(36)}`;
    await page.goto("/en/admin/businesses/new");
    await page.getByLabel("Web address (slug)").fill(slug);
    await page.getByLabel("Place").fill(PLACE);
    await page.getByLabel("Name · English").fill("E2E Upholstery");
    await page.getByLabel("Tagline · English").fill("Sofas made new");
    await page.getByLabel("Street address · English").fill("Main street");
    const kindId = await page.locator('select[name="primaryKindId"] option', { hasText: "(upholstery)" }).getAttribute("value");
    await page.getByLabel("Kind", { exact: true }).selectOption(kindId!);
    await page.getByLabel("Latitude").fill("32.858");
    await page.getByLabel("Longitude").fill("35.181");
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page).toHaveURL(/\/en\/admin\/businesses\/[0-9a-f-]{36}$/);

    await page.getByRole("button", { name: "Publish" }).click();
    await expect(page.getByText("Published").first()).toBeVisible();
    await expect.poll(async () => (await request.get(PUBLIC(slug))).status(), { timeout: 15_000 }).toBe(200);

    await page.getByLabel("Tagline · English").fill("Sofas and chairs made new");
    await page.getByRole("button", { name: "Save" }).click();
    await expect(page.getByRole("alert")).toHaveText(/Saved/);

    await page.getByRole("button", { name: "Suspend now" }).click();
    await expect(page.getByText("Suspended").first()).toBeVisible();
    // Immediate revalidation: the very next public request renders fresh, and the business is gone.
    await expect.poll(async () => (await request.get(PUBLIC(slug))).status(), { timeout: 15_000 }).toBe(404);

    await expect(page.getByRole("heading", { name: "History" })).toBeVisible();
    await expect(page.getByText(/· status/).first()).toBeVisible();
  });

  test("an invalid experience is refused with the reason, and nothing is saved", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, ADMIN);
    await page.goto("/en/admin/businesses/new");
    await page.getByLabel("Web address (slug)").fill(`e2e-bad-${Date.now().toString(36)}`);
    await page.getByLabel("Place").fill(PLACE);
    await page.getByLabel("Name · English").fill("Bad");
    await page.getByLabel("Tagline · English").fill("x");
    await page.getByLabel("Street address · English").fill("x");
    await page.getByLabel("Latitude").fill("32.858");
    await page.getByLabel("Longitude").fill("35.181");
    await page.getByLabel("Experience content (JSON)").fill('{"items": []}');
    await page.getByRole("button", { name: "Create" }).click();
    await expect(page.getByRole("alert")).toContainText("experience");
    await expect(page).toHaveURL(/\/businesses\/new$/);
  });

  test("the Missing report warns that terms are private", async ({ page, context, baseURL }) => {
    await signInAs(context, baseURL!, ADMIN);
    await page.goto("/ar/admin/report");
    await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
    await expect(page.getByRole("note")).toContainText("عاملها كمعلومات خاصة");
  });
});
```
`apps/web/e2e/admin-a11y.spec.ts`:
```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { LOCALES } from "./fixtures";

const SCREENS = ["", "/places", "/sectors", "/kinds", "/businesses", "/businesses/new", "/places/new", "/kinds/new", "/report", "/sign-in"];
const prefix = (l: string) => (l === "he" ? "" : `/${l}`);

for (const locale of LOCALES) {
  for (const screen of SCREENS) {
    test(`${locale} admin${screen || "/"} has no WCAG A/AA violations`, async ({ page, context, baseURL }) => {
      await context.addCookies([{ name: "darb_admin_fake", value: "fake.user_e2e.e2e-admin@darb.test", url: baseURL! }]);
      await page.goto(`${prefix(locale)}/admin${screen}`);
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
}
```
Append the two editors, reached through their lists:
```ts
for (const [list, name] of [["/admin/places?q=sakhnin", "place editor"], ["/admin/businesses?q=samer", "business editor"]] as const) {
  test(`en ${name} has no WCAG A/AA violations`, async ({ page, context, baseURL }) => {
    await context.addCookies([{ name: "darb_admin_fake", value: "fake.user_e2e.e2e-admin@darb.test", url: baseURL! }]);
    await page.goto(`/en${list}`);
    await page.locator("table tbody tr a").first().click();
    await page.waitForLoadState("networkidle");
    const { violations } = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"]).analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  });
}
```

- [ ] **Step 4: No Clerk in public chunks**

In `apps/web/scripts/check-budget.mjs`, after the route budget loop and for each route in `ROUTES` with its first-load file set (the variable the loop already uses for the sum), add a scan. If no such set exists, collect one from the route's manifest entries:
```js
// Clerk is for /admin only (spec §6.4): it must never ship to a public level route.
for (const file of files) {
  if (readFileSync(join(NEXT, file), "utf8").includes("@clerk/")) {
    console.error(`FAIL ${route}: ${file} contains Clerk code`);
    failed = true;
  }
}
```
Use the script's own failure flag and exit convention (read the end of the file).

- [ ] **Step 5: CI**

In `.github/workflows/ci.yml`, add these after `pnpm --filter @darb/api db:deploy && pnpm --filter @darb/api db:seed`. Nothing else changes, because the e2e step already runs every spec:
```yaml
      - name: The migrated database matches the Prisma schema (no drift)
        run: pnpm --filter @darb/api exec prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma --exit-code
```
Add `ADMIN_FAKE_AUTH: "1"` to the job `env` only if `playwright.config.ts` does not already pass it (Step 2 passes it). Leave it out otherwise.

- [ ] **Step 6: Run the whole suite**

Run: `pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test && pnpm --filter @darb/web budget && pnpm --filter @darb/web e2e`
Expected: all green. The e2e counts include the new admin specs, axe reports 0 violations on the admin screens, and the public budgets are unchanged.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src/app/admin apps/web/e2e apps/web/playwright.config.ts apps/web/scripts/check-budget.mjs .github/workflows/ci.yml
git commit -m "test(web): admin end to end (auth, CRUD, audit, takedown revalidation), axe on admin, no Clerk in public chunks"
```

---

## Part F: Real clients, deploy and launch

### Task 28: Real clients: Caramel, Raghad and Paz (OWNER input)

> **OWNER CHECKPOINT. Do not start Step 3 until the owner has answered every question in Step 1.** Never invent a town, address, phone number, set of hours or coordinates for a real business.

**Files:**
- Create: `packages/seed/data/clients.json` (owner data)
- Modify: `packages/seed/src/types.ts` (optional contact and app fields), `packages/seed/src/index.ts` (`loadClients()`, merged by `loadBusinesses()` and `loadBrands()`)
- Test: `packages/seed/src/clients.test.ts`
- Modify: `apps/api/src/seed/load.ts` (writes `phone`, `whatsapp`, `website` and `apps`)
- Test: `apps/api/src/seed/load.test.ts` (append)
- Create: `apps/web/e2e/clients.spec.ts`

**Interfaces:**
- Produces:
  - `SeedBusiness` gains `phone?: string | null`, `whatsapp?: string | null`, `website?: string | null` and `apps?: { web?: string; ios?: string; android?: string }`.
  - `loadClients(): { brands: SeedBrand[]; businesses: SeedBusiness[] }`. It reads `clients.json`, where each business carries its own `experience`.
  - `loadBusinesses()` returns showroom plus clients, and `loadBrands()` returns showroom plus client brands.
  - Clients are seed rows with `tier: "darb"`. After the owner edits one in `/admin`, the seed stops touching it (Task 3).

- [ ] **Step 1: Ask the owner (OWNER input)**

Send this list to the owner and wait for written answers. Never guess.

**For each of Caramel (restaurant), Raghad (shop) and every Paz station:**
1. The display name in Hebrew, Arabic and English (exact spelling, as on the sign).
2. The town, from Darb's places. Give the town name and the worker finds its slug in `packages/seed/data/places.json`. It must be a **live** place in the North or Haifa districts. If it is not live, say whether to make it live.
3. The street address in Hebrew, Arabic and English.
4. The map pin: a Google Maps link or latitude and longitude.
5. The phone, and the WhatsApp number if it is different, in international form (`+972 …`).
6. Opening hours for each day, Sunday to Saturday, including Friday and Saturday, any split shifts and any overnight hours. Also the known closures (holidays, Ramadan hours) for the next six months.
7. Which Darb kind fits best. Caramel: restaurants, cafes or desserts? Raghad: which shop kind (for example clothing, cosmetics or gifts)? Paz: `stations`. Also say whether it delivers.
8. A tagline in each language, of eight words or fewer.
9. The app links: the web app (`https://caramel.darb.co.il`, `https://raghad.darb.co.il`, `https://paz.darb.co.il`), plus the App Store and Google Play URLs if they are published. If not, leave them out.
10. The experience screen. Give three to eight items with an optional short note each: menu highlights for Caramel, product lines for Raghad, station services for Paz (fuel, car wash, convenience store, air or water). Also give the button text, two brand colours (background and accent as hex), and the font (Heebo, Cairo or Ubuntu).

**For Paz only:**
11. Is the client the whole Paz brand or one franchise operator? List exactly which stations Darb should show (towns and addresses). Answer questions 2–6 for each station.

**For all three:**
12. Confirm that each client agreed to be listed on darb.co.il with these details and its name. No photos are used until the media module lands.

- [ ] **Step 2: Record the answers**

Paste the owner's answers, unedited, into the task's PR description, so the reviewer can check `clients.json` against them. Do not commit them as a separate file.

- [ ] **Step 3: Write the failing tests**

`packages/seed/src/clients.test.ts`:
```ts
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { isOpenAt } from "@darb/core";
import { loadBusinesses, loadClients, loadKinds, loadPlaces, SCREEN_SCHEMA } from "./index.js";

const clients = loadClients();
const places = new Map(loadPlaces().map((p) => [p.slug, p]));
const kinds = new Map(loadKinds().map((k) => [k.slug, k]));
const screen = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);
const km = (a: { lat: number; lng: number }, b: { lat: number; lng: number }) => {
  const r = Math.PI / 180;
  const x = (b.lng - a.lng) * r * Math.cos(((a.lat + b.lat) / 2) * r);
  return Math.hypot(x, (b.lat - a.lat) * r) * 6371;
};

describe("real clients", () => {
  it("has Caramel, Raghad and Paz on the darb tier, linking to their Darb apps", () => {
    const webs = clients.businesses.map((b) => b.apps?.web);
    for (const name of ["caramel", "raghad", "paz"]) expect(webs).toContain(`https://${name}.darb.co.il`);
    expect(clients.businesses.every((b) => b.tier === "darb")).toBe(true);
  });

  it.each(clients.businesses.map((b) => [`${b.place}/${b.slug}`, b] as const))("%s is complete and consistent", (_, b) => {
    const place = places.get(b.place);
    expect(place?.status).toBe("live");
    expect(kinds.get(b.primaryKind)?.status).toBe("active");
    expect(km(place!, b)).toBeLessThan(15); // the pin sits in or near its town
    expect(screen(b.experience)).toBe(true);
    expect(b.phone ?? "").toMatch(/^\+972[0-9 -]{7,15}$/);
    expect(["he", "ar", "en"].every((l) => (b.name as Record<string, string>)[l])).toBe(true);
    expect(() => isOpenAt(b.hours, new Date())).not.toThrow();
  });

  it("is merged into the seed and never collides with a showroom slug", () => {
    const all = loadBusinesses();
    const keys = all.map((b) => `${b.place}/${b.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
    for (const c of clients.businesses) expect(keys).toContain(`${c.place}/${c.slug}`);
  });
});
```
Append to `apps/api/src/seed/load.test.ts`:
```ts
it("writes a client's contact details and app links", async () => {
  const client = {
    ...data.businesses[0]!,
    slug: "client",
    tier: "darb" as const,
    phone: "+972 4-000-0000",
    whatsapp: null,
    website: "https://client.darb.co.il",
    apps: { web: "https://client.darb.co.il" },
  };
  await loadSeed(prisma, { ...data, businesses: [...data.businesses, client] });
  const row = await prisma.business.findFirstOrThrow({ where: { slug: "client" } });
  expect([row.phone, row.website, row.apps, row.tier]).toEqual([
    "+972 4-000-0000",
    "https://client.darb.co.il",
    { web: "https://client.darb.co.il" },
    "darb",
  ]);
});
```

- [ ] **Step 4: Run the tests to verify they fail**

Run: `pnpm --filter @darb/seed exec vitest run src/clients.test.ts && pnpm --filter @darb/api exec vitest run src/seed/load.test.ts`
Expected: FAIL. `loadClients` is not exported, and phone is not written.

- [ ] **Step 5: Implement**

In `packages/seed/src/types.ts`, add these to `SeedBusiness`:
```ts
  /** Real clients only (clients.json); showroom examples have none. */
  phone?: string | null;
  whatsapp?: string | null;
  website?: string | null;
  apps?: { web?: string; ios?: string; android?: string };
```
In `packages/seed/src/index.ts`:
```ts
/** Darb's real clients (spec §11): darb tier, own experience screens, owner-supplied details. */
export const loadClients = (): { brands: SeedBrand[]; businesses: SeedBusiness[] } =>
  read<{ brands: SeedBrand[]; businesses: SeedBusiness[] }>("clients.json");
```
Change `loadBrands` to `() => [...read<SeedBrand[]>("brands.json"), ...loadClients().brands]`. Change `loadBusinesses` to return `[...showroom, ...loadClients().businesses]`, where `showroom` is the current mapped array.
In `apps/api/src/seed/load.ts`, add these to the business `fields` object:
```ts
          phone: b.phone ?? null,
          whatsapp: b.whatsapp ?? null,
          website: b.website ?? null,
          apps: json(b.apps ?? {}),
```
Write `packages/seed/data/clients.json` from the owner's answers, in exactly this shape. The `"he"`, `"ar"` and `"en"` values, slugs, `place`, coordinates, phones, hours and experience all come from Step 1. Slugs are the lower-case Latin brand name; Paz stations use `paz-<town slug>`.
```json
{
  "brands": [
    { "slug": "caramel", "name": { "he": "…", "ar": "…", "en": "Caramel" } },
    { "slug": "raghad", "name": { "he": "…", "ar": "…", "en": "Raghad" } },
    { "slug": "paz", "name": { "he": "פז", "ar": "باز", "en": "Paz" } }
  ],
  "businesses": [
    {
      "slug": "caramel",
      "place": "<answer 2>",
      "brand": "caramel",
      "primaryKind": "<answer 7>",
      "kinds": ["<answer 7>"],
      "name": { "he": "<answer 1>", "ar": "<answer 1>", "en": "<answer 1>" },
      "tagline": { "he": "<answer 8>", "ar": "<answer 8>", "en": "<answer 8>" },
      "address": { "he": "<answer 3>", "ar": "<answer 3>", "en": "<answer 3>" },
      "lat": 0,
      "lng": 0,
      "hours": { "weekly": { "0": [{ "open": "HH:MM", "close": "HH:MM" }] }, "exceptions": [] },
      "attributes": { "delivers": false },
      "experience": {
        "brand": { "he": "…", "ar": "…", "en": "…" },
        "title": { "he": "…", "ar": "…", "en": "…" },
        "items": [{ "label": { "he": "…", "ar": "…", "en": "…" } }],
        "cta": { "he": "…", "ar": "…", "en": "…" },
        "palette": { "bg": "#xxxxxx", "surface": "#xxxxxx", "ink": "#xxxxxx", "accent": "#xxxxxx" },
        "font": "Heebo"
      },
      "tier": "darb",
      "phone": "<answer 5>",
      "whatsapp": null,
      "website": "https://caramel.darb.co.il",
      "apps": { "web": "https://caramel.darb.co.il" }
    }
  ]
}
```
This block shows the **shape** only. Every `<answer n>`, `…`, `0`, `HH:MM` and `#xxxxxx` is replaced by the owner's answer before commit, and the Step 3 tests fail on any leftover. Pick `surface` and `ink` so ink on surface meets WCAG AA (≥ 4.5:1). Check with `apps/web/src/lib/contrast.ts`. Add `"ios"` and `"android"` to `apps` only when Step 1 gives published URLs.

- [ ] **Step 6: An e2e test for the Open app action**

`apps/web/e2e/clients.spec.ts`:
```ts
import { expect, test } from "@playwright/test";
import clients from "../../../packages/seed/data/clients.json" with { type: "json" };
import kinds from "../../../packages/seed/data/kinds.json" with { type: "json" };

for (const b of clients.businesses) {
  test(`${b.slug} opens its Darb app`, async ({ page }) => {
    const sector = kinds.find((k) => k.slug === b.primaryKind)!.sector;
    await page.goto(`/en/${b.place}/${sector}/${b.primaryKind}/${b.slug}`);
    await expect(page.locator(`a[href="${b.apps.web}"]`).first()).toBeVisible();
    await expect(page.locator("[data-example-badge]")).toHaveCount(0);
  });
}
```
(If the e2e TypeScript config rejects JSON import attributes, use `JSON.parse(readFileSync(new URL("../../../packages/seed/data/clients.json", import.meta.url), "utf8"))`.)

- [ ] **Step 7: Run the tests**

Run: `pnpm --filter @darb/seed exec vitest run && pnpm --filter @darb/api exec vitest run src/seed && pnpm --filter @darb/api db:seed && pnpm --filter @darb/web build && pnpm --filter @darb/web exec playwright test e2e/clients.spec.ts e2e/a11y.spec.ts`
Expected: PASS. The seed counts grow by the number of client businesses.

- [ ] **Step 8: Commit**

```bash
git add packages/seed apps/api/src/seed apps/web/e2e/clients.spec.ts
git commit -m "feat(seed): Caramel, Raghad and Paz as darb-tier clients linking to their Darb apps"
```

---

### Task 29: Deploy as code: Dockerfile, Vercel config, workflows and env lists

**Files:**
- Create: `apps/api/Dockerfile`, `.dockerignore`
- Modify: `apps/api/prisma.config.ts` (`MIGRATE_DATABASE_URL`)
- Create: `apps/api/src/admin/revalidate-all.ts`; modify `apps/api/package.json` (`web:revalidate`)
- Create: `apps/web/vercel.json`
- Create: `apps/web/scripts/warm.mjs`; test `apps/web/src/lib/warm.test.ts`
- Modify: `apps/web/playwright.config.ts` (Vercel protection bypass header for preview runs)
- Create: `.github/workflows/reindex.yml`, `.github/workflows/warm.yml`
- Create: `docs/launch/hosting.md`, `docs/launch/environments.md`
- Modify: `README.md` (a Deploy section that links the docs)

**Interfaces:**
- Produces:
  - An API image that runs `node apps/api/dist/main.js` on `$PORT`. Railway's pre-deploy command runs `pnpm --filter @darb/api exec prisma migrate deploy` once per release, with `MIGRATE_DATABASE_URL` (Neon direct) preferred over `DATABASE_URL` (pooled).
  - `pnpm --filter @darb/api web:revalidate` posts `["taxonomy", "places", "businesses"]` with `immediate: false`, for use after a production seed.
  - `apps/web/scripts/warm.mjs <site>` fetches every level 0–2 URL in the three sitemaps, four at a time. It exports `locs(xml)` and `shallow(url, site)` for tests.
  - The GitHub workflows:
    - `reindex.yml` (manual: `seed` and/or `reindex`, for staging or production, behind GitHub Environments);
    - `warm.yml` (on a successful Vercel production `deployment_status`, plus manual).

- [ ] **Step 1: Write the failing test**

`apps/web/src/lib/warm.test.ts`:
```ts
import { expect, it } from "vitest";
// @ts-expect-error: plain ESM script without types
import { locs, shallow } from "../../scripts/warm.mjs";

it("reads sitemap locations and keeps levels 0 to 2", () => {
  const xml = `<urlset><url><loc>https://darb.co.il/</loc></url><url><loc>https://darb.co.il/en/sakhnin/food</loc></url><url><loc>https://darb.co.il/en/sakhnin/food/restaurants/caramel</loc></url></urlset>`;
  const all = locs(xml);
  expect(all).toHaveLength(3);
  expect(all.filter((u: string) => shallow(u, "https://darb.co.il"))).toEqual(["https://darb.co.il/", "https://darb.co.il/en/sakhnin/food"]);
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `pnpm --filter @darb/web exec vitest run src/lib/warm.test.ts`
Expected: FAIL. The script is missing.

- [ ] **Step 3: Warm-up script**

`apps/web/scripts/warm.mjs`:
```js
// After a production deploy: render every level 0–2 page once, so a later API outage finds them
// cached (hosting decision, Plan 4). Usage: node apps/web/scripts/warm.mjs https://darb.co.il
export const locs = (xml) => [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

/** Home, place and place/sector pages in any locale (and /k/<kind>), not businesses or kind lists. */
export function shallow(url, site) {
  const parts = new URL(url).pathname.split("/").filter(Boolean);
  if (parts[0] === "ar" || parts[0] === "en") parts.shift();
  return url.startsWith(site) && (parts.length <= 2);
}

async function main(site) {
  const urls = [];
  for (const i of [0, 1, 2]) {
    const res = await fetch(`${site}/sitemap/${i}.xml`);
    if (!res.ok) throw new Error(`sitemap ${i}: ${res.status}`);
    urls.push(...locs(await res.text()).filter((u) => shallow(u, site)));
  }
  let done = 0;
  let failed = 0;
  const queue = [...urls];
  await Promise.all(
    Array.from({ length: 4 }, async () => {
      for (let url = queue.shift(); url; url = queue.shift()) {
        const res = await fetch(url).catch(() => null);
        if (!res?.ok) failed += 1;
        done += 1;
      }
    }),
  );
  console.log(`Warmed ${done - failed}/${done} pages`);
  if (failed > done * 0.05) process.exit(1);
}

if (import.meta.url === `file://${process.argv[1]}`) await main(process.argv[2]?.replace(/\/+$/, "") ?? "");
```

- [ ] **Step 4: API image, migrations and revalidate-all**

`.dockerignore`:
```
**/node_modules
**/.next
**/dist
**/.turbo
apps/web/.tiles
apps/web/test-results
apps/web/playwright-report
apps/web/.screens
**/.env
**/.env.*
!**/.env.example
.git
```
`apps/api/Dockerfile`. Pin the base image digest when you write the file: run `docker buildx imagetools inspect node:22.23.3-bookworm-slim --format '{{json .Manifest.Digest}}'` and put the printed `sha256:…` after the `@` in both `FROM` lines. Node 22.23.3 was released 2026-09-23.
```dockerfile
# Darb API (Railway). Build from the repo root: docker build -f apps/api/Dockerfile .
FROM node:22.23.3-bookworm-slim@sha256:REPLACE_WITH_PRINTED_DIGEST AS build
WORKDIR /app
RUN corepack enable
COPY . .
RUN pnpm install --frozen-lockfile
RUN pnpm exec turbo run build --filter=@darb/api

FROM node:22.23.3-bookworm-slim@sha256:REPLACE_WITH_PRINTED_DIGEST
WORKDIR /app
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends ca-certificates && rm -rf /var/lib/apt/lists/*
ENV NODE_ENV=production
COPY --from=build /app /app
USER node
EXPOSE 4000
CMD ["node", "apps/api/dist/main.js"]
```
`REPLACE_WITH_PRINTED_DIGEST` is an instruction for this step, not a value to commit. The build in Step 7 fails until the real digest is in place. The image keeps dev dependencies on purpose: the pre-deploy command needs the `prisma` CLI, and `db:seed` and `search:reindex` run through `tsx`.

In `apps/api/prisma.config.ts`, change the datasource to:
```ts
  // Neon: migrations need the direct (non-pooled) URL; the app uses the pooled one.
  datasource: { url: process.env["MIGRATE_DATABASE_URL"] ?? process.env["DATABASE_URL"] },
```
`apps/api/src/admin/revalidate-all.ts`:
```ts
import "dotenv/config";
import { loadConfig } from "../config.js";
import { WebRevalidator } from "./revalidator.js";

// After a production seed or data fix: refresh every cached page (these three tags cover them all).
const ok = await new WebRevalidator(loadConfig(process.env)).revalidate(["taxonomy", "places", "businesses"]);
console.log(ok ? "Web revalidated" : "Web revalidation failed (check REVALIDATE_URL and REVALIDATE_SECRET)");
process.exit(ok ? 0 : 1);
```
In `apps/api/package.json` scripts, add `"web:revalidate": "tsx src/admin/revalidate-all.ts"`.

- [ ] **Step 5: Vercel config and preview e2e access**

`apps/web/vercel.json`:
```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "framework": "nextjs",
  "installCommand": "pnpm install --frozen-lockfile",
  "buildCommand": "pnpm exec turbo run build --filter=@darb/web",
  "regions": ["fra1"],
  "github": { "autoJobCancelation": true }
}
```
In `apps/web/playwright.config.ts`, change `use` to:
```ts
  use: {
    baseURL: WEB,
    trace: "retain-on-failure",
    // Vercel previews are protected; the owner's bypass secret lets e2e reach them (never in CI logs).
    ...(process.env.VERCEL_AUTOMATION_BYPASS_SECRET
      ? { extraHTTPHeaders: { "x-vercel-protection-bypass": process.env.VERCEL_AUTOMATION_BYPASS_SECRET } }
      : {}),
  },
```

- [ ] **Step 6: Workflows**

`.github/workflows/reindex.yml`:
```yaml
name: Seed and reindex

on:
  workflow_dispatch:
    inputs:
      environment:
        description: staging or production
        required: true
        type: choice
        options: [staging, production]
      seed:
        description: Load packages/seed data first (never overwrites admin edits)
        type: boolean
        default: false

permissions:
  contents: read

concurrency:
  group: reindex-${{ inputs.environment }}
  cancel-in-progress: false

jobs:
  run:
    runs-on: ubuntu-24.04
    timeout-minutes: 60
    # The GitHub Environment holds the secrets and requires the owner's approval for production.
    environment: ${{ inputs.environment }}
    env:
      DATABASE_URL: ${{ secrets.DATABASE_URL }}
      MIGRATE_DATABASE_URL: ${{ secrets.MIGRATE_DATABASE_URL }}
      VOYAGE_API_KEY: ${{ secrets.VOYAGE_API_KEY }}
      EMBEDDING_PROVIDER: voyage
      INTENT_PROVIDER: "off"
      REVALIDATE_URL: ${{ vars.REVALIDATE_URL }}
      REVALIDATE_SECRET: ${{ secrets.REVALIDATE_SECRET }}
      SEARCH_PROXY_KEY: ${{ secrets.SEARCH_PROXY_KEY }}
      IP_HASH_SALT: ${{ secrets.IP_HASH_SALT }}
    steps:
      - uses: actions/checkout@v7
      - uses: pnpm/action-setup@v6
      - uses: actions/setup-node@v7
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - run: pnpm exec turbo run build --filter=@darb/api^...
      - name: Seed (no embeddings)
        if: ${{ inputs.seed }}
        run: pnpm --filter @darb/api db:seed -- --no-index
      - name: Reindex (embeds only changed rows)
        run: pnpm --filter @darb/api search:reindex
      - name: Refresh cached web pages
        run: pnpm --filter @darb/api web:revalidate
```
`.github/workflows/warm.yml`:
```yaml
name: Warm production pages

on:
  deployment_status:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  warm:
    if: >-
      github.event_name == 'workflow_dispatch' ||
      (github.event.deployment_status.state == 'success' && github.event.deployment.environment == 'Production')
    runs-on: ubuntu-24.04
    timeout-minutes: 20
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22
      - run: node apps/web/scripts/warm.mjs https://darb.co.il
```
CI on PRs stays as it is (`ci.yml`). Vercel's Git integration builds a preview per PR and production on `main`. Railway deploys the API from `main` with **Wait for CI** on (Task 30). Branch protection on `main` (Task 30) means a merge only lands after CI is green.

- [ ] **Step 7: Hosting and environment docs**

`docs/launch/hosting.md`: copy this plan's **Hosting decision** section verbatim (the table, the recommendation and the regions), then add:
```markdown
## Release flow

1. PR: GitHub CI (typecheck, lint, unit, API integration, search quality, budgets, e2e and axe). Vercel builds a protected preview that talks to the **staging** API.
2. Merge to `main`, after CI is green (branch protection):
   - Railway production and staging run `pnpm --filter @darb/api exec prisma migrate deploy` once (pre-deploy), then start the new API. A failed migration keeps the old API running.
   - Vercel builds production. `warm.yml` renders every level 0–2 page once the deployment succeeds.
3. Data: `Seed and reindex` (Actions → Run workflow) seeds and/or reindexes staging or production. Production needs the owner's approval in the GitHub Environment.
4. Migrations are expand/contract: add columns and endpoints first, deploy, then remove old ones in a later release. A preview web never needs an unreleased API change.

## Fallback (b): web self-hosted on Railway

Use this only if Vercel's cost or limits become a problem.
1. Add a `web` service to the Railway project. Use the same image recipe as `apps/api/Dockerfile`, but build with `pnpm exec turbo run build --filter=@darb/web` and start with `pnpm --filter @darb/web start -- --port $PORT`.
2. Run **one** replica only. `cache-handler.mjs` keeps the ISR cache on that instance's disk, and the handler is a private Next internal pinned to 16.3.6.
3. Set `SITE_INDEXABLE=1`, `SITE_URL=https://darb.co.il`, `API_URL` (Railway private URL), `MAP_TILES_DIR` (not needed with R2), `NEXT_PUBLIC_MAP_TILES_URL`, and every other web variable from `environments.md`.
4. DNS: point darb.co.il at the Railway domain (CNAME). Rollback is the reverse DNS change, and waits on the record's TTL.
5. Visitor IP: Railway's edge sets `X-Real-IP`. Confirm it overwrites `X-Forwarded-For`, or the suggest and search limits can be dodged (README, "Visitor IP and the proxy key").
```
`docs/launch/environments.md`:
```markdown
# Environment variables

Values never live in the repo. "secret" means a random value of at least 32 characters, made with `openssl rand -base64 48`.

## API (Railway service `api`)

| Variable | Production | Staging | Notes |
|---|---|---|---|
| `NODE_ENV` | production | production | |
| `DATABASE_URL` | Neon `main` pooled URL | Neon `staging` pooled URL | |
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
| `CLERK_SECRET_KEY` | Clerk production `sk_live_…` | Clerk development `sk_test_…` | |
| `CLERK_JWT_KEY` | Clerk production PEM | Clerk development PEM | networkless verification |
| `CLERK_AUTHORIZED_PARTIES` | https://darb.co.il,https://www.darb.co.il | unset (previews vary) | |
| `ADMIN_EMAILS` | founder@darb.co.il | founder@darb.co.il | first sign-in only |
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
```
In `README.md`, add a `## Deploy` section after `## Map`: "Hosting, release flow and fallback: `docs/launch/hosting.md`. Variables per environment: `docs/launch/environments.md`. Launch and rollback: `docs/launch/runbook.md`."

- [ ] **Step 8: Verify locally**

Run: `pnpm --filter @darb/web exec vitest run src/lib/warm.test.ts && docker build -f apps/api/Dockerfile -t darb-api:local . && docker run --rm -e DATABASE_URL=postgresql://darb:darb@host.docker.internal:5433/darb -e REDIS_URL=redis://host.docker.internal:6380 -p 4400:4000 -d --name darb-api-local darb-api:local && sleep 5 && curl -fsS localhost:4400/health; docker rm -f darb-api-local`
Expected: the test PASSES, the image builds, and `/health` answers 200. The final `docker rm` is cleanup of the local container only.

- [ ] **Step 9: Commit**

```bash
git add .dockerignore apps/api/Dockerfile apps/api/prisma.config.ts apps/api/src/admin/revalidate-all.ts apps/api/package.json apps/web/vercel.json apps/web/scripts/warm.mjs apps/web/src/lib/warm.test.ts apps/web/playwright.config.ts .github/workflows/reindex.yml .github/workflows/warm.yml docs/launch README.md
git commit -m "build: API image, migrate-once pre-deploy, Vercel config, seed/reindex and warm-up workflows, env lists"
```

---

### Task 30: Cloud setup (OWNER cloud actions)

> **OWNER TASK. A worker never performs these steps.** The worker prepares this checklist as `docs/launch/cloud-setup.md` (Step 1), commits it, and stops. The owner performs each step and ticks it off. No secret is ever pasted into the repo, a PR or a chat log. Values go straight into the provider dashboards and GitHub Environments.

**Files:**
- Create: `docs/launch/cloud-setup.md` (the checklist below, verbatim)

- [ ] **Step 1: Write the checklist file, commit and stop**

Write `docs/launch/cloud-setup.md` with this content:
```markdown
# Cloud setup (owner only)

Tick each box. Store every secret only in the provider and in GitHub Environments.

## 1. Neon (database, EU)
- [ ] console.neon.tech → New project `darb-city`, Postgres 17, region **AWS Europe Central 1 (Frankfurt)**.
- [ ] Branches: keep `main` (production) and create `staging` from `main`.
- [ ] For each branch, copy the **pooled** connection string (`DATABASE_URL`) and the **direct** one (`MIGRATE_DATABASE_URL`).
- [ ] SQL editor on `main`: `CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS vector; CREATE EXTENSION IF NOT EXISTS pg_trgm;` (the migrations also create them; this confirms Neon allows them). Repeat on `staging`.

## 2. Railway (API + Redis, EU)
- [ ] railway.com → New project `darb-city`, region **EU West (Amsterdam)**. Create environments `production` and `staging`.
- [ ] In each environment: **+ New → Database → Redis**.
- [ ] **+ New → GitHub repo** `b14ckPanther/Darb-City`. Service name `api`. Settings → Build: Dockerfile path `apps/api/Dockerfile`, root `/`. Watch paths: `apps/api/**`, `packages/**`, `pnpm-lock.yaml`.
- [ ] Settings → Deploy: **Pre-deploy command** `pnpm --filter @darb/api exec prisma migrate deploy`; healthcheck path `/health`; restart policy On failure; replicas 1.
- [ ] Settings → Source: branch `main`, **Wait for CI** on, for both environments.
- [ ] Variables: every API row of `docs/launch/environments.md` for that environment.
- [ ] Networking → custom domain `api.darb.co.il` (production) and `api-staging.darb.co.il` (staging). Add the CNAMEs Railway shows at your DNS host.
- [ ] After the first deploy: `railway run --service api --environment production pnpm --filter @darb/api admin:grant <your Clerk user id>` (optional when `ADMIN_EMAILS` already covers you).

## 3. Cloudflare R2 (map tiles)
- [ ] Is darb.co.il's DNS on Cloudflare? If yes, use `tiles.darb.co.il`. If not, tell the developer; staging can use the bucket's r2.dev URL, but production needs a custom domain on a Cloudflare zone.
- [ ] `npx wrangler@4.143.0 login`
- [ ] `npx wrangler@4.143.0 r2 bucket create darb-tiles --location eeur`
- [ ] `npx wrangler@4.143.0 r2 bucket cors set darb-tiles --file infra/r2/tiles-cors.json`
- [ ] `pnpm --filter @darb/web tiles:israel` (it prints the build date, for example `20261001`)
- [ ] `npx wrangler@4.143.0 r2 object put darb-tiles/israel-<build>.pmtiles --file apps/web/.tiles/israel.pmtiles --remote --content-type application/octet-stream --cache-control "public, max-age=31536000, immutable"`
- [ ] Dashboard → R2 → darb-tiles → Settings → Custom domain `tiles.darb.co.il`.
- [ ] Check: `curl -sI -H "Range: bytes=0-15" -H "Origin: https://darb.co.il" https://tiles.darb.co.il/israel-<build>.pmtiles` shows `206`, `content-range`, `access-control-allow-origin: *` and `access-control-expose-headers` with `ETag`.

## 4. Clerk (admin sign-in only)
- [ ] dashboard.clerk.com → Create application **Darb admin**, with Email only (no social).
- [ ] Configure → Restrictions: **Sign-up mode Restricted**; Allowlist `founder@darb.co.il`.
- [ ] Sessions → Customize session token → Claims: `{"email": "{{user.primary_email_address}}", "email_verified": "{{user.email_verified}}"}`. If Clerk rejects `email_verified`, keep only `email` and grant yourself with `admin:grant`. The API then never auto-grants, which is the safe side.
- [ ] Development instance: copy `pk_test_…`, `sk_test_…` and the JWT public key (API keys → Show JWT public key) into staging and preview.
- [ ] Production instance: domain `darb.co.il`. Add the DNS records Clerk lists (for example `clerk.darb.co.il`). Copy `pk_live_…`, `sk_live_…` and the PEM into production.

## 5. Vercel (web)
- [ ] vercel.com → Add New → Project → import `b14ckPanther/Darb-City`. Root directory `apps/web`, framework Next.js, Node 22. The project is named `darb-city` (the old site's project stays untouched).
- [ ] Settings → Functions region `fra1` (also in `vercel.json`).
- [ ] Settings → Environment Variables: every web row of `environments.md`, for Production and Preview separately.
- [ ] Settings → Deployment Protection: keep Vercel Authentication on previews. Create a **Protection Bypass for Automation** secret, for preview e2e runs only.
- [ ] Do **not** add darb.co.il yet (Task 31).

## 6. GitHub
- [ ] Settings → Environments: create `staging` and `production` with the secrets and variables in `environments.md`. On `production`, set the required reviewer to yourself.
- [ ] Settings → Branches → protect `main`: require a PR, require the `CI` check, and no force pushes.

## 7. Model keys (after Tasks 5–11 are merged)
- [ ] Anthropic console → API key for `darb-api-production` → Railway production `ANTHROPIC_API_KEY`. Set a monthly spend limit of $20 in the console.
- [ ] Voyage AI → API key → Railway production `VOYAGE_API_KEY` and the GitHub `production` secret.
- [ ] Confirm the embedding size. Paste the key only in your terminal:
      `curl -s https://api.voyageai.com/v1/embeddings -H "Authorization: Bearer $VOYAGE_API_KEY" -H "content-type: application/json" -d '{"input":["test"],"model":"voyage-4-lite","output_dimension":512}' | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>console.log(JSON.parse(s).data[0].embedding.length))'` must print `512`.
- [ ] Actions → **Seed and reindex** → `staging` with seed on, then `production` with seed on.
```
Commit:
```bash
git add docs/launch/cloud-setup.md
git commit -m "docs: owner cloud setup checklist (Neon, Railway, R2, Clerk, Vercel, GitHub, model keys)"
```
Then report **OWNER CHECKPOINT: cloud setup** and stop.

---

### Task 31: Preview verification and darb.co.il cut-over runbook (OWNER cloud actions)

> **OWNER TASK for the cut-over itself.** The worker writes the runbook (Step 1) and may run the read-only preview checks (Step 2) when the owner provides the preview URL and bypass secret in their own shell. Moving domains, changing DNS and retiring admin.darb.co.il are owner actions only.

**Files:**
- Create: `docs/launch/runbook.md`

- [ ] **Step 1: Write the runbook**

`docs/launch/runbook.md` (the outer fence here is `~~~` because the file contains a code block):
~~~markdown
# Launch runbook: darb.co.il → Darb-City (spec §12)

## 0. Ready when
- [ ] Plan 4 is merged on `main`, CI is green, and Task 30 is complete.
- [ ] Production API: `curl -fsS https://api.darb.co.il/health` gives 200.
- [ ] Production data: Seed and reindex has run on production, and `/admin` shows the businesses (Caramel, Raghad and Paz present).
- [ ] The old site's Vercel project name is written down here: `__________`. Also note the project that serves admin.darb.co.il: `__________`.

## 1. Pass every §9 check on the preview URL (spec §12 step 1)
Take the Vercel production deployment URL for the `main` commit (`https://darb-city-<hash>.vercel.app`, Deployments → the newest Production), or the staging alias.
```bash
export WEB_URL=https://<deployment>.vercel.app
export API_URL=https://api.darb.co.il            # or api-staging for a preview
export VERCEL_AUTOMATION_BYPASS_SECRET=<from Vercel; never commit or paste in chat>
pnpm --filter @darb/web exec playwright test --grep-invert "admin"
```
- [ ] e2e, axe and LCP (perf.spec) all pass against the deployment. Admin specs run only in CI with fake auth.
- [ ] Manual checks (phone and desktop):
  - map tiles load (DevTools shows 206 from tiles.darb.co.il);
  - no CSP errors in the console;
  - a smart search in Arabic ("بدي حلاق بسخنين") shows chips;
  - near me works;
  - `/robots.txt` on the deployment URL says `Disallow: /`.
- [ ] `/admin` on the production deployment: you can sign in with Clerk, editing a test business's tagline shows in the public page within seconds, and you can revert it.
- [ ] Model guard: the Anthropic console shows calls. `redis-cli` on Railway, `KEYS darb:model:calls:*`, shows counts below the limits.

## 2. Cut-over (spec §12 step 2)
1. Vercel → **old** project → Settings → Domains: note every domain (darb.co.il, www.darb.co.il, admin.darb.co.il). Remove `darb.co.il` and `www.darb.co.il` **from the old project only**. Do not delete the project, and do not turn off its deployments.
2. Vercel → **darb-city** → Settings → Domains → Add `darb.co.il` (primary) and `www.darb.co.il` (redirect to darb.co.il). DNS already points at Vercel, so there is no TTL wait. If Vercel asks for a DNS change, apply exactly what it shows.
3. Within 5 minutes:
   - `curl -sI https://darb.co.il | grep -i x-vercel-id` (new deployment);
   - `curl -s https://darb.co.il/robots.txt` lists the sitemaps;
   - open `/`, `/sakhnin`, `/ar`, `/en/for-business`, and a Caramel page.
4. Actions → **Warm production pages** → Run.
5. Clerk production: sign in at https://darb.co.il/admin.

## 3. Rollback (at any point in the next 14 days)
- Vercel → darb-city → Domains: remove `darb.co.il` and `www.darb.co.il`. Then Vercel → old project → Domains: add them back. The old site serves again within a minute.
- The API, database and admin keep running, so nothing is lost. Fix forward on a PR, then repeat section 2.

## 4. Retire admin.darb.co.il (spec §12 step 3)
- [ ] Vercel → the project that serves admin.darb.co.il → Domains: remove it.
- [ ] Vercel → darb-city → Domains: add `admin.darb.co.il` with **Redirect to** `https://darb.co.il/admin` (308).
- [ ] `curl -sI https://admin.darb.co.il` shows 308 and `location: https://darb.co.il/admin`.

## 5. Day 14
- [ ] No rollback needed: archive the old project (Settings → Advanced → pause or delete, your choice) and note the date here: `__________`.
- [ ] Review the Missing report in `/admin` and decide which kinds or places to add.
~~~
Commit:
```bash
git add docs/launch/runbook.md
git commit -m "docs: launch runbook with preview checks, domain cut-over, rollback and admin.darb.co.il retirement"
```

- [ ] **Step 2: Report the OWNER CHECKPOINT**

Report **OWNER CHECKPOINT: launch**, with a link to `docs/launch/runbook.md`. A worker may run section 1's Playwright command only after the owner has exported the variables in their own shell. A worker never runs section 2, 3 or 4.

---

## Self-review (done while writing)

**Spec coverage:**
- §4.5 ownership: `User.isAdmin` is the authority (Task 12). Organization, Claim and Membership flows stay in sub-project 3 (§13).
- §6.2: the admin module and audited CRUD (Tasks 14–17); domain events to reindex and revalidate (Tasks 8 and 14).
- §6.3 `/admin` (Tasks 23–27), §6.4 hosting (decision section and Tasks 29–30), §7 API down (Task 18 plus the warm-up), §9 budgets, axe and CI (Tasks 21 and 27), §11 real clients (Task 28), §12 launch (Task 31).
- Every follow-up must-do maps to a task:
  - open-now: Task 19;
  - R2, CORS and the tiles guard: Tasks 21 and 30;
  - CSP: Tasks 21 and 23;
  - Vercel vs self-host: the decision section;
  - robots, sitemap, noindex and the global 404: Task 22;
  - `timingSafeEqual`, `server-only` and `siteUrl`: Task 18;
  - immediate revalidation and admin notify: Tasks 14, 17 and 18;
  - the Plan 3 blockers: Tasks 4–11;
  - near-me coordinates: Task 20;
  - log retention: Task 10;
  - suggest limits: Tasks 5 and 20;
  - the report sensitivity note: Tasks 17 and 27.
- Showroom leftovers: Saturday and civic content are done (Plan 2A). No Arabic gaps remain (0 of 10,604 names lack Arabic). `rose-valley-cabins` is still a thin rename, which is a content minor left for the owner. Photos (Media module) are deferred under decision 6.

**Placeholder scan:** The only fill-ins are owner data in Task 28 (the shape is shown, and the tests reject leftovers), the Docker digest in Task 29 (resolved by a given command in the same step), and the blanks the owner writes in the runbook. No TBDs remain in code steps.

**Type consistency:**
- `SearchEvents.notify(entity, ids)` is defined in Task 8 and used in Task 14.
- `WebRevalidator.revalidate(tags, { immediate })` is defined in Task 14 and used in Tasks 14 and 29.
- `AdminActor` and `AdminRequest` (Task 12) are used in Tasks 15–17.
- `webTags.*` (Task 14) is used in Tasks 15–17.
- `World.kindsVersion` and `World.index` (Task 7) are used in Tasks 7 and 11.
- `adminApi` and `okOr` (Task 23) are used in Tasks 24–27.
- `ActionState` and `idle` (Task 25) are used in Tasks 25 and 26.
- `TILES_URL: string | null` (Task 21) is used in the layout and `city-map`.
- `BusinessSummaryDto.hours` (Task 19) is used by the rows and `LiveOpenState`.

**Review Focus:** Five lines, each pinned by a named test in its owning task (Tasks 3, 17 and 27, 12, 8 and 14, and 21).

---

## Controller rulings (2026-10-13, owner approved)

These override the task text above wherever they differ.

1. **Hosting approved:** web on Vercel; API and Redis on Railway (EU); Postgres on Neon (EU). Self-hosting the web on Railway stays the documented fallback.
2. **CSP approved:** public pages allow `'unsafe-inline'` scripts (a nonce would disable ISR); `/admin` uses a nonce.
3. **Example businesses are noindex;** only real businesses are indexed. A new `source=admin` value is approved. Place and business slugs are read-only in admin. Photos are deferred.
4. **Tasks 1–27 run now.** Tasks 28 (real clients), 30 (cloud setup) and 31 (preview checks and cut-over) wait for owner input and owner confirmation. No worker creates cloud resources, touches DNS or deploys.
5. **Owner rules:** never brand the app as halal; no AI attribution; exact catalog versions at least 14 days old, with no release-age exclusions; contact founder@darb.co.il, Instagram @darbco.
