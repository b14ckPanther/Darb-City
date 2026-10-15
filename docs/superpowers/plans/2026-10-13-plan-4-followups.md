# Plan 4 follow-ups

Carried from the Plan 4 execution ledger (2026-10-14). Every item below was parked in a per-task or final review, and was checked against the code at `81e08e1` and found still open. Items fixed by a later commit are not listed. Size: S under 1 h, M a few hours, L a day or more.

## Owner verification at launch

Checked at launch on 2026-10-15 and removed: the Dockerfile digest pin, the Vercel environment name `Production` (the warm workflow ran on it), the production `email_verified` claim (admin sign-in works), the post-deploy reindex, and the local dev database migration.

- GitHub action major-tag pins: `actions/checkout@v7`, `actions/setup-node@v7` and `pnpm/action-setup@v6` in the workflows are major tags copied from `ci.yml`, not SHA pins. Decide whether to pin to SHAs.
- Local production builds: set `NEXT_PUBLIC_LOCAL_TILES=1` in `apps/web/.env.local`. Without it a local `next build` has no map stage. Production needs `NEXT_PUBLIC_MAP_TILES_URL` (R2) at build time.
- Local e2e: every local `playwright` command, including `--list`, now needs `E2E_DATABASE_URL` pointing at a database whose name ends `_e2e` or `_test` (CI exempt). Set `E2E_REUSE_API=1` only to reuse a running API on purpose.

## API

- Non-canonical IPv4-mapped forms (`0:0:0:0:0:ffff:1.2.3.4`, `::ffff:0102:0304`, `::1.2.3.4`) share one IPv6 bucket: `apps/api/src/search/ip-bucket.ts:27`. Unwrap the mapped form in `hextets`, add test cases. S
- `host:port` forms are not normalised (`[2001:db8::1]:443`, `1.2.3.4:80`) so the port gets its own bucket: `ip-bucket.ts:25`. Strip `^\[(.*)\](:\d+)?$` and a dotted-quad `:\d+$`. S
- Seed loader reads edited-row snapshots outside the write transactions, so an admin edit between snapshot and upsert can be overwritten: `apps/api/src/seed/load.ts:49,94,100,178`. Use `updateMany({ where: { <key>, editedAt: null } })` inside the transaction, create only if absent. M
- A failure after the 3 s "late" warning is swallowed in `notify`: `apps/api/src/search/index-queue.ts:92-100`. Attach `.catch` (log, return "failed") to `this.changed()` before racing it. S
- Voyage retry leaves the response body unread, and the default `sleep` ignores `signal`: `apps/api/src/ai/voyage-embedding.provider.ts:35-38,16`. `await res.body?.cancel()` before retry; make sleep abortable. S
- `recordCases` defaults `activeKinds` to `[]`: `apps/api/src/ai/record-cases.ts:18`. Make the parameter required. S
- Retention delete is one unbatched statement: `apps/api/src/search/retention.ts:38-41`. Loop `DELETE ... LIMIT 5000` until done. S
- Up to three Redis round trips before the model on a cache miss: `apps/api/src/search/intent.service.ts:91,106,107`. Fetch both cache keys with one `MGET`. S
- Refusals and `max_tokens` map to `null` and re-spend budget on every repeat: `apps/api/src/ai/anthropic-intent.provider.ts:47`. Return a "model answered" flag so deterministic non-answers can be negative-cached. S
- Admin business list paginates by offset over `updatedAt desc`, so edits while paging skip or repeat rows: `apps/api/src/admin/businesses.admin.ts:85,110`. Keyset cursor on `(updatedAt, id)`. M
- Kinds and sectors admin lists are unbounded: `apps/api/src/admin/kinds.admin.ts`, `sectors.admin.ts`. Add a hard `take: 1000` cap. S
- Admin guard creates a `User` row for every valid Clerk session: `apps/api/src/auth/admin.guard.ts:60`. If sign-ups are ever opened, answer 403 for unknown non-allowlisted users without upserting. Clerk is Invite-only today. S
- The P2002 mapper labels every unique violation inside a write as "already exists" (`already_exists`, `admin-writer.ts:83`), and its body is `{ message, code }`. Narrow to the slug and address constraints. S
- Sitemap caps at 40,000 businesses per request and every locale repeats them: `apps/api/src/businesses/sitemap.controller.ts:29`. Split by place before about 40k businesses. M
- Admin `findUniqueOrThrow` after a P2002 would 500 if the row is deleted in between (practically impossible): `admin.guard.ts` `userFor`. S

## Search

- `fetchFirst` trusts any 2xx JSON, so a proxy error page never falls through to the build-time index: `apps/web/src/search/engine.ts:26-35`. Require `body?.v === 1` with `places` and `kinds` arrays inside the loop. S
- Suggest responses can keep a suspended business in the combobox for up to 15 min: `apps/web/src/app/api/search/suggest/route.ts:13` (`s-maxage=300, stale-while-revalidate=600`). Accept and document, or cut SWR to 60 s. S

