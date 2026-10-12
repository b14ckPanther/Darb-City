# Darb-City Plan 2A: The list-first web city

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A fully working, server-rendered, list-first Darb-City in `apps/web`: levels 0–4 in Hebrew,
Arabic and English, with doors and live counts, the path bar, experience sheets for all eleven
templates, near me, errors and empty states, `/for-business`, and CI gates for e2e, accessibility and
performance. The API gains pagination, kind counts and nearest-places-with-kind.

**Architecture:** `apps/web` is Next.js 16.3.6 (App Router, Turbopack, React 19.3). `src/proxy.ts`
rewrites unprefixed paths to an internal `[locale]` segment (`/` → `/he`, `/haifa` → `/he/haifa`) and
redirects `/he/...` to the unprefixed URL. Every level page is a Server Component rendered on first
request and cached with ISR (`generateStaticParams` returns `[]`, `revalidate = 300`), so `next build`
never needs the API. Data comes from the API through a typed `@ts-rest/core` client over
`@darb/contracts`, with `next: { revalidate, tags }` on every fetch. Level 3 is a layout (the business
list) and level 4 is a page inside it that renders the experience sheet, so the list stays mounted
behind the sheet and focus can return to the row that opened it. Client JavaScript is limited to a
few small islands (near me, show more, the sheet and its actions, the 404 suggestion, the retry
notice).

**Tech Stack:** Next.js 16.3.6, React / React DOM 19.3.0, TypeScript 6.0.3, `next/font/google` (Ubuntu,
Heebo, Cairo), CSS Modules with tokens from `@darb/tokens`, `@ts-rest/core` 3.52.1, zod 3.25.76,
Vitest 5.0.3 + `@vitejs/plugin-react` 6.1.1 + `@testing-library/react` 16.3.3 + jsdom 30.1.1,
Playwright 1.63.0 + `@axe-core/playwright` 4.13.0, ESLint 10 with `@next/eslint-plugin-next` 16.3.6 and
`eslint-plugin-react-hooks` 7.1.1, GitHub Actions.

**Spec:** `docs/superpowers/specs/2026-10-12-darb-city-v1-design.md` (binding: §3, §6.3, §7, §8, §9,
§10). Also read `docs/superpowers/plans/2026-10-12-plan-1-followups.md` (rulings and deferred
findings this plan closes) and, for Next.js 16 conventions, `apps/web/node_modules/next/dist/docs/`
once Task 6 has installed Next (proxy, dynamic routes, generateStaticParams, ISR, fetch, font,
metadata, not-found, error).

## Where this plan sits

| Plan | Delivers |
|---|---|
| 1 (done, PR #1) | Monorepo, `core`, `tokens`, `i18n`, `contracts`, database, read API, seed |
| **2A (this)** | API additions; the list-first web city: levels 0–4, path bar, sheets, locales, errors, `/for-business`, e2e/axe/budget gates, CI; seed content fixes gated before deploy |
| 2B | Map (MapLibre) and 2.5D plaza layered on top of 2A's list views |
| 3 | Smart search (wires 2A's search bar placeholder) |
| 4 | Admin, media, real clients, deploy and cut-over |

## Global Constraints

- Branch `feat/plan-2a-web-city`, created from `feat/plan-1-foundation` (Task 1 Step 1).
- Commits are conventional (`feat:`, `fix:`, `test:`, `build:`, `ci:`, `chore:`, `docs:`) and carry
  **no AI attribution lines** (no `Co-Authored-By`, no "Generated with"). The message ends with the
  last line of the description.
- Exact versions only, through the pnpm `catalog` in `pnpm-workspace.yaml`. pnpm 11 enforces a minimum
  release age: never add `minimumReleaseAgeExclude` or any other exclusion.
- `packages/core`, `tokens`, `i18n` and `contracts` stay free of `node:*` and DOM APIs.
- Halal only: no alcohol, pork, gambling, nightlife, tattoo or immodest content anywhere, in any
  language, including new Arabic copy.
- Locales: Hebrew is the default at `/` (unprefixed), Arabic at `/ar`, English at `/en`. Display text
  always goes through `pickText` (requested locale → Hebrew ↔ Arabic → English), so Arabic falls back
  to Hebrew and is never blank. Interface copy always goes through `t()` from `@darb/i18n`.
- No place, sector or kind slug may be reserved (`isReservedSlug`). Every first path segment the web
  app owns (`k`, `for-business`, `search`, `api`, `brand`, `_next`, `ar`, `en`, `he`) is in
  `RESERVED_SLUGS`.
- Next.js 16 rules: `src/proxy.ts` (never `middleware.ts`); `params` are Promises and are awaited;
  `error.tsx` receives `retry`; `revalidateTag(tag, "max")` takes two arguments; **no `loading.tsx`
  files anywhere** (they start streaming before `notFound()` and turn 404s into 200s).
- Every level route exports `revalidate = 300` and a `generateStaticParams` that returns `[]`; the
  `[locale]` root layout's `generateStaticParams` also returns `[]`. `next build` never calls the API.
- Web imports use the `@/` alias with extensionless paths (bundler resolution). Workspace packages
  keep NodeNext `.js` relative imports.
- CSS uses logical properties only (no `left`/`right` properties, `margin-left`, `padding-right`,
  `text-align: left`, …). Only `transform` and `opacity` are transitioned or animated, at 400–700 ms on
  `var(--ease-out)`, and `prefers-reduced-motion: reduce` cuts motion to a short fade. Task 6's
  `src/lib/styles.test.ts` enforces all three on every `.css` file under `apps/web/src`.
- Touch targets are at least 44 × 44 px; text meets WCAG AA. Allowed text colours on the dark
  surfaces: ivory `#fbf7ec`, ivory-200 `#efe8d6`, sage `#a9b8ad` (secondary text), gold-300 `#f0c77a`,
  gold `#d9a54c`. Gold-600 and forest-400 are for borders and decoration only.
- Client components are only the ones this plan names (`NearMe`, `ShowMore`, `Sheet`, `SheetActions`,
  `NotFoundView`, `ClosestMatch`, `ErrorView`). First-load JS stays under 150 KB gzip per level route.
- Server-only environment: `API_URL`, `SITE_URL`, `REVALIDATE_SECRET`. Coordinates from near me are
  never logged or stored.
- Docker Desktop must be running for API tests, the dev stack and e2e (`pnpm infra:up`).
- Before every commit: `pnpm format` then `pnpm lint` (both clean).

## Review Focus

1. **Right-to-left mirroring of the path bar and sheet.** In Hebrew and Arabic the path bar reads
   right to left, its chevrons and up arrow are mirrored, and the desktop sheet sits on the left (its
   inline end); in English everything flips back. Pinned by Task 21 (`pathbar.spec.ts` computed
   transform checks, `sheet.spec.ts` panel position per locale).
2. **Arabic falling back to Hebrew, never blank.** 200 showroom screens and brand names have no Arabic
   until Tasks 25–26. Every `/ar` page must show Hebrew there, never an empty name or label. Pinned by
   Task 15 (template test with a Hebrew-only screen in Arabic) and Task 21 (`locale.spec.ts` asserts no
   empty business name, door label or sheet title on `/ar` pages).
3. **A business slug from another place returns 404.** `perla-nails` exists in Sakhnin, not in
   Arraba; `/arraba/beauty/nails/perla-nails` must 404, not show Sakhnin's business. Pinned by Task 17
   (level 4 loader) and Task 21 (`levels.spec.ts` asserts status 404).
4. **An ISR page for a kind with zero businesses.** `/arraba/beauty/nails` must render 200 with
   "None in Arraba yet" and the nearest places that have nails (Sakhnin first), not a 404 and not an
   empty list. Pinned by Task 13 and Task 21.
5. **Keyboard focus returning when the sheet closes.** Escape or the close button navigates to level
   3 and focus lands on the row link that opened the sheet, including after a direct load of the
   level 4 URL. Pinned by Task 16 (unit) and Task 21 (`sheet.spec.ts`).

## Decisions this plan makes (controller to confirm)

- `/{place}/k/{kind}` redirects (307) to the canonical `/{place}/{sector}/{kind}` rather than rendering
  a second copy of level 3.
- A business whose primary kind is hidden is not listed and its detail is 404.
- Sheet photos wait for the media module (Plan 4); seed businesses have none. The template screen is
  the sheet's visual.
- Spec §9.3 "screenshot comparison" becomes screenshots reviewed against VC1–VC10 (fonts differ
  between macOS and the Linux runner, so pixel diffs would be noise).
- LCP smoke: under 1.5 s per level on fast-4G network emulation (no CPU throttling), warm ISR cache.
- Arabic pages share the Hebrew Open Graph image (no Arabic share image exists yet).
- The wordmark "Darb / درب" is rendered as text next to the raster mark (no wordmark raster exists in
  `@darb/tokens`).
- Business template fonts are named but not downloaded.
- "Friday short" means closing at 12:00, before the midday prayer; mixed cities and Christian-majority
  villages keep the default week (Task 27, pending the owner).
- ⌘K and every search behaviour belong to Plan 3.

## Visual criteria (used by every task that changes what people see)

Screenshots come from `node apps/web/scripts/shoot.mjs <paths…>` (Task 6), which saves phone
(390 × 844) and desktop (1440 × 900) PNGs to `apps/web/.screens/` and prints, per page, any interactive
element smaller than 44 × 44 px and whether the page scrolls horizontally. Open every PNG with the Read
tool and check:

- **VC1** Backgrounds are night/forest only; no white or grey panels outside business template screens.
- **VC2** Body text ivory; secondary text sage; gold only on counts, door rims, the current crumb, the
  focus ring, the For-businesses pill and the primary action.
- **VC3** Doors use the doorway silhouette (wall rising into one sloped gable) with a thin gold rim;
  empty doors are dimmer but present.
- **VC4** Phone: no horizontal page scroll (`overflow: false`); the search bar is docked at the bottom
  within thumb reach and covers no content.
- **VC5** Desktop: content column at most 1200 px, centred; search sits in the top bar; the sheet is a
  side panel with the list visible behind it.
- **VC6** Hebrew and Arabic read right to left with mirrored chevrons and arrows; English left to right.
- **VC7** The script reports `small: []` (no target under 44 px) on every page.
- **VC8** No overlapping or clipped text at either size in any locale.
- **VC9** Hebrew renders in Heebo, Arabic in Cairo, Latin in Ubuntu.
- **VC10** Keyboard focus shows the gold ring.

---

## File map

```
.github/workflows/ci.yml                     install → build → typecheck → lint → format → unit → seed → budget → e2e
pnpm-workspace.yaml  package.json  eslint.config.mjs  turbo.json  .gitignore  .prettierignore  README.md
packages/core/src/slug.ts (+test)            "brand" joins RESERVED_SLUGS
packages/contracts/src/schemas.ts (+test)    BusinessPage, KindCounts, NearestPlace, Screen schemas
packages/contracts/src/contract.ts           pagination, coordinate(), kindCounts, nearestPlaces
packages/i18n/src/messages/{he,ar,en}.ts     web city copy (+ placeholder-parity test)
packages/seed/
  data/screens.json brands.json businesses.json   civic generic brands, Arabic, palette fix, weekend hours
  data/weekend.json                          Arab and Druze localities (Saturday open, Friday short)
  src/showroom.ts (+ showroom.test.ts)       toArabDruzeWeek
  src/index.ts                               loadWeekend
  src/validate.test.ts                       palette contrast, generic brands, Arabic gate, weekend list
  scripts/arabic-todo.ts merge-arabic.ts weekend-candidates.ts build-showroom.ts
apps/api/src/businesses/
  cursor.ts (+test)                          opaque offset cursors
  businesses.repository.ts                   page, detail, countsByKind, nearestPlacesWithKind
  businesses.controller.ts businesses.module.ts
  businesses.controller.test.ts hidden-kinds.test.ts
apps/api/src/places/places.controller.test.ts   blank coordinates 400
apps/web/
  package.json next.config.ts tsconfig.json vitest.config.ts vitest.setup.ts playwright.config.ts .env.example
  scripts/copy-brand.mjs shoot.mjs check-budget.mjs
  e2e/fixtures.ts levels pathbar locale sheet nearme errors a11y targets perf visual (.spec.ts)
  src/proxy.ts
  src/app/globals.css
  src/app/[locale]/layout.tsx page.tsx not-found.tsx error.tsx
  src/app/[locale]/for-business/page.tsx  search/page.tsx
  src/app/[locale]/k/[kind]/page.tsx  k/[kind]/[...rest]/page.tsx
  src/app/[locale]/[place]/page.tsx  [place]/k/[kind]/page.tsx  [place]/k/[kind]/[...rest]/page.tsx
  src/app/[locale]/[place]/[sector]/page.tsx
  src/app/[locale]/[place]/[sector]/[kind]/layout.tsx page.tsx
  src/app/[locale]/[place]/[sector]/[kind]/[business]/page.tsx  [business]/[...rest]/page.tsx
  src/app/api/businesses/route.ts near/route.ts closest/route.ts revalidate/route.ts (+tests)
  src/lib/ locale locale-path routes metadata site tokens-css styles.test api taxonomy crumbs levels
          format links contrast rows fuzzy (+ .test.ts each where listed)
  src/content/for-business.ts
  src/components/ Header BrandMark SearchBar NearMe CityBar Door PlaceIndex SubPlaceChips Badges
          BusinessRow BusinessList ShowMore NoneYet Sheet SheetActions ExperienceView HoursTable
          NotFoundView ClosestMatch ErrorView (+ *.module.css)
  src/components/templates/ index.ts shared.tsx ScreenView.tsx Menu Booking Shop Portfolio Listing
          Schedule Quote Donate Tracker Pass Builder (.tsx) templates.module.css templates.test.tsx
```

---
### Task 1: Paginated business lists

Closes the deferred finding "businesses list unbounded". The list response becomes
`{ items, nextCursor }`; `limit` defaults to 30 (max 100) and `cursor` is opaque.

**Files:**
- Modify: `packages/contracts/src/schemas.ts`, `packages/contracts/src/contract.ts`,
  `packages/contracts/src/schemas.test.ts`
- Create: `apps/api/src/businesses/cursor.ts`, `apps/api/src/businesses/cursor.test.ts`,
  `apps/api/src/businesses/businesses.repository.ts`
- Modify: `apps/api/src/businesses/businesses.controller.ts`,
  `apps/api/src/businesses/businesses.module.ts`, `apps/api/src/businesses/businesses.controller.test.ts`

**Interfaces:**
- Consumes: `PlacesRepository.bySlug`, `PlacesRepository.subtreeIds`,
  `TaxonomyRepository.activeKindBySlug`, `TaxonomyRepository.descendantKindIds`, `toBusinessSummary`,
  `CLOCK` (Plan 1).
- Produces: `BusinessPageSchema` / `BusinessPageDto = { items: BusinessSummaryDto[]; nextCursor: string | null }`,
  `BadRequestSchema = { message: string }`; `contract.businesses.list` query
  `{ kind?, openNow?, limit (1–100, default 30), cursor? }`, responses 200/400/404;
  `encodeCursor(offset: number): string`, `decodeCursor(cursor: string | undefined): number | null`;
  `BusinessesRepository.page({ placeIds, kindIds, offset, limit, openAt }): Promise<{ rows: (Business & { place: { slug: string } })[]; hasMore: boolean }>`.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/zangeel/Documents/GitHub/Darb-City
git switch feat/plan-1-foundation
git switch -c feat/plan-2a-web-city
pnpm install
pnpm infra:up
```

Expected: `Switched to a new branch 'feat/plan-2a-web-city'`; Postgres and Redis report healthy.

- [ ] **Step 2: Write the failing contract test** — append to `packages/contracts/src/schemas.test.ts`

```ts
import { contract } from "./contract.js";
import { BusinessPageSchema } from "./schemas.js";

describe("businesses.list query", () => {
  const query = contract.businesses.list.query;
  it("defaults limit to 30 and accepts 1 to 100", () => {
    expect(query.parse({}).limit).toBe(30);
    expect(query.parse({ limit: "1" }).limit).toBe(1);
    expect(query.parse({ limit: "100" }).limit).toBe(100);
  });
  it("rejects limits outside 1 to 100 and empty cursors", () => {
    expect(query.safeParse({ limit: "0" }).success).toBe(false);
    expect(query.safeParse({ limit: "101" }).success).toBe(false);
    expect(query.safeParse({ cursor: "" }).success).toBe(false);
  });
});

describe("BusinessPageSchema", () => {
  it("carries items and a nullable cursor", () => {
    expect(BusinessPageSchema.parse({ items: [], nextCursor: null })).toEqual({
      items: [],
      nextCursor: null,
    });
  });
});
```

Merge the new imports into the file's existing import lines rather than duplicating them.

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @darb/contracts test`
Expected: FAIL — `BusinessPageSchema` is not exported and `query.parse({}).limit` is `undefined`.

- [ ] **Step 4: Add the schemas** — append to `packages/contracts/src/schemas.ts`

```ts
export const BusinessPageSchema = z.object({
  items: z.array(BusinessSummarySchema),
  /** Opaque; send it back as `cursor` for the next page. Null on the last page. */
  nextCursor: z.string().nullable(),
});
export type BusinessPageDto = z.infer<typeof BusinessPageSchema>;

export const BadRequestSchema = z.object({ message: z.string() });
```

- [ ] **Step 5: Page the list route** — in `packages/contracts/src/contract.ts`, import
  `BadRequestSchema` and `BusinessPageSchema` from `./schemas.js` and replace `businesses.list` with:

```ts
    list: {
      method: "GET",
      path: "/places/:placeSlug/businesses",
      pathParams: z.object({ placeSlug: SlugSchema }),
      query: z.object({
        kind: SlugSchema.optional(),
        openNow: z
          .enum(["true", "false"])
          .transform((v) => v === "true")
          .optional(),
        limit: z.coerce.number().int().min(1).max(100).default(30),
        cursor: z.string().min(1).max(512).optional(),
      }),
      responses: { 200: BusinessPageSchema, 400: BadRequestSchema, 404: NotFoundSchema },
    },
```

Run: `pnpm --filter @darb/contracts test && pnpm --filter @darb/contracts build`
Expected: PASS; build succeeds (the API now fails to typecheck until Step 10, which is expected).

- [ ] **Step 6: Write the failing cursor test** — `apps/api/src/businesses/cursor.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { decodeCursor, encodeCursor } from "./cursor.js";

describe("cursors", () => {
  it("round-trip an offset", () => {
    expect(decodeCursor(encodeCursor(60))).toBe(60);
  });
  it("start at zero when absent", () => {
    expect(decodeCursor(undefined)).toBe(0);
  });
  it("reject anything that is not one of ours", () => {
    expect(decodeCursor("nonsense")).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":-1}').toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from('{"o":1.5}').toString("base64url"))).toBeNull();
    expect(decodeCursor(Buffer.from("[]").toString("base64url"))).toBeNull();
  });
});
```

Run: `pnpm --filter @darb/api exec vitest run src/businesses/cursor.test.ts`
Expected: FAIL — cannot find module `./cursor.js`.

- [ ] **Step 7: Implement the cursor** — `apps/api/src/businesses/cursor.ts`

```ts
/** Opaque page cursors. Today they wrap an offset; clients must not rely on that. */
export function encodeCursor(offset: number): string {
  return Buffer.from(JSON.stringify({ o: offset })).toString("base64url");
}

/** The offset a cursor stands for: 0 when absent, null when it is not a cursor we issued. */
export function decodeCursor(cursor: string | undefined): number | null {
  if (cursor === undefined) return 0;
  try {
    const value = JSON.parse(Buffer.from(cursor, "base64url").toString("utf8")) as unknown;
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const offset = (value as { o?: unknown }).o;
    return typeof offset === "number" && Number.isInteger(offset) && offset >= 0 ? offset : null;
  } catch {
    return null;
  }
}
```

Run: `pnpm --filter @darb/api exec vitest run src/businesses/cursor.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Rewrite the business API test for pages** — replace
  `apps/api/src/businesses/businesses.controller.test.ts` with:

```ts
import "reflect-metadata";
import type { INestApplication } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { testDatabaseUrl, resetDatabase } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { AppModule } from "../app.module.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { CLOCK } from "./businesses.controller.js";

let app: INestApplication;

beforeAll(async () => {
  testDatabaseUrl();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CLOCK)
    .useValue(() => new Date("2026-10-12T06:30:00Z"))
    .compile();
  app = moduleRef.createNestApplication();
  await app.init();
  const prisma = app.get(PrismaService);
  await resetDatabase(prisma);
  await seedFixtures(prisma);
});
afterAll(() => app.close());

const get = (path: string) => request(app.getHttpServer()).get(path);
const slugs = (items: { slug: string }[]) => items.map((b) => b.slug).sort();

describe("GET /places/:placeSlug/businesses", () => {
  it("lists published businesses of the kind and its sub-kinds", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops");
    expect(res.status).toBe(200);
    expect(slugs(res.body.items)).toEqual(["abu-salim", "little-cuts"]); // draft excluded
    expect(res.body.nextCursor).toBeNull();
  });
  it("includes businesses anywhere under a region", async () => {
    const res = await get("/places/northern-district/businesses?kind=barbershops");
    expect(slugs(res.body.items)).toEqual(["abu-salim", "little-cuts", "tamra-barber"]);
  });
  it("computes openNow, null when there are no hours", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops");
    const byslug = Object.fromEntries(
      res.body.items.map((b: { slug: string; openNow: boolean | null }) => [b.slug, b.openNow]),
    );
    expect(byslug).toEqual({ "abu-salim": true, "little-cuts": null });
  });
  it("filters to open businesses", async () => {
    const res = await get("/places/sakhnin/businesses?kind=barbershops&openNow=true");
    expect(slugs(res.body.items)).toEqual(["abu-salim"]);
  });
  it("404s for an unknown place or kind, and for a hidden kind", async () => {
    expect((await get("/places/nowhere/businesses")).status).toBe(404);
    expect((await get("/places/sakhnin/businesses?kind=nope")).status).toBe(404);
    expect((await get("/places/sakhnin/businesses?kind=hidden-kind")).status).toBe(404);
  });
});

describe("pagination", () => {
  it("pages in a stable order and ends with a null cursor", async () => {
    const first = await get("/places/northern-district/businesses?kind=barbershops&limit=2");
    expect(first.body.items.map((b: { slug: string }) => b.slug)).toEqual([
      "abu-salim",
      "little-cuts",
    ]);
    expect(typeof first.body.nextCursor).toBe("string");
    const second = await get(
      `/places/northern-district/businesses?kind=barbershops&limit=2&cursor=${first.body.nextCursor}`,
    );
    expect(second.body.items.map((b: { slug: string }) => b.slug)).toEqual(["tamra-barber"]);
    expect(second.body.nextCursor).toBeNull();
  });
  it("pages after the open-now filter, not before it", async () => {
    const res = await get("/places/northern-district/businesses?kind=barbershops&openNow=true&limit=1");
    expect(res.body.items.map((b: { slug: string }) => b.slug)).toEqual(["abu-salim"]);
    const next = await get(
      `/places/northern-district/businesses?kind=barbershops&openNow=true&limit=1&cursor=${res.body.nextCursor}`,
    );
    expect(next.body.items.map((b: { slug: string }) => b.slug)).toEqual(["tamra-barber"]);
    expect(next.body.nextCursor).toBeNull();
  });
  it("rejects bad limits and foreign cursors with 400", async () => {
    expect((await get("/places/sakhnin/businesses?limit=0")).status).toBe(400);
    expect((await get("/places/sakhnin/businesses?limit=101")).status).toBe(400);
    expect((await get("/places/sakhnin/businesses?cursor=nonsense")).status).toBe(400);
  });
});

describe("GET /places/:placeSlug/businesses/:slug", () => {
  it("returns the full business with raw localized text", async () => {
    const res = await get("/places/sakhnin/businesses/abu-salim");
    expect(res.status).toBe(200);
    expect(res.body.name).toEqual({ ar: "أبو سليم" });
    expect(res.body.placeSlug).toBe("sakhnin");
    expect(res.body.experience).toEqual({ title: { en: "Book" } });
  });
  it("404s for a business that lives in another place", async () => {
    expect((await get("/places/sakhnin/businesses/tamra-barber")).status).toBe(404);
  });
  it("404s for a draft", async () => {
    expect((await get("/places/sakhnin/businesses/draft-barber")).status).toBe(404);
  });
});
```

The fixture clock is Monday 09:30 Israel time; Abu Salim and Tamra Barber share the fixture's
Sunday/Monday 09:00–19:00 hours, Little Cuts has none.

Run: `pnpm --filter @darb/api exec vitest run src/businesses/businesses.controller.test.ts`
Expected: FAIL — `res.body.items` is undefined (the API still returns an array).

- [ ] **Step 9: Add the repository** — `apps/api/src/businesses/businesses.repository.ts`

```ts
import { Injectable } from "@nestjs/common";
import { isOpenAt, type Hours } from "@darb/core";
import type { Business, Prisma } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

export type BusinessWithPlace = Business & { place: { slug: string } };

export interface PageArgs {
  placeIds: string[];
  /** The kind and its sub-kinds; undefined lists every kind. */
  kindIds?: string[];
  offset: number;
  limit: number;
  /** When set, only businesses open at this moment are listed (and paged). */
  openAt: Date | null;
}

const ORDER: Prisma.BusinessOrderByWithRelationInput[] = [
  { tier: "desc" },
  { slug: "asc" },
  { id: "asc" },
];

@Injectable()
export class BusinessesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async page(args: PageArgs): Promise<{ rows: BusinessWithPlace[]; hasMore: boolean }> {
    const where: Prisma.BusinessWhereInput = {
      status: "published",
      placeId: { in: args.placeIds },
      ...(args.kindIds ? { kinds: { some: { kindId: { in: args.kindIds } } } } : {}),
    };
    const include = { place: { select: { slug: true } } } as const;
    if (!args.openAt) {
      const rows = await this.prisma.business.findMany({
        where,
        orderBy: ORDER,
        skip: args.offset,
        take: args.limit + 1,
        include,
      });
      return { rows: rows.slice(0, args.limit), hasMore: rows.length > args.limit };
    }
    // Open-now depends on Israel time, so it is computed here, then paged.
    const at = args.openAt;
    const candidates = await this.prisma.business.findMany({
      where,
      orderBy: ORDER,
      select: { id: true, hours: true },
    });
    const openIds = candidates
      .filter((b) => isOpenAt(b.hours as unknown as Hours, at))
      .map((b) => b.id);
    const window = openIds.slice(args.offset, args.offset + args.limit + 1);
    const pageIds = window.slice(0, args.limit);
    const rows = await this.prisma.business.findMany({ where: { id: { in: pageIds } }, include });
    const byId = new Map(rows.map((r) => [r.id, r]));
    return {
      rows: pageIds.map((id) => byId.get(id)).filter((r): r is BusinessWithPlace => r !== undefined),
      hasMore: window.length > args.limit,
    };
  }
}
```

- [ ] **Step 10: Page the controller** — in `apps/api/src/businesses/businesses.controller.ts`, add the
  imports and constructor parameter, and replace the `list` handler:

```ts
import { BusinessesRepository } from "./businesses.repository.js";
import { decodeCursor, encodeCursor } from "./cursor.js";
```

```ts
  constructor(
    private readonly prisma: PrismaService,
    private readonly places: PlacesRepository,
    private readonly taxonomy: TaxonomyRepository,
    private readonly businesses: BusinessesRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}
```

```ts
      list: async ({ params, query }) => {
        const place = await this.places.bySlug(params.placeSlug);
        if (!place) return { status: 404, body: { message: `No place "${params.placeSlug}"` } };
        const offset = decodeCursor(query.cursor);
        if (offset === null) return { status: 400, body: { message: "Invalid cursor" } };
        let kindIds: string[] | undefined;
        if (query.kind) {
          const kind = await this.taxonomy.activeKindBySlug(query.kind);
          if (!kind) return { status: 404, body: { message: `No kind "${query.kind}"` } };
          kindIds = await this.taxonomy.descendantKindIds(kind.id);
        }
        const now = this.clock();
        const { rows, hasMore } = await this.businesses.page({
          placeIds: await this.places.subtreeIds(place),
          kindIds,
          offset,
          limit: query.limit,
          openAt: query.openNow ? now : null,
        });
        return {
          status: 200,
          body: {
            items: rows.map((r) => toBusinessSummary(r, r.place.slug, now)),
            nextCursor: hasMore ? encodeCursor(offset + query.limit) : null,
          },
        };
      },
```

In `businesses.module.ts` add `BusinessesRepository` to `providers` (keep the `CLOCK` provider):

```ts
import { BusinessesRepository } from "./businesses.repository.js";
// ...
  providers: [BusinessesRepository, { provide: CLOCK, useValue: () => new Date() }],
```

- [ ] **Step 11: Run the API tests**

Run: `pnpm --filter @darb/api test && pnpm --filter @darb/api typecheck`
Expected: every test file passes (pagination, cursors and the Plan 1 suites); typecheck clean.

- [ ] **Step 12: Commit**

```bash
pnpm format && pnpm lint
git add packages/contracts apps/api/src/businesses
git commit -m "feat(api): paginate business lists with an opaque cursor"
```

---

### Task 2: Reject blank coordinates and keep hidden kinds out of business DTOs

Closes two deferred findings: an empty `lat=` coerces to 0 and passes, and hidden kind ids leak into
`kindIds`. A business whose **primary** kind is hidden is not listed and its detail is 404 (hiding a
kind for halal reasons must hide its businesses).

**Files:**
- Modify: `packages/contracts/src/contract.ts`, `packages/contracts/src/schemas.test.ts`
- Modify: `apps/api/src/businesses/businesses.repository.ts`, `apps/api/src/businesses/businesses.controller.ts`
- Modify: `apps/api/src/places/places.controller.test.ts`
- Create: `apps/api/src/businesses/hidden-kinds.test.ts`

**Interfaces:**
- Consumes: Task 1's `BusinessesRepository.page`.
- Produces: `coordinate(min, max)` in `contract.ts` (not exported; used by `places.nearest` here and
  `businesses.nearestPlaces` in Task 4) — accepts a number or a non-blank numeric string; rejects `""`
  and `"  "`. `BusinessesRepository.detail(placeSlug: string, slug: string): Promise<(Business & { kinds: { kindId: string }[] }) | null>`.

- [ ] **Step 1: Write the failing contract test** — append to `packages/contracts/src/schemas.test.ts`

```ts
describe("coordinates", () => {
  const query = contract.places.nearest.query;
  it("accept numbers and numeric strings", () => {
    expect(query.parse({ lat: "32.85", lng: 35.2 })).toEqual({ lat: 32.85, lng: 35.2 });
  });
  it("reject blank, non-numeric and out-of-range values", () => {
    expect(query.safeParse({ lat: "", lng: "35" }).success).toBe(false);
    expect(query.safeParse({ lat: "  ", lng: "35" }).success).toBe(false);
    expect(query.safeParse({ lat: "abc", lng: "35" }).success).toBe(false);
    expect(query.safeParse({ lat: "91", lng: "35" }).success).toBe(false);
  });
});
```

Run: `pnpm --filter @darb/contracts test`
Expected: FAIL — `lat: ""` parses as 0.

- [ ] **Step 2: Add `coordinate`** — in `packages/contracts/src/contract.ts`, below `const c = initContract();`:

```ts
/** A coordinate from a query string. Blank strings are rejected instead of coerced to 0. */
const coordinate = (min: number, max: number) =>
  z.union([z.number(), z.string().trim().min(1)]).pipe(z.coerce.number().min(min).max(max));
```

and use it in `places.nearest`:

```ts
      query: z.object({ lat: coordinate(-90, 90), lng: coordinate(-180, 180) }),
```

Run: `pnpm --filter @darb/contracts test && pnpm --filter @darb/contracts build`
Expected: PASS.

- [ ] **Step 3: Pin it at the API** — append inside the `GET /nearest-place` describe of
  `apps/api/src/places/places.controller.test.ts`:

```ts
  it("rejects blank coordinates instead of reading them as zero", async () => {
    expect((await request(app.getHttpServer()).get("/nearest-place?lat=&lng=35")).status).toBe(400);
    expect((await request(app.getHttpServer()).get("/nearest-place?lat=32.8&lng=")).status).toBe(
      400,
    );
  });
  it("answers 200 with a live place for valid coordinates", async () => {
    const res = await request(app.getHttpServer()).get("/nearest-place?lat=32.85&lng=35.21");
    expect(res.status).toBe(200);
    expect(res.body.status).toBe("live");
  });
```

- [ ] **Step 4: Write the failing hidden-kind test** — `apps/api/src/businesses/hidden-kinds.test.ts`

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";

let app: INestApplication;
let fx: Fixtures;

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  fx = await seedFixtures(created.prisma);
  const base = {
    tagline: { en: "x" },
    address: { en: "Main st" },
    hours: { weekly: {}, exceptions: [] },
    experience: { title: { en: "x" } },
    tier: "example" as const,
    source: "seed" as const,
    status: "published" as const,
    placeId: fx.tamra.id,
    lat: 32.853,
    lng: 35.198,
  };
  await created.prisma.business.create({
    data: {
      ...base,
      slug: "mixed-barber",
      name: { en: "Mixed" },
      primaryKindId: fx.barbershops.id,
      kinds: { create: [{ kindId: fx.barbershops.id }, { kindId: fx.hidden.id }] },
    },
  });
  await created.prisma.business.create({
    data: {
      ...base,
      slug: "hidden-shop",
      name: { en: "Hidden" },
      primaryKindId: fx.hidden.id,
      kinds: { create: [{ kindId: fx.hidden.id }] },
    },
  });
});
afterAll(() => app.close());

const get = (path: string) => request(app.getHttpServer()).get(path);

it("never returns a hidden kind id", async () => {
  const res = await get("/places/tamra/businesses/mixed-barber");
  expect(res.status).toBe(200);
  expect(res.body.kindIds).toEqual([fx.barbershops.id]);
});

it("hides businesses whose primary kind is hidden", async () => {
  expect((await get("/places/tamra/businesses/hidden-shop")).status).toBe(404);
  const list = await get("/places/tamra/businesses");
  expect(list.body.items.map((b: { slug: string }) => b.slug).sort()).toEqual([
    "mixed-barber",
    "tamra-barber",
  ]);
});
```

Run: `pnpm --filter @darb/api exec vitest run src/businesses/hidden-kinds.test.ts`
Expected: FAIL — `kindIds` contains the hidden kind's id and `hidden-shop` is listed.

- [ ] **Step 5: Filter hidden kinds** — in `businesses.repository.ts`, add the primary-kind filter to
  `page()`'s `where`:

```ts
    const where: Prisma.BusinessWhereInput = {
      status: "published",
      placeId: { in: args.placeIds },
      primaryKind: { is: { status: "active" } },
      ...(args.kindIds ? { kinds: { some: { kindId: { in: args.kindIds } } } } : {}),
    };
```

and add `detail`:

```ts
  /** A published business in exactly this place, with only its active kinds. */
  detail(placeSlug: string, slug: string) {
    return this.prisma.business.findFirst({
      where: {
        slug,
        status: "published",
        place: { slug: placeSlug },
        primaryKind: { is: { status: "active" } },
      },
      include: { kinds: { where: { kind: { is: { status: "active" } } }, select: { kindId: true } } },
    });
  }
```

In `businesses.controller.ts`, replace the body of the `get` handler's lookup with the repository and
remove the now-unused `PrismaService` constructor parameter and import:

```ts
      get: async ({ params }) => {
        const row = await this.businesses.detail(params.placeSlug, params.slug);
        if (!row)
          return {
            status: 404,
            body: { message: `No business "${params.slug}" in "${params.placeSlug}"` },
          };
        return { status: 200, body: toBusinessDetail(row, params.placeSlug, this.clock()) };
      },
```

- [ ] **Step 6: Run the API tests**

Run: `pnpm --filter @darb/api test && pnpm --filter @darb/api typecheck`
Expected: PASS, including `hidden-kinds.test.ts` and the two new nearest-place tests.

- [ ] **Step 7: Commit**

```bash
pnpm format && pnpm lint
git add packages/contracts apps/api/src
git commit -m "fix(api): reject blank coordinates and keep hidden kinds out of businesses"
```

---

### Task 3: Kind counts for a place

Doors show live counts. `GET /places/:placeSlug/kind-counts` returns the number of published
businesses per active kind in the place's subtree. A kind counts its sub-kinds' businesses; every
active kind is present, with 0 when empty.

**Files:**
- Modify: `packages/contracts/src/schemas.ts`, `packages/contracts/src/contract.ts`
- Modify: `apps/api/src/businesses/businesses.repository.ts`, `businesses.controller.ts`,
  `businesses.controller.test.ts`

**Interfaces:**
- Consumes: `PlacesRepository.bySlug` (returns `Place` with `path` like `/israel/northern-district/sakhnin/`).
- Produces: `KindCountsSchema = z.record(z.string(), z.number().int().nonnegative())`,
  `KindCountsDto = Record<string, number>` keyed by kind slug; `contract.businesses.kindCounts`
  (`GET /places/:placeSlug/kind-counts`, 200 | 404);
  `BusinessesRepository.countsByKind(placePath: string): Promise<Record<string, number>>`.

- [ ] **Step 1: Write the failing test** — append to `businesses.controller.test.ts`

```ts
describe("GET /places/:placeSlug/kind-counts", () => {
  it("counts published businesses per active kind, sub-kinds included", async () => {
    const res = await get("/places/sakhnin/kind-counts");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ barbershops: 2, "kids-haircuts": 1 });
  });
  it("counts the whole subtree of a region", async () => {
    const res = await get("/places/northern-district/kind-counts");
    expect(res.body).toEqual({ barbershops: 3, "kids-haircuts": 1 });
  });
  it("lists every active kind with zero where there is nothing", async () => {
    const res = await get("/places/eilat/kind-counts");
    expect(res.body).toEqual({ barbershops: 0, "kids-haircuts": 0 });
  });
  it("404s for an unknown place", async () => {
    expect((await get("/places/nowhere/kind-counts")).status).toBe(404);
  });
});
```

Sakhnin: Abu Salim (barbershops) and Little Cuts (kids-haircuts, a sub-kind of barbershops); the
draft is excluded; `hidden-kind` never appears.

Run: `pnpm --filter @darb/api exec vitest run src/businesses/businesses.controller.test.ts`
Expected: FAIL — 404 for `/places/sakhnin/kind-counts` (no route).

- [ ] **Step 2: Add the contract** — append to `schemas.ts`:

```ts
/** Published businesses per active kind slug in a place's subtree. Every active kind is present. */
export const KindCountsSchema = z.record(z.string(), z.number().int().nonnegative());
export type KindCountsDto = z.infer<typeof KindCountsSchema>;
```

and add to `contract.businesses` in `contract.ts` (import `KindCountsSchema`):

```ts
    kindCounts: {
      method: "GET",
      path: "/places/:placeSlug/kind-counts",
      pathParams: z.object({ placeSlug: SlugSchema }),
      responses: { 200: KindCountsSchema, 404: NotFoundSchema },
    },
```

Run: `pnpm --filter @darb/contracts build`
Expected: success.

- [ ] **Step 3: Count in SQL** — add to `BusinessesRepository`:

```ts
  async countsByKind(placePath: string): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<{ slug: string; n: number }[]>`
      WITH RECURSIVE tree AS (
        SELECT id AS root, id FROM "Kind" WHERE status = 'active'
        UNION
        SELECT t.root, k.id FROM "Kind" k JOIN tree t ON k."parentKindId" = t.id
        WHERE k.status = 'active'
      )
      SELECT r.slug, COUNT(DISTINCT b.id)::int AS n
      FROM tree t
      JOIN "Kind" r ON r.id = t.root
      JOIN "BusinessKind" bk ON bk."kindId" = t.id
      JOIN "Business" b ON b.id = bk."businessId"
      JOIN "Kind" pk ON pk.id = b."primaryKindId"
      JOIN "Place" p ON p.id = b."placeId"
      WHERE b.status = 'published' AND pk.status = 'active' AND p.path LIKE ${`${placePath}%`}
      GROUP BY r.slug`;
    const active = await this.prisma.kind.findMany({
      where: { status: "active" },
      select: { slug: true },
    });
    const counts: Record<string, number> = Object.fromEntries(active.map((k) => [k.slug, 0]));
    for (const row of rows) counts[row.slug] = row.n;
    return counts;
  }
```

Paths contain only slug characters and `/`, so `LIKE` needs no escaping.

- [ ] **Step 4: Serve it** — add to the `tsRestHandler` object in `businesses.controller.ts`:

```ts
      kindCounts: async ({ params }) => {
        const place = await this.places.bySlug(params.placeSlug);
        if (!place) return { status: 404, body: { message: `No place "${params.placeSlug}"` } };
        return { status: 200, body: await this.businesses.countsByKind(place.path) };
      },
```

- [ ] **Step 5: Run the API tests**

Run: `pnpm --filter @darb/api test && pnpm --filter @darb/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add packages/contracts apps/api/src/businesses
git commit -m "feat(api): per-kind business counts for a place subtree"
```

---

### Task 4: Nearest live places that have a kind

For "None in {place} yet": `GET /kinds/:kindSlug/nearest-places?lat&lng&limit=5` returns live places
with at least one published business of the kind (or a sub-kind), nearest first.

**Files:**
- Modify: `packages/contracts/src/schemas.ts`, `packages/contracts/src/contract.ts`
- Modify: `apps/api/src/businesses/businesses.repository.ts`, `businesses.controller.ts`,
  `businesses.controller.test.ts`

**Interfaces:**
- Consumes: `coordinate()` (Task 2), `toPlaceDto` (`apps/api/src/places/place.mapper.ts`),
  `TaxonomyRepository.activeKindBySlug`, `descendantKindIds`.
- Produces: `NearestPlaceSchema = PlaceSchema.extend({ distanceKm: number ≥ 0, count: int ≥ 1 })`,
  `NearestPlaceDto`; `contract.businesses.nearestPlaces` (`GET /kinds/:kindSlug/nearest-places`,
  query `{ lat, lng, limit 1–20 default 5 }`, 200 `NearestPlaceDto[]` | 404);
  `BusinessesRepository.nearestPlacesWithKind(kindIds, lat, lng, limit): Promise<{ place: Place; count: number; distanceKm: number }[]>`.

- [ ] **Step 1: Write the failing test** — append to `businesses.controller.test.ts`

```ts
describe("GET /kinds/:kindSlug/nearest-places", () => {
  it("orders live places that have the kind by distance", async () => {
    const res = await get("/kinds/barbershops/nearest-places?lat=32.853&lng=35.198");
    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug)).toEqual(["tamra", "sakhnin"]);
    expect(res.body.map((p: { count: number }) => p.count)).toEqual([1, 2]);
    expect(res.body[0].distanceKm).toBeLessThan(0.5);
    expect(res.body[1].distanceKm).toBeGreaterThan(9);
    expect(res.body[1].distanceKm).toBeLessThan(11);
  });
  it("respects the limit and includes sub-kinds only where they exist", async () => {
    const one = await get("/kinds/barbershops/nearest-places?lat=32.86&lng=35.3&limit=1");
    expect(one.body.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
    const kids = await get("/kinds/kids-haircuts/nearest-places?lat=32.853&lng=35.198");
    expect(kids.body.map((p: { slug: string }) => p.slug)).toEqual(["sakhnin"]);
  });
  it("404s for unknown and hidden kinds, 400s for blank coordinates", async () => {
    expect((await get("/kinds/nope/nearest-places?lat=32&lng=35")).status).toBe(404);
    expect((await get("/kinds/hidden-kind/nearest-places?lat=32&lng=35")).status).toBe(404);
    expect((await get("/kinds/barbershops/nearest-places?lat=&lng=35")).status).toBe(400);
  });
});
```

Run: `pnpm --filter @darb/api exec vitest run src/businesses/businesses.controller.test.ts`
Expected: FAIL — 404 for the barbershops request (no route).

- [ ] **Step 2: Add the contract** — append to `schemas.ts`:

```ts
export const NearestPlaceSchema = PlaceSchema.extend({
  distanceKm: z.number().nonnegative(),
  /** Published businesses of the kind there. */
  count: z.number().int().positive(),
});
export type NearestPlaceDto = z.infer<typeof NearestPlaceSchema>;
```

and add to `contract.businesses` (import `NearestPlaceSchema`):

```ts
    nearestPlaces: {
      method: "GET",
      path: "/kinds/:kindSlug/nearest-places",
      pathParams: z.object({ kindSlug: SlugSchema }),
      query: z.object({
        lat: coordinate(-90, 90),
        lng: coordinate(-180, 180),
        limit: z.coerce.number().int().min(1).max(20).default(5),
      }),
      responses: { 200: z.array(NearestPlaceSchema), 404: NotFoundSchema },
    },
```

Run: `pnpm --filter @darb/contracts build`
Expected: success.

- [ ] **Step 3: Query by distance** — add to `BusinessesRepository` (import `Place` from the generated
  client alongside `Business`):

```ts
  async nearestPlacesWithKind(
    kindIds: string[],
    lat: number,
    lng: number,
    limit: number,
  ): Promise<{ place: Place; count: number; distanceKm: number }[]> {
    if (kindIds.length === 0) return [];
    const rows = await this.prisma.$queryRaw<{ id: string; n: number; km: number }[]>`
      SELECT p.id, COUNT(DISTINCT b.id)::int AS n,
        ST_Distance(p.point, ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography) / 1000 AS km
      FROM "Business" b
      JOIN "BusinessKind" bk ON bk."businessId" = b.id
      JOIN "Kind" pk ON pk.id = b."primaryKindId"
      JOIN "Place" p ON p.id = b."placeId"
      WHERE b.status = 'published' AND pk.status = 'active' AND p.status = 'live'
        AND bk."kindId" = ANY(${kindIds}::uuid[])
      GROUP BY p.id
      ORDER BY km ASC, p.slug ASC
      LIMIT ${limit}`;
    const places = await this.prisma.place.findMany({ where: { id: { in: rows.map((r) => r.id) } } });
    const byId = new Map(places.map((p) => [p.id, p]));
    return rows.flatMap((r) => {
      const place = byId.get(r.id);
      return place ? [{ place, count: r.n, distanceKm: Number(r.km) }] : [];
    });
  }
```

- [ ] **Step 4: Serve it** — add to the handler object in `businesses.controller.ts` (import
  `toPlaceDto` from `../places/place.mapper.js`):

```ts
      nearestPlaces: async ({ params, query }) => {
        const kind = await this.taxonomy.activeKindBySlug(params.kindSlug);
        if (!kind) return { status: 404, body: { message: `No kind "${params.kindSlug}"` } };
        const kindIds = await this.taxonomy.descendantKindIds(kind.id);
        const rows = await this.businesses.nearestPlacesWithKind(
          kindIds,
          query.lat,
          query.lng,
          query.limit,
        );
        return {
          status: 200,
          body: rows.map((r) => ({ ...toPlaceDto(r.place), count: r.count, distanceKm: r.distanceKm })),
        };
      },
```

- [ ] **Step 5: Run the API tests**

Run: `pnpm --filter @darb/api test && pnpm --filter @darb/api typecheck`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add packages/contracts apps/api/src/businesses
git commit -m "feat(api): nearest live places that have a kind"
```

---

### Task 5: Interface copy for the web city

**Files:**
- Modify: `packages/i18n/src/messages/en.ts`, `he.ts`, `ar.ts`, `packages/i18n/src/index.test.ts`

**Interfaces:**
- Consumes: `Messages = typeof en`, `t(locale, key, vars)`.
- Produces: the message keys below, used by Tasks 10–20. Placeholders: `{place}`, `{kind}`, `{count}`,
  `{km}`, `{name}`.

- [ ] **Step 1: Write the failing test** — append to `packages/i18n/src/index.test.ts`

```ts
const placeholders = (text: string) => [...text.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();

it("uses the same placeholders in every locale", () => {
  for (const key of Object.keys(messages.en) as (keyof typeof messages.en)[]) {
    const expected = placeholders(messages.en[key]);
    for (const locale of LOCALES) expect(placeholders(messages[locale][key]), `${locale}.${key}`).toEqual(expected);
  }
});

it("fills the web city messages", () => {
  expect(t("en", "kindInPlace", { kind: "Barbershops", place: "Sakhnin" })).toBe(
    "Barbershops in Sakhnin",
  );
  expect(t("ar", "businessCount", { count: 3 })).toBe("عدد المصالح: 3");
  expect(t("he", "allOf", { place: "חיפה" })).toBe("כל חיפה");
});
```

Run: `pnpm --filter @darb/i18n test`
Expected: FAIL — `kindInPlace` is not a message key.

- [ ] **Step 2: Add the English messages** — in `packages/i18n/src/messages/en.ts`, add these keys
  after `share` (keep every existing key and value):

```ts
  tagline: "Every halal business, in every city, town and village.",
  skipToContent: "Skip to content",
  pathBar: "You are here",
  upOneLevel: "Up one level",
  language: "Language",
  search: "Search",
  searchSoon: "Smart search arrives soon. Until then, pick a place or a kind below.",
  places: "Places",
  allKinds: "Every kind of business",
  cities: "Cities",
  towns: "Towns",
  villages: "Villages",
  neighbourhoods: "Neighbourhoods",
  allOf: "All of {place}",
  businessCount: "Businesses: {count}",
  businesses: "Businesses",
  showMore: "Show more",
  kindInPlace: "{kind} in {place}",
  kindNationwide: "{kind} across Israel",
  placeSoon: "Darb reaches {place} soon",
  nearestLive: "Nearest live place: {place}",
  distanceKm: "{km} km",
  hours: "Opening hours",
  hoursUnknown: "Hours not listed",
  close: "Close",
  resizeSheet: "Resize",
  exampleNotice: "This is an example — this is what your customers would see",
  whatsappGreeting: "Hello {name}, I found you on Darb.",
  website: "Website",
  linkCopied: "Link copied",
  locating: "Finding you…",
  locationDenied: "Location is off. Pick a place from the list instead.",
  notFoundTitle: "This path leads nowhere yet",
  notFoundBody: "The place, kind or business may have moved.",
  didYouMean: "Did you mean {name}?",
  backToCity: "Back to the city",
  unreachable: "Darb can't be reached right now.",
  retry: "Try again",
```

- [ ] **Step 3: Add the Hebrew messages** — same keys in `he.ts`:

```ts
  tagline: "כל עסק חלאל, בכל עיר, עיירה וכפר.",
  skipToContent: "דילוג לתוכן",
  pathBar: "אתם כאן",
  upOneLevel: "רמה אחת למעלה",
  language: "שפה",
  search: "חיפוש",
  searchSoon: "חיפוש חכם יגיע בקרוב. בינתיים, בחרו מקום או סוג עסק למטה.",
  places: "מקומות",
  allKinds: "כל סוגי העסקים",
  cities: "ערים",
  towns: "עיירות",
  villages: "כפרים ויישובים",
  neighbourhoods: "שכונות",
  allOf: "כל {place}",
  businessCount: "עסקים: {count}",
  businesses: "עסקים",
  showMore: "הצגת עוד",
  kindInPlace: "{kind} ב{place}",
  kindNationwide: "{kind} בכל הארץ",
  placeSoon: "דרב מגיעה ל{place} בקרוב",
  nearestLive: "המקום הפעיל הקרוב: {place}",
  distanceKm: "{km} ק״מ",
  hours: "שעות פתיחה",
  hoursUnknown: "שעות הפתיחה לא צוינו",
  close: "סגירה",
  resizeSheet: "שינוי גודל",
  exampleNotice: "זו דוגמה — כך הלקוחות שלכם יראו את העסק",
  whatsappGreeting: "שלום {name}, מצאתי אתכם בדרב.",
  website: "אתר",
  linkCopied: "הקישור הועתק",
  locating: "מאתרים את המיקום…",
  locationDenied: "המיקום כבוי. אפשר לבחור מקום מהרשימה.",
  notFoundTitle: "הדרך הזו עוד לא מובילה לשום מקום",
  notFoundBody: "ייתכן שהמקום, סוג העסק או העסק עברו.",
  didYouMean: "התכוונתם ל־{name}?",
  backToCity: "חזרה לעיר",
  unreachable: "אין חיבור לדרב כרגע.",
  retry: "לנסות שוב",
```

- [ ] **Step 4: Add the Arabic messages** — same keys in `ar.ts`:

```ts
  tagline: "كل مصلحة حلال، في كل مدينة وبلدة وقرية.",
  skipToContent: "انتقل إلى المحتوى",
  pathBar: "أنت هنا",
  upOneLevel: "مستوى واحد للأعلى",
  language: "اللغة",
  search: "بحث",
  searchSoon: "البحث الذكي قادم قريبًا. حتى ذلك الحين، اختر مكانًا أو نوع مصلحة من القائمة.",
  places: "الأماكن",
  allKinds: "كل أنواع المصالح",
  cities: "المدن",
  towns: "البلدات",
  villages: "القرى",
  neighbourhoods: "الأحياء",
  allOf: "كل {place}",
  businessCount: "عدد المصالح: {count}",
  businesses: "المصالح",
  showMore: "عرض المزيد",
  kindInPlace: "{kind} في {place}",
  kindNationwide: "{kind} في كل البلاد",
  placeSoon: "درب تصل إلى {place} قريبًا",
  nearestLive: "أقرب مكان متاح: {place}",
  distanceKm: "{km} كم",
  hours: "ساعات العمل",
  hoursUnknown: "ساعات العمل غير مذكورة",
  close: "إغلاق",
  resizeSheet: "تغيير الحجم",
  exampleNotice: "هذا مثال — هكذا سيرى زبائنك مصلحتك",
  whatsappGreeting: "مرحبًا {name}، وجدتكم على درب.",
  website: "الموقع",
  linkCopied: "تم نسخ الرابط",
  locating: "جارٍ تحديد موقعك…",
  locationDenied: "خدمة الموقع مغلقة. اختر مكانًا من القائمة.",
  notFoundTitle: "هذا الطريق لا يؤدي إلى أي مكان بعد",
  notFoundBody: "ربما انتقل المكان أو نوع المصلحة أو المصلحة نفسها.",
  didYouMean: "هل تقصد {name}؟",
  backToCity: "العودة إلى المدينة",
  unreachable: "لا يمكن الوصول إلى درب الآن.",
  retry: "حاول مرة أخرى",
```

- [ ] **Step 5: Run the tests and build**

Run: `pnpm --filter @darb/i18n test && pnpm --filter @darb/i18n build`
Expected: PASS (key parity, placeholder parity, the fill tests); build succeeds.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add packages/i18n
git commit -m "feat(i18n): copy for the web city in Hebrew, Arabic and English"
```

---
### Task 6: `apps/web` scaffold: Next 16, tooling, fonts and brand tokens

**Files:**
- Modify: `pnpm-workspace.yaml`, `package.json`, `eslint.config.mjs`, `turbo.json`, `.gitignore`,
  `.prettierignore`, `README.md`, `packages/core/src/slug.ts`, `packages/core/src/slug.test.ts`
- Create: `apps/web/package.json`, `apps/web/next.config.ts`, `apps/web/tsconfig.json`,
  `apps/web/vitest.config.ts`, `apps/web/vitest.setup.ts`, `apps/web/.env.example`,
  `apps/web/scripts/copy-brand.mjs`, `apps/web/scripts/shoot.mjs`, `apps/web/src/app/globals.css`,
  `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx`,
  `apps/web/src/lib/locale.ts`, `apps/web/src/lib/site.ts`, `apps/web/src/lib/tokens-css.ts`,
  `apps/web/src/lib/tokens-css.test.ts`, `apps/web/src/lib/styles.test.ts`

**Interfaces:**
- Consumes: `colors`, `motion` (`@darb/tokens`); `dir`, `t` (`@darb/i18n`); `LOCALES`, `Locale` (`@darb/core`).
- Produces: `isLocale(value: string): value is Locale`; `INTL_TAG: Record<Locale, string>`
  (`he-IL`, `ar-IL-u-nu-latn`, `en-IL`); `OG_LOCALE: Record<Locale, string>`; `siteUrl(): string`;
  `tokensCss(): string` (`:root{--night:#03110c;--forest-950:…;--ease-out:…}`); CSS custom properties
  and global classes `frame`, `visually-hidden`, `skip-link`, `reveal`, `page-title`, `lede`,
  `button`, `button-link`, `text-link`, `quiet`; `/brand/*` served from `@darb/tokens/assets/brand`;
  `scripts/shoot.mjs` for visual checks.

- [ ] **Step 1: Pin the versions** — in `pnpm-workspace.yaml`, the `catalog:` becomes (alphabetical;
  every existing entry kept):

```yaml
catalog:
  "@axe-core/playwright": 4.13.0
  "@eslint/js": 10.0.1
  "@nestjs/common": 11.2.7
  "@nestjs/core": 11.2.7
  "@nestjs/platform-express": 11.2.7
  "@nestjs/testing": 11.2.7
  "@next/eslint-plugin-next": 16.3.6
  "@playwright/test": 1.63.0
  "@prisma/adapter-pg": 7.10.0
  "@prisma/client": 7.10.0
  "@swc/core": 1.16.2
  "@testing-library/dom": 10.4.2
  "@testing-library/react": 16.3.3
  "@ts-rest/core": 3.52.1
  "@ts-rest/nest": 3.52.1
  "@types/node": 22.20.5
  "@types/pg": 8.23.1
  "@types/react": 19.3.0
  "@types/react-dom": 19.3.0
  "@types/supertest": 7.2.1
  "@vitejs/plugin-react": 6.1.1
  ajv: 8.20.0
  dotenv: 18.0.7
  eslint: 10.12.0
  eslint-plugin-react-hooks: 7.1.1
  jsdom: 30.1.1
  next: 16.3.6
  pg: 8.23.1
  prettier: 3.9.10
  prisma: 7.10.0
  react: 19.3.0
  react-dom: 19.3.0
  reflect-metadata: 0.2.2
  rxjs: 7.8.2
  supertest: 7.3.1
  tsx: 4.23.15
  turbo: 2.11.7
  typescript: 6.0.3
  typescript-eslint: 8.71.1
  unplugin-swc: 2.0.0
  vitest: 5.0.3
  zod: 3.25.76
```

`@testing-library/dom` is the required peer of `@testing-library/react`; 10.4.2 was published
2026-09-13. Do not add any release-age exclusion; if `pnpm install` refuses a version as too new, stop
and report it.

In the root `package.json` add to `devDependencies`:

```json
    "@next/eslint-plugin-next": "catalog:",
    "eslint-plugin-react-hooks": "catalog:",
```

- [ ] **Step 2: Reserve `brand`** — Next serves `/brand/*` from `public/`, so no place may be called
  `brand`. In `packages/core/src/slug.ts` add `"brand",` after `"_next",` in `RESERVED_SLUGS`. In
  `slug.test.ts` add `"brand",` to the expected list in "cover locales, the kind prefix and app routes"
  and to the `it.each([...])("%s is reserved")` list.

Run: `pnpm --filter @darb/core test && pnpm --filter @darb/core build && pnpm --filter @darb/seed test`
Expected: PASS (the seed's reserved-slug gate still passes: no place is called `brand`).

- [ ] **Step 3: Create the web package** — `apps/web/package.json`

```json
{
  "name": "@darb/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "brand": "node scripts/copy-brand.mjs",
    "dev": "node scripts/copy-brand.mjs && next dev --port 3000",
    "build": "node scripts/copy-brand.mjs && next build",
    "start": "next start --port 3000",
    "typecheck": "next typegen && tsc --noEmit",
    "test": "vitest run",
    "e2e": "playwright test",
    "budget": "node scripts/check-budget.mjs"
  },
  "dependencies": {
    "@darb/contracts": "workspace:*",
    "@darb/core": "workspace:*",
    "@darb/i18n": "workspace:*",
    "@darb/tokens": "workspace:*",
    "@ts-rest/core": "catalog:",
    "next": "catalog:",
    "react": "catalog:",
    "react-dom": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@axe-core/playwright": "catalog:",
    "@playwright/test": "catalog:",
    "@testing-library/dom": "catalog:",
    "@testing-library/react": "catalog:",
    "@types/node": "catalog:",
    "@types/react": "catalog:",
    "@types/react-dom": "catalog:",
    "@vitejs/plugin-react": "catalog:",
    "jsdom": "catalog:",
    "typescript": "catalog:",
    "vitest": "catalog:"
  }
}
```

`apps/web/next.config.ts` — Turbopack must see the whole workspace, because the `@darb/*` packages
live outside `apps/web`:

```ts
import path from "node:path";
import type { NextConfig } from "next";

const workspaceRoot = path.resolve(process.cwd(), "../..");

const config: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  turbopack: { root: workspaceRoot },
  outputFileTracingRoot: workspaceRoot,
};

export default config;
```

`apps/web/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "lib": ["DOM", "DOM.Iterable", "ES2023"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "noEmit": true,
    "allowJs": true,
    "declaration": false,
    "sourceMap": false,
    "incremental": true,
    "types": ["node"],
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./src/*"] }
  },
  "include": [
    "next-env.d.ts",
    "*.ts",
    "src",
    "e2e",
    ".next/types/**/*.ts",
    ".next/dev/types/**/*.ts"
  ],
  "exclude": ["node_modules"]
}
```

`apps/web/vitest.config.ts`:

```ts
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
  },
});
```

`apps/web/vitest.setup.ts`:

```ts
import { cleanup } from "@testing-library/react";
import { afterEach } from "vitest";

afterEach(() => cleanup());
```

`apps/web/.env.example`:

```
API_URL=http://localhost:4000
SITE_URL=http://localhost:3000
REVALIDATE_SECRET=change-me
```

`apps/web/scripts/copy-brand.mjs` — brand files are copied, never redrawn:

```js
// Copies the approved brand files from @darb/tokens into public/brand (served at /brand/*).
import { cpSync, mkdirSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const source = dirname(require.resolve("@darb/tokens/assets/brand/icon-32.png"));
const target = fileURLToPath(new URL("../public/brand", import.meta.url));
rmSync(target, { recursive: true, force: true });
mkdirSync(target, { recursive: true });
cpSync(source, target, { recursive: true });
console.log(`brand: ${source} -> ${target}`);
```

`apps/web/scripts/shoot.mjs` — the visual-check tool every visual task uses:

```js
// Usage: node apps/web/scripts/shoot.mjs /sakhnin /en/sakhnin/beauty ...
// Saves phone and desktop screenshots to apps/web/.screens and reports small targets and overflow.
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { chromium } from "@playwright/test";

const base = process.env.WEB_URL ?? "http://localhost:3000";
const paths = process.argv.slice(2);
if (paths.length === 0) throw new Error("Usage: node scripts/shoot.mjs <path> [path…]");
const out = fileURLToPath(new URL("../.screens/", import.meta.url));
mkdirSync(out, { recursive: true });

const viewports = [
  ["phone", { width: 390, height: 844 }],
  ["desktop", { width: 1440, height: 900 }],
];
const browser = await chromium.launch();
for (const [name, viewport] of viewports) {
  const context = await browser.newContext({ viewport, reducedMotion: "reduce" });
  const page = await context.newPage();
  for (const path of paths) {
    await page.goto(base + path, { waitUntil: "networkidle" });
    const file = `${out}${name}${path === "/" ? "_home" : path.replaceAll("/", "_")}.png`;
    await page.screenshot({ path: file });
    const report = await page.evaluate(() => {
      const targets = document.querySelectorAll("a[href], button, input, summary, [role='button']");
      const small = [...targets]
        .filter((el) => !el.closest(".visually-hidden, .skip-link, p"))
        .filter((el) => {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (box.width === 0 || style.visibility === "hidden" || style.display === "none") return false;
          return box.width < 44 || box.height < 44;
        })
        .map((el) => el.outerHTML.slice(0, 90));
      const overflow = document.documentElement.scrollWidth > document.documentElement.clientWidth;
      return { small, overflow };
    });
    console.log(JSON.stringify({ file, ...report }));
  }
  await context.close();
}
await browser.close();
```

Inline links inside a paragraph (`p a`) are exempt from the 44 px rule, as WCAG 2.5.8 allows.

- [ ] **Step 4: Root tooling** — replace `eslint.config.mjs`:

```js
import eslint from "@eslint/js";
import nextPlugin from "@next/eslint-plugin-next";
import { defineConfig, globalIgnores } from "eslint/config";
import reactHooks from "eslint-plugin-react-hooks";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores([
    "**/dist/**",
    "**/generated/**",
    "**/.turbo/**",
    "**/coverage/**",
    "**/.next/**",
    "**/next-env.d.ts",
    ".superpowers/**",
    "apps/web/public/brand/**",
    "apps/web/.screens/**",
    "apps/web/playwright-report/**",
    "apps/web/test-results/**",
  ]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
    },
  },
  {
    files: ["**/*.mjs"],
    languageOptions: {
      globals: { process: "readonly", console: "readonly", URL: "readonly", document: "readonly", getComputedStyle: "readonly" },
    },
  },
  {
    files: ["apps/web/**/*.{ts,tsx}"],
    plugins: { "@next/next": nextPlugin, "react-hooks": reactHooks },
    settings: { next: { rootDir: "apps/web/" } },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      ...nextPlugin.configs["core-web-vitals"].rules,
      ...reactHooks.configs.recommended.rules,
    },
  },
);
```

In `turbo.json`, change the `build` task's outputs to
`["dist/**", ".next/**", "!.next/cache/**"]`.

Append to `.gitignore`:

```
.next/
next-env.d.ts
apps/web/public/brand/
apps/web/.screens/
playwright-report/
test-results/
```

Append to `.prettierignore`:

```
**/.next
apps/web/next-env.d.ts
apps/web/public/brand
apps/web/.screens
apps/web/playwright-report
apps/web/test-results
```

In `README.md`, under `## Run`, after `cp apps/api/.env.example apps/api/.env`, add
`cp apps/web/.env.example apps/web/.env.local`, and change the `pnpm dev` comment to
`# Postgres + Redis, migrations, seed, API on :4000, web on http://localhost:3000`. Add one line
under the test commands: `pnpm --filter @darb/web e2e   # Playwright; needs the seeded API`.

Run: `pnpm install`
Expected: installs with no release-age refusal and no unapproved build scripts. If pnpm lists an
ignored build script, add that package to `allowBuilds` with `false` (the web app needs no native
build) and run `pnpm install` again.

- [ ] **Step 5: Write the failing token test** — `apps/web/src/lib/tokens-css.test.ts`

```ts
import { colors } from "@darb/tokens";
import { expect, it } from "vitest";
import { tokensCss } from "./tokens-css";

it("exposes every brand colour and motion curve as a custom property", () => {
  const css = tokensCss();
  expect(css.startsWith(":root{")).toBe(true);
  expect(css).toContain("--night:#03110c;");
  expect(css).toContain("--forest-950:#051811;");
  expect(css).toContain("--gold-300:#f0c77a;");
  expect(css).toContain("--ink-muted:#4c5f56;");
  expect(css).toContain("--ease-out:cubic-bezier(0.22, 1, 0.36, 1);");
  for (const value of Object.values(colors)) expect(css).toContain(value);
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — cannot resolve `./tokens-css`.

- [ ] **Step 6: Implement the small libraries**

`apps/web/src/lib/tokens-css.ts`:

```ts
import { colors, motion } from "@darb/tokens";

/** forest950 → forest-950, inkMuted → ink-muted. */
const kebab = (key: string) => key.replace(/([a-z])([0-9A-Z])/g, "$1-$2").toLowerCase();

/** The brand tokens as CSS custom properties: the single source for every colour and curve. */
export function tokensCss(): string {
  const declarations = [
    ...Object.entries(colors).map(([key, value]) => `--${kebab(key)}:${value};`),
    `--ease-out:${motion.easeOut};`,
    `--ease-in-out:${motion.easeInOut};`,
  ];
  return `:root{${declarations.join("")}}`;
}
```

`apps/web/src/lib/locale.ts`:

```ts
import { LOCALES, type Locale } from "@darb/core";

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

/** Intl tags. Arabic in Israel writes Latin digits, so Arabic asks for them explicitly. */
export const INTL_TAG: Record<Locale, string> = {
  he: "he-IL",
  ar: "ar-IL-u-nu-latn",
  en: "en-IL",
};

export const OG_LOCALE: Record<Locale, string> = { he: "he_IL", ar: "ar_IL", en: "en_IL" };
```

`apps/web/src/lib/site.ts`:

```ts
/** The public origin, without a trailing slash. */
export function siteUrl(): string {
  return (process.env.SITE_URL ?? "http://localhost:3000").replace(/\/+$/, "");
}
```

Run: `pnpm --filter @darb/web test`
Expected: PASS (1 test).

- [ ] **Step 7: Global styles** — `apps/web/src/app/globals.css`

```css
/* Brand colours and curves come from @darb/tokens (injected by the root layout). These are roles. */
:root {
  color-scheme: dark;
  --bg: var(--night);
  --surface-1: var(--forest-950);
  --surface-2: var(--forest-900);
  --surface-3: var(--forest-800);
  --text: var(--ivory);
  --text-soft: var(--ivory-200);
  --text-muted: #a9b8ad;
  --accent: var(--gold);
  --accent-bright: var(--gold-300);
  --line: rgb(217 165 76 / 0.24);
  --line-soft: rgb(251 247 236 / 0.08);
  --focus-ring: 0 0 0 2px var(--night), 0 0 0 4px var(--gold-300);
  --font-body: var(--font-latin), var(--font-hebrew), var(--font-arabic), system-ui, sans-serif;
  --step--1: 0.875rem;
  --step-0: 1rem;
  --step-1: 1.125rem;
  --step-2: 1.375rem;
  --step-3: clamp(1.625rem, 1.3rem + 1.4vw, 2.25rem);
  --step-4: clamp(2rem, 1.5rem + 2.4vw, 3.25rem);
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 24px;
  --space-6: 32px;
  --space-7: 48px;
  --space-8: 64px;
  --radius-s: 10px;
  --radius-m: 16px;
  --radius-l: 24px;
  --radius-pill: 999px;
  --tap: 44px;
  --dur-fast: 400ms;
  --dur: 550ms;
  --dur-slow: 700ms;
  --gutter: 16px;
  --frame: 1200px;
  --shadow-panel: 0 24px 64px rgb(0 0 0 / 0.45), inset 0 1px 0 rgb(251 231 189 / 0.06);
}

@media (min-width: 900px) {
  :root {
    --gutter: 32px;
  }
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html {
  -webkit-text-size-adjust: 100%;
  text-size-adjust: 100%;
}

body {
  margin: 0;
  min-block-size: 100dvh;
  background:
    radial-gradient(120% 70% at 50% -10%, var(--forest-900) 0%, transparent 65%),
    var(--night);
  color: var(--text);
  font-family: var(--font-body);
  font-size: var(--step-0);
  line-height: 1.55;
}

@media (max-width: 899px) {
  body {
    padding-block-end: 96px; /* room for the docked search bar */
  }
}

a {
  color: inherit;
}

h1,
h2,
h3 {
  margin: 0;
  line-height: 1.2;
  font-weight: 700;
}

:focus-visible {
  outline: none;
  box-shadow: var(--focus-ring);
  border-radius: var(--radius-s);
}

.frame {
  inline-size: min(100%, var(--frame));
  margin-inline: auto;
  padding-inline: var(--gutter);
}

.visually-hidden {
  position: absolute;
  inline-size: 1px;
  block-size: 1px;
  margin: -1px;
  padding: 0;
  overflow: hidden;
  clip-path: inset(50%);
  white-space: nowrap;
  border: 0;
}

.skip-link {
  position: absolute;
  inset-inline-start: var(--space-4);
  inset-block-start: var(--space-2);
  z-index: 50;
  padding: var(--space-3) var(--space-4);
  background: var(--gold);
  color: var(--night);
  font-weight: 700;
  border-radius: var(--radius-s);
  transform: translateY(-200%);
}

.skip-link:focus-visible {
  transform: none;
}

.page-title {
  font-size: var(--step-4);
  letter-spacing: -0.01em;
  margin-block: var(--space-5) var(--space-3);
}

.page-title:focus-visible {
  box-shadow: none;
}

.lede {
  color: var(--text-soft);
  font-size: var(--step-1);
  max-inline-size: 60ch;
  margin-block: 0 var(--space-6);
}

.button,
.button-link {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-block-size: var(--tap);
  padding-inline: var(--space-5);
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--gold-300);
  font: inherit;
  font-weight: 500;
  text-decoration: none;
  cursor: pointer;
}

.text-link {
  color: var(--gold-300);
  text-underline-offset: 0.2em;
}

.quiet {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-4);
  margin-block: var(--space-7);
  padding: var(--space-5);
  border: 1px solid var(--line-soft);
  border-radius: var(--radius-m);
  background: var(--surface-1);
  color: var(--text-soft);
}

.reveal {
  animation: reveal var(--dur) var(--ease-out) both;
}

@keyframes reveal {
  from {
    opacity: 0;
    transform: translateY(8px);
  }
  to {
    opacity: 1;
    transform: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  *,
  *::before,
  *::after {
    animation-duration: 1ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 1ms !important;
    scroll-behavior: auto !important;
  }
}
```

- [ ] **Step 8: Write the CSS guard test** — `apps/web/src/lib/styles.test.ts`

```ts
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

const PHYSICAL = [
  /\b(?:margin|padding|border)-(?:left|right)\b/,
  /(?:^|[\s;{])(?:left|right)\s*:/m,
  /text-align\s*:\s*(?:left|right)/,
  /\bfloat\s*:\s*(?:left|right)/,
  /border-(?:top|bottom)-(?:left|right)-radius/,
];
const MOTION_PROPS = new Set(["opacity", "transform"]);

describe.each(cssFiles(SRC))("%s", (file) => {
  const css = readFileSync(file, "utf8");

  it("uses logical properties only", () => {
    for (const re of PHYSICAL) expect(css, String(re)).not.toMatch(re);
  });

  it("transitions only transform and opacity", () => {
    for (const [, value] of css.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)) {
      for (const part of value!.split(",")) {
        const property = part.trim().split(/\s+/)[0]!;
        if (property === "none") continue;
        expect(MOTION_PROPS.has(property), `${property} in "${value}"`).toBe(true);
      }
    }
  });

  it("animates only transform and opacity in keyframes", () => {
    for (const [, body] of css.matchAll(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g)) {
      for (const [, property] of body!.matchAll(/([a-z-]+)\s*:/g)) {
        expect(MOTION_PROPS.has(property!), property).toBe(true);
      }
    }
  });

  it("keeps literal durations between 400 and 700 ms (1 ms only for reduced motion)", () => {
    for (const [, ms] of css.matchAll(/(\d+)ms/g)) {
      const n = Number(ms);
      expect(n === 1 || (n >= 400 && n <= 700), `${n}ms`).toBe(true);
    }
  });
});
```

Transitions name a property first (`transform var(--dur) var(--ease-out)`); never write
`transition: all` or a duration-first shorthand.

Run: `pnpm --filter @darb/web test`
Expected: PASS (`globals.css` passes all four checks; tokens test passes).

- [ ] **Step 9: Root layout and a first page**

`apps/web/src/app/[locale]/layout.tsx`:

```tsx
import type { Metadata, Viewport } from "next";
import { Cairo, Heebo, Ubuntu } from "next/font/google";
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { dir, t } from "@darb/i18n";
import { colors } from "@darb/tokens";
import { isLocale } from "@/lib/locale";
import { siteUrl } from "@/lib/site";
import { tokensCss } from "@/lib/tokens-css";
import "../globals.css";

// Each family carries only its own script, so a page downloads what it renders.
const ubuntu = Ubuntu({
  weight: ["400", "500", "700"],
  subsets: ["latin"],
  display: "swap",
  variable: "--font-latin",
});
const heebo = Heebo({ subsets: ["hebrew"], display: "swap", variable: "--font-hebrew" });
const cairo = Cairo({ subsets: ["arabic"], display: "swap", variable: "--font-arabic", preload: false });

export const viewport: Viewport = { themeColor: colors.night, colorScheme: "dark" };

/** Every page renders on first request and is then cached (ISR); the build never calls the API. */
export function generateStaticParams() {
  return [];
}

type LayoutProps = { children: ReactNode; params: Promise<{ locale: string }> };

export async function generateMetadata({
  params,
}: {
  params: Promise<{ locale: string }>;
}): Promise<Metadata> {
  const { locale } = await params;
  const l = isLocale(locale) ? locale : "he";
  return {
    metadataBase: new URL(siteUrl()),
    applicationName: t(l, "appName"),
    description: t(l, "tagline"),
    icons: {
      icon: [
        { url: "/brand/icon-32.png", sizes: "32x32", type: "image/png" },
        { url: "/brand/icon-192.png", sizes: "192x192", type: "image/png" },
      ],
      apple: "/brand/apple-touch-icon.png",
    },
  };
}

export default async function RootLayout({ children, params }: LayoutProps) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <html
      lang={locale}
      dir={dir(locale)}
      className={[ubuntu.variable, heebo.variable, cairo.variable].join(" ")}
    >
      <head>
        <style id="darb-tokens" dangerouslySetInnerHTML={{ __html: tokensCss() }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
```

Cairo is not preloaded because only Arabic pages use it; Ubuntu and Heebo are.

`apps/web/src/app/[locale]/page.tsx` (Task 11 replaces it with level 0):

```tsx
import { notFound } from "next/navigation";
import { t } from "@darb/i18n";
import { isLocale } from "@/lib/locale";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  return (
    <main id="main" className="frame">
      <h1 className="page-title">{t(locale, "appName")}</h1>
    </main>
  );
}
```

- [ ] **Step 10: Build, type-check and run it**

```bash
cp apps/web/.env.example apps/web/.env.local
pnpm --filter @darb/web exec playwright install chromium
pnpm build
pnpm --filter @darb/web typecheck
pnpm --filter @darb/web start &
sleep 5
curl -s http://localhost:3000/he | grep -o '<html[^>]*>'
curl -s http://localhost:3000/ar | grep -o '<html[^>]*>'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/brand/og-he.jpg
kill %1
```

Expected: build succeeds without contacting the API; typecheck clean; the two `<html>` tags read
`lang="he" dir="rtl"` and `lang="ar" dir="rtl"` (with the three font variable classes); the OG image
returns `200`. If `next build` rewrites `apps/web/tsconfig.json`, keep its additions.

- [ ] **Step 11: Commit**

```bash
pnpm format && pnpm lint
git add pnpm-workspace.yaml pnpm-lock.yaml package.json eslint.config.mjs turbo.json .gitignore .prettierignore README.md packages/core apps/web
git commit -m "feat(web): Next 16 app with brand tokens, script-limited fonts and tooling"
```

---

### Task 7: Locale routing, URLs and page metadata

Hebrew lives at `/`, Arabic at `/ar`, English at `/en`. `src/proxy.ts` rewrites unprefixed paths to
the internal `[locale]` segment and redirects `/he/...` to the unprefixed URL.

**Files:**
- Create: `apps/web/src/lib/locale-path.ts`, `apps/web/src/lib/locale-path.test.ts`,
  `apps/web/src/proxy.ts`, `apps/web/src/lib/routes.ts`, `apps/web/src/lib/routes.test.ts`,
  `apps/web/src/lib/metadata.ts`, `apps/web/src/lib/metadata.test.ts`

**Interfaces:**
- Consumes: `OG_LOCALE` (Task 6), `t` (`@darb/i18n`), `LOCALES`.
- Produces:
  - `routeLocale(pathname: string): { action: "next" } | { action: "rewrite" | "redirect"; pathname: string }`
  - `href(locale: Locale, segments?: readonly string[]): string` — `href("he", ["haifa"])` → `/haifa`,
    `href("ar")` → `/ar`, `href("he")` → `/`
  - `paths.home() / place(p) / sector(p, s) / kind(p, s, k) / business(p, s, k, b) / nationalKind(k) / placeKind(p, k) / forBusiness() / search()` → `string[]`
  - `languageAlternates(segments): Record<"he" | "ar" | "en" | "x-default", string>`
  - `pageMetadata({ locale, segments, title, description }): Metadata`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/locale-path.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { routeLocale } from "./locale-path";

describe("routeLocale", () => {
  it("rewrites unprefixed paths to Hebrew", () => {
    expect(routeLocale("/")).toEqual({ action: "rewrite", pathname: "/he" });
    expect(routeLocale("/haifa/beauty")).toEqual({ action: "rewrite", pathname: "/he/haifa/beauty" });
  });
  it("passes Arabic and English through", () => {
    expect(routeLocale("/ar")).toEqual({ action: "next" });
    expect(routeLocale("/en/haifa")).toEqual({ action: "next" });
  });
  it("redirects explicit Hebrew to the unprefixed URL", () => {
    expect(routeLocale("/he")).toEqual({ action: "redirect", pathname: "/" });
    expect(routeLocale("/he/haifa")).toEqual({ action: "redirect", pathname: "/haifa" });
  });
  it("does not mistake a slug that starts like a locale", () => {
    expect(routeLocale("/hebron")).toEqual({ action: "rewrite", pathname: "/he/hebron" });
    expect(routeLocale("/arraba")).toEqual({ action: "rewrite", pathname: "/he/arraba" });
  });
});
```

`apps/web/src/lib/routes.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { href, languageAlternates, paths } from "./routes";

describe("href", () => {
  it("leaves Hebrew unprefixed and prefixes Arabic and English", () => {
    expect(href("he")).toBe("/");
    expect(href("ar")).toBe("/ar");
    expect(href("en", paths.kind("haifa", "beauty", "barbershops"))).toBe(
      "/en/haifa/beauty/barbershops",
    );
    expect(href("he", paths.nationalKind("barbershops"))).toBe("/k/barbershops");
    expect(href("ar", paths.placeKind("haifa", "barbershops"))).toBe("/ar/haifa/k/barbershops");
  });
});

describe("languageAlternates", () => {
  it("points every locale and x-default at the same path", () => {
    expect(languageAlternates(paths.place("haifa"))).toEqual({
      he: "/haifa",
      ar: "/ar/haifa",
      en: "/en/haifa",
      "x-default": "/haifa",
    });
  });
});
```

`apps/web/src/lib/metadata.test.ts`:

```ts
import { expect, it } from "vitest";
import { pageMetadata } from "./metadata";

it("builds title, canonical, alternates and Open Graph for a locale", () => {
  const meta = pageMetadata({
    locale: "ar",
    segments: ["haifa"],
    title: "حيفا",
    description: "وصف",
  });
  expect(meta.title).toBe("حيفا · درب");
  expect(meta.alternates?.canonical).toBe("/ar/haifa");
  expect(meta.alternates?.languages).toEqual({
    he: "/haifa",
    ar: "/ar/haifa",
    en: "/en/haifa",
    "x-default": "/haifa",
  });
  expect(meta.openGraph).toMatchObject({ url: "/ar/haifa", locale: "ar_IL" });
  expect(JSON.stringify(meta.openGraph)).toContain("/brand/og-he.jpg");
});

it("uses the English share image for English and no suffix for the brand itself", () => {
  const meta = pageMetadata({ locale: "en", segments: [], title: "Darb", description: "d" });
  expect(meta.title).toBe("Darb");
  expect(JSON.stringify(meta.openGraph)).toContain("/brand/og-en.jpg");
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — the three modules do not exist.

- [ ] **Step 2: Implement** 

`apps/web/src/lib/locale-path.ts`:

```ts
export type LocaleRoute =
  | { action: "next" }
  | { action: "rewrite"; pathname: string }
  | { action: "redirect"; pathname: string };

const PREFIXED = new Set(["ar", "en"]);

/** Hebrew is served unprefixed; `[locale]` is internal. */
export function routeLocale(pathname: string): LocaleRoute {
  const first = pathname.split("/")[1] ?? "";
  if (first === "he") {
    const rest = pathname.slice(3);
    return { action: "redirect", pathname: rest === "" ? "/" : rest };
  }
  if (PREFIXED.has(first)) return { action: "next" };
  return { action: "rewrite", pathname: pathname === "/" ? "/he" : `/he${pathname}` };
}
```

`apps/web/src/proxy.ts`:

```ts
import { NextResponse, type NextRequest } from "next/server";
import { routeLocale } from "./lib/locale-path";

export function proxy(request: NextRequest) {
  const route = routeLocale(request.nextUrl.pathname);
  if (route.action === "next") return NextResponse.next();
  const url = request.nextUrl.clone();
  url.pathname = route.pathname;
  return route.action === "redirect"
    ? NextResponse.redirect(url, 308)
    : NextResponse.rewrite(url);
}

export const config = {
  // Route handlers, Next internals, brand files and anything with a file extension skip the proxy.
  matcher: ["/((?!api/|_next/|brand/|.*\\..*).*)"],
};
```

`apps/web/src/lib/routes.ts`:

```ts
import { LOCALES, type Locale } from "@darb/core";

/** A locale's URL for path segments. Slugs are URL-safe, so they are joined as they are. */
export function href(locale: Locale, segments: readonly string[] = []): string {
  const prefix = locale === "he" ? "" : `/${locale}`;
  if (segments.length === 0) return prefix === "" ? "/" : prefix;
  return `${prefix}/${segments.join("/")}`;
}

export const paths = {
  home: (): string[] => [],
  place: (place: string) => [place],
  sector: (place: string, sector: string) => [place, sector],
  kind: (place: string, sector: string, kind: string) => [place, sector, kind],
  business: (place: string, sector: string, kind: string, business: string) => [
    place,
    sector,
    kind,
    business,
  ],
  nationalKind: (kind: string) => ["k", kind],
  placeKind: (place: string, kind: string) => [place, "k", kind],
  forBusiness: () => ["for-business"],
  search: () => ["search"],
};

export function languageAlternates(segments: readonly string[]): Record<string, string> {
  return {
    ...Object.fromEntries(LOCALES.map((l) => [l, href(l, segments)])),
    "x-default": href("he", segments),
  };
}
```

`apps/web/src/lib/metadata.ts`:

```ts
import type { Metadata } from "next";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { OG_LOCALE } from "./locale";
import { href, languageAlternates } from "./routes";

export interface PageMeta {
  locale: Locale;
  segments: readonly string[];
  title: string;
  description: string;
}

export function pageMetadata({ locale, segments, title, description }: PageMeta): Metadata {
  const brand = t(locale, "appName");
  const fullTitle = title === brand ? brand : `${title} · ${brand}`;
  const url = href(locale, segments);
  // There is no Arabic share image yet; the Hebrew one carries the bilingual wordmark.
  const image = locale === "en" ? "/brand/og-en.jpg" : "/brand/og-he.jpg";
  return {
    title: fullTitle,
    description,
    alternates: { canonical: url, languages: languageAlternates(segments) },
    openGraph: {
      type: "website",
      url,
      title: fullTitle,
      description,
      siteName: brand,
      locale: OG_LOCALE[locale],
      images: [{ url: image, width: 1200, height: 630, alt: brand }],
    },
    twitter: { card: "summary_large_image", title: fullTitle, description, images: [image] },
  };
}
```

Run: `pnpm --filter @darb/web test`
Expected: PASS.

- [ ] **Step 3: Check the proxy end to end**

```bash
pnpm --filter @darb/web build && (pnpm --filter @darb/web start &) && sleep 5
curl -s http://localhost:3000/ | grep -o '<html[^>]*>'
curl -s http://localhost:3000/en | grep -o '<html[^>]*>'
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/he
pkill -f "next start"
```

Expected: `lang="he" dir="rtl"`; `lang="en" dir="ltr"`; `308 http://localhost:3000/`.

- [ ] **Step 4: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): Hebrew at /, Arabic and English prefixed, through proxy.ts"
```

---

### Task 8: Typed API client with ISR tags, and on-demand revalidation

**Files:**
- Create: `apps/web/src/lib/api.ts`, `apps/web/src/lib/api.test.ts`, `apps/web/src/lib/taxonomy.ts`,
  `apps/web/src/lib/taxonomy.test.ts`, `apps/web/src/app/api/revalidate/route.ts`,
  `apps/web/src/app/api/revalidate/route.test.ts`

**Interfaces:**
- Consumes: `contract`, DTO types (Tasks 1–4).
- Produces (all server-side):
  - `class ApiUnavailableError extends Error`
  - `REVALIDATE = { lists: 300, taxonomy: 3600 }`; `tags.taxonomy | places | place(slug) | businesses | business(place, slug)`
  - `getTaxonomy(): Promise<TaxonomyDto>`
  - `getPlace(slug): Promise<PlaceDetailDto | null>`
  - `getPlaces(status?: "live" | "soon"): Promise<PlaceDto[]>`
  - `getKindCounts(placeSlug): Promise<KindCountsDto | null>`
  - `getBusinesses(placeSlug, { kind?, cursor?, limit? }): Promise<BusinessPageDto | null>` (null on 400/404)
  - `getBusiness(placeSlug, slug): Promise<BusinessDetailDto | null>`
  - `getNearestPlacesWithKind(kindSlug, lat, lng, limit, cache?: "cached" | "no-store"): Promise<NearestPlaceDto[] | null>`
  - `getNearestPlace(lat, lng, cache: "cached" | "no-store"): Promise<PlaceDto | null>`
  - `TaxonomyIndex { sectors; sectorBySlug; sectorById; kindBySlug; kindById; doorsBySector }`,
    `indexTaxonomy(t)`, `kindCovers(index, ancestorId, kindId): boolean`,
    `sectorTotals(index, counts): Map<sectorSlug, number>`
  - `POST /api/revalidate` with header `x-revalidate-secret` and body `{ tags: string[] }`

- [ ] **Step 1: Write the failing API client test** — `apps/web/src/lib/api.test.ts`

```ts
// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ApiUnavailableError, getBusinesses, getNearestPlace, getPlace } from "./api";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test/");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const place = {
  id: "p1",
  slug: "haifa",
  type: "city",
  name: { he: "חיפה" },
  status: "live",
  lat: 32.8,
  lng: 35,
  parentId: null,
  ancestors: [],
  children: [],
};

describe("api client", () => {
  it("fetches with an ISR lifetime and cache tags", async () => {
    fetchMock.mockResolvedValue(Response.json(place));
    expect(await getPlace("haifa")).toEqual(place);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/places/haifa");
    expect((init as RequestInit & { next?: unknown }).next).toEqual({
      revalidate: 300,
      tags: ["places", "place:haifa"],
    });
  });
  it("turns a 404 into null", async () => {
    fetchMock.mockResolvedValue(Response.json({ message: "nope" }, { status: 404 }));
    expect(await getPlace("nowhere")).toBeNull();
  });
  it("sends only the query it is given", async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [], nextCursor: null }));
    await getBusinesses("sakhnin", { kind: "barbershops" });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "http://api.test/places/sakhnin/businesses?kind=barbershops",
    );
  });
  it("can skip the cache for live lookups", async () => {
    fetchMock.mockResolvedValue(Response.json({ ...place, ancestors: undefined, children: undefined }));
    await getNearestPlace(32.85, 35.33, "no-store");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/nearest-place?lat=32.85&lng=35.33");
    expect((init as RequestInit).cache).toBe("no-store");
  });
  it("reports an unreachable or failing API as ApiUnavailableError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getPlace("haifa")).rejects.toBeInstanceOf(ApiUnavailableError);
    fetchMock.mockResolvedValue(Response.json({ message: "boom" }, { status: 500 }));
    await expect(getPlace("haifa")).rejects.toBeInstanceOf(ApiUnavailableError);
  });
});
```

`apps/web/src/lib/taxonomy.test.ts`:

```ts
import type { TaxonomyDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { indexTaxonomy, kindCovers, sectorTotals } from "./taxonomy";

const kind = (id: string, slug: string, sectorId: string, order: number, parentKindId: string | null = null) => ({
  id,
  slug,
  sectorId,
  parentKindId,
  name: { en: slug },
  template: "booking" as const,
  attributes: [],
  icon: null,
  order,
});
const taxonomy: TaxonomyDto = {
  sectors: [
    { id: "s2", slug: "food", name: { en: "Food" }, tagline: { en: "t" }, accent: "#aa7744", order: 2, kinds: [kind("k3", "bakeries", "s2", 1)] },
    {
      id: "s1",
      slug: "beauty",
      name: { en: "Beauty" },
      tagline: { en: "t" },
      accent: "#aa7744",
      order: 1,
      kinds: [kind("k2", "salons", "s1", 2), kind("k1", "barbershops", "s1", 1), kind("k4", "kids-cuts", "s1", 3, "k1")],
    },
  ],
};

describe("indexTaxonomy", () => {
  const index = indexTaxonomy(taxonomy);
  it("orders sectors and their top-level doors", () => {
    expect(index.sectors.map((s) => s.slug)).toEqual(["beauty", "food"]);
    expect(index.doorsBySector.get("s1")!.map((k) => k.slug)).toEqual(["barbershops", "salons"]);
  });
  it("looks kinds and sectors up by slug and id", () => {
    expect(index.kindBySlug.get("kids-cuts")?.id).toBe("k4");
    expect(index.sectorById.get("s2")?.slug).toBe("food");
  });
  it("knows which kinds a kind covers", () => {
    expect(kindCovers(index, "k1", "k4")).toBe(true);
    expect(kindCovers(index, "k1", "k1")).toBe(true);
    expect(kindCovers(index, "k4", "k1")).toBe(false);
    expect(kindCovers(index, "k1", "unknown")).toBe(false);
  });
  it("sums door counts per sector without double counting sub-kinds", () => {
    const totals = sectorTotals(index, { barbershops: 3, "kids-cuts": 1, salons: 2 });
    expect(totals.get("beauty")).toBe(5);
    expect(totals.get("food")).toBe(0);
  });
});
```

`apps/web/src/app/api/revalidate/route.test.ts`:

```ts
// @vitest-environment node
import { afterEach, beforeEach, expect, it, vi } from "vitest";

const revalidateTag = vi.fn();
vi.mock("next/cache", () => ({ revalidateTag }));
const { POST } = await import("./route");

beforeEach(() => vi.stubEnv("REVALIDATE_SECRET", "s3cret"));
afterEach(() => {
  vi.unstubAllEnvs();
  revalidateTag.mockReset();
});

const post = (body: unknown, secret?: string) =>
  POST(
    new Request("http://web.test/api/revalidate", {
      method: "POST",
      headers: { "content-type": "application/json", ...(secret ? { "x-revalidate-secret": secret } : {}) },
      body: JSON.stringify(body),
    }),
  );

it("revalidates each tag with the max profile", async () => {
  const res = await post({ tags: ["places", "place:haifa"] }, "s3cret");
  expect(res.status).toBe(200);
  expect(revalidateTag.mock.calls).toEqual([
    ["places", "max"],
    ["place:haifa", "max"],
  ]);
});

it("refuses a wrong secret and a bad body", async () => {
  expect((await post({ tags: ["places"] }, "wrong")).status).toBe(401);
  expect((await post({ nope: true }, "s3cret")).status).toBe(400);
  expect(revalidateTag).not.toHaveBeenCalled();
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./api`, `./taxonomy` and `./route` do not exist.

- [ ] **Step 2: Implement the client** — `apps/web/src/lib/api.ts`

```ts
import {
  contract,
  type BusinessDetailDto,
  type BusinessPageDto,
  type KindCountsDto,
  type NearestPlaceDto,
  type PlaceDetailDto,
  type PlaceDto,
  type TaxonomyDto,
} from "@darb/contracts";
import { initClient, type ApiFetcher } from "@ts-rest/core";

/** The API could not be reached or answered with an error it should never give. */
export class ApiUnavailableError extends Error {
  constructor(cause: unknown) {
    super("The Darb API is unavailable", { cause });
    this.name = "ApiUnavailableError";
  }
}

export const REVALIDATE = { lists: 300, taxonomy: 3600 } as const;

export const tags = {
  taxonomy: "taxonomy",
  places: "places",
  place: (slug: string) => `place:${slug}`,
  businesses: "businesses",
  business: (place: string, slug: string) => `business:${place}/${slug}`,
};

type Cache = "no-store" | { revalidate: number; tags: string[] };
const cached = (revalidate: number, ...list: string[]): Cache => ({ revalidate, tags: list });
const fetchOptions = (cache: Cache) =>
  cache === "no-store"
    ? { cache: "no-store" as const }
    : { next: { revalidate: cache.revalidate, tags: cache.tags } };

/** Passes Next's `next` and `cache` options straight to fetch. */
const fetcher: ApiFetcher = async ({ path, method, headers, body, fetchOptions: options }) => {
  const res = await fetch(path, { ...options, method, headers, body });
  const type = res.headers.get("content-type") ?? "";
  return {
    status: res.status,
    body: type.includes("json") ? await res.json() : await res.text(),
    headers: res.headers,
  };
};

function apiBaseUrl(): string {
  const url = process.env.API_URL;
  if (!url) throw new ApiUnavailableError(new Error("API_URL is not set (see apps/web/.env.example)"));
  return url.replace(/\/+$/, "");
}

const client = () =>
  initClient(contract, { baseUrl: apiBaseUrl(), api: fetcher, throwOnUnknownStatus: true });

async function call<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run();
  } catch (error) {
    throw error instanceof ApiUnavailableError ? error : new ApiUnavailableError(error);
  }
}

export async function getTaxonomy(): Promise<TaxonomyDto> {
  const res = await call(() =>
    client().taxonomy.get({ fetchOptions: fetchOptions(cached(REVALIDATE.taxonomy, tags.taxonomy)) }),
  );
  if (res.status === 200) return res.body;
  throw new ApiUnavailableError(res);
}

export async function getPlace(slug: string): Promise<PlaceDetailDto | null> {
  const res = await call(() =>
    client().places.get({
      params: { slug },
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.places, tags.place(slug))),
    }),
  );
  return res.status === 200 ? res.body : null;
}

export async function getPlaces(status?: "live" | "soon"): Promise<PlaceDto[]> {
  const res = await call(() =>
    client().places.list({
      query: status ? { status } : {},
      fetchOptions: fetchOptions(cached(REVALIDATE.taxonomy, tags.places)),
    }),
  );
  if (res.status === 200) return res.body;
  throw new ApiUnavailableError(res);
}

export async function getKindCounts(placeSlug: string): Promise<KindCountsDto | null> {
  const res = await call(() =>
    client().businesses.kindCounts({
      params: { placeSlug },
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses, tags.place(placeSlug))),
    }),
  );
  return res.status === 200 ? res.body : null;
}

export async function getBusinesses(
  placeSlug: string,
  options: { kind?: string; cursor?: string; limit?: number } = {},
): Promise<BusinessPageDto | null> {
  const query = {
    ...(options.kind ? { kind: options.kind } : {}),
    ...(options.cursor ? { cursor: options.cursor } : {}),
    ...(options.limit ? { limit: options.limit } : {}),
  };
  const res = await call(() =>
    client().businesses.list({
      params: { placeSlug },
      query,
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses)),
    }),
  );
  return res.status === 200 ? res.body : null;
}

export async function getBusiness(placeSlug: string, slug: string): Promise<BusinessDetailDto | null> {
  const res = await call(() =>
    client().businesses.get({
      params: { placeSlug, slug },
      fetchOptions: fetchOptions(
        cached(REVALIDATE.lists, tags.businesses, tags.business(placeSlug, slug)),
      ),
    }),
  );
  return res.status === 200 ? res.body : null;
}

export async function getNearestPlacesWithKind(
  kindSlug: string,
  lat: number,
  lng: number,
  limit: number,
  cache: "cached" | "no-store" = "cached",
): Promise<NearestPlaceDto[] | null> {
  const res = await call(() =>
    client().businesses.nearestPlaces({
      params: { kindSlug },
      query: { lat, lng, limit },
      fetchOptions: fetchOptions(
        cache === "no-store" ? "no-store" : cached(REVALIDATE.lists, tags.businesses),
      ),
    }),
  );
  return res.status === 200 ? res.body : null;
}

/** "no-store" for a person's live position (never cached); "cached" for a place's own point. */
export async function getNearestPlace(
  lat: number,
  lng: number,
  cache: "cached" | "no-store",
): Promise<PlaceDto | null> {
  const res = await call(() =>
    client().places.nearest({
      query: { lat, lng },
      fetchOptions: fetchOptions(cache === "no-store" ? "no-store" : cached(REVALIDATE.taxonomy, tags.places)),
    }),
  );
  return res.status === 200 ? res.body : null;
}
```

`next: { revalidate, tags }` type-checks because Next augments the global `RequestInit` (through
`next-env.d.ts`). If the `fetchOptions` argument does not type-check, cast the object with
`as RequestInit` at the `fetchOptions(...)` helper's return.

- [ ] **Step 3: Implement the taxonomy index** — `apps/web/src/lib/taxonomy.ts`

```ts
import type { KindDto, SectorDto, TaxonomyDto } from "@darb/contracts";

export interface TaxonomyIndex {
  /** Ordered. */
  sectors: TaxonomyDto["sectors"];
  sectorBySlug: Map<string, SectorDto>;
  sectorById: Map<string, SectorDto>;
  kindBySlug: Map<string, KindDto>;
  kindById: Map<string, KindDto>;
  /** Each sector's top-level kinds (no parent), ordered: one door each. */
  doorsBySector: Map<string, KindDto[]>;
}

export function indexTaxonomy(taxonomy: TaxonomyDto): TaxonomyIndex {
  const sectors = [...taxonomy.sectors].sort((a, b) => a.order - b.order);
  const kinds = sectors.flatMap((s) => s.kinds);
  return {
    sectors,
    sectorBySlug: new Map(sectors.map((s) => [s.slug, s])),
    sectorById: new Map(sectors.map((s) => [s.id, s])),
    kindBySlug: new Map(kinds.map((k) => [k.slug, k])),
    kindById: new Map(kinds.map((k) => [k.id, k])),
    doorsBySector: new Map(
      sectors.map((s) => [
        s.id,
        s.kinds.filter((k) => k.parentKindId === null).sort((a, b) => a.order - b.order),
      ]),
    ),
  };
}

/** True when `kindId` is `ancestorId` or one of its sub-kinds. */
export function kindCovers(index: TaxonomyIndex, ancestorId: string, kindId: string): boolean {
  let current = index.kindById.get(kindId);
  for (let depth = 0; current && depth < 16; depth++) {
    if (current.id === ancestorId) return true;
    current = current.parentKindId ? index.kindById.get(current.parentKindId) : undefined;
  }
  return false;
}

/** Businesses behind each sector's doors. Door counts already include sub-kinds. */
export function sectorTotals(index: TaxonomyIndex, counts: Record<string, number>): Map<string, number> {
  return new Map(
    index.sectors.map((s) => [
      s.slug,
      (index.doorsBySector.get(s.id) ?? []).reduce((sum, k) => sum + (counts[k.slug] ?? 0), 0),
    ]),
  );
}
```

- [ ] **Step 4: On-demand revalidation** — `apps/web/src/app/api/revalidate/route.ts`

```ts
import { revalidateTag } from "next/cache";
import { z } from "zod";

const Body = z.object({ tags: z.array(z.string().min(1).max(256)).min(1).max(64) });

/** The API calls this after a write (spec §6.2) so cached pages refresh without waiting. */
export async function POST(request: Request): Promise<Response> {
  const secret = process.env.REVALIDATE_SECRET;
  if (!secret || request.headers.get("x-revalidate-secret") !== secret) {
    return Response.json({ message: "Unauthorized" }, { status: 401 });
  }
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ message: "Expected { tags: string[] }" }, { status: 400 });
  for (const tag of parsed.data.tags) revalidateTag(tag, "max");
  return Response.json({ revalidated: parsed.data.tags });
}
```

- [ ] **Step 5: Run the tests**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS; typecheck clean.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): typed API client with ISR tags and on-demand revalidation"
```

---

### Task 9: Locale formatting and safe links

**Files:**
- Create: `apps/web/src/lib/format.ts`, `apps/web/src/lib/format.test.ts`,
  `apps/web/src/lib/links.ts`, `apps/web/src/lib/links.test.ts`,
  `apps/web/src/lib/contrast.ts`, `apps/web/src/lib/contrast.test.ts`

**Interfaces:**
- Consumes: `INTL_TAG` (Task 6), `t`, `pickText`, `Tier`.
- Produces:
  - `formatNumber(value, locale, maximumFractionDigits = 0): string`; `formatKm(km, locale): string`
  - `formatPhone(phone): string` (Israeli local format, e.g. `050-123-4567`)
  - `weekdayNames(locale): string[]` (Sunday first)
  - `HoursRow { day: number; name: string; text: string; closed: boolean; today: boolean }`;
    `hoursRows(hours, locale, at = new Date()): HoursRow[]`; `hasHours(hours): boolean`
  - `safeHttpUrl(value): string | null`; `telHref(phone): string | null`;
    `whatsappHref(phone, text): string | null`; `directionsHref(lat, lng): string`
  - `PrimaryAction = { kind: "whatsapp" | "call"; href: string } | { kind: "example" } | { kind: "none" }`;
    `primaryAction({ whatsapp, phone, tier, name }, locale): PrimaryAction`
  - `contrastRatio(a, b): number`; `readableOn(background): "#000000" | "#ffffff"`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/format.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { formatKm, formatNumber, formatPhone, hasHours, hoursRows, weekdayNames } from "./format";

describe("numbers", () => {
  it("groups digits and writes Arabic with Latin digits", () => {
    expect(formatNumber(1234, "ar")).toBe("1,234");
    expect(formatNumber(1234, "he")).toBe("1,234");
  });
  it("writes distances with one decimal under 10 km", () => {
    expect(formatKm(9.76, "en")).toBe("9.8 km");
    expect(formatKm(23.4, "he")).toBe("23 ק״מ");
    expect(formatKm(3.21, "ar")).toBe("3.2 كم");
  });
});

describe("phones", () => {
  it("writes Israeli numbers the local way", () => {
    expect(formatPhone("+972501234567")).toBe("050-123-4567");
    expect(formatPhone("0501234567")).toBe("050-123-4567");
    expect(formatPhone("+97246012345")).toBe("04-601-2345");
  });
  it("leaves anything else alone", () => {
    expect(formatPhone("*2700")).toBe("*2700");
  });
});

describe("hours", () => {
  const hours = {
    weekly: { "0": [{ open: "09:00", close: "19:00" }], "5": [{ open: "09:00", close: "14:00" }] },
  };
  it("names the week from Sunday in each language", () => {
    expect(weekdayNames("en")[0]).toBe("Sunday");
    expect(weekdayNames("he")[6]).toBe("יום שבת");
    expect(weekdayNames("ar")[5]).toBe("الجمعة");
  });
  it("lists every day, closed days included, and marks today in Israel", () => {
    const rows = hoursRows(hours, "en", new Date("2026-10-16T08:00:00Z")); // Friday in Israel
    expect(rows).toHaveLength(7);
    expect(rows[0]).toMatchObject({ name: "Sunday", text: "09:00–19:00", closed: false, today: false });
    expect(rows[1]).toMatchObject({ text: "Closed", closed: true });
    expect(rows[5]).toMatchObject({ text: "09:00–14:00", today: true });
  });
  it("knows when there are no hours at all", () => {
    expect(hasHours({ weekly: {} })).toBe(false);
    expect(hasHours(hours)).toBe(true);
  });
});
```

`apps/web/src/lib/links.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { directionsHref, primaryAction, safeHttpUrl, telHref, whatsappHref } from "./links";

describe("safeHttpUrl", () => {
  it("keeps http and https", () => {
    expect(safeHttpUrl("https://caramel.darb.co.il")).toBe("https://caramel.darb.co.il/");
    expect(safeHttpUrl("http://example.com/a")).toBe("http://example.com/a");
  });
  it("drops every other scheme and garbage", () => {
    for (const bad of ["javascript:alert(1)", "data:text/html,x", "ftp://x.y", "itms-apps://x", "not a url", "", null, undefined])
      expect(safeHttpUrl(bad)).toBeNull();
  });
});

describe("contact links", () => {
  it("dials and messages in international form", () => {
    expect(telHref("050-123-4567")).toBe("tel:+972501234567");
    expect(whatsappHref("+972 50 123 4567", "Hi there")).toBe("https://wa.me/972501234567?text=Hi%20there");
    expect(telHref("12")).toBeNull();
  });
  it("routes directions to the business point", () => {
    expect(directionsHref(32.86, 35.3)).toBe(
      "https://www.google.com/maps/dir/?api=1&destination=32.86,35.3",
    );
  });
});

describe("primaryAction", () => {
  const name = { he: "סאמר", en: "Samer" };
  it("prefers WhatsApp with a prefilled greeting", () => {
    const action = primaryAction({ whatsapp: "0501234567", phone: "0501234567", tier: "basic", name }, "en");
    expect(action).toEqual({
      kind: "whatsapp",
      href: "https://wa.me/972501234567?text=Hello%20Samer%2C%20I%20found%20you%20on%20Darb.",
    });
  });
  it("falls back to a call", () => {
    expect(primaryAction({ whatsapp: null, phone: "04-601-2345", tier: "basic", name }, "he")).toEqual({
      kind: "call",
      href: "tel:+97246012345",
    });
  });
  it("explains an example business with no contact, and offers nothing for a real one", () => {
    expect(primaryAction({ whatsapp: null, phone: null, tier: "example", name }, "ar")).toEqual({ kind: "example" });
    expect(primaryAction({ whatsapp: null, phone: null, tier: "verified", name }, "ar")).toEqual({ kind: "none" });
  });
});
```

`apps/web/src/lib/contrast.test.ts`:

```ts
import { expect, it } from "vitest";
import { contrastRatio, readableOn } from "./contrast";

it("measures WCAG contrast", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  expect(contrastRatio("#fbf7ec", "#03110c")).toBeGreaterThan(17);
});

it("picks black or white text for an accent", () => {
  expect(readableOn("#ffd25a")).toBe("#000000");
  expect(readableOn("#1d5a43")).toBe("#ffffff");
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — modules missing.

- [ ] **Step 2: Implement** 

`apps/web/src/lib/format.ts`:

```ts
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { INTL_TAG } from "./locale";

export function formatNumber(value: number, locale: Locale, maximumFractionDigits = 0): string {
  return new Intl.NumberFormat(INTL_TAG[locale], { maximumFractionDigits }).format(value);
}

export function formatKm(km: number, locale: Locale): string {
  return t(locale, "distanceKm", { km: formatNumber(km, locale, km < 10 ? 1 : 0) });
}

/** Israeli numbers in local form; anything else unchanged. Render inside `dir="ltr"`. */
export function formatPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const local = digits.startsWith("972") ? `0${digits.slice(3)}` : digits;
  if (/^05\d{8}$/.test(local)) return `${local.slice(0, 3)}-${local.slice(3, 6)}-${local.slice(6)}`;
  if (/^0[2-9]\d{7}$/.test(local)) return `${local.slice(0, 2)}-${local.slice(2, 5)}-${local.slice(5)}`;
  return phone;
}

export function weekdayNames(locale: Locale): string[] {
  const format = new Intl.DateTimeFormat(INTL_TAG[locale], { weekday: "long", timeZone: "UTC" });
  // 2026-10-11 is a Sunday.
  return [0, 1, 2, 3, 4, 5, 6].map((d) => format.format(new Date(Date.UTC(2026, 9, 11 + d))));
}

type WeeklyHours = { weekly: Partial<Record<string, { open: string; close: string }[]>> };

export interface HoursRow {
  day: number;
  name: string;
  /** "09:00–19:00, 20:00–23:00" (render inside dir="ltr") or the localized "Closed". */
  text: string;
  closed: boolean;
  today: boolean;
}

const ISRAEL_WEEKDAY = new Intl.DateTimeFormat("en-US", { timeZone: "Asia/Jerusalem", weekday: "short" });
const DAY_INDEX: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function hoursRows(hours: WeeklyHours, locale: Locale, at: Date = new Date()): HoursRow[] {
  const today = DAY_INDEX[ISRAEL_WEEKDAY.format(at)];
  return weekdayNames(locale).map((name, day) => {
    const intervals = hours.weekly[String(day)] ?? [];
    const closed = intervals.length === 0;
    return {
      day,
      name,
      closed,
      today: day === today,
      text: closed ? t(locale, "closed") : intervals.map((i) => `${i.open}–${i.close}`).join(", "),
    };
  });
}

export function hasHours(hours: WeeklyHours): boolean {
  return Object.values(hours.weekly).some((intervals) => (intervals?.length ?? 0) > 0);
}
```

`apps/web/src/lib/links.ts`:

```ts
import { pickText, type Locale, type Localized, type Tier } from "@darb/core";
import { t } from "@darb/i18n";

/** Only http(s) URLs are ever rendered as links (closes the Plan 1 `apps.*` scheme finding). */
export function safeHttpUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

/** 972XXXXXXXXX, or null when the number is too short to dial. */
function internationalDigits(phone: string): string | null {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 9) return null;
  if (digits.startsWith("972")) return digits;
  return digits.startsWith("0") ? `972${digits.slice(1)}` : digits;
}

export function telHref(phone: string): string | null {
  const digits = internationalDigits(phone);
  return digits ? `tel:+${digits}` : null;
}

export function whatsappHref(phone: string, text: string): string | null {
  const digits = internationalDigits(phone);
  return digits ? `https://wa.me/${digits}?text=${encodeURIComponent(text)}` : null;
}

export function directionsHref(lat: number, lng: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
}

export type PrimaryAction =
  | { kind: "whatsapp"; href: string }
  | { kind: "call"; href: string }
  | { kind: "example" }
  | { kind: "none" };

export function primaryAction(
  business: { whatsapp: string | null; phone: string | null; tier: Tier; name: Localized },
  locale: Locale,
): PrimaryAction {
  const greeting = t(locale, "whatsappGreeting", { name: pickText(business.name, locale) });
  const whatsapp = business.whatsapp ? whatsappHref(business.whatsapp, greeting) : null;
  if (whatsapp) return { kind: "whatsapp", href: whatsapp };
  const call = business.phone ? telHref(business.phone) : null;
  if (call) return { kind: "call", href: call };
  return business.tier === "example" ? { kind: "example" } : { kind: "none" };
}
```

`apps/web/src/lib/contrast.ts`:

```ts
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrastRatio(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

/** Black or white, whichever reads better on the background. */
export function readableOn(background: string): "#000000" | "#ffffff" {
  return contrastRatio("#000000", background) >= contrastRatio("#ffffff", background)
    ? "#000000"
    : "#ffffff";
}
```

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @darb/web test`
Expected: PASS. If Node's ICU writes the Arabic distance with directional marks, assert with
`.replace(/[‎‏؜]/g, "")` on the result rather than changing the format.

- [ ] **Step 4: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/lib
git commit -m "feat(web): locale-aware numbers, phones and hours; http(s)-only links"
```

---
### Task 10: City frame: header, search bar, path bar, locale switch and doors

**Files:**
- Create: `apps/web/src/lib/crumbs.ts`, `apps/web/src/lib/crumbs.test.ts`,
  `apps/web/src/components/BrandMark.tsx`, `Header.tsx`, `Header.module.css`, `SearchBar.tsx`,
  `SearchBar.module.css`, `CityBar.tsx`, `CityBar.module.css`, `CityBar.test.tsx`, `Door.tsx`,
  `Door.module.css`, `Badges.tsx`, `Badges.module.css` (all under `apps/web/src/components/` except the lib files)
- Modify: `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/page.tsx`

**Interfaces:**
- Consumes: `href`, `paths` (Task 7), `t`, `pickText`, `DOOR_PATH`, `DOOR_CLIP_PATH`, `colors`, DTO types.
- Produces:
  - `Crumb { label: string; href: string }`;
    `crumbsFor(locale, at: { place?: PlaceDetailDto; sector?: SectorDto; kind?: KindDto; business?: { slug: string; name: Localized }; nationalKind?: KindDto; page?: Crumb }): Crumb[]`
    (Israel first; regions and the country are skipped as ancestors; `page` appends a static page crumb)
  - `<Header locale nearMe? />` (`id="site-header"`, `data-site-header`), `<BrandMark locale />`,
    `<SearchBar locale nearMe? />` (`data-search-bar`; GET form to `/search`)
  - `<CityBar locale crumbs segments />` (`id="city-bar"`), `<PathBar locale crumbs />` (`data-path-bar`,
    up link `data-up`, mirrored icons `.flip`), `<LocaleSwitch locale segments />` (`data-locale-switch`,
    links carry `hreflang`)
  - `<DoorDefs />` (renders `#darb-door-clip`, once per page), `<DoorRim className? />`,
    `<DoorGrid label>`, `<Door slug href label sublabel? count countText countLabel accent? />`
    (`data-door={slug}`, `data-count={count}`, `data-empty` when 0)
  - `<ExampleBadge label />` (`data-example-badge`), `<OpenState openNow labels={{ open, closed }} />`

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/crumbs.test.ts`:

```ts
import type { KindDto, PlaceDetailDto, SectorDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { crumbsFor } from "./crumbs";

const placeDto = (slug: string, type: PlaceDetailDto["type"], name: string) => ({
  id: slug,
  slug,
  type,
  name: { en: name, he: name },
  status: "live" as const,
  lat: 32,
  lng: 35,
  parentId: null,
});
const kiryatHaim: PlaceDetailDto = {
  ...placeDto("kiryat-haim", "neighbourhood", "Kiryat Haim"),
  ancestors: [
    placeDto("israel", "country", "Israel"),
    placeDto("haifa-district", "region", "Haifa District"),
    placeDto("haifa", "city", "Haifa"),
  ],
  children: [],
};
const beauty = { id: "s1", slug: "beauty", name: { en: "Beauty Row" } } as SectorDto;
const barbers = { id: "k1", slug: "barbershops", name: { en: "Barbershops" } } as KindDto;

describe("crumbsFor", () => {
  it("starts at Israel and skips the country and regions", () => {
    expect(crumbsFor("en", { place: kiryatHaim, sector: beauty, kind: barbers })).toEqual([
      { label: "Israel", href: "/en" },
      { label: "Haifa", href: "/en/haifa" },
      { label: "Kiryat Haim", href: "/en/kiryat-haim" },
      { label: "Beauty Row", href: "/en/kiryat-haim/beauty" },
      { label: "Barbershops", href: "/en/kiryat-haim/beauty/barbershops" },
    ]);
  });
  it("ends with the business when there is one", () => {
    const crumbs = crumbsFor("he", {
      place: kiryatHaim,
      sector: beauty,
      kind: barbers,
      business: { slug: "samers-barbershop", name: { en: "Samer's" } },
    });
    expect(crumbs.at(-1)).toEqual({
      label: "Samer's",
      href: "/kiryat-haim/beauty/barbershops/samers-barbershop",
    });
  });
  it("goes straight from Israel to a national kind or a static page", () => {
    expect(crumbsFor("ar", { nationalKind: barbers })).toEqual([
      { label: "إسرائيل", href: "/ar" },
      { label: "Barbershops", href: "/ar/k/barbershops" },
    ]);
    expect(crumbsFor("en", { page: { label: "For businesses", href: "/en/for-business" } })).toHaveLength(2);
  });
});
```

`apps/web/src/components/CityBar.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { LocaleSwitch, PathBar } from "./CityBar";

const crumbs = [
  { label: "Israel", href: "/en" },
  { label: "Sakhnin", href: "/en/sakhnin" },
  { label: "Beauty Row", href: "/en/sakhnin/beauty" },
];

it("marks the current crumb and links up one level", () => {
  const { container } = render(<PathBar locale="en" crumbs={crumbs} />);
  expect(screen.getByText("Beauty Row").getAttribute("aria-current")).toBe("page");
  expect(container.querySelector("[data-up]")?.getAttribute("href")).toBe("/en/sakhnin");
  expect(screen.getByRole("navigation", { name: "You are here" })).toBeTruthy();
});

it("has no up link at the top level", () => {
  const { container } = render(<PathBar locale="en" crumbs={crumbs.slice(0, 1)} />);
  expect(container.querySelector("[data-up]")).toBeNull();
});

it("keeps the path when switching language", () => {
  const { container } = render(<LocaleSwitch locale="ar" segments={["sakhnin", "beauty"]} />);
  const links = [...container.querySelectorAll("a")].map((a) => [a.getAttribute("hreflang"), a.getAttribute("href")]);
  expect(links).toEqual([
    ["he", "/sakhnin/beauty"],
    ["ar", "/ar/sakhnin/beauty"],
    ["en", "/en/sakhnin/beauty"],
  ]);
  expect(container.querySelector('[hreflang="ar"]')?.getAttribute("aria-current")).toBe("true");
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./crumbs` and `./CityBar` missing.

- [ ] **Step 2: Crumbs** — `apps/web/src/lib/crumbs.ts`

```ts
import { pickText, type Locale, type Localized } from "@darb/core";
import type { KindDto, PlaceDetailDto, SectorDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { href, paths } from "./routes";

export interface Crumb {
  label: string;
  href: string;
}

export interface CrumbTarget {
  place?: PlaceDetailDto;
  sector?: SectorDto;
  kind?: KindDto;
  business?: { slug: string; name: Localized };
  nationalKind?: KindDto;
  page?: Crumb;
}

/** Israel ▸ (parent city) ▸ place ▸ sector ▸ kind ▸ business. Regions are not steps people take. */
export function crumbsFor(locale: Locale, at: CrumbTarget): Crumb[] {
  const crumbs: Crumb[] = [{ label: t(locale, "country"), href: href(locale) }];
  if (at.page) return [...crumbs, at.page];
  if (at.nationalKind) {
    crumbs.push({
      label: pickText(at.nationalKind.name, locale),
      href: href(locale, paths.nationalKind(at.nationalKind.slug)),
    });
    return crumbs;
  }
  const { place, sector, kind, business } = at;
  if (!place) return crumbs;
  for (const a of place.ancestors) {
    if (a.type === "country" || a.type === "region") continue;
    crumbs.push({ label: pickText(a.name, locale), href: href(locale, paths.place(a.slug)) });
  }
  if (place.type !== "country") {
    crumbs.push({ label: pickText(place.name, locale), href: href(locale, paths.place(place.slug)) });
  }
  if (!sector) return crumbs;
  crumbs.push({
    label: pickText(sector.name, locale),
    href: href(locale, paths.sector(place.slug, sector.slug)),
  });
  if (!kind) return crumbs;
  const kindPath = paths.kind(place.slug, sector.slug, kind.slug);
  crumbs.push({ label: pickText(kind.name, locale), href: href(locale, kindPath) });
  if (business) {
    crumbs.push({ label: pickText(business.name, locale), href: href(locale, [...kindPath, business.slug]) });
  }
  return crumbs;
}
```

- [ ] **Step 3: Path bar and locale switch** — `apps/web/src/components/CityBar.tsx`

```tsx
import Link from "next/link";
import { LOCALES, type Locale } from "@darb/core";
import { t } from "@darb/i18n";
import type { Crumb } from "@/lib/crumbs";
import { href } from "@/lib/routes";
import styles from "./CityBar.module.css";

const LANGUAGE_NAMES: Record<Locale, string> = { he: "עברית", ar: "العربية", en: "English" };

export function LocaleSwitch({ locale, segments }: { locale: Locale; segments: readonly string[] }) {
  return (
    <nav aria-label={t(locale, "language")} className={styles.locales} data-locale-switch="">
      <ul>
        {LOCALES.map((l) => (
          <li key={l}>
            <Link
              href={href(l, segments)}
              hrefLang={l}
              lang={l}
              prefetch={false}
              aria-current={l === locale ? "true" : undefined}
              className={styles.locale}
            >
              {LANGUAGE_NAMES[l]}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** The chevron and arrow point along the reading direction; `.flip` mirrors them in RTL. */
export function PathBar({ locale, crumbs }: { locale: Locale; crumbs: Crumb[] }) {
  const up = crumbs.length > 1 ? crumbs[crumbs.length - 2] : undefined;
  return (
    <nav aria-label={t(locale, "pathBar")} className={styles.path} data-path-bar="">
      {up ? (
        <Link href={up.href} className={styles.up} aria-label={t(locale, "upOneLevel")} data-up="">
          <svg className={styles.flip} viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <path d="M15 6l-6 6 6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </Link>
      ) : null}
      <ol className={styles.crumbs}>
        {crumbs.map((crumb, i) => {
          const last = i === crumbs.length - 1;
          return (
            <li key={crumb.href} className={styles.crumb}>
              {i > 0 ? (
                <svg className={`${styles.chevron} ${styles.flip}`} viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                  <path d="M9 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
              {last ? (
                <span aria-current="page" className={styles.current}>
                  {crumb.label}
                </span>
              ) : (
                <Link href={crumb.href} className={styles.link}>
                  {crumb.label}
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}

export function CityBar({
  locale,
  crumbs,
  segments,
}: {
  locale: Locale;
  crumbs: Crumb[];
  segments: readonly string[];
}) {
  return (
    <div id="city-bar" className={`frame ${styles.bar}`}>
      <PathBar locale={locale} crumbs={crumbs} />
      <LocaleSwitch locale={locale} segments={segments} />
    </div>
  );
}
```

`apps/web/src/components/CityBar.module.css`:

```css
.bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-2) var(--space-4);
  padding-block: var(--space-3);
}

.path {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  min-inline-size: 0;
  flex: 1 1 20rem;
}

.up {
  flex: none;
  display: grid;
  place-items: center;
  inline-size: var(--tap);
  block-size: var(--tap);
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  color: var(--gold-300);
}

.crumbs {
  display: flex;
  align-items: center;
  margin: 0;
  padding: 0;
  list-style: none;
  overflow-x: auto;
  scrollbar-width: none;
  white-space: nowrap;
}

.crumb {
  display: inline-flex;
  align-items: center;
}

.chevron {
  color: var(--text-muted);
  margin-inline: var(--space-1);
}

.link,
.current {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--tap);
  padding-inline: var(--space-2);
}

.link {
  color: var(--text-soft);
  text-decoration: none;
}

.link:hover {
  color: var(--text);
  text-decoration: underline;
  text-underline-offset: 0.25em;
}

.current {
  color: var(--gold-300);
  font-weight: 700;
}

[dir="rtl"] .flip {
  transform: scaleX(-1);
}

.locales ul {
  display: flex;
  gap: var(--space-1);
  margin: 0;
  padding: 0;
  list-style: none;
}

.locale {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-block-size: var(--tap);
  min-inline-size: var(--tap);
  padding-inline: var(--space-3);
  border-radius: var(--radius-pill);
  color: var(--text-muted);
  text-decoration: none;
  font-size: var(--step--1);
}

.locale[aria-current="true"] {
  color: var(--night);
  background: var(--gold);
  font-weight: 700;
}
```

- [ ] **Step 4: Brand mark, search bar and header**

`apps/web/src/components/BrandMark.tsx`:

```tsx
import Image from "next/image";
import Link from "next/link";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { href } from "@/lib/routes";
import styles from "./Header.module.css";

/** The approved raster mark (never redrawn) and the bilingual wordmark Darb / درب. */
export function BrandMark({ locale }: { locale: Locale }) {
  return (
    <Link href={href(locale)} className={styles.brand} aria-label={t(locale, "appName")}>
      <Image src="/brand/darb-mark-96.webp" alt="" width={36} height={42} unoptimized />
      <span className={styles.wordmark} aria-hidden="true">
        <span lang="en">Darb</span>
        <span className={styles.slash}>/</span>
        <span lang="ar">درب</span>
      </span>
    </Link>
  );
}
```

`apps/web/src/components/SearchBar.tsx`:

```tsx
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { href, paths } from "@/lib/routes";
import styles from "./SearchBar.module.css";

/** Plan 3 wires search. Top bar on desktop, docked at the bottom (thumb reach) on phones. */
export function SearchBar({ locale, nearMe }: { locale: Locale; nearMe?: ReactNode }) {
  return (
    <div className={styles.dock} data-search-bar="">
      <form role="search" action={href(locale, paths.search())} method="get" className={styles.form}>
        <label htmlFor="q" className="visually-hidden">
          {t(locale, "search")}
        </label>
        <input
          id="q"
          name="q"
          type="search"
          placeholder={t(locale, "searchPlaceholder")}
          autoComplete="off"
          enterKeyHint="search"
          className={styles.input}
        />
        <button type="submit" className={styles.submit} aria-label={t(locale, "search")}>
          <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
            <circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" strokeWidth="2" />
            <path d="M16 16l4.5 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </button>
      </form>
      {nearMe}
    </div>
  );
}
```

`apps/web/src/components/SearchBar.module.css`:

```css
.dock {
  flex: 1;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  max-inline-size: 560px;
}

.form {
  flex: 1;
  display: flex;
  align-items: center;
  min-block-size: 48px;
  padding-inline-start: var(--space-4);
  background: var(--surface-2);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
}

.form:focus-within {
  box-shadow: var(--focus-ring);
}

.input {
  flex: 1;
  min-inline-size: 0;
  min-block-size: 46px;
  border: 0;
  background: transparent;
  color: var(--text);
  font: inherit;
}

.input::placeholder {
  color: var(--text-muted);
}

.input:focus-visible {
  box-shadow: none;
}

.submit {
  display: grid;
  place-items: center;
  inline-size: var(--tap);
  block-size: var(--tap);
  border: 0;
  border-radius: var(--radius-pill);
  background: transparent;
  color: var(--gold-300);
  cursor: pointer;
}

@media (max-width: 899px) {
  .dock {
    position: fixed;
    inset-inline: 0;
    inset-block-end: 0;
    z-index: 20;
    max-inline-size: none;
    padding: var(--space-3) var(--gutter) max(var(--space-3), env(safe-area-inset-bottom));
    background: linear-gradient(180deg, transparent 0%, var(--night) 35%);
  }
}
```

`apps/web/src/components/Header.tsx`:

```tsx
import Link from "next/link";
import type { ReactNode } from "react";
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import { href, paths } from "@/lib/routes";
import { BrandMark } from "./BrandMark";
import { SearchBar } from "./SearchBar";
import styles from "./Header.module.css";

export function Header({ locale, nearMe }: { locale: Locale; nearMe?: ReactNode }) {
  return (
    <header id="site-header" className={styles.header} data-site-header="">
      <div className={`frame ${styles.inner}`}>
        <BrandMark locale={locale} />
        <SearchBar locale={locale} nearMe={nearMe} />
        <Link href={href(locale, paths.forBusiness())} className={styles.forBusiness}>
          {t(locale, "forBusiness")}
        </Link>
      </div>
    </header>
  );
}
```

`apps/web/src/components/Header.module.css`:

```css
.header {
  border-block-end: 1px solid var(--line-soft);
  background: rgb(3 17 12 / 0.88);
}

.inner {
  display: flex;
  align-items: center;
  gap: var(--space-4);
  min-block-size: 68px;
}

.brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  min-block-size: var(--tap);
  color: var(--text);
  text-decoration: none;
}

.wordmark {
  font-weight: 700;
  font-size: var(--step-1);
  letter-spacing: 0.02em;
}

.slash {
  color: var(--gold);
  margin-inline: 0.3em;
}

.forBusiness {
  margin-inline-start: auto;
  display: inline-flex;
  align-items: center;
  min-block-size: var(--tap);
  padding-inline: var(--space-4);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  color: var(--gold-300);
  font-weight: 500;
  text-decoration: none;
  white-space: nowrap;
}
```

- [ ] **Step 5: Doors and badges**

`apps/web/src/components/Door.tsx`:

```tsx
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { colors, DOOR_CLIP_PATH, DOOR_PATH } from "@darb/tokens";
import styles from "./Door.module.css";

/** Hidden SVG definitions: `clip-path: url(#darb-door-clip)` and the gold rim gradient. Render once. */
export function DoorDefs() {
  return (
    <svg width="0" height="0" aria-hidden="true" focusable="false" className={styles.defs}>
      <defs>
        <clipPath id="darb-door-clip" clipPathUnits="objectBoundingBox">
          <path d={DOOR_CLIP_PATH} />
        </clipPath>
        <linearGradient id="darb-gold-stroke" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor={colors.gold100} />
          <stop offset="0.45" stopColor={colors.gold} />
          <stop offset="1" stopColor={colors.gold900} />
        </linearGradient>
      </defs>
    </svg>
  );
}

/** A thin gold rim tracing the doorway, scaled to its box. */
export function DoorRim({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 100 150" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <path d={DOOR_PATH} fill="none" stroke="url(#darb-gold-stroke)" strokeWidth={1.25} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export function DoorGrid({ label, children }: { label: string; children: ReactNode }) {
  return (
    <ul className={styles.grid} aria-label={label}>
      {children}
    </ul>
  );
}

export interface DoorProps {
  slug: string;
  href: string;
  label: string;
  sublabel?: string;
  count: number;
  /** The count formatted for the locale. */
  countText: string;
  /** "Businesses: 3" for screen readers. */
  countLabel: string;
  /** A sector accent (warm, desaturated hex). */
  accent?: string;
}

export function Door({ slug, href, label, sublabel, count, countText, countLabel, accent }: DoorProps) {
  const style = accent ? ({ "--door-accent": accent } as CSSProperties) : undefined;
  return (
    <li>
      <Link
        href={href}
        className={styles.door}
        style={style}
        data-door={slug}
        data-count={count}
        data-empty={count === 0 ? "" : undefined}
      >
        <span className={styles.frame} aria-hidden="true">
          <span className={styles.glow} />
          <DoorRim className={styles.rim} />
          <span className={styles.countInFrame}>{countText}</span>
        </span>
        <span className={styles.text}>
          <span className={styles.label}>{label}</span>
          {sublabel ? <span className={styles.sublabel}>{sublabel}</span> : null}
        </span>
        <span className={styles.countInline} aria-hidden="true">
          {countText}
        </span>
        <span className="visually-hidden">{countLabel}</span>
      </Link>
    </li>
  );
}
```

`apps/web/src/components/Door.module.css`:

```css
.defs {
  position: absolute;
  inline-size: 0;
  block-size: 0;
  overflow: hidden;
}

.grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-2) var(--space-3);
  margin: 0 0 var(--space-7);
  padding: 0;
  list-style: none;
}

/* Phone: a compact row per door — small doorway, name, count. */
.door {
  --door-accent: var(--gold);
  display: grid;
  grid-template-columns: 36px minmax(0, 1fr) auto;
  align-items: center;
  gap: var(--space-3);
  min-block-size: 64px;
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-m);
  background: var(--surface-1);
  border: 1px solid var(--line-soft);
  color: var(--text);
  text-decoration: none;
}

.frame {
  position: relative;
  display: grid;
  place-items: center;
  aspect-ratio: 2 / 3;
  inline-size: 100%;
  clip-path: url(#darb-door-clip);
  background: linear-gradient(180deg, var(--forest-800) 0%, var(--forest-950) 70%, var(--night) 100%);
}

.glow {
  position: absolute;
  inset: 0;
  background: radial-gradient(60% 45% at 50% 100%, var(--door-accent) 0%, transparent 72%);
  opacity: 0.5;
  transform: translateY(6%);
  transition: opacity var(--dur) var(--ease-out), transform var(--dur) var(--ease-out);
}

.rim {
  position: absolute;
  inset: 0;
  inline-size: 100%;
  block-size: 100%;
}

.text {
  display: grid;
  gap: 2px;
  min-inline-size: 0;
}

.label {
  font-weight: 700;
  line-height: 1.25;
}

.sublabel {
  color: var(--text-muted);
  font-size: var(--step--1);
  line-height: 1.35;
}

.countInFrame {
  display: none;
}

.countInline {
  color: var(--gold-300);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.door:hover .glow,
.door:focus-visible .glow {
  opacity: 1;
  transform: none;
}

.door[data-empty] .frame {
  background: linear-gradient(180deg, var(--forest-900) 0%, var(--night) 100%);
}

.door[data-empty] .glow {
  opacity: 0.15;
}

.door[data-empty] .countInline,
.door[data-empty] .countInFrame {
  color: var(--text-muted);
}

@media (max-width: 479px) {
  .sublabel {
    display: none;
  }
}

/* Tablet and desktop: tall doorways with the count inside and the name beneath. */
@media (min-width: 900px) {
  .grid {
    grid-template-columns: repeat(auto-fill, minmax(164px, 1fr));
    gap: var(--space-6) var(--space-5);
  }

  .door {
    grid-template-columns: 1fr;
    align-items: start;
    gap: var(--space-3);
    padding: 0;
    background: transparent;
    border: 0;
  }

  .countInFrame {
    display: block;
    position: relative;
    font-size: var(--step-3);
    font-weight: 700;
    color: var(--gold-300);
    font-variant-numeric: tabular-nums;
  }

  .countInline {
    display: none;
  }

  .text {
    padding-inline: var(--space-1);
  }
}
```

`apps/web/src/components/Badges.tsx`:

```tsx
import styles from "./Badges.module.css";

export function ExampleBadge({ label }: { label: string }) {
  return (
    <span className={styles.example} data-example-badge="">
      {label}
    </span>
  );
}

export function OpenState({
  openNow,
  labels,
}: {
  openNow: boolean | null;
  labels: { open: string; closed: string };
}) {
  if (openNow === null) return null;
  return (
    <span className={styles.open} data-open={openNow ? "true" : "false"}>
      <span className={styles.dot} aria-hidden="true" />
      {openNow ? labels.open : labels.closed}
    </span>
  );
}
```

`apps/web/src/components/Badges.module.css`:

```css
.example {
  display: inline-flex;
  align-items: center;
  padding: 2px var(--space-2);
  border: 1px solid var(--gold);
  border-radius: var(--radius-pill);
  color: var(--gold-300);
  font-size: var(--step--1);
  font-weight: 500;
  line-height: 1.4;
}

.open {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: var(--step--1);
  color: var(--text-muted);
}

.open[data-open="true"] {
  color: var(--text);
}

.dot {
  inline-size: 8px;
  block-size: 8px;
  border-radius: 50%;
  background: var(--text-muted);
}

.open[data-open="true"] .dot {
  background: #6fcf97;
}
```

(`#6fcf97` on the forest surfaces is decoration next to text, not text.)

- [ ] **Step 6: Frame the layout** — in `apps/web/src/app/[locale]/layout.tsx`, import `DoorDefs` and
  `Header` and replace `<body>{children}</body>` with:

```tsx
      <body>
        <DoorDefs />
        <a className="skip-link" href="#main">
          {t(locale, "skipToContent")}
        </a>
        <Header locale={locale} />
        {children}
      </body>
```

In the placeholder `apps/web/src/app/[locale]/page.tsx`, render the city bar above `<main>` so it can
be seen (Task 11 replaces this page):

```tsx
    <>
      <CityBar locale={locale} crumbs={crumbsFor(locale, {})} segments={[]} />
      <main id="main" className="frame">
        <h1 className="page-title">{t(locale, "appName")}</h1>
      </main>
    </>
```

(import `CityBar` from `@/components/CityBar` and `crumbsFor` from `@/lib/crumbs`).

- [ ] **Step 7: Run tests and checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS.

- [ ] **Step 8: Visual check** — with `pnpm dev` running (API on :4000, web on :3000):

```bash
node apps/web/scripts/shoot.mjs / /ar /en
```

Open the six PNGs. Check VC1, VC2, VC4, VC5, VC6, VC7 (`small: []` for every page), VC8, VC9: the
header shows the mark, `Darb / درب`, the search field and the For-businesses pill; on the phone the
search is docked at the bottom; the locale switch highlights the current language in gold.

- [ ] **Step 9: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): city frame with path bar, locale switch, search bar and doorway doors"
```

---

### Task 11: Level 0, the country

`/` lists every live place (grouped by region and by city, town and village) and every kind (grouped
by sector, linking to `/k/{kind}`). Every place and kind is at most two taps away.

**Files:**
- Create: `apps/web/src/components/PlaceIndex.tsx`, `apps/web/src/components/PlaceIndex.module.css`
- Modify: `apps/web/src/app/[locale]/page.tsx` (replace), `apps/web/src/lib/levels.ts` (create)

**Interfaces:**
- Consumes: `getPlace`, `getPlaces`, `getTaxonomy`, `indexTaxonomy`, `crumbsFor`, `CityBar`,
  `pageMetadata`, `INTL_TAG`.
- Produces:
  - `levels.ts`: `COUNTRY_SLUG = "israel"`; `localeOrNotFound(value: string): Locale`
  - `<PlaceIndex locale regions={{ slug, name, places: PlaceDto[] }[]} />` (`id="places"` section,
    cities as visible links, towns and villages in `<details>`)
  - `<KindIndex locale index />` (sectors as `<details>`, kinds link to `/k/{kind}`)

- [ ] **Step 1: Shared level helpers** — `apps/web/src/lib/levels.ts`

```ts
import { notFound } from "next/navigation";
import type { Locale } from "@darb/core";
import { isLocale } from "./locale";

/** The root of the place tree. `/israel` redirects to `/`. */
export const COUNTRY_SLUG = "israel";

export function localeOrNotFound(value: string): Locale {
  if (!isLocale(value)) notFound();
  return value;
}
```

- [ ] **Step 2: Place and kind indexes** — `apps/web/src/components/PlaceIndex.tsx`

```tsx
import Link from "next/link";
import { pickText, type Locale } from "@darb/core";
import type { PlaceDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { INTL_TAG } from "@/lib/locale";
import { href, paths } from "@/lib/routes";
import type { TaxonomyIndex } from "@/lib/taxonomy";
import styles from "./PlaceIndex.module.css";

export interface RegionGroup {
  slug: string;
  name: string;
  places: PlaceDto[];
}

function PlaceLinks({ locale, places }: { locale: Locale; places: PlaceDto[] }) {
  const collator = new Intl.Collator(INTL_TAG[locale]);
  const sorted = places
    .map((p) => ({ slug: p.slug, name: pickText(p.name, locale) }))
    .sort((a, b) => collator.compare(a.name, b.name));
  return (
    <ul className={styles.links}>
      {sorted.map((p) => (
        <li key={p.slug}>
          <Link href={href(locale, paths.place(p.slug))} className={styles.link}>
            {p.name}
          </Link>
        </li>
      ))}
    </ul>
  );
}

export function PlaceIndex({ locale, regions }: { locale: Locale; regions: RegionGroup[] }) {
  return (
    <section id="places" aria-labelledby="places-title" className={styles.section}>
      <h2 id="places-title" className={styles.heading}>
        {t(locale, "places")}
      </h2>
      {regions.map((region) => {
        const of = (type: PlaceDto["type"]) => region.places.filter((p) => p.type === type);
        const towns = of("town");
        const villages = of("village");
        return (
          <div key={region.slug} className={styles.region}>
            <h3 className={styles.regionName}>{region.name}</h3>
            <p className={styles.groupLabel}>{t(locale, "cities")}</p>
            <PlaceLinks locale={locale} places={of("city")} />
            {towns.length > 0 ? (
              <details className={styles.details}>
                <summary className={styles.summary}>
                  {t(locale, "towns")} <span className={styles.count}>{towns.length}</span>
                </summary>
                <PlaceLinks locale={locale} places={towns} />
              </details>
            ) : null}
            {villages.length > 0 ? (
              <details className={styles.details}>
                <summary className={styles.summary}>
                  {t(locale, "villages")} <span className={styles.count}>{villages.length}</span>
                </summary>
                <PlaceLinks locale={locale} places={villages} />
              </details>
            ) : null}
          </div>
        );
      })}
    </section>
  );
}

export function KindIndex({ locale, index }: { locale: Locale; index: TaxonomyIndex }) {
  return (
    <section id="kinds" aria-labelledby="kinds-title" className={styles.section}>
      <h2 id="kinds-title" className={styles.heading}>
        {t(locale, "allKinds")}
      </h2>
      <div className={styles.sectors}>
        {index.sectors.map((sector) => (
          <details key={sector.slug} className={styles.details}>
            <summary className={styles.summary}>
              <span>{pickText(sector.name, locale)}</span>
              <span className={styles.tagline}>{pickText(sector.tagline, locale)}</span>
            </summary>
            <ul className={styles.links}>
              {(index.doorsBySector.get(sector.id) ?? []).map((kind) => (
                <li key={kind.slug}>
                  <Link href={href(locale, paths.nationalKind(kind.slug))} className={styles.link}>
                    {pickText(kind.name, locale)}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ))}
      </div>
    </section>
  );
}
```

`apps/web/src/components/PlaceIndex.module.css`:

```css
.section {
  margin-block: var(--space-6) var(--space-8);
}

.heading {
  font-size: var(--step-3);
  margin-block-end: var(--space-4);
}

.region + .region {
  margin-block-start: var(--space-6);
}

.regionName {
  font-size: var(--step-2);
  color: var(--gold-300);
  margin-block-end: var(--space-2);
}

.groupLabel {
  margin: var(--space-3) 0 var(--space-2);
  color: var(--text-muted);
  font-size: var(--step--1);
}

.links {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0 0 var(--space-3);
  padding: 0;
  list-style: none;
}

.link {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--tap);
  padding-inline: var(--space-4);
  border-radius: var(--radius-pill);
  border: 1px solid var(--line-soft);
  background: var(--surface-1);
  color: var(--text);
  text-decoration: none;
}

.link:hover {
  border-color: var(--line);
}

.details {
  border-block-start: 1px solid var(--line-soft);
}

.summary {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  gap: var(--space-1) var(--space-3);
  min-block-size: var(--tap);
  padding-block: var(--space-3);
  cursor: pointer;
  font-weight: 700;
}

.tagline,
.count {
  color: var(--text-muted);
  font-weight: 400;
  font-size: var(--step--1);
}

.sectors {
  display: grid;
  gap: 0 var(--space-6);
}

@media (min-width: 900px) {
  .sectors {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
```

- [ ] **Step 3: The level 0 page** — replace `apps/web/src/app/[locale]/page.tsx`

```tsx
import type { Metadata } from "next";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { KindIndex, PlaceIndex } from "@/components/PlaceIndex";
import { getPlace, getPlaces, getTaxonomy } from "@/lib/api";
import { crumbsFor } from "@/lib/crumbs";
import { COUNTRY_SLUG, localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { indexTaxonomy } from "@/lib/taxonomy";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  return pageMetadata({
    locale,
    segments: [],
    title: t(locale, "appName"),
    description: t(locale, "tagline"),
  });
}

export default async function CountryPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const [country, places, taxonomy] = await Promise.all([
    getPlace(COUNTRY_SLUG),
    getPlaces("live"),
    getTaxonomy(),
  ]);
  const regions = (country?.children ?? [])
    .filter((r) => r.type === "region" && r.status === "live")
    .map((r) => ({
      slug: r.slug,
      name: pickText(r.name, locale),
      places: places.filter((p) => p.parentId === r.id),
    }))
    .filter((r) => r.places.length > 0);
  return (
    <>
      <CityBar locale={locale} crumbs={crumbsFor(locale, {})} segments={[]} />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {t(locale, "tagline")}
        </h1>
        <PlaceIndex locale={locale} regions={regions} />
        <KindIndex locale={locale} index={indexTaxonomy(taxonomy)} />
      </main>
    </>
  );
}
```

- [ ] **Step 4: Run checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS.

With `pnpm dev` running:

```bash
curl -s http://localhost:3000/ | grep -c 'href="/sakhnin"'
curl -s http://localhost:3000/en | grep -c 'href="/en/k/barbershops"'
```

Expected: both print `1` or more.

- [ ] **Step 5: Visual check**

Run: `node apps/web/scripts/shoot.mjs / /ar /en`
Check VC1–VC9. The two live regions (Northern District, Haifa District) each show their cities as
pill links, with towns and villages collapsed; the 18 sectors collapse below; Hebrew and Arabic sort
by their own alphabets.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): level 0 lists every live place and every kind"
```

---

### Task 12: Levels 1 and 2, the place and its sectors

`/{place}` shows one door per sector with live counts (and, for a region, its places; for a soon
place, when Darb arrives and the nearest live place). `/{place}/{sector}` shows one door per kind,
empty doors included. Neighbourhoods appear as chips.

**Files:**
- Create: `apps/web/src/app/[locale]/[place]/page.tsx`, `apps/web/src/app/[locale]/[place]/[sector]/page.tsx`,
  `apps/web/src/components/SubPlaceChips.tsx`, `apps/web/src/components/List.module.css`
- Modify: `apps/web/src/lib/levels.ts`, `apps/web/src/lib/crumbs.ts`, `apps/web/src/lib/crumbs.test.ts`

**Interfaces:**
- Consumes: `getPlace`, `getTaxonomy`, `getKindCounts`, `getNearestPlace`, `indexTaxonomy`,
  `sectorTotals`, `Door`, `DoorGrid`, `CityBar`, `PlaceIndex`, `formatNumber`, `pageMetadata`.
- Produces:
  - `PlaceLevel { locale; place: PlaceDetailDto; index: TaxonomyIndex }`, `SectorLevel extends PlaceLevel { sector }`;
    `loadPlaceLevel({ locale, place })`, `loadSectorLevel({ locale, place, sector })` (404 on unknown,
    `/israel` → permanent redirect to `/`)
  - `Chip { key; label; href; current }`; `subPlaceChips(locale, place, tail: string[]): Chip[]`
  - `<SubPlaceChips label chips />` (`data-chip={key}`, `aria-current="page"` on the current one)
  - `List.module.css` classes: `chips`, `chip`, `list`, `row`, `rowLink`, `rowName`, `rowTagline`,
    `rowMeta`, `rowPlace`, `none`, `nearest`, `distance`, `more`

- [ ] **Step 1: Write the failing chip test** — append to `apps/web/src/lib/crumbs.test.ts` (add
  `subPlaceChips` to the existing `./crumbs` import)

```ts

describe("subPlaceChips", () => {
  const haifa: PlaceDetailDto = {
    ...placeDto("haifa", "city", "Haifa"),
    ancestors: [placeDto("israel", "country", "Israel"), placeDto("haifa-district", "region", "Haifa District")],
    children: [placeDto("kiryat-haim", "neighbourhood", "Kiryat Haim")],
  };
  it("offers a city's neighbourhoods with the city itself current", () => {
    expect(subPlaceChips("en", haifa, ["beauty", "barbershops"])).toEqual([
      { key: "haifa", label: "All of Haifa", href: "/en/haifa/beauty/barbershops", current: true },
      { key: "kiryat-haim", label: "Kiryat Haim", href: "/en/kiryat-haim/beauty/barbershops", current: false },
    ]);
  });
  it("lets a neighbourhood go back to the whole city", () => {
    expect(subPlaceChips("he", kiryatHaim, [])).toEqual([
      { key: "haifa", label: "כל Haifa", href: "/haifa", current: false },
      { key: "kiryat-haim", label: "Kiryat Haim", href: "/kiryat-haim", current: true },
    ]);
  });
  it("offers nothing for a place without neighbourhoods", () => {
    expect(subPlaceChips("en", { ...haifa, children: [] }, [])).toEqual([]);
  });
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `subPlaceChips` is not exported.

- [ ] **Step 2: Chips** — append to `apps/web/src/lib/crumbs.ts`

```ts
export interface Chip {
  key: string;
  label: string;
  href: string;
  current: boolean;
}

/**
 * Neighbourhoods narrow a level as a filter, never as extra URL depth: each chip is the same level
 * (`tail` = the sector and kind segments, if any) in the neighbourhood or in the whole city.
 */
export function subPlaceChips(locale: Locale, place: PlaceDetailDto, tail: readonly string[]): Chip[] {
  const name = (p: { name: Localized }) => pickText(p.name, locale);
  if (place.type === "neighbourhood") {
    const parent = place.ancestors.at(-1);
    if (!parent) return [];
    return [
      { key: parent.slug, label: t(locale, "allOf", { place: name(parent) }), href: href(locale, [parent.slug, ...tail]), current: false },
      { key: place.slug, label: name(place), href: href(locale, [place.slug, ...tail]), current: true },
    ];
  }
  const neighbourhoods = place.children.filter((c) => c.type === "neighbourhood" && c.status === "live");
  if (neighbourhoods.length === 0) return [];
  return [
    { key: place.slug, label: t(locale, "allOf", { place: name(place) }), href: href(locale, [place.slug, ...tail]), current: true },
    ...neighbourhoods.map((n) => ({ key: n.slug, label: name(n), href: href(locale, [n.slug, ...tail]), current: false })),
  ];
}
```

- [ ] **Step 3: Level loaders** — append to `apps/web/src/lib/levels.ts`

```ts
import { permanentRedirect } from "next/navigation";
import type { PlaceDetailDto, SectorDto } from "@darb/contracts";
import { getPlace, getTaxonomy } from "./api";
import { href } from "./routes";
import { indexTaxonomy, type TaxonomyIndex } from "./taxonomy";

export interface PlaceLevel {
  locale: Locale;
  place: PlaceDetailDto;
  index: TaxonomyIndex;
}
export interface SectorLevel extends PlaceLevel {
  sector: SectorDto;
}

export async function loadPlaceLevel(raw: { locale: string; place: string }): Promise<PlaceLevel> {
  const locale = localeOrNotFound(raw.locale);
  if (raw.place === COUNTRY_SLUG) permanentRedirect(href(locale));
  const [place, taxonomy] = await Promise.all([getPlace(raw.place), getTaxonomy()]);
  if (!place) notFound();
  return { locale, place, index: indexTaxonomy(taxonomy) };
}

export async function loadSectorLevel(raw: {
  locale: string;
  place: string;
  sector: string;
}): Promise<SectorLevel> {
  const level = await loadPlaceLevel(raw);
  const sector = level.index.sectorBySlug.get(raw.sector);
  if (!sector) notFound();
  return { ...level, sector };
}
```

(Merge the imports with the file's existing ones.)

- [ ] **Step 4: Chips component and list styles**

`apps/web/src/components/SubPlaceChips.tsx`:

```tsx
import Link from "next/link";
import type { Chip } from "@/lib/crumbs";
import styles from "./List.module.css";

export function SubPlaceChips({ label, chips }: { label: string; chips: Chip[] }) {
  return (
    <nav aria-label={label} className={styles.chips}>
      <ul>
        {chips.map((chip) => (
          <li key={chip.key}>
            <Link
              href={chip.href}
              className={styles.chip}
              aria-current={chip.current ? "page" : undefined}
              data-chip={chip.key}
            >
              {chip.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}
```

`apps/web/src/components/List.module.css`:

```css
.chips ul {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0 0 var(--space-5);
  padding: 0;
  list-style: none;
}

.chip {
  display: inline-flex;
  align-items: center;
  min-block-size: var(--tap);
  padding-inline: var(--space-4);
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  color: var(--text-soft);
  text-decoration: none;
}

.chip[aria-current="page"] {
  background: var(--gold);
  border-color: var(--gold);
  color: var(--night);
  font-weight: 700;
}

.list {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: var(--space-3);
  }
}

.rowLink {
  display: grid;
  gap: var(--space-1);
  min-block-size: 72px;
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-m);
  border: 1px solid var(--line-soft);
  background: var(--surface-1);
  color: var(--text);
  text-decoration: none;
}

.rowLink:hover {
  border-color: var(--line);
}

.rowName {
  font-weight: 700;
  font-size: var(--step-1);
}

.rowTagline {
  color: var(--text-muted);
  font-size: var(--step--1);
}

.rowMeta {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-2) var(--space-3);
}

.rowPlace {
  color: var(--text-soft);
  font-size: var(--step--1);
}

.more {
  margin-block: var(--space-5);
}

.none {
  margin-block: var(--space-5) var(--space-8);
  padding: var(--space-5);
  border-radius: var(--radius-l);
  border: 1px solid var(--line-soft);
  background: var(--surface-1);
}

.none h2 {
  font-size: var(--step-2);
  margin-block-end: var(--space-3);
}

.nearest {
  display: grid;
  gap: var(--space-2);
  margin: var(--space-3) 0 0;
  padding: 0;
  list-style: none;
}

.nearest a {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: var(--space-3);
  min-block-size: var(--tap);
  padding-inline: var(--space-4);
  border-radius: var(--radius-m);
  background: var(--surface-2);
  color: var(--text);
  text-decoration: none;
}

.distance {
  color: var(--gold-300);
  font-variant-numeric: tabular-nums;
}
```

- [ ] **Step 5: Level 1** — `apps/web/src/app/[locale]/[place]/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { Door, DoorGrid } from "@/components/Door";
import { PlaceIndex } from "@/components/PlaceIndex";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getKindCounts, getNearestPlace } from "@/lib/api";
import { crumbsFor, subPlaceChips } from "@/lib/crumbs";
import { formatNumber } from "@/lib/format";
import { loadPlaceLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { sectorTotals } from "@/lib/taxonomy";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; place: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, place } = await loadPlaceLevel(await params);
  const name = pickText(place.name, locale);
  return pageMetadata({
    locale,
    segments: paths.place(place.slug),
    title: name,
    description: `${name} — ${t(locale, "tagline")}`,
  });
}

export default async function PlacePage({ params }: Props) {
  const { locale, place, index } = await loadPlaceLevel(await params);
  const name = pickText(place.name, locale);
  const bar = <CityBar locale={locale} crumbs={crumbsFor(locale, { place })} segments={paths.place(place.slug)} />;

  if (place.status === "soon") {
    const nearest = await getNearestPlace(place.lat, place.lng, "cached");
    return (
      <>
        {bar}
        <main id="main" className="frame reveal">
          <h1 id="main-heading" tabIndex={-1} className="page-title">
            {name}
          </h1>
          <p className="lede">{t(locale, "placeSoon", { place: name })}</p>
          {nearest ? (
            <p>
              <Link className="button-link" href={href(locale, paths.place(nearest.slug))}>
                {t(locale, "nearestLive", { place: pickText(nearest.name, locale) })}
              </Link>
            </p>
          ) : null}
        </main>
      </>
    );
  }

  const totals = sectorTotals(index, (await getKindCounts(place.slug)) ?? {});
  const chips = subPlaceChips(locale, place, []);
  const settlements =
    place.type === "region"
      ? place.children.filter((c) => c.status === "live" && c.type !== "neighbourhood")
      : [];
  return (
    <>
      {bar}
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {name}
        </h1>
        {chips.length > 0 ? <SubPlaceChips label={t(locale, "neighbourhoods")} chips={chips} /> : null}
        <DoorGrid label={t(locale, "allKinds")}>
          {index.sectors.map((sector) => {
            const count = totals.get(sector.slug) ?? 0;
            const countText = formatNumber(count, locale);
            return (
              <Door
                key={sector.slug}
                slug={sector.slug}
                href={href(locale, paths.sector(place.slug, sector.slug))}
                label={pickText(sector.name, locale)}
                sublabel={pickText(sector.tagline, locale)}
                count={count}
                countText={countText}
                countLabel={t(locale, "businessCount", { count: countText })}
                accent={sector.accent}
              />
            );
          })}
        </DoorGrid>
        {settlements.length > 0 ? (
          <PlaceIndex locale={locale} regions={[{ slug: place.slug, name, places: settlements }]} />
        ) : null}
      </main>
    </>
  );
}
```

A soon place's nearest live place uses the place's own coordinates, so it is cached (`"cached"`); a
`no-store` fetch here would make the route dynamic.

- [ ] **Step 6: Level 2** — `apps/web/src/app/[locale]/[place]/[sector]/page.tsx`

```tsx
import type { Metadata } from "next";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { Door, DoorGrid } from "@/components/Door";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getKindCounts } from "@/lib/api";
import { crumbsFor, subPlaceChips } from "@/lib/crumbs";
import { formatNumber } from "@/lib/format";
import { loadSectorLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; place: string; sector: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, place, sector } = await loadSectorLevel(await params);
  return pageMetadata({
    locale,
    segments: paths.sector(place.slug, sector.slug),
    title: `${pickText(sector.name, locale)} · ${pickText(place.name, locale)}`,
    description: pickText(sector.tagline, locale),
  });
}

export default async function SectorPage({ params }: Props) {
  const { locale, place, sector, index } = await loadSectorLevel(await params);
  const counts = (await getKindCounts(place.slug)) ?? {};
  const chips = subPlaceChips(locale, place, [sector.slug]);
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { place, sector })}
        segments={paths.sector(place.slug, sector.slug)}
      />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {pickText(sector.name, locale)}
        </h1>
        <p className="lede">{pickText(sector.tagline, locale)}</p>
        {chips.length > 0 ? <SubPlaceChips label={t(locale, "neighbourhoods")} chips={chips} /> : null}
        <DoorGrid label={pickText(sector.name, locale)}>
          {(index.doorsBySector.get(sector.id) ?? []).map((kind) => {
            const count = counts[kind.slug] ?? 0;
            const countText = formatNumber(count, locale);
            return (
              <Door
                key={kind.slug}
                slug={kind.slug}
                href={href(locale, paths.kind(place.slug, sector.slug, kind.slug))}
                label={pickText(kind.name, locale)}
                count={count}
                countText={countText}
                countLabel={t(locale, "businessCount", { count: countText })}
                accent={sector.accent}
              />
            );
          })}
        </DoorGrid>
      </main>
    </>
  );
}
```

- [ ] **Step 7: Run checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS.

With `pnpm dev` running:

```bash
curl -s http://localhost:3000/sakhnin | grep -o 'data-door="[a-z-]*"' | wc -l
curl -s http://localhost:3000/arraba/beauty | grep -o 'data-door="nails" data-count="0"'
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/nowhere-at-all
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/israel
```

Expected: `18`; the nails door with count 0; `404`; `308 http://localhost:3000/`. (Attribute order
in the HTML may differ; if the second grep prints nothing, check both attributes on the nails door
by eye.)

- [ ] **Step 8: Visual check**

Run: `node apps/web/scripts/shoot.mjs /sakhnin /sakhnin/beauty /arraba/beauty /haifa /en/sakhnin /ar/sakhnin/beauty /eilat`
Check VC1–VC10. Desktop doors are tall doorways with the gold rim and the count inside; phone doors
are compact two-column rows with the count at the inline end; `/arraba/beauty` shows dim empty doors
with `0`; `/haifa` shows the "All of Haifa" and "Kiryat Haim" chips; `/eilat` (soon) shows "Darb
reaches Eilat soon" and a link to the nearest live place.

- [ ] **Step 9: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): place and sector levels with live door counts and neighbourhood chips"
```

---
### Task 13: Level 3, the kind in a place

`/{place}/{sector}/{kind}` lists the businesses (first page of 30), filters by neighbourhood through
chips, and, when there are none, says "None in {place} yet" with the nearest places that have the
kind. The list lives in a **layout** so it stays mounted when level 4 opens the sheet over it.

**Files:**
- Create: `apps/web/src/lib/rows.ts`, `apps/web/src/lib/rows.test.ts`,
  `apps/web/src/components/BusinessRow.tsx`, `apps/web/src/components/BusinessList.tsx`,
  `apps/web/src/components/NoneYet.tsx`,
  `apps/web/src/app/[locale]/[place]/[sector]/[kind]/layout.tsx`,
  `apps/web/src/app/[locale]/[place]/[sector]/[kind]/page.tsx`
- Modify: `apps/web/src/lib/levels.ts`

**Interfaces:**
- Consumes: `getBusinesses`, `getNearestPlacesWithKind`, `subPlaceChips`, `SubPlaceChips`,
  `ExampleBadge`, `OpenState`, `formatKm`, `List.module.css`.
- Produces:
  - `KindLevel extends SectorLevel { kind: KindDto }`; `loadKindLevel(raw, rest: string[] = [])` —
    404 for unknown place/kind; a kind under the wrong sector redirects to its canonical sector
    (keeping `rest`, e.g. the business slug)
  - `BusinessRowData { key; name; tagline; href; example; openNow; placeName }` (`key` =
    `"{placeSlug}/{slug}"`); `placeNames(place | null, places?): Map<slug, Localized>`;
    `toBusinessRow(b, ctx)`, `toRows(items, ctx)` with `ctx = { locale, index, names, here: string | null }`
  - `RowLabels { example; openNow; closed }`; `<BusinessRow row labels />` (`data-business={key}`,
    link `data-business-link={key}`, name `data-business-name`, `scroll={false}`)
  - `<BusinessList locale rows />` (`data-business-list`; Task 14 adds a `more` prop and `ShowMore`)
  - `<NoneYet title subtitle places={{ key, name, href, distance }[]} />` (`data-none-yet`, links
    `data-nearest-place={key}`)
  - Element ids the sheet relies on: `city-list` (the list region), `main-heading` (focus fallback)

- [ ] **Step 1: Write the failing row test** — `apps/web/src/lib/rows.test.ts`

```ts
import type { BusinessSummaryDto, PlaceDetailDto, TaxonomyDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { placeNames, toBusinessRow, toRows } from "./rows";
import { indexTaxonomy } from "./taxonomy";

const index = indexTaxonomy({
  sectors: [
    {
      id: "s1",
      slug: "beauty",
      name: { en: "Beauty" },
      tagline: { en: "t" },
      accent: "#aa7744",
      order: 1,
      kinds: [
        { id: "k1", slug: "barbershops", sectorId: "s1", parentKindId: null, name: { en: "Barbers" }, template: "booking", attributes: [], icon: null, order: 1 },
      ],
    },
  ],
} satisfies TaxonomyDto);

const business = (slug: string, placeSlug: string, primaryKindId = "k1"): BusinessSummaryDto => ({
  id: slug,
  slug,
  name: { he: "המספרה של סאמר", en: "Samer's" },
  tagline: { en: "Fades" },
  tier: "example",
  primaryKindId,
  placeId: placeSlug,
  placeSlug,
  lat: 32.8,
  lng: 35.3,
  photo: null,
  openNow: true,
});

const haifa = {
  slug: "haifa",
  name: { en: "Haifa" },
  children: [{ slug: "kiryat-haim", name: { en: "Kiryat Haim", ar: "كريات حاييم" } }],
} as unknown as PlaceDetailDto;

describe("business rows", () => {
  const ctx = { locale: "ar" as const, index, names: placeNames(haifa), here: "haifa" };
  it("links into the business's own place and falls back from Arabic to Hebrew", () => {
    expect(toBusinessRow(business("samers", "haifa"), ctx)).toEqual({
      key: "haifa/samers",
      name: "המספרה של סאמר",
      tagline: "Fades",
      href: "/ar/haifa/beauty/barbershops/samers",
      example: true,
      openNow: true,
      placeName: null,
    });
  });
  it("names the neighbourhood when a row comes from below the current place", () => {
    expect(toBusinessRow(business("samers", "kiryat-haim"), ctx)?.placeName).toBe("كريات حاييم");
    expect(toBusinessRow(business("samers", "kiryat-haim"), ctx)?.href).toBe(
      "/ar/kiryat-haim/beauty/barbershops/samers",
    );
  });
  it("drops rows whose kind is not in the taxonomy", () => {
    expect(toRows([business("a", "haifa"), business("b", "haifa", "hidden")], ctx).map((r) => r.key)).toEqual([
      "haifa/a",
    ]);
  });
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./rows` missing.

- [ ] **Step 2: Rows** — `apps/web/src/lib/rows.ts`

```ts
import { pickText, type Locale, type Localized } from "@darb/core";
import type { BusinessSummaryDto, PlaceDetailDto, PlaceDto } from "@darb/contracts";
import { href, paths } from "./routes";
import type { TaxonomyIndex } from "./taxonomy";

/** A business row, already localized, so client components can render it too. */
export interface BusinessRowData {
  key: string;
  name: string;
  tagline: string;
  href: string;
  example: boolean;
  openNow: boolean | null;
  /** Shown when the business is in another place than the one being listed. */
  placeName: string | null;
}

export interface RowContext {
  locale: Locale;
  index: TaxonomyIndex;
  names: Map<string, Localized>;
  /** The place being listed; rows from elsewhere name their place. Null lists everywhere. */
  here: string | null;
}

export function placeNames(place: PlaceDetailDto | null, places: readonly PlaceDto[] = []) {
  const names = new Map<string, Localized>(places.map((p) => [p.slug, p.name]));
  if (place) {
    names.set(place.slug, place.name);
    for (const child of place.children) names.set(child.slug, child.name);
  }
  return names;
}

export function toBusinessRow(b: BusinessSummaryDto, ctx: RowContext): BusinessRowData | null {
  const kind = ctx.index.kindById.get(b.primaryKindId);
  const sector = kind ? ctx.index.sectorById.get(kind.sectorId) : undefined;
  if (!kind || !sector) return null;
  const name = ctx.names.get(b.placeSlug);
  return {
    key: `${b.placeSlug}/${b.slug}`,
    name: pickText(b.name, ctx.locale),
    tagline: pickText(b.tagline, ctx.locale),
    href: href(ctx.locale, paths.business(b.placeSlug, sector.slug, kind.slug, b.slug)),
    example: b.tier === "example",
    openNow: b.openNow,
    placeName: b.placeSlug === ctx.here || !name ? null : pickText(name, ctx.locale),
  };
}

export function toRows(items: readonly BusinessSummaryDto[], ctx: RowContext): BusinessRowData[] {
  return items.flatMap((b) => {
    const row = toBusinessRow(b, ctx);
    return row ? [row] : [];
  });
}
```

Run: `pnpm --filter @darb/web test`
Expected: PASS.

- [ ] **Step 3: Kind loader** — append to `apps/web/src/lib/levels.ts` (add `redirect` to the
  `next/navigation` import and `KindDto` to the contracts import; import `paths` from `./routes`)

```ts
export interface KindLevel extends SectorLevel {
  kind: KindDto;
}

/** `rest` keeps deeper segments (the business) when a kind is redirected to its own sector. */
export async function loadKindLevel(
  raw: { locale: string; place: string; sector: string; kind: string },
  rest: readonly string[] = [],
): Promise<KindLevel> {
  const level = await loadPlaceLevel(raw);
  const kind = level.index.kindBySlug.get(raw.kind);
  if (!kind) notFound();
  const sector = level.index.sectorById.get(kind.sectorId);
  if (!sector) notFound();
  if (sector.slug !== raw.sector) {
    redirect(href(level.locale, [...paths.kind(level.place.slug, sector.slug, kind.slug), ...rest]));
  }
  return { ...level, sector, kind };
}
```

- [ ] **Step 4: Rows, list and empty state components**

`apps/web/src/components/BusinessRow.tsx`:

```tsx
import Link from "next/link";
import type { BusinessRowData } from "@/lib/rows";
import { ExampleBadge, OpenState } from "./Badges";
import styles from "./List.module.css";

export interface RowLabels {
  example: string;
  openNow: string;
  closed: string;
}

/** Pure: rendered by the server list and by ShowMore on the client. */
export function BusinessRow({ row, labels }: { row: BusinessRowData; labels: RowLabels }) {
  return (
    <li className={styles.row} data-business={row.key}>
      <Link href={row.href} scroll={false} className={styles.rowLink} data-business-link={row.key}>
        <span className={styles.rowName} data-business-name="">
          {row.name}
        </span>
        {row.tagline ? <span className={styles.rowTagline}>{row.tagline}</span> : null}
        <span className={styles.rowMeta}>
          {row.placeName ? <span className={styles.rowPlace}>{row.placeName}</span> : null}
          {row.example ? <ExampleBadge label={labels.example} /> : null}
          <OpenState openNow={row.openNow} labels={{ open: labels.openNow, closed: labels.closed }} />
        </span>
      </Link>
    </li>
  );
}
```

`apps/web/src/components/BusinessList.tsx`:

```tsx
import type { Locale } from "@darb/core";
import { t } from "@darb/i18n";
import type { BusinessRowData } from "@/lib/rows";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import styles from "./List.module.css";

export function rowLabels(locale: Locale): RowLabels {
  return { example: t(locale, "example"), openNow: t(locale, "openNow"), closed: t(locale, "closed") };
}

export function BusinessList({ locale, rows }: { locale: Locale; rows: BusinessRowData[] }) {
  const labels = rowLabels(locale);
  return (
    <section aria-labelledby="businesses-title">
      <h2 id="businesses-title" className="visually-hidden">
        {t(locale, "businesses")}
      </h2>
      <ul className={styles.list} data-business-list="">
        {rows.map((row) => (
          <BusinessRow key={row.key} row={row} labels={labels} />
        ))}
      </ul>
    </section>
  );
}
```

`apps/web/src/components/NoneYet.tsx`:

```tsx
import Link from "next/link";
import styles from "./List.module.css";

export interface NearbyPlace {
  key: string;
  name: string;
  href: string;
  distance: string;
}

export function NoneYet({ title, subtitle, places }: { title: string; subtitle: string; places: NearbyPlace[] }) {
  return (
    <section className={styles.none} aria-labelledby="none-yet-title" data-none-yet="">
      <h2 id="none-yet-title">{title}</h2>
      {places.length > 0 ? (
        <>
          <p>{subtitle}</p>
          <ul className={styles.nearest}>
            {places.map((p) => (
              <li key={p.key}>
                <Link href={p.href} data-nearest-place={p.key}>
                  <span>{p.name}</span>
                  <span className={styles.distance}>{p.distance}</span>
                </Link>
              </li>
            ))}
          </ul>
        </>
      ) : null}
    </section>
  );
}
```

- [ ] **Step 5: The level 3 layout and page**

`apps/web/src/app/[locale]/[place]/[sector]/[kind]/layout.tsx`:

```tsx
import { notFound } from "next/navigation";
import type { ReactNode } from "react";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { BusinessList } from "@/components/BusinessList";
import { NoneYet } from "@/components/NoneYet";
import { SubPlaceChips } from "@/components/SubPlaceChips";
import { getBusinesses, getNearestPlacesWithKind } from "@/lib/api";
import { subPlaceChips } from "@/lib/crumbs";
import { formatKm } from "@/lib/format";
import { loadKindLevel } from "@/lib/levels";
import { href, paths } from "@/lib/routes";
import { placeNames, toRows } from "@/lib/rows";

type Props = {
  children: ReactNode;
  params: Promise<{ locale: string; place: string; sector: string; kind: string }>;
};

/**
 * The list is a layout so it stays mounted under the level 4 sheet. Pages render the city bar
 * (`children`, before the list) so the locale switch can keep the full path.
 */
export default async function KindLayout({ children, params }: Props) {
  const { locale, place, sector, kind, index } = await loadKindLevel(await params);
  const page = await getBusinesses(place.slug, { kind: kind.slug });
  if (!page) notFound();
  const rows = toRows(page.items, { locale, index, names: placeNames(place), here: place.slug });
  const placeName = pickText(place.name, locale);
  const nearest =
    rows.length === 0 ? ((await getNearestPlacesWithKind(kind.slug, place.lat, place.lng, 5)) ?? []) : [];
  const chips = subPlaceChips(locale, place, [sector.slug, kind.slug]);
  return (
    <>
      {children}
      <main id="main" className="frame">
        <div id="city-list" className="reveal">
          <h1 id="main-heading" tabIndex={-1} className="page-title">
            {t(locale, "kindInPlace", { kind: pickText(kind.name, locale), place: placeName })}
          </h1>
          {chips.length > 0 ? <SubPlaceChips label={t(locale, "neighbourhoods")} chips={chips} /> : null}
          {rows.length > 0 ? (
            <BusinessList locale={locale} rows={rows} />
          ) : (
            <NoneYet
              title={t(locale, "noneHereYet", { place: placeName })}
              subtitle={t(locale, "nearestPlaces")}
              places={nearest.map((p) => ({
                key: p.slug,
                name: pickText(p.name, locale),
                href: href(locale, paths.kind(p.slug, sector.slug, kind.slug)),
                distance: formatKm(p.distanceKm, locale),
              }))}
            />
          )}
        </div>
      </main>
    </>
  );
}
```

`apps/web/src/app/[locale]/[place]/[sector]/[kind]/page.tsx`:

```tsx
import type { Metadata } from "next";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { crumbsFor } from "@/lib/crumbs";
import { loadKindLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { paths } from "@/lib/routes";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; place: string; sector: string; kind: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, place, sector, kind } = await loadKindLevel(await params);
  return pageMetadata({
    locale,
    segments: paths.kind(place.slug, sector.slug, kind.slug),
    title: t(locale, "kindInPlace", { kind: pickText(kind.name, locale), place: pickText(place.name, locale) }),
    description: t(locale, "tagline"),
  });
}

export default async function KindPage({ params }: Props) {
  const { locale, place, sector, kind } = await loadKindLevel(await params);
  return (
    <CityBar
      locale={locale}
      crumbs={crumbsFor(locale, { place, sector, kind })}
      segments={paths.kind(place.slug, sector.slug, kind.slug)}
    />
  );
}
```

- [ ] **Step 6: Run checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS.

With `pnpm dev` running:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/arraba/beauty/nails
curl -s http://localhost:3000/arraba/beauty/nails | grep -o 'data-nearest-place="[a-z-]*"' | head -1
curl -s http://localhost:3000/sakhnin/beauty/barbershops | grep -o 'data-business-link="sakhnin/samers-barbershop"'
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/sakhnin/food/barbershops
```

Expected: `200`; `data-nearest-place="sakhnin"`; the Samer's link; a `307` redirect to
`/sakhnin/beauty/barbershops`.

- [ ] **Step 7: Visual check**

Run: `node apps/web/scripts/shoot.mjs /sakhnin/beauty/barbershops /haifa/beauty/barbershops /arraba/beauty/nails /ar/arraba/beauty/nails /en/kiryat-haim/beauty/barbershops`
Check VC1–VC10. Rows are dark cards with the name in ivory, the tagline in sage, a gold-outlined
"Example" pill and the open state; `/arraba/beauty/nails` shows the "None in Arraba yet" panel with
Sakhnin first and its distance in gold; Kiryat Haim's page offers "All of Haifa".

- [ ] **Step 8: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): kind level with business list, neighbourhood filter and none-yet fallback"
```

---

### Task 14: More results, the national kind and the place shortcut

Lists page through `ShowMore` (a small client island calling a route handler). `/k/{kind}` lists the
kind across Israel; `/{place}/k/{kind}` redirects to the canonical `/{place}/{sector}/{kind}`.

**Files:**
- Create: `apps/web/src/components/ShowMore.tsx`, `apps/web/src/components/ShowMore.test.tsx`,
  `apps/web/src/app/api/businesses/route.ts`, `apps/web/src/app/[locale]/k/[kind]/page.tsx`,
  `apps/web/src/app/[locale]/[place]/k/[kind]/page.tsx`
- Modify: `apps/web/src/components/BusinessList.tsx`,
  `apps/web/src/app/[locale]/[place]/[sector]/[kind]/layout.tsx`

**Interfaces:**
- Consumes: `getBusinesses`, `getPlace`, `getPlaces`, `getTaxonomy`, `toRows`, `placeNames`,
  `BusinessRow`, `rowLabels`, `COUNTRY_SLUG`.
- Produces:
  - `GET /api/businesses?locale&place&kind&cursor` → `{ rows: BusinessRowData[]; nextCursor: string | null }`
    (400 bad query, 404 unknown, 503 API down)
  - `<ShowMore locale place kind cursor labels={{ showMore, unreachable }} rowLabels />`
    (button `data-show-more`)
  - `MoreQuery { place; kind; cursor }`; `<BusinessList locale rows more={MoreQuery | null} />`
  - `/k/{kind}` page (`id="city-list"`, h1 "{kind} across Israel"); the place shortcut redirect

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/ShowMore.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { ShowMore } from "./ShowMore";

afterEach(() => vi.unstubAllGlobals());

const row = (key: string) => ({
  key,
  name: key,
  tagline: "",
  href: `/x/${key}`,
  example: true,
  openNow: null,
  placeName: null,
});
const props = {
  locale: "en" as const,
  place: "israel",
  kind: "barbershops",
  cursor: "c1",
  labels: { showMore: "Show more", unreachable: "Darb can't be reached right now." },
  rowLabels: { example: "Example", openNow: "Open now", closed: "Closed" },
};

it("appends the next page and stops at the last one", async () => {
  const fetchMock = vi
    .fn()
    .mockResolvedValueOnce(Response.json({ rows: [row("a"), row("b")], nextCursor: "c2" }))
    .mockResolvedValueOnce(Response.json({ rows: [row("c")], nextCursor: null }));
  vi.stubGlobal("fetch", fetchMock);
  render(<ShowMore {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  await waitFor(() => expect(screen.getByText("b")).toBeTruthy());
  expect(String(fetchMock.mock.calls[0]![0])).toBe(
    "/api/businesses?locale=en&place=israel&kind=barbershops&cursor=c1",
  );
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  await waitFor(() => expect(screen.getByText("c")).toBeTruthy());
  expect(screen.queryByRole("button", { name: "Show more" })).toBeNull();
});

it("says quietly when the API cannot be reached", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 503 })));
  render(<ShowMore {...props} />);
  fireEvent.click(screen.getByRole("button", { name: "Show more" }));
  await waitFor(() => expect(screen.getByText("Darb can't be reached right now.")).toBeTruthy());
  expect(screen.getByRole("button", { name: "Show more" })).toBeTruthy();
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./ShowMore` missing.

- [ ] **Step 2: ShowMore** — `apps/web/src/components/ShowMore.tsx`

```tsx
"use client";

import { useRef, useState } from "react";
import type { Locale } from "@darb/core";
import type { BusinessRowData } from "@/lib/rows";
import { BusinessRow, type RowLabels } from "./BusinessRow";
import styles from "./List.module.css";

export interface ShowMoreProps {
  locale: Locale;
  place: string;
  kind: string;
  cursor: string;
  labels: { showMore: string; unreachable: string };
  rowLabels: RowLabels;
}

export function ShowMore({ locale, place, kind, cursor, labels, rowLabels }: ShowMoreProps) {
  const [rows, setRows] = useState<BusinessRowData[]>([]);
  const [next, setNext] = useState<string | null>(cursor);
  const [state, setState] = useState<"idle" | "loading" | "error">("idle");
  const list = useRef<HTMLUListElement>(null);

  async function load() {
    if (!next) return;
    setState("loading");
    const firstNew = rows.length;
    try {
      const res = await fetch(`/api/businesses?${new URLSearchParams({ locale, place, kind, cursor: next })}`);
      if (!res.ok) throw new Error(String(res.status));
      const body = (await res.json()) as { rows: BusinessRowData[]; nextCursor: string | null };
      setRows((current) => [...current, ...body.rows]);
      setNext(body.nextCursor);
      setState("idle");
      // Keyboard users continue from the first new row.
      requestAnimationFrame(() => list.current?.querySelectorAll<HTMLAnchorElement>("a")[firstNew]?.focus());
    } catch {
      setState("error");
    }
  }

  return (
    <>
      <ul ref={list} className={styles.list} hidden={rows.length === 0}>
        {rows.map((row) => (
          <BusinessRow key={row.key} row={row} labels={rowLabels} />
        ))}
      </ul>
      <div className={styles.more}>
        {state === "error" ? <p role="status">{labels.unreachable}</p> : null}
        {next ? (
          <button
            type="button"
            className="button"
            onClick={load}
            disabled={state === "loading"}
            aria-busy={state === "loading"}
            data-show-more=""
          >
            {labels.showMore}
          </button>
        ) : null}
      </div>
    </>
  );
}
```

In `BusinessList.tsx`, import `ShowMore`, add the `more` prop and render it after the `<ul>`:

```tsx
export interface MoreQuery {
  place: string;
  kind: string;
  cursor: string;
}

export function BusinessList({
  locale,
  rows,
  more,
}: {
  locale: Locale;
  rows: BusinessRowData[];
  more: MoreQuery | null;
}) {
  const labels = rowLabels(locale);
  return (
    <section aria-labelledby="businesses-title">
      <h2 id="businesses-title" className="visually-hidden">
        {t(locale, "businesses")}
      </h2>
      <ul className={styles.list} data-business-list="">
        {rows.map((row) => (
          <BusinessRow key={row.key} row={row} labels={labels} />
        ))}
      </ul>
      {more ? (
        <ShowMore
          locale={locale}
          {...more}
          labels={{ showMore: t(locale, "showMore"), unreachable: t(locale, "unreachable") }}
          rowLabels={labels}
        />
      ) : null}
    </section>
  );
}
```

In the level 3 layout, pass the cursor through:

```tsx
            <BusinessList
              locale={locale}
              rows={rows}
              more={page.nextCursor ? { place: place.slug, kind: kind.slug, cursor: page.nextCursor } : null}
            />
```

Run: `pnpm --filter @darb/web test`
Expected: PASS.

- [ ] **Step 3: The route handler** — `apps/web/src/app/api/businesses/route.ts`

```ts
import { SlugSchema } from "@darb/contracts";
import { z } from "zod";
import { ApiUnavailableError, getBusinesses, getPlace, getPlaces, getTaxonomy } from "@/lib/api";
import { COUNTRY_SLUG } from "@/lib/levels";
import { placeNames, toRows } from "@/lib/rows";
import { indexTaxonomy } from "@/lib/taxonomy";

const Query = z.object({
  locale: z.enum(["he", "ar", "en"]),
  place: SlugSchema,
  kind: SlugSchema,
  cursor: z.string().min(1).max(512),
});

export async function GET(request: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { locale, place, kind, cursor } = parsed.data;
  try {
    const [page, taxonomy, detail, places] = await Promise.all([
      getBusinesses(place, { kind, cursor }),
      getTaxonomy(),
      place === COUNTRY_SLUG ? null : getPlace(place),
      place === COUNTRY_SLUG ? getPlaces("live") : [],
    ]);
    if (!page) return Response.json({ message: "Not found" }, { status: 404 });
    const rows = toRows(page.items, {
      locale,
      index: indexTaxonomy(taxonomy),
      names: placeNames(detail, places),
      here: place === COUNTRY_SLUG ? null : place,
    });
    return Response.json({ rows, nextCursor: page.nextCursor });
  } catch (error) {
    if (error instanceof ApiUnavailableError) return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
```

- [ ] **Step 4: The national kind page** — `apps/web/src/app/[locale]/k/[kind]/page.tsx`

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { BusinessList } from "@/components/BusinessList";
import { CityBar } from "@/components/CityBar";
import { NoneYet } from "@/components/NoneYet";
import { getBusinesses, getPlaces, getTaxonomy } from "@/lib/api";
import { crumbsFor } from "@/lib/crumbs";
import { COUNTRY_SLUG, localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { paths } from "@/lib/routes";
import { placeNames, toRows } from "@/lib/rows";
import { indexTaxonomy } from "@/lib/taxonomy";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Props = { params: Promise<{ locale: string; kind: string }> };

async function load(params: Props["params"]) {
  const raw = await params;
  const locale = localeOrNotFound(raw.locale);
  const index = indexTaxonomy(await getTaxonomy());
  const kind = index.kindBySlug.get(raw.kind);
  if (!kind) notFound();
  return { locale, index, kind };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, kind } = await load(params);
  return pageMetadata({
    locale,
    segments: paths.nationalKind(kind.slug),
    title: t(locale, "kindNationwide", { kind: pickText(kind.name, locale) }),
    description: t(locale, "tagline"),
  });
}

export default async function NationalKindPage({ params }: Props) {
  const { locale, index, kind } = await load(params);
  const [page, places] = await Promise.all([
    getBusinesses(COUNTRY_SLUG, { kind: kind.slug }),
    getPlaces("live"),
  ]);
  if (!page) notFound();
  const rows = toRows(page.items, { locale, index, names: placeNames(null, places), here: null });
  return (
    <>
      <CityBar locale={locale} crumbs={crumbsFor(locale, { nationalKind: kind })} segments={paths.nationalKind(kind.slug)} />
      <main id="main" className="frame">
        <div id="city-list" className="reveal">
          <h1 id="main-heading" tabIndex={-1} className="page-title">
            {t(locale, "kindNationwide", { kind: pickText(kind.name, locale) })}
          </h1>
          {rows.length > 0 ? (
            <BusinessList
              locale={locale}
              rows={rows}
              more={page.nextCursor ? { place: COUNTRY_SLUG, kind: kind.slug, cursor: page.nextCursor } : null}
            />
          ) : (
            <NoneYet title={t(locale, "noneHereYet", { place: t(locale, "country") })} subtitle="" places={[]} />
          )}
        </div>
      </main>
    </>
  );
}
```

- [ ] **Step 5: The place shortcut** — `apps/web/src/app/[locale]/[place]/k/[kind]/page.tsx`

```tsx
import { notFound, redirect } from "next/navigation";
import { getTaxonomy } from "@/lib/api";
import { localeOrNotFound } from "@/lib/levels";
import { href, paths } from "@/lib/routes";
import { indexTaxonomy } from "@/lib/taxonomy";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

/** Search lands here without knowing the sector; the canonical URL has it. */
export default async function PlaceKindShortcut({
  params,
}: {
  params: Promise<{ locale: string; place: string; kind: string }>;
}) {
  const raw = await params;
  const locale = localeOrNotFound(raw.locale);
  const index = indexTaxonomy(await getTaxonomy());
  const kind = index.kindBySlug.get(raw.kind);
  const sector = kind ? index.sectorById.get(kind.sectorId) : undefined;
  if (!kind || !sector) notFound();
  redirect(href(locale, paths.kind(raw.place, sector.slug, kind.slug)));
}
```

- [ ] **Step 6: Run checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS.

With `pnpm dev` running:

```bash
curl -s http://localhost:3000/k/barbershops | grep -o 'data-business-link=' | wc -l
curl -s 'http://localhost:3000/api/businesses?locale=en&place=israel&kind=barbershops&cursor=eyJvIjozMH0' | head -c 200
curl -s -o /dev/null -w '%{http_code} %{redirect_url}\n' http://localhost:3000/sakhnin/k/barbershops
```

Expected: `30`; JSON starting `{"rows":[{"key":` (`eyJvIjozMH0` is the cursor for offset 30); a
`307` to `/sakhnin/beauty/barbershops`.

- [ ] **Step 7: Visual check**

Run: `node apps/web/scripts/shoot.mjs /k/barbershops /ar/k/barbershops`
Check VC1–VC8: rows name their place in sage; the "Show more" pill sits under the list.

- [ ] **Step 8: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): show more, kind across Israel and the place-kind shortcut"
```

---

### Task 15: Experience templates

One body component per template, each laying out the shared screen content (brand, title, subtitle,
tags, items with meta, cta, palette, font) in a way that fits the template. Business identity
(palette, font) stays separate from Darb's corporate styling.

**Files:**
- Modify: `packages/contracts/src/schemas.ts`, `packages/contracts/src/schemas.test.ts`
- Modify: `packages/seed/data/screens.json` (one palette), `packages/seed/src/validate.test.ts`
- Create: `apps/web/src/components/templates/shared.tsx`, `index.ts`, `ScreenView.tsx`, `Menu.tsx`,
  `Booking.tsx`, `Shop.tsx`, `Portfolio.tsx`, `Listing.tsx`, `Schedule.tsx`, `Quote.tsx`, `Donate.tsx`,
  `Tracker.tsx`, `Pass.tsx`, `Builder.tsx`, `templates.module.css`, `templates.test.tsx`

**Interfaces:**
- Consumes: `TEMPLATES`, `Template`, `pickText`, `readableOn` (Task 9).
- Produces: `ScreenSchema`, `ScreenDto` (contracts); `TemplateProps { screen: ScreenDto; locale: Locale }`;
  `TEMPLATE_BODIES: Record<Template, (props: TemplateProps) => JSX.Element>`;
  `parseScreen(experience: unknown): ScreenDto | null`;
  `<ScreenView screen template locale />` (`data-template={template}`, items `data-item`).

- [ ] **Step 1: Write the failing contract test** — append to `packages/contracts/src/schemas.test.ts`

```ts
import { ScreenSchema } from "./schemas.js";

describe("ScreenSchema", () => {
  const screen = {
    brand: { he: "המספרה של סאמר", en: "Samer's" },
    title: { en: "A chair in two taps" },
    items: [{ label: { en: "Haircut" }, meta: { en: "₪60" } }],
    cta: { en: "Book" },
    palette: { bg: "#efe3cf", surface: "#fbf5ea", ink: "#2b1d14", accent: "#b4542a" },
    font: "Suez One",
  };
  it("accepts a showroom screen", () => {
    expect(ScreenSchema.parse(screen).font).toBe("Suez One");
  });
  it("rejects a screen without items or with a bad colour", () => {
    expect(ScreenSchema.safeParse({ ...screen, items: [] }).success).toBe(false);
    expect(ScreenSchema.safeParse({ ...screen, palette: { ...screen.palette, bg: "red" } }).success).toBe(false);
  });
});
```

Merge the import into the file's existing `./schemas.js` import.

Run: `pnpm --filter @darb/contracts test`
Expected: FAIL — `ScreenSchema` not exported.

- [ ] **Step 2: Add the schema** — append to `packages/contracts/src/schemas.ts`

```ts
const hex = z.string().regex(/^#[0-9a-fA-F]{6}$/);

/** A business's experience screen (the v1 shape every template shares; see seed SCREEN_SCHEMA). */
export const ScreenSchema = z.object({
  brand: LocalizedSchema,
  title: LocalizedSchema,
  subtitle: LocalizedSchema.optional(),
  tags: z.array(LocalizedSchema).optional(),
  items: z.array(z.object({ label: LocalizedSchema, meta: LocalizedSchema.optional() })).min(1),
  cta: LocalizedSchema,
  palette: z.object({ bg: hex, surface: hex, ink: hex, accent: hex }),
  font: z.string().min(1),
});
export type ScreenDto = z.infer<typeof ScreenSchema>;
```

Run: `pnpm --filter @darb/contracts test && pnpm --filter @darb/contracts build`
Expected: PASS.

- [ ] **Step 3: Gate screen palettes on contrast** — append to `packages/seed/src/validate.test.ts`

```ts
function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
const contrast = (a: string, b: string) => {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
};

describe("screen palettes", () => {
  it("keep ink readable (WCAG AA) on the background and the surface", () => {
    for (const [slug, s] of Object.entries(loadScreens())) {
      expect(contrast(s.palette.ink, s.palette.bg), `${slug} ink/bg`).toBeGreaterThanOrEqual(4.5);
      expect(contrast(s.palette.ink, s.palette.surface), `${slug} ink/surface`).toBeGreaterThanOrEqual(4.5);
    }
  });
});
```

Run: `pnpm --filter @darb/seed test`
Expected: FAIL — `tractors ink/bg` is 4.3.

In `packages/seed/data/screens.json`, in the `"tractors"` screen's `palette`, change
`"ink": "#fff4e6"` to `"ink": "#ffffff"` (4.67 on its background, 5.83 on its surface). Only that one
value changes.

Run: `pnpm --filter @darb/seed test`
Expected: PASS.

- [ ] **Step 4: Write the failing template test** — `apps/web/src/components/templates/templates.test.tsx`

```tsx
import { render } from "@testing-library/react";
import { TEMPLATES } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { parseScreen, TEMPLATE_BODIES } from "./index";
import { ScreenView } from "./ScreenView";

const screen: ScreenDto = {
  brand: { he: "המספרה של סאמר", en: "Samer's Barbershop" },
  title: { he: "תור בשתי לחיצות", en: "A chair in two taps" },
  subtitle: { he: "היום", en: "Today" },
  tags: [{ en: "16:00" }, { en: "16:30" }],
  items: [
    { label: { he: "תספורת", en: "Haircut" }, meta: { en: "₪60 · 30 min" } },
    { label: { he: "תספורת וזקן", en: "Cut and beard" } },
  ],
  cta: { en: "Book" },
  palette: { bg: "#efe3cf", surface: "#fbf5ea", ink: "#2b1d14", accent: "#b4542a" },
  font: "Suez One",
};

describe.each(TEMPLATES)("%s template", (template) => {
  it("renders every item and tag inside its own layout", () => {
    const { container } = render(<ScreenView screen={screen} template={template} locale="en" />);
    const root = container.querySelector(`[data-template="${template}"]`);
    expect(root).not.toBeNull();
    expect(container.querySelectorAll("[data-item]")).toHaveLength(2);
    for (const text of ["Samer's Barbershop", "A chair in two taps", "Haircut", "Cut and beard", "₪60 · 30 min", "16:00"])
      expect(container.textContent).toContain(text);
  });
  it("falls back from Arabic to Hebrew, never to blank", () => {
    const { container } = render(<ScreenView screen={screen} template={template} locale="ar" />);
    expect(container.textContent).toContain("המספרה של סאמר");
    expect(container.textContent).toContain("תספורת וזקן");
  });
});

it("has a body for every template", () => {
  expect(Object.keys(TEMPLATE_BODIES).sort()).toEqual([...TEMPLATES].sort());
});

it("parses only valid screens", () => {
  expect(parseScreen(screen)).toEqual(screen);
  expect(parseScreen({ title: { en: "x" } })).toBeNull();
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./index` missing.

- [ ] **Step 5: Shared pieces** — `apps/web/src/components/templates/shared.tsx`

```tsx
import { pickText, type Locale, type Localized } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import styles from "./templates.module.css";

export interface TemplateProps {
  screen: ScreenDto;
  locale: Locale;
}

export const text = (value: Localized | undefined, locale: Locale): string =>
  value ? pickText(value, locale) : "";

/** Tags as pills; `variant` changes only their look. */
export function Tags({ screen, locale, variant = "pill" }: TemplateProps & { variant?: "pill" | "slot" | "amount" }) {
  if (!screen.tags || screen.tags.length === 0) return null;
  return (
    <ul className={`${styles.tags} ${styles[variant]}`}>
      {screen.tags.map((tag, i) => (
        <li key={i}>{text(tag, locale)}</li>
      ))}
    </ul>
  );
}
```

- [ ] **Step 6: The eleven bodies** — each file is under `apps/web/src/components/templates/`

`Menu.tsx` — categories, then dishes with a dotted leader to the price:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Menu({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} />
      <ul className={styles.menu}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="">
            <span>{text(item.label, locale)}</span>
            <span className={styles.leader} aria-hidden="true" />
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`Booking.tsx` — free slots, then services as cards:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Booking({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} variant="slot" />
      <ul className={styles.cards}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" className={styles.card}>
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`Shop.tsx` — a two-column product grid with a colour swatch:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Shop({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} />
      <ul className={styles.grid}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" className={styles.tile}>
            <span className={styles.swatch} aria-hidden="true" />
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`Portfolio.tsx` — a gallery of captioned frames:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Portfolio({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <ul className={styles.gallery}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="">
            <span className={styles.frame} aria-hidden="true" />
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
```

`Listing.tsx` — a spec sheet of label and value rows:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Listing({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <dl className={styles.specs}>
        {screen.items.map((item, i) => (
          <div key={i} data-item="">
            <dt>{text(item.label, locale)}</dt>
            <dd>{text(item.meta, locale)}</dd>
          </div>
        ))}
      </dl>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
```

`Schedule.tsx` — a timeline with the time first:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Schedule({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} variant="slot" />
      <ol className={styles.timeline}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="">
            <span className={styles.when}>{text(item.meta, locale)}</span>
            <span className={styles.strong}>{text(item.label, locale)}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
```

`Quote.tsx` — numbered request steps:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Quote({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <ol className={styles.steps}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="">
            <span className={styles.number} aria-hidden="true">
              {i + 1}
            </span>
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ol>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
```

`Donate.tsx` — amounts first, then where it goes:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Donate({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} variant="amount" />
      <ul className={styles.cards}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" className={styles.card}>
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

`Tracker.tsx` — a vertical stepper, the first step reached:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Tracker({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <ol className={styles.stepper}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="" data-reached={i === 0 ? "" : undefined}>
            <span className={styles.marker} aria-hidden="true" />
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ol>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
```

`Pass.tsx` — a card with fields and a code block:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

/** A decorative code pattern, the same for the same brand. */
function codeCells(seed: string): boolean[] {
  let x = 7;
  for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  return Array.from({ length: 49 }, (_, i) => ((x >>> (i % 29)) ^ (i * 2654435761)) % 3 === 0);
}

export function Pass({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <div className={styles.pass}>
        <dl className={styles.fields}>
          {screen.items.map((item, i) => (
            <div key={i} data-item="">
              <dt>{text(item.label, locale)}</dt>
              <dd>{text(item.meta, locale)}</dd>
            </div>
          ))}
        </dl>
        <div className={styles.code} aria-hidden="true">
          {codeCells(text(screen.brand, "en")).map((on, i) => (
            <span key={i} data-on={on ? "" : undefined} />
          ))}
        </div>
      </div>
      <Tags screen={screen} locale={locale} />
    </div>
  );
}
```

`Builder.tsx` — options to choose from:

```tsx
import { Tags, text, type TemplateProps } from "./shared";
import styles from "./templates.module.css";

export function Builder({ screen, locale }: TemplateProps) {
  return (
    <div className={styles.body}>
      <Tags screen={screen} locale={locale} />
      <ul className={styles.options}>
        {screen.items.map((item, i) => (
          <li key={i} data-item="">
            <span className={styles.check} aria-hidden="true" data-checked={i === 0 ? "" : undefined} />
            <span className={styles.strong}>{text(item.label, locale)}</span>
            <span className={styles.meta}>{text(item.meta, locale)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 7: The registry and the screen frame**

`apps/web/src/components/templates/index.ts`:

```ts
import type { Template } from "@darb/core";
import { ScreenSchema, type ScreenDto } from "@darb/contracts";
import type { JSX } from "react";
import { Booking } from "./Booking";
import { Builder } from "./Builder";
import { Donate } from "./Donate";
import { Listing } from "./Listing";
import { Menu } from "./Menu";
import { Pass } from "./Pass";
import { Portfolio } from "./Portfolio";
import { Quote } from "./Quote";
import { Schedule } from "./Schedule";
import type { TemplateProps } from "./shared";
import { Shop } from "./Shop";
import { Tracker } from "./Tracker";

export const TEMPLATE_BODIES: Record<Template, (props: TemplateProps) => JSX.Element> = {
  menu: Menu,
  booking: Booking,
  shop: Shop,
  portfolio: Portfolio,
  listing: Listing,
  schedule: Schedule,
  quote: Quote,
  donate: Donate,
  tracker: Tracker,
  pass: Pass,
  builder: Builder,
};

export function parseScreen(experience: unknown): ScreenDto | null {
  const parsed = ScreenSchema.safeParse(experience);
  return parsed.success ? parsed.data : null;
}
```

`apps/web/src/components/templates/ScreenView.tsx`:

```tsx
import type { CSSProperties } from "react";
import type { Locale, Template } from "@darb/core";
import type { ScreenDto } from "@darb/contracts";
import { readableOn } from "@/lib/contrast";
import { TEMPLATE_BODIES } from "./index";
import { text } from "./shared";
import styles from "./templates.module.css";

/** The business's own app screen, in its own palette and typeface. */
export function ScreenView({ screen, template, locale }: { screen: ScreenDto; template: Template; locale: Locale }) {
  const Body = TEMPLATE_BODIES[template];
  const font = screen.font.replace(/[^\p{L}\p{N} -]/gu, "");
  const style = {
    "--t-bg": screen.palette.bg,
    "--t-surface": screen.palette.surface,
    "--t-ink": screen.palette.ink,
    "--t-accent": screen.palette.accent,
    "--t-on-accent": readableOn(screen.palette.accent),
    "--t-font": `"${font}"`,
  } as CSSProperties;
  return (
    <section className={styles.screen} style={style} data-template={template} aria-label={text(screen.brand, locale)}>
      <div className={styles.appBar}>
        <span className={styles.brand}>{text(screen.brand, locale)}</span>
      </div>
      <div className={styles.hero}>
        <p className={styles.title}>{text(screen.title, locale)}</p>
        {screen.subtitle ? <p className={styles.subtitle}>{text(screen.subtitle, locale)}</p> : null}
      </div>
      <Body screen={screen} locale={locale} />
    </section>
  );
}
```

The template's typeface is named but not downloaded (it would cost every sheet a font request); it
renders when the device has it and falls back to the page font otherwise.

`apps/web/src/components/templates/templates.module.css` — text is always `--t-ink` on `--t-bg` or
`--t-surface` (contrast-gated in seed); the accent is decoration or carries `--t-on-accent` text:

```css
.screen {
  margin-block: var(--space-5);
  border-radius: var(--radius-l);
  overflow: hidden;
  background: var(--t-bg);
  color: var(--t-ink);
  font-family: var(--t-font), var(--font-body);
  box-shadow: var(--shadow-panel);
}

.appBar {
  display: flex;
  align-items: center;
  min-block-size: 48px;
  padding-inline: var(--space-4);
  background: var(--t-surface);
  border-block-end: 3px solid var(--t-accent);
}

.brand {
  font-weight: 700;
}

.hero {
  padding: var(--space-5) var(--space-4) var(--space-2);
}

.title {
  margin: 0;
  font-size: var(--step-2);
  font-weight: 700;
  line-height: 1.25;
}

.subtitle {
  margin: var(--space-1) 0 0;
  font-size: var(--step--1);
}

.body {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-3) var(--space-4) var(--space-5);
}

.strong {
  font-weight: 700;
}

.meta {
  font-size: var(--step--1);
}

.tags {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.tags li {
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-pill);
  background: var(--t-surface);
  font-size: var(--step--1);
}

.slot li {
  border: 1px solid var(--t-accent);
  border-radius: var(--radius-s);
  font-variant-numeric: tabular-nums;
}

.amount li {
  background: var(--t-accent);
  color: var(--t-on-accent);
  font-weight: 700;
}

.pill li {
  border: 1px solid transparent;
}

.menu,
.cards,
.grid,
.gallery,
.timeline,
.steps,
.stepper,
.options {
  display: grid;
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.menu li {
  display: flex;
  align-items: baseline;
  gap: var(--space-2);
  padding-block: var(--space-2);
}

.leader {
  flex: 1;
  border-block-end: 1px dotted var(--t-ink);
}

.card,
.tile,
.gallery li,
.steps li,
.options li,
.timeline li,
.stepper li {
  display: grid;
  gap: 2px;
  padding: var(--space-3);
  border-radius: var(--radius-m);
  background: var(--t-surface);
}

.grid {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.swatch {
  block-size: 56px;
  border-radius: var(--radius-s);
  background: var(--t-accent);
  margin-block-end: var(--space-2);
}

.gallery {
  grid-template-columns: repeat(2, minmax(0, 1fr));
}

.frame {
  aspect-ratio: 4 / 3;
  border-radius: var(--radius-s);
  background: linear-gradient(135deg, var(--t-accent), var(--t-bg));
  margin-block-end: var(--space-2);
}

.specs,
.fields {
  display: grid;
  margin: 0;
}

.specs div,
.fields div {
  display: flex;
  justify-content: space-between;
  gap: var(--space-3);
  padding-block: var(--space-2);
  border-block-end: 1px solid var(--t-surface);
}

.specs dd,
.fields dd {
  margin: 0;
  font-weight: 700;
}

.when {
  font-size: var(--step--1);
  font-variant-numeric: tabular-nums;
  border-inline-start: 3px solid var(--t-accent);
  padding-inline-start: var(--space-2);
}

.steps li {
  grid-template-columns: auto 1fr;
  column-gap: var(--space-3);
}

.steps .meta {
  grid-column: 2;
}

.number {
  grid-row: span 2;
  display: grid;
  place-items: center;
  inline-size: 28px;
  block-size: 28px;
  border-radius: 50%;
  background: var(--t-accent);
  color: var(--t-on-accent);
  font-weight: 700;
}

.stepper li {
  grid-template-columns: auto 1fr;
  column-gap: var(--space-3);
}

.stepper .meta {
  grid-column: 2;
}

.marker {
  grid-row: span 2;
  inline-size: 14px;
  block-size: 14px;
  margin-block-start: 4px;
  border-radius: 50%;
  border: 2px solid var(--t-accent);
}

.stepper li[data-reached] .marker {
  background: var(--t-accent);
}

.pass {
  display: grid;
  gap: var(--space-4);
  padding: var(--space-4);
  border-radius: var(--radius-m);
  background: var(--t-surface);
  border-inline-start: 6px solid var(--t-accent);
}

.code {
  display: grid;
  grid-template-columns: repeat(7, 12px);
  gap: 2px;
  justify-content: center;
}

.code span {
  block-size: 12px;
  background: var(--t-bg);
}

.code span[data-on] {
  background: var(--t-ink);
}

.options li {
  grid-template-columns: auto 1fr;
  column-gap: var(--space-3);
}

.options .meta {
  grid-column: 2;
}

.check {
  grid-row: span 2;
  inline-size: 20px;
  block-size: 20px;
  border-radius: 6px;
  border: 2px solid var(--t-accent);
}

.check[data-checked] {
  background: var(--t-accent);
}
```

- [ ] **Step 8: Run the tests**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS (22 template cases, registry and parse tests; the CSS guard passes on the new file).

- [ ] **Step 9: Commit**

```bash
pnpm format && pnpm lint
git add packages/contracts packages/seed apps/web/src
git commit -m "feat(web): eleven experience templates in each business's own palette"
```

---
### Task 16: The experience sheet

A bottom sheet with peek, half and full snap points on phones and a side panel on the inline end on
desktop. It is a modal dialog: focus moves in, Tab is trapped, Escape and the close button navigate to
level 3, the background is `inert`, and focus returns to the row that opened it.

**Files:**
- Create: `apps/web/src/components/Sheet.tsx`, `apps/web/src/components/Sheet.module.css`,
  `apps/web/src/components/Sheet.test.tsx`

**Interfaces:**
- Consumes: element ids `site-header`, `city-bar`, `city-list`, `main-heading` and the
  `[data-business-link="{key}"]` rows (Tasks 10, 13).
- Produces: `type Snap = "peek" | "half" | "full"`; `nextSnap(current, direction: 1 | -1): Snap`;
  `snapFromDrag(current, deltaY): Snap`; `focusables(root): HTMLElement[]`;
  `<Sheet closeHref labelledBy returnFocusTo labels={{ close, resize }}>{children}</Sheet>`
  (`role="dialog"`, `data-sheet`, `data-snap`, close button `data-sheet-close`, handle `data-sheet-handle`);
  `SHEET_BACKGROUND_IDS = ["site-header", "city-bar", "city-list"]`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/Sheet.test.tsx`

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const { nextSnap, Sheet, snapFromDrag } = await import("./Sheet");

beforeEach(() => {
  document.body.innerHTML = `
    <header id="site-header"><a href="/">home</a></header>
    <div id="city-bar"></div>
    <div id="city-list"><h1 id="main-heading" tabindex="-1">List</h1>
      <a href="/x" data-business-link="sakhnin/samers-barbershop">Samer's</a></div>`;
});
afterEach(() => push.mockReset());

const renderSheet = () =>
  render(
    <Sheet
      closeHref="/sakhnin/beauty/barbershops"
      labelledBy="sheet-title"
      returnFocusTo="sakhnin/samers-barbershop"
      labels={{ close: "Close", resize: "Resize" }}
    >
      <h2 id="sheet-title">Samer's</h2>
      <a href="https://wa.me/1">WhatsApp</a>
      <button type="button">Share</button>
    </Sheet>,
    { container: document.body.appendChild(document.createElement("div")) },
  );

describe("Sheet", () => {
  it("opens as a labelled modal dialog with focus on close and the city inert", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog.getAttribute("aria-modal")).toBe("true");
    expect(dialog.getAttribute("aria-labelledby")).toBe("sheet-title");
    expect(document.activeElement?.getAttribute("data-sheet-close")).toBe("");
    for (const id of ["site-header", "city-bar", "city-list"])
      expect(document.getElementById(id)?.hasAttribute("inert")).toBe(true);
  });

  it("closes on Escape by going to the kind level without scrolling", () => {
    renderSheet();
    fireEvent.keyDown(screen.getByRole("dialog"), { key: "Escape" });
    expect(push).toHaveBeenCalledWith("/sakhnin/beauty/barbershops", { scroll: false });
  });

  it("closes from the close button", () => {
    renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(push).toHaveBeenCalledWith("/sakhnin/beauty/barbershops", { scroll: false });
  });

  it("traps Tab inside the dialog in both directions", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    const share = screen.getByRole("button", { name: "Share" });
    share.focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement?.getAttribute("data-sheet-handle")).toBe("");
    fireEvent.keyDown(dialog, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(share);
  });

  it("gives focus back to the row that opened it and lifts inert when it closes", () => {
    const { unmount } = renderSheet();
    unmount();
    expect(document.activeElement?.getAttribute("data-business-link")).toBe("sakhnin/samers-barbershop");
    expect(document.getElementById("city-list")?.hasAttribute("inert")).toBe(false);
  });

  it("falls back to the page heading when the row is not on the page", () => {
    document.querySelector("[data-business-link]")?.remove();
    const { unmount } = renderSheet();
    unmount();
    expect(document.activeElement?.id).toBe("main-heading");
  });

  it("moves between snap points from the keyboard", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    const handle = screen.getByRole("button", { name: "Resize" });
    expect(dialog.getAttribute("data-snap")).toBe("half");
    fireEvent.keyDown(handle, { key: "ArrowUp" });
    expect(dialog.getAttribute("data-snap")).toBe("full");
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    fireEvent.keyDown(handle, { key: "ArrowDown" });
    expect(dialog.getAttribute("data-snap")).toBe("peek");
  });
});

describe("snap rules", () => {
  it("steps and clamps", () => {
    expect(nextSnap("half", 1)).toBe("full");
    expect(nextSnap("full", 1)).toBe("full");
    expect(nextSnap("peek", -1)).toBe("peek");
  });
  it("follows a drag past 60 px", () => {
    expect(snapFromDrag("half", -80)).toBe("full");
    expect(snapFromDrag("half", 80)).toBe("peek");
    expect(snapFromDrag("half", 30)).toBe("half");
  });
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./Sheet` missing.

- [ ] **Step 2: Implement** — `apps/web/src/components/Sheet.tsx`

```tsx
"use client";

import { useRouter } from "next/navigation";
import {
  useEffect,
  useRef,
  useState,
  type KeyboardEvent,
  type PointerEvent,
  type ReactNode,
} from "react";
import styles from "./Sheet.module.css";

export type Snap = "peek" | "half" | "full";
const ORDER: readonly Snap[] = ["peek", "half", "full"];
const DRAG_THRESHOLD = 60;
const DISMISS_DRAG = 120;

/** Everything behind the sheet; made inert while it is open. */
export const SHEET_BACKGROUND_IDS = ["site-header", "city-bar", "city-list"] as const;

export function nextSnap(current: Snap, direction: 1 | -1): Snap {
  const i = Math.min(ORDER.length - 1, Math.max(0, ORDER.indexOf(current) + direction));
  return ORDER[i]!;
}

/** Dragging up (negative) opens further, dragging down closes further. */
export function snapFromDrag(current: Snap, deltaY: number): Snap {
  if (deltaY < -DRAG_THRESHOLD) return nextSnap(current, 1);
  if (deltaY > DRAG_THRESHOLD) return nextSnap(current, -1);
  return current;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

export function focusables(root: HTMLElement): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => {
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

export interface SheetProps {
  /** Level 3: where closing goes. */
  closeHref: string;
  labelledBy: string;
  /** `data-business-link` key of the row that opens this sheet. */
  returnFocusTo: string;
  labels: { close: string; resize: string };
  children: ReactNode;
}

export function Sheet({ closeHref, labelledBy, returnFocusTo, labels, children }: SheetProps) {
  const router = useRouter();
  const panel = useRef<HTMLDivElement>(null);
  const closeButton = useRef<HTMLButtonElement>(null);
  const drag = useRef<{ startY: number } | null>(null);
  const [snap, setSnap] = useState<Snap>("half");

  useEffect(() => {
    const background = SHEET_BACKGROUND_IDS.map((id) => document.getElementById(id));
    for (const el of background) el?.setAttribute("inert", "");
    closeButton.current?.focus();
    return () => {
      for (const el of background) el?.removeAttribute("inert");
      const row = document.querySelector<HTMLElement>(`[data-business-link="${returnFocusTo}"]`);
      (row ?? document.getElementById("main-heading"))?.focus();
    };
  }, [returnFocusTo]);

  const close = () => router.push(closeHref, { scroll: false });

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      close();
      return;
    }
    if (event.key !== "Tab" || !panel.current) return;
    const items = focusables(panel.current);
    const first = items[0];
    const last = items[items.length - 1];
    if (!first || !last) return;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function onHandleKey(event: KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setSnap((s) => nextSnap(s, 1));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setSnap((s) => nextSnap(s, -1));
    }
  }

  function onPointerDown(event: PointerEvent<HTMLButtonElement>) {
    drag.current = { startY: event.clientY };
    event.currentTarget.setPointerCapture(event.pointerId);
    panel.current?.setAttribute("data-dragging", "");
  }

  function onPointerMove(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    panel.current?.style.setProperty("--drag", `${event.clientY - drag.current.startY}px`);
  }

  function onPointerEnd(event: PointerEvent<HTMLButtonElement>) {
    if (!drag.current) return;
    const deltaY = event.clientY - drag.current.startY;
    drag.current = null;
    panel.current?.removeAttribute("data-dragging");
    panel.current?.style.removeProperty("--drag");
    if (snap === "peek" && deltaY > DISMISS_DRAG) close();
    else setSnap((s) => snapFromDrag(s, deltaY));
  }

  return (
    <div className={styles.root} data-sheet="">
      <div className={styles.scrim} aria-hidden="true" onClick={close} />
      <div
        ref={panel}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        className={styles.panel}
        data-snap={snap}
        onKeyDown={onKeyDown}
      >
        <div className={styles.top}>
          <span aria-hidden="true" />
          <button
            type="button"
            className={styles.handle}
            aria-label={labels.resize}
            data-sheet-handle=""
            onKeyDown={onHandleKey}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={onPointerEnd}
            onPointerCancel={onPointerEnd}
          />
          <button
            ref={closeButton}
            type="button"
            className={styles.close}
            aria-label={labels.close}
            data-sheet-close=""
            onClick={close}
          >
            <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
              <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className={styles.body}>{children}</div>
      </div>
    </div>
  );
}
```

`apps/web/src/components/Sheet.module.css`:

```css
.root {
  position: fixed;
  inset: 0;
  z-index: 40;
  pointer-events: none;
}

.scrim {
  position: absolute;
  inset: 0;
  background: rgb(3 17 12 / 0.55);
  pointer-events: auto;
  transition: opacity var(--dur) var(--ease-out);
}

@starting-style {
  .scrim {
    opacity: 0;
  }
}

/* Phone: a bottom sheet. --snap-y is how far it sits below fully open. */
.panel {
  --peek: 220px;
  --snap-y: 45%;
  position: absolute;
  inset-inline: 0;
  inset-block-end: 0;
  block-size: 92dvh;
  display: grid;
  grid-template-rows: auto 1fr;
  background: var(--surface-1);
  border-block-start: 1px solid var(--line);
  border-start-start-radius: var(--radius-l);
  border-start-end-radius: var(--radius-l);
  box-shadow: var(--shadow-panel);
  pointer-events: auto;
  transform: translateY(calc(var(--snap-y) + var(--drag, 0px)));
  transition: transform var(--dur) var(--ease-out);
}

.panel[data-snap="peek"] {
  --snap-y: calc(100% - var(--peek));
}

.panel[data-snap="half"] {
  --snap-y: 45%;
}

.panel[data-snap="full"] {
  --snap-y: 0px;
}

.panel[data-dragging] {
  transition: none;
}

@starting-style {
  .panel {
    transform: translateY(100%);
  }
}

.top {
  display: grid;
  grid-template-columns: var(--tap) 1fr var(--tap);
  align-items: center;
  padding: var(--space-2) var(--space-3) 0;
}

.handle {
  justify-self: center;
  display: grid;
  place-items: center;
  inline-size: 72px;
  block-size: var(--tap);
  border: 0;
  background: transparent;
  cursor: grab;
  touch-action: none;
}

.handle::after {
  content: "";
  inline-size: 40px;
  block-size: 4px;
  border-radius: 2px;
  background: var(--ivory-200);
}

.close {
  display: grid;
  place-items: center;
  inline-size: var(--tap);
  block-size: var(--tap);
  border-radius: var(--radius-pill);
  border: 1px solid var(--line);
  background: var(--surface-2);
  color: var(--text);
  cursor: pointer;
}

.body {
  overflow-y: auto;
  overscroll-behavior: contain;
  padding: 0 var(--gutter) calc(var(--space-7) + env(safe-area-inset-bottom));
}

/* Desktop: a side panel on the inline end (right in English, left in Hebrew and Arabic). */
@media (min-width: 900px) {
  .scrim {
    background: rgb(3 17 12 / 0.35);
  }

  .panel {
    inset-block: 0;
    inset-inline-start: auto;
    inset-inline-end: 0;
    inline-size: min(480px, 100%);
    block-size: auto;
    border-block-start: 0;
    border-inline-start: 1px solid var(--line);
    border-start-start-radius: 0;
    border-start-end-radius: 0;
    transform: none;
    transition: opacity var(--dur) var(--ease-out);
  }

  @starting-style {
    .panel {
      opacity: 0;
      transform: none;
    }
  }

  .handle {
    display: none;
  }
}

@media (prefers-reduced-motion: reduce) {
  .panel {
    transition: opacity var(--dur-fast) var(--ease-out);
  }

  @starting-style {
    .panel {
      opacity: 0;
      transform: translateY(var(--snap-y));
    }
  }
}
```

- [ ] **Step 3: Run the tests**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS (9 sheet tests; the CSS guard passes).

- [ ] **Step 4: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/components
git commit -m "feat(web): accessible experience sheet with snap points and focus return"
```

---

### Task 17: Level 4, the business

`/{place}/{sector}/{kind}/{business}` renders the level 3 list (from the layout) with the sheet open.
The sheet shows the name, kind and place, the Example badge, open-now state, the template screen, the
primary action, call / WhatsApp / directions / share, opening hours, the website and, for the darb
tier, "Open the app". Only http(s) links are rendered.

**Files:**
- Create: `apps/web/src/components/SheetActions.tsx`, `SheetActions.test.tsx`, `ExperienceView.tsx`,
  `Experience.module.css`, `HoursTable.tsx` (under `apps/web/src/components/`),
  `apps/web/src/app/[locale]/[place]/[sector]/[kind]/[business]/page.tsx`,
  `apps/web/src/app/[locale]/[place]/[sector]/[kind]/[business]/[...rest]/page.tsx`

**Interfaces:**
- Consumes: `loadKindLevel(raw, rest)`, `getBusiness`, `kindCovers`, `Sheet`, `ScreenView`,
  `parseScreen`, `LocaleSwitch`, `primaryAction`, `telHref`, `whatsappHref`, `directionsHref`,
  `safeHttpUrl`, `hoursRows`, `hasHours`, `formatPhone`, `siteUrl`, `crumbsFor`, `CityBar`.
- Produces: `<SheetActions primary ctaLabel secondary share labels />` (primary `data-primary-action`,
  status line `data-sheet-status`); `<ExperienceView locale business kind placeName segments shareUrl />`
  (title `id="sheet-title"`, `data-sheet-title`); `<HoursTable locale hours />`.

- [ ] **Step 1: Write the failing test** — `apps/web/src/components/SheetActions.test.tsx`

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { SheetActions, type SheetActionsProps } from "./SheetActions";

afterEach(() => vi.unstubAllGlobals());

const base: SheetActionsProps = {
  primary: { kind: "example" },
  ctaLabel: "Book a chair",
  secondary: { call: null, whatsapp: null, directions: "https://www.google.com/maps/dir/?api=1&destination=1,2", website: null, apps: [] },
  share: { url: "https://darb.co.il/sakhnin", title: "Samer's" },
  labels: {
    call: "Call",
    whatsapp: "WhatsApp",
    directions: "Directions",
    share: "Share",
    website: "Website",
    exampleNotice: "This is an example — this is what your customers would see",
    linkCopied: "Link copied",
  },
};

it("explains an example instead of contacting anyone", () => {
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Book a chair" }));
  expect(screen.getByRole("status").textContent).toBe(base.labels.exampleNotice);
});

it("opens WhatsApp in a new tab for a real business", () => {
  render(<SheetActions {...base} primary={{ kind: "whatsapp", href: "https://wa.me/972501234567?text=Hi" }} />);
  const link = screen.getByRole("link", { name: "Book a chair" });
  expect(link.getAttribute("href")).toBe("https://wa.me/972501234567?text=Hi");
  expect(link.getAttribute("target")).toBe("_blank");
  expect(link.getAttribute("rel")).toBe("noopener noreferrer");
});

it("shows only the secondary actions that exist", () => {
  render(<SheetActions {...base} secondary={{ ...base.secondary, call: "tel:+97246012345" }} />);
  expect(screen.getByRole("link", { name: "Call" }).getAttribute("href")).toBe("tel:+97246012345");
  expect(screen.queryByRole("link", { name: "WhatsApp" })).toBeNull();
  expect(screen.getByRole("link", { name: "Directions" })).toBeTruthy();
});

it("copies the link when the device cannot share", async () => {
  const writeText = vi.fn().mockResolvedValue(undefined);
  vi.stubGlobal("navigator", { clipboard: { writeText } });
  render(<SheetActions {...base} />);
  fireEvent.click(screen.getByRole("button", { name: "Share" }));
  await waitFor(() => expect(screen.getByRole("status").textContent).toBe("Link copied"));
  expect(writeText).toHaveBeenCalledWith("https://darb.co.il/sakhnin");
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./SheetActions` missing.

- [ ] **Step 2: Actions** — `apps/web/src/components/SheetActions.tsx`

```tsx
"use client";

import { useState } from "react";
import type { PrimaryAction } from "@/lib/links";
import styles from "./Experience.module.css";

export interface SheetActionsProps {
  primary: PrimaryAction;
  /** The business's own call to action, e.g. "Book a chair". */
  ctaLabel: string;
  /** Already-safe hrefs (tel:, https://wa.me, https://…) or null when absent. */
  secondary: {
    call: string | null;
    whatsapp: string | null;
    directions: string;
    website: string | null;
    apps: { label: string; href: string }[];
  };
  share: { url: string; title: string };
  labels: {
    call: string;
    whatsapp: string;
    directions: string;
    share: string;
    website: string;
    exampleNotice: string;
    linkCopied: string;
  };
}

const external = { target: "_blank", rel: "noopener noreferrer" } as const;

export function SheetActions({ primary, ctaLabel, secondary, share, labels }: SheetActionsProps) {
  const [status, setStatus] = useState("");

  async function onShare() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: share.title, url: share.url });
      } catch {
        // Dismissed: nothing to say.
      }
      return;
    }
    await navigator.clipboard?.writeText(share.url);
    setStatus(labels.linkCopied);
  }

  return (
    <div className={styles.actions}>
      {primary.kind === "whatsapp" || primary.kind === "call" ? (
        <a
          href={primary.href}
          className={styles.primary}
          data-primary-action=""
          {...(primary.kind === "whatsapp" ? external : {})}
        >
          {ctaLabel}
        </a>
      ) : primary.kind === "example" ? (
        <button
          type="button"
          className={styles.primary}
          data-primary-action=""
          onClick={() => setStatus(labels.exampleNotice)}
        >
          {ctaLabel}
        </button>
      ) : null}
      <p role="status" className={styles.status} data-sheet-status="">
        {status}
      </p>
      <ul className={styles.secondary}>
        {secondary.call ? (
          <li>
            <a href={secondary.call}>{labels.call}</a>
          </li>
        ) : null}
        {secondary.whatsapp ? (
          <li>
            <a href={secondary.whatsapp} {...external}>
              {labels.whatsapp}
            </a>
          </li>
        ) : null}
        <li>
          <a href={secondary.directions} {...external}>
            {labels.directions}
          </a>
        </li>
        <li>
          <button type="button" onClick={onShare}>
            {labels.share}
          </button>
        </li>
        {secondary.website ? (
          <li>
            <a href={secondary.website} {...external}>
              {labels.website}
            </a>
          </li>
        ) : null}
        {secondary.apps.map((app) => (
          <li key={app.href}>
            <a href={app.href} {...external} data-open-app="">
              {app.label}
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
```

- [ ] **Step 3: Hours and the sheet content**

`apps/web/src/components/HoursTable.tsx`:

```tsx
import type { Locale } from "@darb/core";
import type { BusinessDetailDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { hasHours, hoursRows } from "@/lib/format";
import styles from "./Experience.module.css";

export function HoursTable({ locale, hours }: { locale: Locale; hours: BusinessDetailDto["hours"] }) {
  return (
    <section aria-labelledby="hours-title" className={styles.section}>
      <h3 id="hours-title" className={styles.sectionTitle}>
        {t(locale, "hours")}
      </h3>
      {hasHours(hours) ? (
        <table className={styles.hours}>
          <tbody>
            {hoursRows(hours, locale).map((row) => (
              <tr key={row.day} data-today={row.today ? "" : undefined}>
                <th scope="row">{row.name}</th>
                <td>{row.closed ? row.text : <span dir="ltr">{row.text}</span>}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className={styles.muted}>{t(locale, "hoursUnknown")}</p>
      )}
    </section>
  );
}
```

`apps/web/src/components/ExperienceView.tsx`:

```tsx
import { pickText, type Locale } from "@darb/core";
import type { BusinessDetailDto, KindDto } from "@darb/contracts";
import { t } from "@darb/i18n";
import { formatPhone } from "@/lib/format";
import { directionsHref, primaryAction, safeHttpUrl, telHref, whatsappHref } from "@/lib/links";
import { ExampleBadge, OpenState } from "./Badges";
import { LocaleSwitch } from "./CityBar";
import { HoursTable } from "./HoursTable";
import { SheetActions } from "./SheetActions";
import { parseScreen } from "./templates";
import { ScreenView } from "./templates/ScreenView";
import styles from "./Experience.module.css";

export interface ExperienceViewProps {
  locale: Locale;
  business: BusinessDetailDto;
  /** The business's primary kind: its template and its name. */
  kind: KindDto;
  placeName: string;
  /** Level 4 segments, for the in-sheet locale switch. */
  segments: readonly string[];
  shareUrl: string;
}

export function ExperienceView({ locale, business, kind, placeName, segments, shareUrl }: ExperienceViewProps) {
  const name = pickText(business.name, locale);
  const screen = parseScreen(business.experience);
  const apps =
    business.tier === "darb"
      ? [business.apps.web, business.apps.ios, business.apps.android]
          .map((url) => safeHttpUrl(url))
          .filter((url): url is string => url !== null)
          .map((url) => ({ label: t(locale, "openTheApp"), href: url }))
      : [];
  const greeting = t(locale, "whatsappGreeting", { name });
  return (
    <article className={styles.view}>
      <header className={styles.head}>
        <LocaleSwitch locale={locale} segments={segments} />
        <h2 id="sheet-title" className={styles.title} data-sheet-title="">
          {name}
        </h2>
        <p className={styles.kind}>
          {pickText(kind.name, locale)} · {placeName}
        </p>
        <p className={styles.badges}>
          {business.tier === "example" ? <ExampleBadge label={t(locale, "example")} /> : null}
          <OpenState openNow={business.openNow} labels={{ open: t(locale, "openNow"), closed: t(locale, "closed") }} />
        </p>
        {business.phone ? (
          <p className={styles.muted}>
            <span dir="ltr">{formatPhone(business.phone)}</span>
          </p>
        ) : null}
      </header>
      {screen ? <ScreenView screen={screen} template={kind.template} locale={locale} /> : null}
      <SheetActions
        primary={primaryAction(business, locale)}
        ctaLabel={screen ? pickText(screen.cta, locale) : t(locale, "call")}
        secondary={{
          call: business.phone ? telHref(business.phone) : null,
          whatsapp: business.whatsapp ? whatsappHref(business.whatsapp, greeting) : null,
          directions: directionsHref(business.lat, business.lng),
          website: safeHttpUrl(business.website),
          apps,
        }}
        share={{ url: shareUrl, title: name }}
        labels={{
          call: t(locale, "call"),
          whatsapp: t(locale, "whatsapp"),
          directions: t(locale, "directions"),
          share: t(locale, "share"),
          website: t(locale, "website"),
          exampleNotice: t(locale, "exampleNotice"),
          linkCopied: t(locale, "linkCopied"),
        }}
      />
      <HoursTable locale={locale} hours={business.hours} />
    </article>
  );
}
```

`apps/web/src/components/Experience.module.css`:

```css
.view {
  display: grid;
  gap: var(--space-2);
}

.head {
  display: grid;
  gap: var(--space-2);
}

.title {
  font-size: var(--step-3);
}

.kind {
  margin: 0;
  color: var(--text-soft);
}

.badges {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: var(--space-3);
  margin: 0;
}

.muted {
  margin: 0;
  color: var(--text-muted);
}

.actions {
  display: grid;
  gap: var(--space-3);
}

.primary {
  display: flex;
  align-items: center;
  justify-content: center;
  min-block-size: 52px;
  padding-inline: var(--space-5);
  border: 0;
  border-radius: var(--radius-pill);
  background: var(--gold);
  color: var(--night);
  font: inherit;
  font-weight: 700;
  font-size: var(--step-1);
  text-decoration: none;
  cursor: pointer;
}

.status {
  margin: 0;
  min-block-size: 1.5em;
  color: var(--gold-300);
}

.secondary {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(96px, 1fr));
  gap: var(--space-2);
  margin: 0;
  padding: 0;
  list-style: none;
}

.secondary a,
.secondary button {
  display: flex;
  align-items: center;
  justify-content: center;
  inline-size: 100%;
  min-block-size: var(--tap);
  padding-inline: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--text);
  font: inherit;
  text-decoration: none;
  cursor: pointer;
}

.section {
  margin-block: var(--space-5);
}

.sectionTitle {
  font-size: var(--step-1);
  margin-block-end: var(--space-2);
}

.hours {
  inline-size: 100%;
  border-collapse: collapse;
}

.hours th,
.hours td {
  padding-block: var(--space-2);
  border-block-end: 1px solid var(--line-soft);
  text-align: start;
  font-weight: 400;
}

.hours td {
  text-align: end;
  color: var(--text-soft);
}

.hours tr[data-today] th,
.hours tr[data-today] td {
  color: var(--gold-300);
  font-weight: 700;
}
```

- [ ] **Step 4: The level 4 page** — `apps/web/src/app/[locale]/[place]/[sector]/[kind]/[business]/page.tsx`

```tsx
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { ExperienceView } from "@/components/ExperienceView";
import { Sheet } from "@/components/Sheet";
import { getBusiness } from "@/lib/api";
import { crumbsFor } from "@/lib/crumbs";
import { loadKindLevel } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import { siteUrl } from "@/lib/site";
import { kindCovers } from "@/lib/taxonomy";

export const revalidate = 300;
export function generateStaticParams() {
  return [];
}

type Params = { locale: string; place: string; sector: string; kind: string; business: string };
type Props = { params: Promise<Params> };

/** The business must live in exactly this place (the API 404s otherwise) and be of this kind. */
async function load(params: Props["params"]) {
  const raw = await params;
  const level = await loadKindLevel(raw, [raw.business]);
  const business = await getBusiness(level.place.slug, raw.business);
  if (!business) notFound();
  const ofKind = [business.primaryKindId, ...business.kindIds].some((id) =>
    kindCovers(level.index, level.kind.id, id),
  );
  if (!ofKind) notFound();
  const primaryKind = level.index.kindById.get(business.primaryKindId) ?? level.kind;
  return { ...level, business, primaryKind };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, place, sector, kind, business } = await load(params);
  return pageMetadata({
    locale,
    segments: paths.business(place.slug, sector.slug, kind.slug, business.slug),
    title: pickText(business.name, locale),
    description:
      pickText(business.tagline, locale) ||
      t(locale, "kindInPlace", { kind: pickText(kind.name, locale), place: pickText(place.name, locale) }),
  });
}

export default async function BusinessPage({ params }: Props) {
  const { locale, place, sector, kind, business, primaryKind } = await load(params);
  const segments = paths.business(place.slug, sector.slug, kind.slug, business.slug);
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { place, sector, kind, business })}
        segments={segments}
      />
      <Sheet
        closeHref={href(locale, paths.kind(place.slug, sector.slug, kind.slug))}
        labelledBy="sheet-title"
        returnFocusTo={`${place.slug}/${business.slug}`}
        labels={{ close: t(locale, "close"), resize: t(locale, "resizeSheet") }}
      >
        <ExperienceView
          locale={locale}
          business={business}
          kind={primaryKind}
          placeName={pickText(place.name, locale)}
          segments={segments}
          shareUrl={`${siteUrl()}${href(locale, segments)}`}
        />
      </Sheet>
    </>
  );
}
```

Deeper URLs 404 inside the city frame —
`apps/web/src/app/[locale]/[place]/[sector]/[kind]/[business]/[...rest]/page.tsx`:

```tsx
import { notFound } from "next/navigation";

export default function TooDeep(): never {
  notFound();
}
```

- [ ] **Step 5: Run checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS.

With `pnpm dev` running:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/sakhnin/beauty/barbershops/samers-barbershop
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/arraba/beauty/nails/perla-nails
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/sakhnin/beauty/nails/samers-barbershop
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/sakhnin/beauty/barbershops/samers-barbershop/extra
```

Expected: `200`, `404` (business of another place), `404` (wrong kind), `404` (too deep).

- [ ] **Step 6: Visual check**

Run: `node apps/web/scripts/shoot.mjs /sakhnin/beauty/barbershops/samers-barbershop /ar/sakhnin/food/restaurants/beit-al-zaytoun /en/sakhnin/civic/municipal/umm-al-fahm-municipality`
Check VC1–VC10. Phone: the sheet sits at half height over the list with a handle and close button,
the business screen in its own palette inside; desktop: the side panel is on the left in Hebrew and
Arabic and on the right in English, with the list visible behind a light scrim; the primary action is
a gold pill; hours show the Israeli week from Sunday with today in gold and times written
left-to-right. (The civic URL changes in Task 24; use whatever civic business exists at this point.)

- [ ] **Step 7: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): business level opens the experience sheet with actions and hours"
```

---

### Task 18: Near me and the search placeholder

"Near me" asks for location only when tapped, then goes to the nearest live place (or, on a national
kind page, the nearest place that has the kind). Denied location explains itself in one line. The
search page says smart search is coming.

**Files:**
- Create: `apps/web/src/components/NearMe.tsx`, `NearMe.test.tsx`, `NearMe.module.css`,
  `apps/web/src/app/api/near/route.ts`, `apps/web/src/app/api/near/route.test.ts`,
  `apps/web/src/app/[locale]/search/page.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/[locale]/k/[kind]/page.tsx`

**Interfaces:**
- Consumes: `getNearestPlace(lat, lng, "no-store")`, `getNearestPlacesWithKind(kind, lat, lng, 1, "no-store")`,
  `getTaxonomy`, `indexTaxonomy`, `href`, `paths`.
- Produces: `GET /api/near?locale&lat&lng[&kind]` → `{ href }` | 404 | 400 | 503 (never cached,
  coordinates never logged); `<NearMe locale kind? homeHref labels={{ nearMe, locating, denied }} />`
  (button `data-near-me` or `data-near-me-kind`, message `data-near-me-message`).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/app/api/near/route.test.ts`:

```ts
// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const getNearestPlace = vi.fn();
const getNearestPlacesWithKind = vi.fn();
const getTaxonomy = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiUnavailableError: class extends Error {},
  getNearestPlace,
  getNearestPlacesWithKind,
  getTaxonomy,
}));
const { GET } = await import("./route");

afterEach(() => vi.resetAllMocks());

const get = (query: string) => GET(new Request(`http://web.test/api/near?${query}`));

it("sends a person to the nearest live place, uncached", async () => {
  getNearestPlace.mockResolvedValue({ slug: "arraba" });
  const res = await get("locale=ar&lat=32.85&lng=35.34");
  expect(await res.json()).toEqual({ href: "/ar/arraba" });
  expect(getNearestPlace).toHaveBeenCalledWith(32.85, 35.34, "no-store");
});

it("sends them to the nearest place with the kind on a national kind page", async () => {
  getTaxonomy.mockResolvedValue({
    sectors: [{ id: "s1", slug: "beauty", name: { en: "B" }, tagline: { en: "t" }, accent: "#aa7744", order: 1,
      kinds: [{ id: "k1", slug: "nails", sectorId: "s1", parentKindId: null, name: { en: "Nails" }, template: "booking", attributes: [], icon: null, order: 1 }] }],
  });
  getNearestPlacesWithKind.mockResolvedValue([{ slug: "sakhnin" }]);
  const res = await get("locale=he&lat=32.85&lng=35.34&kind=nails");
  expect(await res.json()).toEqual({ href: "/sakhnin/beauty/nails" });
  expect(getNearestPlacesWithKind).toHaveBeenCalledWith("nails", 32.85, 35.34, 1, "no-store");
});

it("rejects bad coordinates and reports nothing found", async () => {
  expect((await get("locale=he&lat=&lng=35")).status).toBe(400);
  getNearestPlace.mockResolvedValue(null);
  expect((await get("locale=he&lat=29.5&lng=34.9")).status).toBe(404);
});
```

`apps/web/src/components/NearMe.test.tsx`:

```tsx
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";

const push = vi.fn();
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));
const { NearMe } = await import("./NearMe");

afterEach(() => {
  vi.unstubAllGlobals();
  push.mockReset();
});

const labels = { nearMe: "Near me", locating: "Finding you…", denied: "Location is off. Pick a place from the list instead." };

function stubLocation(result: "granted" | "denied") {
  vi.stubGlobal("navigator", {
    geolocation: {
      getCurrentPosition: (ok: PositionCallback, fail: PositionErrorCallback) =>
        result === "granted"
          ? ok({ coords: { latitude: 32.85, longitude: 35.34 } } as GeolocationPosition)
          : fail({ code: 1 } as GeolocationPositionError),
    },
  });
}

it("asks for location only when tapped, then goes to the nearest place", async () => {
  stubLocation("granted");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ href: "/arraba" })));
  render(<NearMe locale="he" homeHref="/" labels={labels} />);
  expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  await waitFor(() => expect(push).toHaveBeenCalledWith("/arraba"));
  expect(String(vi.mocked(fetch).mock.calls[0]![0])).toBe("/api/near?locale=he&lat=32.85&lng=35.34");
});

it("explains in one line when location is denied", async () => {
  stubLocation("denied");
  render(<NearMe locale="en" homeHref="/en" labels={labels} />);
  fireEvent.click(screen.getByRole("button", { name: "Near me" }));
  await waitFor(() => expect(screen.getByText(labels.denied)).toBeTruthy());
  expect(push).not.toHaveBeenCalled();
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./route` and `./NearMe` missing.

- [ ] **Step 2: The route** — `apps/web/src/app/api/near/route.ts`

```ts
import { SlugSchema } from "@darb/contracts";
import { z } from "zod";
import { ApiUnavailableError, getNearestPlace, getNearestPlacesWithKind, getTaxonomy } from "@/lib/api";
import { href, paths } from "@/lib/routes";
import { indexTaxonomy } from "@/lib/taxonomy";

const coordinate = (min: number, max: number) => z.string().trim().min(1).pipe(z.coerce.number().min(min).max(max));
const Query = z.object({
  locale: z.enum(["he", "ar", "en"]),
  lat: coordinate(-90, 90),
  lng: coordinate(-180, 180),
  kind: SlugSchema.optional(),
});

/** A person's position is used once, never cached and never logged. */
export async function GET(request: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { locale, lat, lng, kind } = parsed.data;
  try {
    if (kind) {
      const index = indexTaxonomy(await getTaxonomy());
      const k = index.kindBySlug.get(kind);
      const sector = k ? index.sectorById.get(k.sectorId) : undefined;
      if (!k || !sector) return Response.json({ message: "Unknown kind" }, { status: 404 });
      const [place] = (await getNearestPlacesWithKind(k.slug, lat, lng, 1, "no-store")) ?? [];
      if (!place) return Response.json({ message: "None yet" }, { status: 404 });
      return Response.json({ href: href(locale, paths.kind(place.slug, sector.slug, k.slug)) });
    }
    const place = await getNearestPlace(lat, lng, "no-store");
    if (!place) return Response.json({ message: "No live place" }, { status: 404 });
    return Response.json({ href: href(locale, paths.place(place.slug)) });
  } catch (error) {
    if (error instanceof ApiUnavailableError) return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
```

- [ ] **Step 3: The button** — `apps/web/src/components/NearMe.tsx`

```tsx
"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import type { Locale } from "@darb/core";
import styles from "./NearMe.module.css";

export interface NearMeProps {
  locale: Locale;
  /** On a national kind page: find the nearest place that has it. */
  kind?: string;
  /** Where "pick a place" sends people when location is off. */
  homeHref: string;
  labels: { nearMe: string; locating: string; denied: string };
}

export function NearMe({ locale, kind, homeHref, labels }: NearMeProps) {
  const router = useRouter();
  const [state, setState] = useState<"idle" | "locating" | "denied">("idle");

  function locate() {
    if (!("geolocation" in navigator)) {
      setState("denied");
      return;
    }
    setState("locating");
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        const query = new URLSearchParams({
          locale,
          lat: String(coords.latitude),
          lng: String(coords.longitude),
          ...(kind ? { kind } : {}),
        });
        try {
          const res = await fetch(`/api/near?${query}`);
          if (!res.ok) throw new Error(String(res.status));
          const { href } = (await res.json()) as { href: string };
          router.push(href);
        } catch {
          setState("denied");
        }
      },
      () => setState("denied"),
      { timeout: 10_000, maximumAge: 600_000 },
    );
  }

  return (
    <div className={styles.nearMe}>
      <button
        type="button"
        className={styles.button}
        onClick={locate}
        aria-busy={state === "locating"}
        {...(kind ? { "data-near-me-kind": "" } : { "data-near-me": "" })}
      >
        <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
          <circle cx="12" cy="12" r="3" fill="currentColor" />
          <circle cx="12" cy="12" r="8" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        <span className={styles.label}>{state === "locating" ? labels.locating : labels.nearMe}</span>
      </button>
      {state === "denied" ? (
        <p role="status" className={styles.message} data-near-me-message="">
          <Link href={`${homeHref}#places`}>{labels.denied}</Link>
        </p>
      ) : null}
    </div>
  );
}
```

`apps/web/src/components/NearMe.module.css`:

```css
.nearMe {
  position: relative;
}

.button {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  min-block-size: 48px;
  min-inline-size: 48px;
  padding-inline: var(--space-3);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  color: var(--gold-300);
  font: inherit;
  cursor: pointer;
  white-space: nowrap;
}

.message {
  position: absolute;
  inset-inline-end: 0;
  inset-block-end: calc(100% + var(--space-2));
  z-index: 30;
  inline-size: max-content;
  max-inline-size: min(80vw, 320px);
  margin: 0;
  padding: var(--space-3);
  border-radius: var(--radius-m);
  background: var(--surface-3);
  color: var(--text);
  font-size: var(--step--1);
}

@media (min-width: 900px) {
  .message {
    inset-block-end: auto;
    inset-block-start: calc(100% + var(--space-2));
  }
}

@media (max-width: 479px) {
  .label {
    position: absolute;
    inline-size: 1px;
    block-size: 1px;
    overflow: hidden;
    clip-path: inset(50%);
    white-space: nowrap;
  }
}
```

(On a phone the button keeps its text for screen readers but shows only the icon.)

- [ ] **Step 4: Wire it in** — in `apps/web/src/app/[locale]/layout.tsx`, import `NearMe` and `href`,
  and pass it to the header:

```tsx
        <Header
          locale={locale}
          nearMe={
            <NearMe
              locale={locale}
              homeHref={href(locale)}
              labels={{ nearMe: t(locale, "nearMe"), locating: t(locale, "locating"), denied: t(locale, "locationDenied") }}
            />
          }
        />
```

In `apps/web/src/app/[locale]/k/[kind]/page.tsx`, below the `<h1>`, add (import `NearMe` and `href`):

```tsx
          <NearMe
            locale={locale}
            kind={kind.slug}
            homeHref={href(locale)}
            labels={{ nearMe: t(locale, "nearMe"), locating: t(locale, "locating"), denied: t(locale, "locationDenied") }}
          />
```

- [ ] **Step 5: The search placeholder** — `apps/web/src/app/[locale]/search/page.tsx`

```tsx
import type { Metadata } from "next";
import Link from "next/link";
import { LOCALES } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";

/** Plan 3 replaces this page with smart search. */
export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  return {
    ...pageMetadata({ locale, segments: paths.search(), title: t(locale, "search"), description: t(locale, "searchSoon") }),
    robots: { index: false },
  };
}

export default async function SearchPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { page: { label: t(locale, "search"), href: href(locale, paths.search()) } })}
        segments={paths.search()}
      />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {t(locale, "search")}
        </h1>
        <p className="lede">{t(locale, "searchSoon")}</p>
        <p>
          <Link className="button-link" href={`${href(locale)}#places`}>
            {t(locale, "places")}
          </Link>
        </p>
      </main>
    </>
  );
}
```

- [ ] **Step 6: Run checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS.

- [ ] **Step 7: Visual check**

Run: `node apps/web/scripts/shoot.mjs / /k/nails /en/search`
Check VC4 (the docked bar holds the search field and the round near-me button within thumb reach),
VC7 and VC8.

- [ ] **Step 8: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): near me on request, and the search placeholder"
```

---
### Task 19: Errors and empty states

An unknown slug offers the closest place or kind by slug similarity, otherwise a plain 404 inside the
city frame. An unreachable API shows a quiet notice with a retry.

**Files:**
- Create: `apps/web/src/lib/fuzzy.ts`, `apps/web/src/lib/fuzzy.test.ts`,
  `apps/web/src/app/api/closest/route.ts`, `apps/web/src/components/ClosestMatch.tsx`,
  `apps/web/src/components/NotFoundView.tsx`, `apps/web/src/components/ErrorView.tsx`,
  `apps/web/src/components/ErrorView.test.tsx`, `apps/web/src/app/[locale]/not-found.tsx`,
  `apps/web/src/app/[locale]/error.tsx`, `apps/web/src/app/[locale]/k/[kind]/[...rest]/page.tsx`,
  `apps/web/src/app/[locale]/[place]/k/[kind]/[...rest]/page.tsx`

**Interfaces:**
- Consumes: `getPlaces`, `getTaxonomy`, `indexTaxonomy`, `isLocale`, `href`, `t`, `pickText`.
- Produces: `levenshtein(a, b): number`; `closestSlug(input, candidates): string | null`;
  `SlugWorld { places: string[]; sectors: string[]; kinds: Map<kindSlug, sectorSlug> }`;
  `closestPath(segments, world): string[] | null`; `GET /api/closest?path=` → `{ href, label }` | 404;
  `<NotFoundView />` (`data-not-found`, back link `data-back-home`), `<ClosestMatch template />`
  (link `data-closest-match`), `<ErrorView retry />` (`data-unreachable`).

- [ ] **Step 1: Write the failing tests**

`apps/web/src/lib/fuzzy.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { closestPath, closestSlug, levenshtein } from "./fuzzy";

describe("levenshtein", () => {
  it("counts edits", () => {
    expect(levenshtein("sakhnim", "sakhnin")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("closestSlug", () => {
  const places = ["haifa", "sakhnin", "tamra", "tamra-yizreel", "arraba"];
  it("finds near misses", () => {
    expect(closestSlug("sakhnim", places)).toBe("sakhnin");
    expect(closestSlug("hifa", places)).toBe("haifa");
    expect(closestSlug("arabba", places)).toBe("arraba");
  });
  it("gives up on nonsense", () => {
    expect(closestSlug("qqqqqqqqqq", places)).toBeNull();
    expect(closestSlug("x", places)).toBeNull();
  });
});

describe("closestPath", () => {
  const world = {
    places: ["sakhnin", "haifa"],
    sectors: ["beauty", "food"],
    kinds: new Map([
      ["barbershops", "beauty"],
      ["restaurants", "food"],
    ]),
  };
  it("corrects a place", () => {
    expect(closestPath(["sakhnim"], world)).toEqual(["sakhnin"]);
  });
  it("corrects a kind and puts it under its own sector", () => {
    expect(closestPath(["sakhnin", "beauty", "barbershop"], world)).toEqual(["sakhnin", "beauty", "barbershops"]);
    expect(closestPath(["sakhnin", "food", "barbershop"], world)).toEqual(["sakhnin", "beauty", "barbershops"]);
    expect(closestPath(["k", "resturants"], world)).toEqual(["k", "restaurants"]);
    expect(closestPath(["sakhnin", "k", "barbrshops"], world)).toEqual(["sakhnin", "beauty", "barbershops"]);
  });
  it("drops an unknown business back to its kind", () => {
    expect(closestPath(["sakhnin", "beauty", "barbershops", "nobody"], world)).toEqual([
      "sakhnin",
      "beauty",
      "barbershops",
    ]);
  });
  it("offers nothing when nothing is close or the path is already right", () => {
    expect(closestPath(["qqqqqqqqqq"], world)).toBeNull();
    expect(closestPath(["sakhnin", "beauty"], world)).toBeNull();
  });
});
```

`apps/web/src/components/ErrorView.test.tsx`:

```tsx
import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useParams: () => ({ locale: "ar" }) }));
const { ErrorView } = await import("./ErrorView");

it("says quietly that Darb cannot be reached and retries on request", () => {
  const retry = vi.fn();
  render(<ErrorView retry={retry} />);
  expect(screen.getByRole("status").textContent).toContain("لا يمكن الوصول إلى درب الآن.");
  fireEvent.click(screen.getByRole("button", { name: "حاول مرة أخرى" }));
  expect(retry).toHaveBeenCalledOnce();
});
```

Run: `pnpm --filter @darb/web test`
Expected: FAIL — `./fuzzy` and `./ErrorView` missing.

- [ ] **Step 2: Fuzzy matching** — `apps/web/src/lib/fuzzy.ts`

```ts
export function levenshtein(a: string, b: string): number {
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j]! + 1, current[j - 1]! + 1, previous[j - 1]! + cost);
    }
    previous = current;
  }
  return previous[b.length]!;
}

/** The candidate within max(1, ⌊length/3⌋) edits, closest first, alphabetical on ties. */
export function closestSlug(input: string, candidates: readonly string[]): string | null {
  if (input.length < 2) return null;
  const limit = Math.max(1, Math.floor(input.length / 3));
  let best: string | null = null;
  let bestDistance = Infinity;
  for (const candidate of candidates) {
    if (Math.abs(candidate.length - input.length) > limit) continue;
    const distance = levenshtein(input, candidate);
    if (distance < bestDistance || (distance === bestDistance && best !== null && candidate < best)) {
      best = candidate;
      bestDistance = distance;
    }
  }
  return bestDistance <= limit ? best : null;
}

export interface SlugWorld {
  places: readonly string[];
  sectors: readonly string[];
  /** kind slug → its sector slug */
  kinds: ReadonlyMap<string, string>;
}

const pick = (input: string | undefined, candidates: readonly string[]) =>
  input === undefined ? null : candidates.includes(input) ? input : closestSlug(input, candidates);

/** The nearest real path to a broken one, or null when there is none or it is not broken. */
export function closestPath(segments: readonly string[], world: SlugWorld): string[] | null {
  const [first, second, third] = segments;
  if (!first) return null;
  const kindSlugs = [...world.kinds.keys()];
  const kindPath = (place: string, kind: string) => [place, world.kinds.get(kind)!, kind];
  let result: string[] | null;
  if (first === "k") {
    const kind = pick(second, kindSlugs);
    result = kind ? ["k", kind] : null;
  } else {
    const place = pick(first, world.places);
    if (!place) return null;
    result = [place];
    if (second === "k") {
      const kind = pick(third, kindSlugs);
      if (kind) result = kindPath(place, kind);
    } else if (second !== undefined) {
      const kind = pick(third, kindSlugs);
      if (kind) result = kindPath(place, kind);
      else {
        const sector = pick(second, world.sectors);
        if (sector) result = [place, sector];
      }
    }
  }
  if (!result || result.join("/") === segments.join("/")) return null;
  return result;
}
```

- [ ] **Step 3: The suggestion route** — `apps/web/src/app/api/closest/route.ts`

```ts
import { pickText, type Locale } from "@darb/core";
import { getPlaces, getTaxonomy } from "@/lib/api";
import { closestPath } from "@/lib/fuzzy";
import { isLocale } from "@/lib/locale";
import { href } from "@/lib/routes";
import { indexTaxonomy } from "@/lib/taxonomy";

export async function GET(request: Request): Promise<Response> {
  const path = new URL(request.url).searchParams.get("path") ?? "";
  if (path.length > 300) return Response.json(null, { status: 400 });
  const parts = path.split("/").filter(Boolean).map((s) => s.toLowerCase());
  const locale: Locale = parts[0] && isLocale(parts[0]) ? (parts.shift() as Locale) : "he";
  try {
    const [places, taxonomy] = await Promise.all([getPlaces(), getTaxonomy()]);
    const index = indexTaxonomy(taxonomy);
    const kinds = new Map(
      [...index.kindBySlug.values()].map((k) => [k.slug, index.sectorById.get(k.sectorId)?.slug ?? ""]),
    );
    const match = closestPath(parts, { places: places.map((p) => p.slug), sectors: index.sectors.map((s) => s.slug), kinds });
    if (!match) return Response.json(null, { status: 404 });
    const names = match.flatMap((segment) => {
      if (segment === "k") return [];
      const place = places.find((p) => p.slug === segment);
      const sector = index.sectorBySlug.get(segment);
      const kind = index.kindBySlug.get(segment);
      const name = place?.name ?? kind?.name ?? sector?.name;
      return name ? [pickText(name, locale)] : [];
    });
    return Response.json({ href: href(locale, match), label: names.join(" › ") });
  } catch {
    return Response.json(null, { status: 503 });
  }
}
```

- [ ] **Step 4: The 404 and error views**

`apps/web/src/components/ClosestMatch.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/** Looks up the closest real path once the 404 is on screen. `template` holds "{name}". */
export function ClosestMatch({ template }: { template: string }) {
  const [match, setMatch] = useState<{ href: string; label: string } | null>(null);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`/api/closest?path=${encodeURIComponent(window.location.pathname)}`, { signal: controller.signal })
      .then((res) => (res.ok ? (res.json() as Promise<{ href: string; label: string }>) : null))
      .then((found) => setMatch(found))
      .catch(() => undefined);
    return () => controller.abort();
  }, []);
  if (!match) return null;
  const [before, after] = template.split("{name}");
  return (
    <p className="lede">
      {before}
      <Link href={match.href} className="text-link" data-closest-match="">
        {match.label}
      </Link>
      {after}
    </p>
  );
}
```

`apps/web/src/components/NotFoundView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { t } from "@darb/i18n";
import { isLocale } from "@/lib/locale";
import { href } from "@/lib/routes";
import { ClosestMatch } from "./ClosestMatch";

/** Rendered inside the city frame (the [locale] layout); the locale comes from the route. */
export function NotFoundView() {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : "he";
  return (
    <main id="main" className="frame reveal" data-not-found="">
      <h1 id="main-heading" tabIndex={-1} className="page-title">
        {t(locale, "notFoundTitle")}
      </h1>
      <p className="lede">{t(locale, "notFoundBody")}</p>
      <ClosestMatch template={t(locale, "didYouMean", { name: "{name}" })} />
      <p>
        <Link href={href(locale)} className="button-link" data-back-home="">
          {t(locale, "backToCity")}
        </Link>
      </p>
    </main>
  );
}
```

`apps/web/src/components/ErrorView.tsx`:

```tsx
"use client";

import { useParams } from "next/navigation";
import { t } from "@darb/i18n";
import { isLocale } from "@/lib/locale";

/** API unreachable: a quiet notice and a retry, inside the city frame. */
export function ErrorView({ retry }: { retry: () => void }) {
  const params = useParams<{ locale?: string }>();
  const locale = params.locale && isLocale(params.locale) ? params.locale : "he";
  return (
    <main id="main" className="frame">
      <div className="quiet" role="status" data-unreachable="">
        <p>{t(locale, "unreachable")}</p>
        <button type="button" className="button" onClick={() => retry()}>
          {t(locale, "retry")}
        </button>
      </div>
    </main>
  );
}
```

`apps/web/src/app/[locale]/not-found.tsx`:

```tsx
import { NotFoundView } from "@/components/NotFoundView";

export default function NotFound() {
  return <NotFoundView />;
}
```

`apps/web/src/app/[locale]/error.tsx`:

```tsx
"use client";

import { ErrorView } from "@/components/ErrorView";

export default function CityError({ retry }: { error: Error & { digest?: string }; retry: () => void }) {
  return <ErrorView retry={retry} />;
}
```

Too-deep catch-alls (same body in both files):
`apps/web/src/app/[locale]/k/[kind]/[...rest]/page.tsx` and
`apps/web/src/app/[locale]/[place]/k/[kind]/[...rest]/page.tsx`

```tsx
import { notFound } from "next/navigation";

export default function TooDeep(): never {
  notFound();
}
```

- [ ] **Step 5: Run checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck`
Expected: PASS.

With `pnpm dev` running:

```bash
curl -s -o /dev/null -w '%{http_code}\n' http://localhost:3000/sakhnim
curl -s 'http://localhost:3000/api/closest?path=/en/sakhnin/beauty/barbershop'
curl -s -o /dev/null -w '%{http_code}\n' 'http://localhost:3000/api/closest?path=/qqqqqqqqqq'
```

Expected: `404`; `{"href":"/en/sakhnin/beauty/barbershops","label":"Sakhnin › Beauty Row › Barbershops"}`
(the sector label is whatever the seed calls it); `404`.

- [ ] **Step 6: Visual check**

Run: `node apps/web/scripts/shoot.mjs /sakhnim /ar/qqqqqqqqqq`
Check VC1, VC2, VC6, VC8: the 404 sits inside the city frame (header and search present), offers
"Did you mean Sakhnin?" on the first and only "Back to the city" on the second.

- [ ] **Step 7: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): closest-match 404s inside the city and a quiet retry when the API is down"
```

---

### Task 20: `/for-business`

What Darb builds — a web app and a native app for any kind of business — with live client work and a
way to get in touch. Short copy; people looking for a business never pass through it.

**Files:**
- Create: `apps/web/src/content/for-business.ts`, `apps/web/src/app/[locale]/for-business/page.tsx`,
  `apps/web/src/components/ForBusiness.module.css`

**Interfaces:**
- Consumes: `crumbsFor({ page })`, `CityBar`, `DoorRim`, `pageMetadata`, `safeHttpUrl`.
- Produces: `forBusiness: Record<Locale, ForBusinessCopy>`, `LIVE_CLIENTS`, `CONTACT`; the page at
  `/for-business`, `/ar/for-business`, `/en/for-business` (prerendered at build; no API).

- [ ] **Step 1: The copy** — `apps/web/src/content/for-business.ts`

```ts
import type { Locale, Localized } from "@darb/core";

export interface ForBusinessCopy {
  title: string;
  lead: string;
  points: { title: string; body: string }[];
  clientsTitle: string;
  contactTitle: string;
  contactBody: string;
  email: string;
  instagram: string;
}

export const forBusiness: Record<Locale, ForBusinessCopy> = {
  en: {
    title: "Your business, as an app",
    lead: "Darb builds a web app and a native app for any kind of business, in any town, in Hebrew, Arabic and English.",
    points: [
      { title: "Any kind of business", body: "Restaurants, salons, garages, clinics, shops, mosques and two hundred more. Every door in this city shows what we build." },
      { title: "A web app", body: "Fast, installable and easy to find. Orders, bookings and questions reach you directly." },
      { title: "A native app", body: "On the App Store and Google Play, with your name, your colours and your language." },
    ],
    clientsTitle: "Live client work",
    contactTitle: "Talk to us",
    contactBody: "Tell us about your business and what your customers should be able to do.",
    email: "Email",
    instagram: "Instagram",
  },
  he: {
    title: "העסק שלכם, כאפליקציה",
    lead: "דרב בונה אפליקציית ווב ואפליקציה נייטיב לכל סוג עסק, בכל יישוב, בעברית, בערבית ובאנגלית.",
    points: [
      { title: "כל סוג של עסק", body: "מסעדות, מספרות, מוסכים, מרפאות, חנויות, מסגדים ועוד מאתיים סוגים. כל דלת בעיר הזו מראה מה אנחנו בונים." },
      { title: "אפליקציית ווב", body: "מהירה, ניתנת להתקנה וקלה למציאה. הזמנות, תורים ושאלות מגיעים ישר אליכם." },
      { title: "אפליקציה נייטיב", body: "ב-App Store וב-Google Play, עם השם, הצבעים והשפה שלכם." },
    ],
    clientsTitle: "עבודות חיות של לקוחות",
    contactTitle: "דברו איתנו",
    contactBody: "ספרו לנו על העסק ומה הלקוחות שלכם צריכים לעשות בו.",
    email: "אימייל",
    instagram: "אינסטגרם",
  },
  ar: {
    title: "مصلحتك، كتطبيق",
    lead: "درب تبني تطبيق ويب وتطبيقًا أصليًا لأي نوع من المصالح، في أي بلدة، بالعربية والعبرية والإنجليزية.",
    points: [
      { title: "أي نوع من المصالح", body: "مطاعم، صالونات، كراجات، عيادات، محلات، مساجد ومئتا نوع آخر. كل باب في هذه المدينة يُريك ما نبنيه." },
      { title: "تطبيق ويب", body: "سريع، قابل للتثبيت وسهل الإيجاد. الطلبات والحجوزات والأسئلة تصلك مباشرة." },
      { title: "تطبيق أصلي", body: "على App Store وGoogle Play، باسمك وألوانك ولغتك." },
    ],
    clientsTitle: "أعمال منشورة لزبائننا",
    contactTitle: "تحدّث معنا",
    contactBody: "أخبرنا عن مصلحتك وماذا يجب أن يستطيع زبائنك فعله.",
    email: "البريد الإلكتروني",
    instagram: "إنستغرام",
  },
};

export const LIVE_CLIENTS: { name: Localized; kind: Localized; url: string }[] = [
  { name: { he: "קרמל", ar: "كراميل", en: "Caramel" }, kind: { he: "מסעדה", ar: "مطعم", en: "Restaurant" }, url: "https://caramel.darb.co.il" },
  { name: { he: "רגד", ar: "رغد", en: "Raghad" }, kind: { he: "חנות", ar: "متجر", en: "Shop" }, url: "https://raghad.darb.co.il" },
  { name: { he: "פז", ar: "باز", en: "Paz" }, kind: { he: "תחנות דלק", ar: "محطات وقود", en: "Fuel stations" }, url: "https://paz.darb.co.il" },
];

export const CONTACT = { email: "founder@darb.co.il", instagram: "https://www.instagram.com/darbco/" };
```

- [ ] **Step 2: The page** — `apps/web/src/app/[locale]/for-business/page.tsx`

```tsx
import type { Metadata } from "next";
import { LOCALES, pickText } from "@darb/core";
import { t } from "@darb/i18n";
import { CityBar } from "@/components/CityBar";
import { DoorRim } from "@/components/Door";
import { CONTACT, forBusiness, LIVE_CLIENTS } from "@/content/for-business";
import { crumbsFor } from "@/lib/crumbs";
import { localeOrNotFound } from "@/lib/levels";
import { pageMetadata } from "@/lib/metadata";
import { href, paths } from "@/lib/routes";
import styles from "@/components/ForBusiness.module.css";

export function generateStaticParams() {
  return LOCALES.map((locale) => ({ locale }));
}

type Props = { params: Promise<{ locale: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const locale = localeOrNotFound((await params).locale);
  const copy = forBusiness[locale];
  return pageMetadata({ locale, segments: paths.forBusiness(), title: copy.title, description: copy.lead });
}

export default async function ForBusinessPage({ params }: Props) {
  const locale = localeOrNotFound((await params).locale);
  const copy = forBusiness[locale];
  return (
    <>
      <CityBar
        locale={locale}
        crumbs={crumbsFor(locale, { page: { label: t(locale, "forBusiness"), href: href(locale, paths.forBusiness()) } })}
        segments={paths.forBusiness()}
      />
      <main id="main" className="frame reveal">
        <h1 id="main-heading" tabIndex={-1} className="page-title">
          {copy.title}
        </h1>
        <p className="lede">{copy.lead}</p>
        <ul className={styles.points}>
          {copy.points.map((point) => (
            <li key={point.title} className={styles.point}>
              <DoorRim className={styles.rim} />
              <h2 className={styles.pointTitle}>{point.title}</h2>
              <p>{point.body}</p>
            </li>
          ))}
        </ul>
        <section aria-labelledby="clients-title" className={styles.section}>
          <h2 id="clients-title">{copy.clientsTitle}</h2>
          <ul className={styles.clients}>
            {LIVE_CLIENTS.map((client) => (
              <li key={client.url}>
                <a href={client.url} target="_blank" rel="noopener noreferrer" className={styles.client}>
                  <span className={styles.clientName}>{pickText(client.name, locale)}</span>
                  <span className={styles.clientKind}>{pickText(client.kind, locale)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
        <section aria-labelledby="contact-title" className={styles.section}>
          <h2 id="contact-title">{copy.contactTitle}</h2>
          <p>{copy.contactBody}</p>
          <p className={styles.contact}>
            <a className="button-link" href={`mailto:${CONTACT.email}`}>
              {copy.email}: <span dir="ltr">{CONTACT.email}</span>
            </a>
            <a className="button-link" href={CONTACT.instagram} target="_blank" rel="noopener noreferrer">
              {copy.instagram}
            </a>
          </p>
        </section>
      </main>
    </>
  );
}
```

`apps/web/src/components/ForBusiness.module.css`:

```css
.points {
  display: grid;
  gap: var(--space-4);
  margin: 0 0 var(--space-7);
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .points {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.point {
  position: relative;
  padding: var(--space-6) var(--space-5) var(--space-5);
  border-radius: var(--radius-l);
  background: linear-gradient(180deg, var(--surface-3), var(--surface-1));
  overflow: hidden;
}

.rim {
  position: absolute;
  inset-block-start: var(--space-4);
  inset-inline-end: var(--space-4);
  inline-size: 28px;
  block-size: 42px;
}

.pointTitle {
  font-size: var(--step-2);
  color: var(--gold-300);
  margin-block-end: var(--space-2);
}

.point p {
  margin: 0;
  color: var(--text-soft);
}

.section {
  margin-block: var(--space-7);
}

.section h2 {
  font-size: var(--step-3);
  margin-block-end: var(--space-4);
}

.clients {
  display: grid;
  gap: var(--space-3);
  margin: 0;
  padding: 0;
  list-style: none;
}

@media (min-width: 900px) {
  .clients {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.client {
  display: grid;
  gap: var(--space-1);
  min-block-size: 72px;
  padding: var(--space-4);
  border-radius: var(--radius-m);
  border: 1px solid var(--line);
  background: var(--surface-1);
  color: var(--text);
  text-decoration: none;
}

.clientName {
  font-weight: 700;
  font-size: var(--step-1);
}

.clientKind {
  color: var(--text-muted);
}

.contact {
  display: flex;
  flex-wrap: wrap;
  gap: var(--space-3);
}
```

- [ ] **Step 3: Run checks**

Run: `pnpm --filter @darb/web test && pnpm --filter @darb/web typecheck && pnpm --filter @darb/web build`
Expected: PASS; the build succeeds without the API running (the page needs no API data).

- [ ] **Step 4: Visual check**

Run: `node apps/web/scripts/shoot.mjs /for-business /ar/for-business /en/for-business`
Check VC1–VC10: three cards (any business, web app, native app) each with a small gold doorway rim,
three live client cards, and the contact buttons.

- [ ] **Step 5: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src
git commit -m "feat(web): for-business page with live client work and contact"
```

---

### Task 21: End-to-end suite

Playwright drives the built app against the seeded API at phone (390 × 844) and desktop
(1440 × 900) sizes: every level, the path bar, the locale switch, the sheet's keyboard flow, near me
(mocked location) and the error states. This task also pins Review Focus 1–5.

**Files:**
- Create: `apps/web/playwright.config.ts`, `apps/web/e2e/fixtures.ts`, `apps/web/e2e/levels.spec.ts`,
  `apps/web/e2e/pathbar.spec.ts`, `apps/web/e2e/locale.spec.ts`, `apps/web/e2e/sheet.spec.ts`,
  `apps/web/e2e/nearme.spec.ts`, `apps/web/e2e/errors.spec.ts`

**Interfaces:**
- Consumes: the data attributes produced by Tasks 10–20; the full seed (Plan 1 Task 18) loaded into
  the dev database.
- Produces: `LOCALES`, `localePath(locale, path)`, `LEVELS`, `EMPTY_KIND`, `OTHER_PLACE_BUSINESS`,
  `ARRABA`, `isPhone(testInfo)` in `e2e/fixtures.ts` (used by Task 22).

- [ ] **Step 1: Configure Playwright** — `apps/web/playwright.config.ts`

```ts
import { defineConfig } from "@playwright/test";

const WEB = process.env.WEB_URL ?? "http://localhost:3000";

export default defineConfig({
  testDir: "./e2e",
  timeout: 30_000,
  expect: { timeout: 10_000 },
  retries: process.env.CI ? 1 : 0,
  workers: process.env.CI ? 2 : undefined,
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: { baseURL: WEB, trace: "retain-on-failure" },
  projects: [
    {
      name: "phone",
      use: { browserName: "chromium", viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
    },
    { name: "desktop", use: { browserName: "chromium", viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command: "pnpm --filter @darb/api start",
      cwd: "../..",
      url: "http://localhost:4000/health",
      reuseExistingServer: true,
      timeout: 60_000,
    },
    {
      command: "pnpm start",
      url: `${WEB}/for-business`,
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: { API_URL: "http://localhost:4000", SITE_URL: WEB },
    },
  ],
});
```

The suite runs against `next start`, so run `pnpm build` first, with the dev database migrated and
seeded (`pnpm dev` once, or `pnpm --filter @darb/api db:deploy && pnpm --filter @darb/api db:seed`).

- [ ] **Step 2: Fixtures** — `apps/web/e2e/fixtures.ts`

```ts
import type { TestInfo } from "@playwright/test";

export const LOCALES = ["he", "ar", "en"] as const;
export type Locale = (typeof LOCALES)[number];

/** `/sakhnin` in a locale: unprefixed for Hebrew. */
export function localePath(locale: Locale, path: string): string {
  if (locale === "he") return path;
  return path === "/" ? `/${locale}` : `/${locale}${path}`;
}

/** Sakhnin is a flagship: it has one example business of every active kind. */
export const LEVELS = {
  country: "/",
  place: "/sakhnin",
  sector: "/sakhnin/beauty",
  kind: "/sakhnin/beauty/barbershops",
  business: "/sakhnin/beauty/barbershops/samers-barbershop",
  nationalKind: "/k/barbershops",
} as const;
export const BUSINESS_KEY = "sakhnin/samers-barbershop";

/** Arraba has only the 16 common kinds, so it has no nails salon. */
export const EMPTY_KIND = "/arraba/beauty/nails";
/** Perla Nails exists in Sakhnin, never in Arraba. */
export const OTHER_PLACE_BUSINESS = "/arraba/beauty/nails/perla-nails";
export const ARRABA = { latitude: 32.8486259, longitude: 35.3358268 };

export const isPhone = (info: TestInfo) => info.project.name === "phone";
```

- [ ] **Step 3: Levels** — `apps/web/e2e/levels.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { BUSINESS_KEY, EMPTY_KIND, LEVELS, OTHER_PLACE_BUSINESS } from "./fixtures";

test("level 0 links every live place and every kind", async ({ page }) => {
  expect((await page.goto(LEVELS.country))?.status()).toBe(200);
  await expect(page.locator('#places a[href="/sakhnin"]')).toHaveCount(1);
  await expect(page.locator('#kinds a[href="/k/barbershops"]')).toHaveCount(1);
});

test("level 1 shows one door per sector with live counts", async ({ page }) => {
  await page.goto(LEVELS.place);
  await expect(page.locator("[data-door]")).toHaveCount(18);
  const beauty = Number(await page.locator('[data-door="beauty"]').getAttribute("data-count"));
  expect(beauty).toBeGreaterThan(0);
});

test("level 2 keeps empty doors visible", async ({ page }) => {
  await page.goto("/arraba/beauty");
  await expect(page.locator('[data-door="barbershops"]')).toHaveAttribute("data-count", "1");
  await expect(page.locator('[data-door="nails"]')).toHaveAttribute("data-count", "0");
});

test("level 3 lists businesses that open the sheet", async ({ page }) => {
  await page.goto(LEVELS.kind);
  await expect(page.locator(`[data-business-link="${BUSINESS_KEY}"]`)).toHaveAttribute("href", LEVELS.business);
});

test("an empty kind is a 200 that names the nearest places that have it", async ({ page }) => {
  expect((await page.goto(EMPTY_KIND))?.status()).toBe(200);
  await expect(page.locator("[data-none-yet]")).toBeVisible();
  await expect(page.locator("[data-nearest-place]").first()).toHaveAttribute("data-nearest-place", "sakhnin");
  await expect(page.locator("[data-nearest-place]").first()).toHaveAttribute("href", "/sakhnin/beauty/nails");
});

test("neighbourhood chips filter Haifa's list without adding depth", async ({ page }) => {
  await page.goto("/haifa/beauty/barbershops");
  await expect(page.locator('[data-chip="haifa"]')).toHaveAttribute("aria-current", "page");
  await page.locator('[data-chip="kiryat-haim"]').click();
  await expect(page).toHaveURL("/kiryat-haim/beauty/barbershops");
  await expect(page.locator('[data-chip="kiryat-haim"]')).toHaveAttribute("aria-current", "page");
});

test("the national kind pages through every place", async ({ page }) => {
  await page.goto(LEVELS.nationalKind);
  await expect(page.locator("[data-business]")).toHaveCount(30);
  await page.locator("[data-show-more]").click();
  await expect(page.locator("[data-business]")).toHaveCount(60);
});

test("the place shortcut lands on the canonical kind URL", async ({ page }) => {
  await page.goto("/sakhnin/k/barbershops");
  await expect(page).toHaveURL(LEVELS.kind);
});

test("a business from another place is a 404, not that place's business", async ({ page }) => {
  expect((await page.goto(OTHER_PLACE_BUSINESS))?.status()).toBe(404);
  await expect(page.locator("[data-not-found]")).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
});

test("level 4 opens the sheet over the list", async ({ page }) => {
  expect((await page.goto(LEVELS.business))?.status()).toBe(200);
  await expect(page.getByRole("dialog")).toBeVisible();
  await expect(page.locator(`[data-business-link="${BUSINESS_KEY}"]`)).toBeAttached();
});
```

- [ ] **Step 4: Path bar** — `apps/web/e2e/pathbar.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { LEVELS, localePath } from "./fixtures";

test("shows the path, marks where you are and goes up one level", async ({ page }) => {
  await page.goto(LEVELS.kind);
  const bar = page.locator("[data-path-bar]");
  await expect(bar.locator("li")).toHaveCount(4); // Israel ▸ Sakhnin ▸ Beauty ▸ Barbershops
  await expect(bar.locator('[aria-current="page"]')).toHaveCount(1);
  await bar.locator("[data-up]").click();
  await expect(page).toHaveURL(LEVELS.sector);
  await page.locator("[data-path-bar] li a").nth(1).click();
  await expect(page).toHaveURL(LEVELS.place);
});

for (const [locale, mirrored] of [["he", true], ["ar", true], ["en", false]] as const) {
  test(`mirrors its arrows in ${locale}`, async ({ page }) => {
    await page.goto(localePath(locale, LEVELS.kind));
    const transform = (selector: string) =>
      page.locator(selector).first().evaluate((el) => getComputedStyle(el).transform);
    const flipped = "matrix(-1, 0, 0, 1, 0, 0)";
    expect(await transform("[data-up] svg")).toBe(mirrored ? flipped : "none");
    expect(await transform("[data-path-bar] li svg")).toBe(mirrored ? flipped : "none");
  });
}
```

- [ ] **Step 5: Locales** — `apps/web/e2e/locale.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { LEVELS } from "./fixtures";

test("switching language keeps the path, even inside the sheet", async ({ page }) => {
  await page.goto(LEVELS.business);
  const sheetSwitch = page.locator('[role="dialog"] [data-locale-switch]');
  await sheetSwitch.locator('a[hreflang="en"]').click();
  await expect(page).toHaveURL(`/en${LEVELS.business}`);
  await expect(page.locator("html")).toHaveAttribute("lang", "en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await page.locator('[role="dialog"] [data-locale-switch] a[hreflang="ar"]').click();
  await expect(page).toHaveURL(`/ar${LEVELS.business}`);
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.locator('[role="dialog"] [data-locale-switch] a[hreflang="he"]').click();
  await expect(page).toHaveURL(LEVELS.business);
  await expect(page.locator("html")).toHaveAttribute("lang", "he");
});

test("the city bar switch keeps the path on list levels", async ({ page }) => {
  await page.goto(LEVELS.sector);
  await page.locator('#city-bar [data-locale-switch] a[hreflang="ar"]').click();
  await expect(page).toHaveURL(`/ar${LEVELS.sector}`);
});

test("Arabic falls back to Hebrew and is never blank", async ({ page }) => {
  await page.goto(`/ar${LEVELS.nationalKind}`);
  for (const name of await page.locator("[data-business-name]").allTextContents()) expect(name.trim()).not.toBe("");
  await page.goto(`/ar${LEVELS.sector}`);
  for (const label of await page.locator("[data-door]").allTextContents()) expect(label.trim()).not.toBe("");
  await page.goto(`/ar${LEVELS.business}`);
  expect((await page.locator("[data-sheet-title]").textContent())?.trim()).not.toBe("");
});

test("an explicit Hebrew prefix redirects to the unprefixed URL", async ({ page }) => {
  await page.goto(`/he${LEVELS.place}`);
  await expect(page).toHaveURL(LEVELS.place);
});
```

- [ ] **Step 6: The sheet** — `apps/web/e2e/sheet.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { BUSINESS_KEY, isPhone, LEVELS, localePath } from "./fixtures";

test("keyboard: open from the list, stay trapped, Escape returns focus to the row", async ({ page }) => {
  await page.goto(LEVELS.kind);
  const row = page.locator(`[data-business-link="${BUSINESS_KEY}"]`);
  await row.focus();
  await page.keyboard.press("Enter");
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(page).toHaveURL(LEVELS.business);
  await expect(dialog.locator("[data-sheet-close]")).toBeFocused();
  for (let i = 0; i < 30; i++) {
    await page.keyboard.press("Tab");
    expect(await dialog.evaluate((d) => d.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press("Escape");
  await expect(page).toHaveURL(LEVELS.kind);
  await expect(dialog).toHaveCount(0);
  await expect(row).toBeFocused();
});

test("closing a directly loaded sheet also lands on its row", async ({ page }) => {
  await page.goto(LEVELS.business);
  await page.locator("[data-sheet-close]").click();
  await expect(page).toHaveURL(LEVELS.kind);
  await expect(page.locator(`[data-business-link="${BUSINESS_KEY}"]`)).toBeFocused();
});

test("an example business explains itself instead of calling", async ({ page }) => {
  await page.goto(`/en${LEVELS.business}`);
  await page.locator("[data-primary-action]").click();
  await expect(page.locator("[data-sheet-status]")).toHaveText(
    "This is an example — this is what your customers would see",
  );
});

for (const [locale, side] of [["he", "left"], ["ar", "left"], ["en", "right"]] as const) {
  test(`desktop: the side panel sits on the ${side} in ${locale}`, async ({ page }, info) => {
    test.skip(isPhone(info), "desktop only");
    await page.goto(localePath(locale, LEVELS.business));
    const box = (await page.getByRole("dialog").boundingBox())!;
    if (side === "left") expect(box.x).toBeLessThan(10);
    else expect(box.x + box.width).toBeGreaterThan(1430);
    expect(box.width).toBeLessThanOrEqual(480);
  });
}

test("phone: the bottom sheet moves between snap points", async ({ page }, info) => {
  test.skip(!isPhone(info), "phone only");
  await page.goto(LEVELS.business);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toHaveAttribute("data-snap", "half");
  await page.locator("[data-sheet-handle]").focus();
  await page.keyboard.press("ArrowUp");
  await expect(dialog).toHaveAttribute("data-snap", "full");
  await page.keyboard.press("ArrowDown");
  await page.keyboard.press("ArrowDown");
  await expect(dialog).toHaveAttribute("data-snap", "peek");
});

test.describe("reduced motion", () => {
  test.use({ reducedMotion: "reduce" });
  test("the sheet does not fly", async ({ page }) => {
    await page.goto(LEVELS.business);
    const duration = await page.getByRole("dialog").evaluate((el) => getComputedStyle(el).transitionDuration);
    expect(duration).toBe("0.001s");
  });
});
```

- [ ] **Step 7: Near me** — `apps/web/e2e/nearme.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { ARRABA } from "./fixtures";

test.describe("with location", () => {
  test.use({ geolocation: ARRABA, permissions: ["geolocation"] });

  test("jumps to the nearest live place", async ({ page }) => {
    await page.goto("/");
    await page.locator("[data-near-me]").click();
    await expect(page).toHaveURL("/arraba");
  });

  test("on a national kind page, jumps to the nearest place that has it", async ({ page }) => {
    await page.goto("/k/nails");
    await page.locator("[data-near-me-kind]").click();
    await expect(page).toHaveURL("/sakhnin/beauty/nails");
  });
});

test.describe("without location", () => {
  test.use({ permissions: [] });

  test("explains in one line and stays put", async ({ page }) => {
    await page.goto("/en");
    await page.locator("[data-near-me]").click();
    await expect(page.locator("[data-near-me-message]")).toHaveText(
      "Location is off. Pick a place from the list instead.",
    );
    await expect(page).toHaveURL("/en");
  });
});
```

- [ ] **Step 8: Errors** — `apps/web/e2e/errors.spec.ts`

```ts
import { expect, test } from "@playwright/test";

test("a misspelt place suggests the real one", async ({ page }) => {
  expect((await page.goto("/sakhnim"))?.status()).toBe(404);
  await expect(page.locator("[data-closest-match]")).toHaveAttribute("href", "/sakhnin");
});

test("a misspelt kind keeps the place", async ({ page }) => {
  expect((await page.goto("/en/sakhnin/beauty/barbershop"))?.status()).toBe(404);
  await expect(page.locator("[data-closest-match]")).toHaveAttribute("href", "/en/sakhnin/beauty/barbershops");
});

test("nonsense is a plain 404 inside the city frame", async ({ page }) => {
  expect((await page.goto("/qqqqqqqqqq"))?.status()).toBe(404);
  await expect(page.locator("[data-site-header]")).toBeVisible();
  await expect(page.locator("[data-back-home]")).toHaveAttribute("href", "/");
  await page.waitForLoadState("networkidle");
  await expect(page.locator("[data-closest-match]")).toHaveCount(0);
});
```

- [ ] **Step 9: Run the suite**

```bash
pnpm build
pnpm --filter @darb/web e2e
```

Expected: every test passes in both projects (desktop-only and phone-only tests report as skipped in
the other project). If a sheet focus assertion fails because Next moved focus after navigation,
confirm that every row link and `router.push` use `scroll: false` before changing the test.

- [ ] **Step 10: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/playwright.config.ts apps/web/e2e
git commit -m "test(web): end-to-end suite for every level, the sheet, locales and near me"
```

---

### Task 22: Accessibility, target size, performance budgets and screenshots

**Files:**
- Create: `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/targets.spec.ts`, `apps/web/e2e/perf.spec.ts`,
  `apps/web/e2e/visual.spec.ts`, `apps/web/scripts/check-budget.mjs`

**Interfaces:**
- Consumes: `e2e/fixtures.ts`; the Next build output (`.next/build-manifest.json`,
  `.next/server/app/**/page_client-reference-manifest.js`).
- Produces: `pnpm --filter @darb/web budget` (exits 1 over 150 KB gzip per level route);
  `test-results/screens/{project}-{name}.png` for review.

- [ ] **Step 1: axe on every level in all three locales** — `apps/web/e2e/a11y.spec.ts`

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { EMPTY_KIND, LEVELS, LOCALES, localePath } from "./fixtures";

const PAGES = [...Object.values(LEVELS), EMPTY_KIND, "/for-business"];

for (const locale of LOCALES) {
  for (const path of PAGES) {
    test(`${locale} ${path} has no WCAG A/AA violations`, async ({ page }) => {
      await page.goto(localePath(locale, path));
      await page.waitForLoadState("networkidle");
      const { violations } = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
        .analyze();
      expect(violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`)).toEqual([]);
    });
  }
}
```

- [ ] **Step 2: 44 px targets and no sideways scroll on phones** — `apps/web/e2e/targets.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { EMPTY_KIND, isPhone, LEVELS } from "./fixtures";

for (const path of [...Object.values(LEVELS), EMPTY_KIND, "/for-business"]) {
  test(`${path}: touch targets are at least 44 px and nothing scrolls sideways`, async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    await page.goto(path);
    const report = await page.evaluate(() => {
      const targets = document.querySelectorAll("a[href], button, input, summary, [role='button']");
      const small = [...targets]
        .filter((el) => !el.closest(".visually-hidden, .skip-link, p"))
        .filter((el) => {
          const box = el.getBoundingClientRect();
          const style = getComputedStyle(el);
          if (box.width === 0 || style.visibility === "hidden" || style.display === "none") return false;
          return box.width < 44 || box.height < 44;
        })
        .map((el) => el.outerHTML.slice(0, 90));
      return { small, overflow: document.documentElement.scrollWidth > document.documentElement.clientWidth };
    });
    expect(report.small).toEqual([]);
    expect(report.overflow).toBe(false);
  });
}
```

- [ ] **Step 3: LCP smoke check on a throttled phone** — `apps/web/e2e/perf.spec.ts`

```ts
import { expect, test } from "@playwright/test";
import { isPhone, LEVELS } from "./fixtures";

for (const [name, path] of Object.entries(LEVELS)) {
  test(`${name}: Largest Contentful Paint under 1.5 s on fast 4G`, async ({ page }, info) => {
    test.skip(!isPhone(info), "phone only");
    await page.goto(path); // warm the ISR cache: the budget is for cached pages
    const cdp = await page.context().newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    await cdp.send("Network.emulateNetworkConditions", {
      offline: false,
      latency: 150,
      downloadThroughput: (9 * 1024 * 1024) / 8,
      uploadThroughput: (1.5 * 1024 * 1024) / 8,
    });
    await page.goto(path, { waitUntil: "load" });
    const lcp = await page.evaluate(
      () =>
        new Promise<number>((resolve) => {
          new PerformanceObserver((list) => {
            const entries = list.getEntries();
            resolve(entries[entries.length - 1]!.startTime);
          }).observe({ type: "largest-contentful-paint", buffered: true });
          setTimeout(() => resolve(-1), 5000);
        }),
    );
    expect(lcp).toBeGreaterThan(0);
    expect(lcp).toBeLessThan(1500);
  });
}
```

- [ ] **Step 4: Screenshots for review** — `apps/web/e2e/visual.spec.ts`

```ts
import { test } from "@playwright/test";
import { EMPTY_KIND, LEVELS, localePath } from "./fixtures";

const SHOTS: [string, string][] = [
  ...Object.entries(LEVELS).map(([name, path]) => [name, path] as [string, string]),
  ["empty-kind", EMPTY_KIND],
  ["ar-business", localePath("ar", LEVELS.business)],
  ["en-business", localePath("en", LEVELS.business)],
  ["for-business", "/for-business"],
  ["not-found", "/sakhnim"],
];

test.use({ reducedMotion: "reduce" });

for (const [name, path] of SHOTS) {
  test(`screenshot ${name}`, async ({ page }, info) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  });
}
```

Pixel comparison is not used: fonts render differently on macOS and the Linux CI runner. CI uploads
the PNGs; reviewers check them against VC1–VC10.

- [ ] **Step 5: The JS budget from the build output** — `apps/web/scripts/check-budget.mjs`

Next 16 no longer prints "First Load JS", so this reads the build manifests directly.

```js
// First-load JavaScript per level route, gzip-compressed, from the Next build output.
// Fails (exit 1) when a route exceeds the spec §9.1 budget.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const LIMIT = 150 * 1024;
const NEXT = new URL("../.next/", import.meta.url);
const ROUTES = [
  "/[locale]/page",
  "/[locale]/[place]/page",
  "/[locale]/[place]/[sector]/page",
  "/[locale]/[place]/[sector]/[kind]/page",
  "/[locale]/[place]/[sector]/[kind]/[business]/page",
  "/[locale]/k/[kind]/page",
];

const build = JSON.parse(readFileSync(new URL("build-manifest.json", NEXT), "utf8"));
const sizes = new Map();
const gz = (file) => {
  if (!sizes.has(file)) sizes.set(file, gzipSync(readFileSync(new URL(file, NEXT))).length);
  return sizes.get(file);
};

function entryFiles(route) {
  const sandbox = {};
  const source = readFileSync(new URL(`server/app${route}_client-reference-manifest.js`, NEXT), "utf8");
  vm.runInNewContext(source, sandbox);
  const manifest = sandbox.__RSC_MANIFEST?.[route];
  if (!manifest) throw new Error(`No client manifest for ${route}`);
  return Object.values(manifest.entryJSFiles ?? {}).flat();
}

let failed = false;
for (const route of ROUTES) {
  const files = new Set([...build.rootMainFiles, ...entryFiles(route)].map((f) => f.replace(/^\/?_next\//, "")));
  const total = [...files].reduce((sum, file) => sum + gz(file), 0);
  const ok = total <= LIMIT;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${(total / 1024).toFixed(1).padStart(6)} KB  ${route}`);
}
if (failed) {
  console.error(`First-load JS must stay under ${LIMIT / 1024} KB gzip per level route (spec §9.1).`);
  process.exit(1);
}
```

Polyfills (`nomodule`) and the low-priority build manifests are excluded; CSS is not JavaScript.

Run: `pnpm build && pnpm --filter @darb/web budget`
Expected: six `ok` lines, each under 150 KB. The React and Next runtime alone is about 134 KB, so the
client islands have roughly 16 KB. If a route fails, find the heaviest entry with
`ls -S apps/web/.next/static/chunks | head`; keep `@darb/i18n` out of any client component that does
not already import it, and do not add client libraries.

- [ ] **Step 6: Run everything**

Run: `pnpm --filter @darb/web e2e`
Expected: all pass, including 24 axe runs per project, the phone-only target and LCP checks, and the
screenshots. Fix violations in the components (not by disabling rules). Open the PNGs in
`apps/web/test-results/screens/` and check VC1–VC10.

- [ ] **Step 7: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/e2e apps/web/scripts/check-budget.mjs
git commit -m "test(web): axe in three locales, 44px targets, LCP smoke and a JS budget"
```

---

### Task 23: Continuous integration

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: root scripts (`build`, `typecheck`, `lint`, `format:check`, `test`), `infra/docker-compose.yml`
  (Postgres built from `infra/postgres/Dockerfile` with `darb_test`), `@darb/api db:deploy` /
  `db:seed`, `@darb/web budget` / `e2e`.
- Produces: one `ci` job on every pull request and on pushes to `main`.

- [ ] **Step 1: Write the workflow** — `.github/workflows/ci.yml`

```yaml
name: CI

on:
  pull_request:
  push:
    branches: [main]

concurrency:
  group: ci-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    runs-on: ubuntu-24.04
    timeout-minutes: 45
    env:
      DATABASE_URL: postgresql://darb:darb@localhost:5433/darb
      TEST_DATABASE_URL: postgresql://darb:darb@localhost:5433/darb_test
      API_URL: http://localhost:4000
      SITE_URL: http://localhost:3000
      NEXT_TELEMETRY_DISABLED: "1"
      TURBO_TELEMETRY_DISABLED: "1"
    steps:
      - uses: actions/checkout@v5
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with:
          node-version: 22
          cache: pnpm
      - run: pnpm install --frozen-lockfile
      - name: Postgres with PostGIS and pgvector (infra/postgres/Dockerfile)
        run: docker compose -f infra/docker-compose.yml up -d --wait postgres
      - run: cp apps/api/.env.example apps/api/.env
      - run: pnpm build
      - run: pnpm typecheck
      - run: pnpm lint
      - run: pnpm format:check
      - name: Unit and API integration tests
        run: pnpm test
      - name: Migrate and seed the e2e database
        run: pnpm --filter @darb/api db:deploy && pnpm --filter @darb/api db:seed
      - name: First-load JS budget
        run: pnpm --filter @darb/web budget
      - run: pnpm --filter @darb/web exec playwright install --with-deps chromium
      - name: End-to-end, accessibility and LCP
        run: pnpm --filter @darb/web e2e
      - if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright
          path: |
            apps/web/playwright-report
            apps/web/test-results
          retention-days: 14
```

The API tests reset `darb_test`; e2e uses the seeded `darb` database, so the two never collide.

- [ ] **Step 2: Lint the workflow locally**

Run: `pnpm format:check`
Expected: clean (Prettier formats YAML). If `actionlint` is installed, also run
`actionlint .github/workflows/ci.yml` and expect no output.

- [ ] **Step 3: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: build, test, budget and e2e against a seeded API on every pull request"
```

Push only when the controller says so (`git push -u origin feat/plan-2a-web-city`); then follow the
run with `gh run watch` and fix any failure before Task 28.

---
### Task 24: Seed: generic names for place-bound brands

The showroom copies one brand per kind into every town, so a brand that names a real council or town
("Umm al Fahm Municipality" in Haifa) is wrong everywhere else. Civic services get generic names;
brands that name a real locality are renamed. Gated before any preview deploy.

**Files:**
- Modify: `packages/seed/data/screens.json`, `packages/seed/data/brands.json`,
  `packages/seed/data/businesses.json` (regenerated), `packages/seed/src/validate.test.ts`

**Interfaces:**
- Consumes: `loadScreens`, `loadPlaces`, `scripts/build-showroom.ts` (Plan 1).
- Produces: new brand and business slugs for the seven kinds below (e.g. `city-services` instead of
  `umm-al-fahm-municipality`); the loader suspends the old seed businesses on the next `db:seed`.

- [ ] **Step 1: Write the failing test** — append to `packages/seed/src/validate.test.ts`

```ts
/** Brands copied into every town must not belong to one. */
const GENERIC_BRANDS: Record<string, string> = {
  municipal: "City Services",
  "school-registration": "School Registration Desk",
  parking: "Parking Services",
  permits: "Local Planning Committee",
  "football-academies": "Galilee Stars Academy",
  "it-support": "Abu Ghanem NetSupport",
  hotels: "Rose Valley Cabins",
};
/** Brand words that are also tiny localities' names, but here are common words or personal names. */
const ALLOWED_PLACE_WORDS = new Set([
  "app-developers:sulam",
  "architects:shahar",
  "beekeepers:nahala",
  "carpentry:erez",
  "catering:adi",
  "cleaning:zohar",
  "community-centres:navve",
  "ev-charging:barak",
  "ladies-spa:hamaam",
  "libraries:manara",
  "meal-prep:sallama",
  "metalworks:hadid",
  "orthodontics:basma",
]);

describe("showroom brands", () => {
  const screens = loadScreens();
  it("give civic services generic names", () => {
    for (const [kind, en] of Object.entries(GENERIC_BRANDS)) expect(screens[kind]?.brand.en, kind).toBe(en);
  });
  it("never name a real locality", () => {
    const matchers = loadPlaces()
      .filter((p) => ["city", "town", "village"].includes(p.type))
      .map((p) => {
        const en = p.name.en ?? "";
        const he = p.name.he ?? "";
        return {
          slug: p.slug,
          en: en.length >= 5 ? new RegExp(`(?<![A-Za-z])${escapeRegExp(en)}(?![A-Za-z])`, "i") : null,
          he: he.length >= 3 ? new RegExp(`(^|\\s)${escapeRegExp(he)}($|\\s)`) : null,
        };
      });
    const hits: string[] = [];
    for (const [kind, screen] of Object.entries(screens)) {
      for (const m of matchers) {
        if (m.en?.test(screen.brand.en ?? "") || m.he?.test(screen.brand.he ?? "")) hits.push(`${kind}:${m.slug}`);
      }
    }
    expect(hits.filter((hit) => !ALLOWED_PLACE_WORDS.has(hit))).toEqual([]);
  });
});
```

Run: `pnpm --filter @darb/seed test`
Expected: FAIL — `municipal` is "Umm al Fahm Municipality"; the scan reports
`football-academies:sakhnin`, `it-support:abu-gosh` (or the slug CBS gives Abu Ghosh) and
`hotels:ein-vered`.

- [ ] **Step 2: Rename the brands** — from the repo root:

```bash
node -e '
const fs = require("node:fs");
const file = "packages/seed/data/screens.json";
const screens = JSON.parse(fs.readFileSync(file, "utf8"));
const brands = {
  municipal: { he: "שירותי העירייה", ar: "خدمات البلدية", en: "City Services" },
  "school-registration": { he: "מדור רישום לבתי ספר", ar: "قسم تسجيل المدارس", en: "School Registration Desk" },
  parking: { he: "שירותי חניה", ar: "خدمات المواقف", en: "Parking Services" },
  permits: { he: "הוועדה המקומית לתכנון", ar: "اللجنة المحلية للتخطيط", en: "Local Planning Committee" },
  "football-academies": { he: "אקדמיית כוכבי הגליל", ar: "أكاديمية نجوم الجليل", en: "Galilee Stars Academy" },
  "it-support": { he: "נט סאפורט אבו גאנם", ar: "نت سبورت أبو غانم", en: "Abu Ghanem NetSupport" },
  hotels: { he: "בקתות עמק הוורדים", ar: "أكواخ وادي الورد", en: "Rose Valley Cabins" },
};
for (const [kind, brand] of Object.entries(brands)) {
  if (!screens[kind]) throw new Error(`screens.json has no ${kind}`);
  screens[kind].brand = brand;
}
fs.writeFileSync(file, JSON.stringify(screens, null, 2) + "\n");
'
grep -rn "אום אל פחם\|Umm al Fahm\|Sakhnin Stars\|Ein Vered\|Abu Ghosh\|Ein Al Ward\|Ramat HaZayit\|Marj Al Zuhur" packages/seed/data/screens.json
```

Expected: the grep prints nothing. If a renamed screen's title, subtitle or items also name the old
brand (read each of the seven screens), replace those words with the generic name in the same
language, keeping the rest of the text.

- [ ] **Step 3: Regenerate the showroom and reseed**

```bash
pnpm --filter @darb/seed exec tsx scripts/build-showroom.ts
pnpm --filter @darb/seed test
pnpm --filter @darb/api db:seed
```

Expected: `205 brands, … businesses in … places` (same counts as before); seed tests PASS; the
loader reports the same counts and suspends the old civic slugs.

- [ ] **Step 4: Commit**

```bash
pnpm format && pnpm lint
git add packages/seed
git commit -m "fix(seed): generic names for brands that belonged to one place"
```

---

### Task 25: Seed: Arabic for the showroom screens, sectors 1–9

200 showroom screens (brand, title, subtitle, tags, items, cta) exist only in Hebrew and English, so
Arabic visitors see Hebrew. This task writes the Arabic for the first nine sectors: food, beauty,
health, sports, kids, education, tech, services, home (101 screens, about 1,600 strings). Gated before
any preview deploy.

**Content rules:** the Arabic that Arab citizens of Israel read every day — clear Modern Standard
Arabic with natural local words (كراج, صالون, مصلحة); Latin digits as written in the source
(`₪60`, `16:00`); keep every number, price, time and unit; translate meaning, not word by word; keep
brand names recognisable (transliterate personal and family names, translate descriptive words); halal
only. Do not touch `he` or `en`.

**Files:**
- Create: `packages/seed/scripts/arabic-todo.ts`, `packages/seed/scripts/merge-arabic.ts`
- Modify: `packages/seed/data/screens.json`, `packages/seed/src/validate.test.ts`

**Interfaces:**
- Consumes: `loadKinds`, `loadScreens`, `SeedScreen`.
- Produces: `data/screens-ar.json` (transient, deleted by the merge):
  `Record<kindSlug, { brand: string; title: string; subtitle?: string; tags?: string[]; items: { label: string; meta?: string }[]; cta: string }>`;
  `ARABIC_SECTORS` in `validate.test.ts` (Task 26 widens it to every sector).

- [ ] **Step 1: Write the failing gate** — append to `packages/seed/src/validate.test.ts`

```ts
/** Sectors whose showroom screens are fully Arabic. Task 26 makes this every sector. */
const ARABIC_SECTORS = new Set(["food", "beauty", "health", "sports", "kids", "education", "tech", "services", "home"]);

describe("showroom screens in Arabic", () => {
  const screens = loadScreens();
  const texts = (s: SeedScreen): Localized[] => [
    s.brand,
    s.title,
    ...(s.subtitle ? [s.subtitle] : []),
    ...(s.tags ?? []),
    ...s.items.flatMap((i) => [i.label, ...(i.meta ? [i.meta] : [])]),
    s.cta,
  ];
  it.each(kinds.filter((k) => ARABIC_SECTORS.has(k.sector)).map((k) => k.slug))("%s has Arabic everywhere", (slug) => {
    for (const text of texts(screens[slug]!)) {
      expect(text.ar?.trim(), JSON.stringify(text)).toBeTruthy();
      expect(blockedIn(text.ar ?? ""), text.ar).toEqual([]);
    }
  });
});
```

Add `SeedScreen` to the file's import from `./index.js`.

Run: `pnpm --filter @darb/seed test`
Expected: FAIL for every kind in the nine sectors except those whose screen comes from
`extra-screens.json` (restaurants, barbershops, salons already have Arabic).

- [ ] **Step 2: The two helper scripts**

`packages/seed/scripts/arabic-todo.ts`:

```ts
// Prints, for one sector, every showroom screen still missing Arabic, shaped like
// data/screens-ar.json with "Hebrew | English" in place of each Arabic string.
// Usage: pnpm --filter @darb/seed exec tsx scripts/arabic-todo.ts <sector-slug>
import type { Localized } from "@darb/core";
import { loadKinds, loadScreens } from "../src/index.js";

const sector = process.argv[2];
if (!sector) throw new Error("Usage: tsx scripts/arabic-todo.ts <sector-slug>");
const screens = loadScreens();
const both = (v: Localized) => `${v.he ?? ""} | ${v.en ?? ""}`;
const todo = Object.fromEntries(
  loadKinds()
    .filter((k) => k.sector === sector && !screens[k.slug]!.brand.ar)
    .map((k) => {
      const s = screens[k.slug]!;
      return [
        k.slug,
        {
          brand: both(s.brand),
          title: both(s.title),
          ...(s.subtitle ? { subtitle: both(s.subtitle) } : {}),
          ...(s.tags ? { tags: s.tags.map(both) } : {}),
          items: s.items.map((i) => ({ label: both(i.label), ...(i.meta ? { meta: both(i.meta) } : {}) })),
          cta: both(s.cta),
        },
      ];
    }),
);
console.log(JSON.stringify(todo, null, 2));
```

`packages/seed/scripts/merge-arabic.ts`:

```ts
// Merges data/screens-ar.json (Arabic for some showroom screens) into data/screens.json, next to
// the Hebrew and English, then deletes screens-ar.json. Shapes must match exactly.
import { readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Localized } from "@darb/core";
import type { SeedScreen } from "../src/types.js";

interface ArabicScreen {
  brand: string;
  title: string;
  subtitle?: string;
  tags?: string[];
  items: { label: string; meta?: string }[];
  cta: string;
}

const DATA = (file: string) => new URL(`../data/${file}`, import.meta.url);
const screens = JSON.parse(readFileSync(DATA("screens.json"), "utf8")) as Record<string, SeedScreen>;
const arabic = JSON.parse(readFileSync(DATA("screens-ar.json"), "utf8")) as Record<string, ArabicScreen>;

function put(target: Localized, ar: string | undefined, where: string) {
  if (ar === undefined || ar.trim() === "" || ar.includes(" | ")) throw new Error(`No Arabic for ${where}`);
  target.ar = ar.trim();
}

for (const [kind, ar] of Object.entries(arabic)) {
  const screen = screens[kind];
  if (!screen) throw new Error(`screens.json has no ${kind}`);
  put(screen.brand, ar.brand, `${kind}.brand`);
  put(screen.title, ar.title, `${kind}.title`);
  if (screen.subtitle) put(screen.subtitle, ar.subtitle, `${kind}.subtitle`);
  if ((screen.tags?.length ?? 0) !== (ar.tags?.length ?? 0)) throw new Error(`${kind}: tag count differs`);
  screen.tags?.forEach((tag, i) => put(tag, ar.tags![i], `${kind}.tags[${i}]`));
  if (screen.items.length !== ar.items.length) throw new Error(`${kind}: item count differs`);
  screen.items.forEach((item, i) => {
    put(item.label, ar.items[i]!.label, `${kind}.items[${i}].label`);
    if (item.meta) put(item.meta, ar.items[i]!.meta, `${kind}.items[${i}].meta`);
  });
  put(screen.cta, ar.cta, `${kind}.cta`);
}

writeFileSync(DATA("screens.json"), `${JSON.stringify(screens, null, 2)}\n`);
rmSync(DATA("screens-ar.json"));
console.log(`Merged Arabic into ${Object.keys(arabic).length} screens`);
```

- [ ] **Step 3: Translate, one sector at a time** — repeat for `food`, `beauty`, `health`,
  `sports`, `kids`, `education`, `tech`, `services`, `home`:

```bash
pnpm --filter @darb/seed exec tsx scripts/arabic-todo.ts food > packages/seed/data/screens-ar.json
# Replace every "Hebrew | English" string in screens-ar.json with its Arabic, following the content rules.
pnpm --filter @darb/seed exec tsx scripts/merge-arabic.ts
pnpm --filter @darb/seed exec vitest run src/validate.test.ts -t "Arabic"
git add packages/seed/data/screens.json
git commit -m "feat(seed): Arabic for the food showroom screens"
```

Expected per sector: `Merged Arabic into N screens`; that sector's gate cases pass (the remaining
sectors in `ARABIC_SECTORS` still fail until their turn). Use the sector name in each commit message.

- [ ] **Step 4: Regenerate the showroom, check and commit**

```bash
pnpm --filter @darb/seed exec tsx scripts/build-showroom.ts
pnpm --filter @darb/seed test
pnpm --filter @darb/api db:seed
```

Expected: all seed tests pass; `brands.json` and `businesses.json` now carry Arabic names and
taglines for these sectors; the loader reseeds without errors.

```bash
pnpm format && pnpm lint
git add packages/seed
git commit -m "feat(seed): Arabic brand names and taglines for sectors 1-9"
```

---

### Task 26: Seed: Arabic for the showroom screens, sectors 10–18

Same method and content rules as Task 25 (read its rules and use its two scripts) for industry, auto,
agriculture, events, travel, retail, faith, civic and community (99 screens). After this task every
showroom screen, brand and tagline exists in Arabic.

**Files:**
- Modify: `packages/seed/data/screens.json`, `packages/seed/data/brands.json`,
  `packages/seed/data/businesses.json`, `packages/seed/src/validate.test.ts`

**Interfaces:**
- Consumes: `scripts/arabic-todo.ts`, `scripts/merge-arabic.ts`, `ARABIC_SECTORS` (Task 25).
- Produces: Arabic everywhere; the gate covers every sector.

- [ ] **Step 1: Widen the gate** — in `validate.test.ts` replace the `ARABIC_SECTORS` declaration with:

```ts
/** Every showroom screen is fully Arabic. */
const ARABIC_SECTORS = new Set(sectors.map((s) => s.slug));
```

Run: `pnpm --filter @darb/seed test`
Expected: FAIL for the kinds of the nine remaining sectors (civic's renamed brands from Task 24
already have Arabic brand names but not the rest of their screens).

- [ ] **Step 2: Translate, one sector at a time** — repeat Task 25 Step 3 for `industry`, `auto`,
  `agriculture`, `events`, `travel`, `retail`, `faith`, `civic`, `community`. For a screen whose
  `brand.ar` already exists (Task 24), `arabic-todo.ts` skips it; translate its remaining strings by
  editing those entries in `screens.json` directly, adding `ar` beside `he` and `en`.

Expected: after `community`, `pnpm --filter @darb/seed exec vitest run src/validate.test.ts -t "Arabic"`
passes for all 205 kinds.

- [ ] **Step 3: Regenerate, check and commit**

```bash
pnpm --filter @darb/seed exec tsx scripts/build-showroom.ts
pnpm --filter @darb/seed test
pnpm --filter @darb/api db:seed
node -e 'const b=require("./packages/seed/data/brands.json");console.log(b.filter(x=>!x.name.ar).length)'
```

Expected: seed tests pass; the last command prints `0`.

```bash
pnpm format && pnpm lint
git add packages/seed
git commit -m "feat(seed): Arabic for every showroom screen, brand and tagline"
```

---

### Task 27: Seed: Arab and Druze weekend hours (skip if the owner declines)

**Gate: this task depends on a pending owner answer. If the controller reports that the owner
declines, or has not confirmed the pattern, skip the whole task and record "skipped: owner" in the
ledger.**

Showroom hours close on Saturday everywhere, which is wrong for Arab and Druze towns, where Saturday
is a working day and Friday is short. The pattern for those localities: Saturday has Sunday's hours;
Friday opens as on Sunday and closes at 12:00, before the midday prayer. Restaurants (`menu`) and
mosques keep their own week. Mixed cities (Haifa, Akko, Ma'alot-Tarshiha) and Christian-majority
villages (Fassuta, Mi'ilya, Eilabun, Jish) keep the default until the owner says otherwise.

**Files:**
- Create: `packages/seed/data/weekend.json`, `packages/seed/scripts/weekend-candidates.ts`,
  `packages/seed/src/showroom.test.ts`
- Modify: `packages/seed/src/showroom.ts`, `packages/seed/src/index.ts`,
  `packages/seed/scripts/build-showroom.ts`, `packages/seed/src/validate.test.ts`,
  `packages/seed/data/businesses.json` (regenerated)

**Interfaces:**
- Consumes: `Hours` (`@darb/core`), `loadPlaces`, `loadBusinesses`.
- Produces: `toArabDruzeWeek(hours: Hours): Hours`; `loadWeekend(): { arabDruze: string[] }`
  (CBS codes).

- [ ] **Step 1: Write the failing unit test** — `packages/seed/src/showroom.test.ts`

```ts
import type { Hours } from "@darb/core";
import { expect, it } from "vitest";
import { toArabDruzeWeek } from "./showroom.js";

const booking: Hours = {
  weekly: {
    0: [{ open: "09:00", close: "19:00" }],
    4: [{ open: "09:00", close: "19:00" }],
    5: [{ open: "09:00", close: "14:00" }],
  },
  exceptions: [],
};

it("opens Saturday like Sunday and closes Friday at noon", () => {
  const week = toArabDruzeWeek(booking);
  expect(week.weekly[6]).toEqual([{ open: "09:00", close: "19:00" }]);
  expect(week.weekly[5]).toEqual([{ open: "09:00", close: "12:00" }]);
  expect(week.weekly[4]).toEqual(booking.weekly[4]);
});

it("closes Friday when Sunday opens after noon, and leaves an empty week alone", () => {
  const late: Hours = { weekly: { 0: [{ open: "14:00", close: "22:00" }] }, exceptions: [] };
  expect(toArabDruzeWeek(late).weekly[5]).toEqual([]);
  const none: Hours = { weekly: {}, exceptions: [] };
  expect(toArabDruzeWeek(none)).toEqual(none);
});
```

Run: `pnpm --filter @darb/seed test`
Expected: FAIL — `toArabDruzeWeek` is not exported.

- [ ] **Step 2: Implement** — append to `packages/seed/src/showroom.ts`

```ts
import type { Hours } from "@darb/core";

/**
 * Arab and Druze localities: Saturday is a working day (Sunday's hours) and Friday closes at noon,
 * before the midday prayer. Weeks without Sunday hours are left as they are.
 */
export function toArabDruzeWeek(hours: Hours): Hours {
  const sunday = hours.weekly[0] ?? [];
  const first = sunday[0];
  if (!first) return hours;
  const friday = first.open < "12:00" ? [{ open: first.open, close: "12:00" }] : [];
  return {
    ...hours,
    weekly: { ...hours.weekly, 5: friday, 6: sunday.map((interval) => ({ ...interval })) },
  };
}
```

(Move the `import type` line to the top of the file.)

Add to `packages/seed/src/index.ts`:

```ts
export const loadWeekend = () => read<{ arabDruze: string[] }>("weekend.json");
export { toArabDruzeWeek } from "./showroom.js";
```

Run: `pnpm --filter @darb/seed exec vitest run src/showroom.test.ts`
Expected: PASS.

- [ ] **Step 3: List the localities** — `packages/seed/scripts/weekend-candidates.ts`

```ts
// Prints every live settlement in the Northern and Haifa districts with its CBS code and names, to
// curate data/weekend.json by hand. Usage: pnpm --filter @darb/seed exec tsx scripts/weekend-candidates.ts
import { loadPlaces } from "../src/index.js";

for (const p of loadPlaces()
  .filter((x) => x.status === "live" && x.cbsCode && ["northern-district", "haifa-district"].includes(x.parent ?? ""))
  .sort((a, b) => Number(a.cbsCode) - Number(b.cbsCode))) {
  console.log([p.cbsCode, p.slug, p.name.he, p.name.ar, p.name.en].join("\t"));
}
```

Run it and write `packages/seed/data/weekend.json` with every Arab (including Bedouin) and Druze
locality's CBS code, sorted numerically:

```json
{
  "$comment": "CBS codes of Arab and Druze localities in the Northern and Haifa districts: Saturday open, Friday short. Mixed cities and Christian-majority villages keep the default week until the owner decides.",
  "arabDruze": ["473", "480", "482", "490", "494", "502", "509", "522", "531", "534", "1292", "2710", "4201", "7300", "7500", "8800", "8900"]
}
```

The list above is the minimum (the test anchors); the full list has well over a hundred codes. Decide
each row by the locality itself (Arab towns and villages, Bedouin villages such as Zarzir or Ka'abiyye,
Druze villages such as Beit Jann, Peki'in, Hurfeish, Yanuh-Jat, Mas'ade, Buq'ata); kibbutzim, moshavim
and Jewish towns stay out, as do the mixed cities and Christian-majority villages named above.

- [ ] **Step 4: Write the failing data test** — append to `packages/seed/src/validate.test.ts`
  (add `loadWeekend` to the import from `./index.js`)

```ts
describe("weekend pattern", () => {
  const weekend = loadWeekend().arabDruze;
  const byCbs = new Map(loadPlaces().filter((p) => p.cbsCode).map((p) => [p.cbsCode!, p]));
  it("lists unique live localities in the north", () => {
    expect(new Set(weekend).size).toBe(weekend.length);
    for (const code of weekend) {
      const place = byCbs.get(code);
      expect(place?.status, code).toBe("live");
      expect(["northern-district", "haifa-district"], code).toContain(place?.parent);
    }
  });
  it("includes the known Arab and Druze localities and leaves out Jewish and mixed ones", () => {
    for (const code of ["473", "482", "490", "494", "502", "509", "522", "531", "534", "1292", "2710", "4201", "7300", "7500", "8800", "8900"])
      expect(weekend, code).toContain(code);
    for (const code of ["4000", "7600", "1063", "1139", "1061", "7700", "2300", "8000", "9100", "4100", "6800", "9500", "8200", "9600", "535", "530"])
      expect(weekend, code).not.toContain(code);
  });
  it("gives showroom businesses there a Saturday and a short Friday", () => {
    const businesses = loadBusinesses();
    const at = (place: string, kind: string) => businesses.find((b) => b.place === place && b.primaryKind === kind)!;
    expect(at("sakhnin", "barbershops").hours.weekly[6]?.length).toBeGreaterThan(0);
    expect(at("sakhnin", "barbershops").hours.weekly[5]).toEqual([{ open: "09:00", close: "12:00" }]);
    expect(at("haifa", "barbershops").hours.weekly[6] ?? []).toEqual([]);
    expect(at("sakhnin", "mosques").hours).toEqual(at("haifa", "mosques").hours);
  });
});
```

Run: `pnpm --filter @darb/seed test`
Expected: the list tests PASS (after Step 3) and the showroom-hours test FAILS (Sakhnin's barbershop
is still closed on Saturday).

- [ ] **Step 5: Apply it in the showroom builder** — in `packages/seed/scripts/build-showroom.ts`,
  import `loadWeekend` and `toArabDruzeWeek`, add after `const screens = loadScreens();`:

```ts
const arabDruze = new Set(loadWeekend().arabDruze);
```

and replace the `hours:` line in `businesses.push({ … })` with:

```ts
      hours: hoursFor(place, slug, kind.template),
```

defining, above the loop:

```ts
function hoursFor(place: { cbsCode: string | null }, kindSlug: string, template: Template): Hours {
  if (kindSlug === "mosques") return MOSQUE_HOURS;
  const base = HOURS[template] ?? DEFAULT_HOURS;
  const local = place.cbsCode !== null && arabDruze.has(place.cbsCode) && template !== "menu";
  return local ? toArabDruzeWeek(base) : base;
}
```

Run:

```bash
pnpm --filter @darb/seed exec tsx scripts/build-showroom.ts
pnpm --filter @darb/seed test
pnpm --filter @darb/api db:seed
```

Expected: same brand and business counts; all seed tests PASS; reseed succeeds.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add packages/seed
git commit -m "feat(seed): Saturday hours and a short Friday in Arab and Druze localities"
```

---

### Task 28: Final verification and visual review

**Files:**
- Modify: none, unless a check fails (fix in the owning task's files, with its own commit).

- [ ] **Step 1: Clean install and every gate, as CI runs them**

```bash
cd /Users/zangeel/Documents/GitHub/Darb-City
pnpm install --frozen-lockfile
pnpm infra:up
pnpm build
pnpm typecheck
pnpm lint
pnpm format:check
pnpm test
pnpm --filter @darb/api db:deploy && pnpm --filter @darb/api db:seed
pnpm --filter @darb/web budget
pnpm --filter @darb/web e2e
```

Expected: every command exits 0; the budget prints six `ok` lines; the e2e summary shows no failures.

- [ ] **Step 2: Spec walk-through** — with `pnpm dev` running, check by hand and note each in the
  ledger:
  - Every sector, kind and live place is reachable from `/` in at most three taps (spec §1 success
    criterion 1).
  - `/`, `/ar`, `/en` set `lang`/`dir`; the locale switch keeps the path on every level, including
    inside the sheet.
  - A door with zero businesses opens "None in {place} yet" with the nearest places.
  - Escape and the close button return focus to the opening row.
  - `/sakhnim` suggests Sakhnin; `/qqqqqqqqqq` is a plain 404 inside the frame.
  - Stop the API (`kill` the API process) and load an uncached path, e.g. `/en/akko/food`: the quiet
    "Darb can't be reached right now" notice and "Try again" appear inside the frame; restart the
    API and press "Try again": the page loads.

- [ ] **Step 3: Visual review** — open every PNG in `apps/web/test-results/screens/` (written by
  `visual.spec.ts`) and check VC1–VC10 at both sizes. Also run
  `node apps/web/scripts/shoot.mjs /ar/sakhnin /ar/sakhnin/faith/mosques/al-noor-mosque /en/haifa/beauty/barbershops`
  and confirm Arabic content now appears where Hebrew fallback appeared before Tasks 25–26.

- [ ] **Step 4: Report** — no commit unless a fix was needed. Summarise for the controller: gates
  passed, budget per route, any VC item that needed a fix, and whether Task 27 ran or was skipped.

---

## Controller rulings (2026-10-12, plan approved by the controller on the owner's delegation)

These override the task text above wherever they differ.

1. **JS budget.** A probe build measured ~134 KB gzip for the Next 16 + React 19 runtime alone, so the spec's 150 KB first-load figure cannot hold. Task 22's budget is: total first-load JS ≤ 180 KB gzip per level route, and route-specific JS (excluding the shared framework chunks) ≤ 40 KB gzip. Recorded as a deliberate deviation from spec §9.1.
2. **Halal rule (owner, 2026-10-12).** Forbidden: bars and alcohol, pork, gambling. All borderline kinds (spas and massage, escape rooms and the rest) are approved. New copy follows this rule.
3. **Weekend hours (Task 27) are approved by the owner. Do not skip.** Arab and Druze localities: Saturday open, Friday closes 12:00. Christian-majority villages (e.g. Fassuta, Mi'ilya, Eilabun, Jish): Saturday open, Sunday closed. Mixed cities (Haifa, Akko, Ma'alot-Tarshiha, Nof HaGalil, Lod-style mixed) keep the default week.
4. The plan's listed decisions are accepted as written: `/{place}/k/{kind}` 307 to the canonical URL, hidden-primary-kind businesses 404, photos wait for Plan 4, screenshots reviewed against VC1–VC10, Hebrew OG image on Arabic pages, text wordmark, template fonts named but not downloaded, Friday short = 12:00, ⌘K in Plan 3.
5. **GitHub Actions versions** are unconfirmed. Task 23 checks the latest major tag of each action with `gh api repos/<owner>/<action>/releases/latest` and pins those, never a floating `@main`.