## Admin

- Business create resolves its place by a fuzzy `q` search capped at 100: `apps/web/src/admin/business-actions.ts:69`. Add an exact `slug` filter to the admin places list or `GET /admin/places/by-slug/:slug`. S
- No unit tests for the create and update server actions (request bodies, 409 on create maps to `errAlreadyExists`): `apps/web/src/admin/actions.ts`, `business-actions.ts`. Mock `./api` and `next/navigation`. M
- Admin API messages for uncoded 400/404/409 stay English under the localized headline: `apps/web/src/admin/admin-errors.ts`. Add codes server-side for the common cases. M
- Sector editor reads the whole sector list because there is no single-sector GET: admin sector editor. Add `GET /admin/sectors/:id`. S

## Web public

- Every `*.vercel.app` production host is indexable (robots allows crawling, no `x-robots-tag`): `apps/web/src/app/robots.ts:10`, `apps/web/src/proxy.ts:17`, `apps/web/src/lib/site.ts:23`. Also require the request host to equal `new URL(siteUrl()).host`. Canonical URLs already point at `SITE_URL`. S
- Suggest limiter clears every visitor's counts once it holds over 50,000 keys: `apps/web/src/lib/rate-limit.ts:11`. Delete stale-window entries first, clear only if still over, and document that self-hosting needs a proxy that overwrites `X-Forwarded-For`. S
- Arabic part of the global 404 heading has no language tag: `apps/web/src/app/global-not-found.tsx:16`. Wrap it in `<span lang="ar">`. S
- No test that the no-tiles build omits `#darb-stage-boot` (and the inverse): `apps/web/src/app/[locale]/layout.tsx:99,125`. Server-render with `TILES_URL: null` and assert. S
- One interval and one `Intl` format per open-state badge: `apps/web/src/components/LiveOpenState.tsx:25`. Share a module-level minute ticker via `useSyncExternalStore`, or try/catch the tick. S
- Web build does not check env, so a production deployment missing a secret builds, is promoted, then answers 500: `apps/web/src/instrumentation.ts:2-6`, `apps/web/next.config.ts`. Run a pure copy of the check from `next.config.ts` when `VERCEL_ENV === "production"`. M

## Seed and data

- No guard against a future all-day Yom Kippur `exceptions` entry for the fuel stations, which would wrongly mark them closed: `packages/seed/data/clients.json` (Paz hours), `clients.test.ts`. Add a one-line test comment. S

## Infra and launch

- R2 CORS allows any origin: `infra/r2/tiles-cors.json:5`. List `https://darb.co.il` and the preview pattern once domains are fixed. S
- The API image keeps dev dependencies and the whole repo, so the first pull is slow: `apps/api/Dockerfile:7`. Prune with `pnpm deploy --prod` once launch is stable. M
- Staging admin sign-in works only on the stable staging origin listed in `CLERK_AUTHORIZED_PARTIES`, not on per-PR preview URLs. Documented; revisit if previews need admin. S
- Revalidation retry has no automatic queue: a failed takedown shows a warning and a Retry button only. Optionally enqueue a BullMQ retry job: `apps/api/src/admin/revalidator.ts`. M

## Tests

- Suggest-limit test calls can straddle a minute window and flake: `apps/api/src/search/suggest-limit.test.ts:15,32`. Pin `Date.now` with `vi.setSystemTime`. S
- Schema test checks `editedAt` null only for places and businesses, and never reads `AuditLog.fields` or `embedHash`: `apps/api/src/admin/schema.test.ts:11-20`. S
- The instant-invalidation resubscribe test uses a fake emitter; none runs against a real Redis that starts late: `apps/api/src/search/instant-invalidation.test.ts`. M
- The e2e "immediate takedown" poll (15 s) cannot tell immediate revalidation from stale-while-revalidate: `apps/web/e2e/admin.spec.ts:78,89`. Assert 404 on the first request. S
- e2e does not catch a CSP nonce mismatch that blocks hydration: `apps/web/e2e/admin.spec.ts:30-40`. Collect `console` messages matching `Content Security Policy`, or click "Add hours" and assert a time input appears. S
- No unit test of the proxy Clerk-mode branch: `apps/web/src/proxy.test.ts:29`. Stub a `pk_test_` key and assert CSP and nonce headers. S
- No phone-overflow guard for the admin screens: `apps/web/e2e/admin-a11y.spec.ts`. Assert `scrollWidth <= innerWidth` in the existing loop. S
- Playwright e2e guard does not exempt a remote `WEB_URL`, and `CI=true` accepts any `DATABASE_URL`: `apps/web/e2e/e2e-database.ts:9`. Document, or add an explicit remote-run flag. S
