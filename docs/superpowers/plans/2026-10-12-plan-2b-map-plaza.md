# Darb-City Plan 2B: the Zoomable City (map and plaza)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Layer the Zoomable City on top of Plan 2A's list-first pages. Level 0 is a MapLibre map of
Israel in the Darb style, with live places glowing by business density. Entering a place flies the
camera in and crossfades into a 2.5D plaza (the Darb gate, sectors as lit streets, kinds as gold
doors). Levels 3–4 return to the map at street level with business pins, behind a non-modal desktop
sheet. Every list stays the complete experience, and the stage is progressive enhancement that loads
after the list is interactive.

**Architecture:** A new DOM-free package, `@darb/stage`, holds the stage as plain data: the level
model, cameras, transition plans, easing, density glow and the plaza scene model (`buildPlaza`), so
the Expo app can later draw the same scene with Skia. Level pages render a tiny client `StageData`
that publishes each level's `StageLevel` to a module store. The root layout holds `StageMount`, a
~1 KB island that waits for `load` and idle time and then `next/dynamic`-loads `@/stage/Stage` (async
chunk). `Stage` owns a `Director` (an imperative transition runner), a `CityMap` (MapLibre 6.11.2
loaded at runtime as vendored ES modules from `/map/vendor/…`, PMTiles through the `pmtiles` protocol,
a build-time Darb style made with `@protomaps/basemaps`, self-hosted glyphs) and a `PlazaView` (SVG
scenery plus real `<Link>` doors). Tiles come from `/api/tiles/[name]` (a Range-capable route handler
over a local extract) or, in production (Plan 4), from `NEXT_PUBLIC_MAP_TILES_URL` on R2. An inline
`<head>` script decides the desktop split layout before the first paint, so the page never shifts.

**Tech Stack:** Next.js 16.3.6 (Turbopack, `next/dynamic`, route handlers), React 19.3,
`maplibre-gl` 6.11.2 (vendored ESM, WebGL2), `pmtiles` 4.5.0, `@protomaps/basemaps` 5.7.2 (build-time
only), go-pmtiles CLI v1.31.2 (developer tool, never in CI), Noto Sans Regular glyph PBFs (SIL OFL)
from `protomaps/basemaps-assets@028c18f`, Vitest 5, Playwright 1.63 (Chromium with SwiftShader WebGL),
NestJS 11 + Prisma 7 (one new endpoint).

**Spec:** `docs/superpowers/specs/2026-10-12-darb-city-v1-design.md` (binding: §3.1, §3.2, §3.3, §3.5,
§6.1, §6.3, §6.4, §7, §8, §9). Also read `docs/superpowers/plans/2026-10-12-plan-2a-web-city.md`
(Global Constraints, Visual criteria, Controller rulings) and
`docs/superpowers/plans/2026-10-12-plan-2a-followups.md` (rulings I2, I5 and the sub-place URL). Read
the Next.js 16 docs in `apps/web/node_modules/next/dist/docs/` before you write Next code:
`01-app/02-guides/lazy-loading.md` (`next/dynamic`, `turbopackIgnore`) and
`01-app/03-api-reference/03-file-conventions/route.md` (route handlers; a `route.ts` may export only
HTTP methods and segment config).

## Where this plan sits

| Plan | Delivers |
|---|---|
| 1 (done, PR #1) | Monorepo, `core`, `tokens`, `i18n`, `contracts`, database, read API, seed |
| 2A (done, PR #2) | List-first web city: levels 0–4, path bar, sheets, locales, errors, `/for-business`, gates |
| **2B (this)** | `@darb/stage`; the map (levels 0, 3, 4), the plaza (levels 1, 2), camera moves, non-modal desktop sheet, tiles tooling, stage budget, e2e |
| 3 | Smart search, level-3 filters (I4) |
| 4 | Admin, media, deploy: tiles on R2, open-now client-side (I3), cut-over |

## Global Constraints

- Branch `feat/plan-2b-map-plaza`, created from `feat/plan-2a-web-city` (Task 1 Step 1).
- Commits are conventional (`feat:`, `fix:`, `test:`, `build:`, `ci:`, `chore:`, `docs:`) and carry
  **no AI attribution lines** (no `Co-Authored-By`, no "Generated with"). The message ends with the
  last line of the description.
- Exact versions only, through the pnpm `catalog` in `pnpm-workspace.yaml`. Every new version is at
  least 14 days old on 2026-10-12 (older than 2026-09-28). pnpm 11 enforces a minimum release age:
  never add `minimumReleaseAgeExclude` or any other exclusion.
- `packages/core`, `tokens`, `i18n`, `contracts` and the new `packages/stage` stay free of `node:*`
  and DOM APIs (`packages/stage` compiles with `"lib": ["ES2023"]` and `"types": []`).
- Halal only, in any language: no alcohol, pork, gambling, nightlife, tattoo or immodest content. The
  map drops OpenStreetMap points of interest entirely (they include bars and pubs).
- Locales: Hebrew at `/` (unprefixed), Arabic at `/ar`, English at `/en`. Display text goes through
  `pickText`; interface copy goes through `t()` from `@darb/i18n`. Map labels use the tile name field
  for the page locale (`name:he`, `name:ar`, `name:en`).
- Hebrew and Arabic read right to left: the plaza mirrors (first door at the right), the desktop
  stage sits on the left, and the sheet's side follows 2A (inline end).
- Slugs are never reserved words (`RESERVED_SLUGS` in `@darb/core`). New URLs live under `/api/…`
  and `/map/…` (files with extensions), which the proxy already skips.
- Next.js 16: `src/proxy.ts` (never `middleware.ts`); level pages keep `revalidate = 300` and
  `generateStaticParams` returning `[]`; `next build` never calls the API or the network (tiles,
  glyphs and MapLibre come from the repo and `node_modules`).
- Web imports use the `@/` alias with extensionless paths. Workspace packages keep NodeNext `.js`
  relative imports.
- CSS uses logical properties only. Only `transform` and `opacity` are transitioned or animated (CSS
  and the Web Animations API alike). Level changes are camera moves of 400–700 ms on the Darb
  ease-out `cubic-bezier(0.22, 1, 0.36, 1)` (`motion.easeOut` in `@darb/tokens`); content appears
  before motion ends; `prefers-reduced-motion: reduce` gives no flying and a 400 ms opacity fade.
  `src/lib/styles.test.ts` enforces the CSS half on every `.css` file under `apps/web/src`.
- The map and plaza are enhancements. Every level stays a complete list-and-link view; keyboard and
  screen-reader users reach every door through the list; the map canvas has an accessible name and
  is not a tab stop; nothing traps focus except the phone's modal sheet (2A).
- Touch targets at least 44 × 44 px (plaza doors included); WCAG AA text on dark surfaces with 2A's
  allowed colours (ivory `#fbf7ec`, ivory-200 `#efe8d6`, sage `#a9b8ad`, gold-300 `#f0c77a`, gold
  `#d9a54c`).
- First-load JavaScript per level route stays within 2A's budget (≤ 180 KB gzip total, ≤ 40 KB
  route-specific). Map and plaza code never enters a route's first load. The lazy stage has its own
  budget (≤ 340 KB gzip on the main thread, Task 16).
- No runtime third-party requests: MapLibre, glyphs, styles and tiles are same-origin (tiles may move
  to the Darb R2 host in Plan 4). OpenStreetMap and Protomaps attribution is always visible on the
  map.
- Docker Desktop must be running for API tests and e2e (`pnpm infra:up`).
- Before every commit: `pnpm format` then `pnpm lint` (both clean).

## Review Focus

1. **Right-to-left plaza.** In Hebrew and Arabic the first door stands at the inline start (the
   right) and rows read right to left; door links still follow list order in the DOM. Pinned by
   Task 3 (`buildPlaza` mirror test) and Task 17 (`stage.spec.ts`, "RTL: the first door stands at
   the right").
2. **The stage failing after the layout committed.** A GPU that refuses WebGL2 (the API exists, the
   context is `null`) or a tile archive that 404s must collapse the desktop split back to 2A's
   centred column, with the full list and no dead pane. Pinned by Task 15 (`StageMount` hands
   the city back on `onFail`) and Task 17 ("a GPU that refuses WebGL2", "a failed tile load").
3. **Navigating while the camera is still moving.** A second click or Back during a 550 ms move must
   end with the stage showing the last URL, not the one it was flying to. Pinned by Task 14
   (`Director` superseded-run test) and Task 17 ("navigation during a camera move ends where the URL
   ends").
4. **Sub-place businesses.** `/{listed}/{sector}/{kind}/{ownPlace}/{slug}` keeps the listed place's
   camera and highlights the business's own pin, with no redirect. Pinned by Task 10 (`kindStage`
   pin hrefs use `paths.listedBusiness`) and Task 17 ("a neighbourhood business keeps the listed
   place's camera").
5. **Escape while another widget owns it.** With the desktop sheet open, an Escape that something
   else already handled (`defaultPrevented`) must not close the sheet, and the map behind the sheet
   must stay clickable. Pinned by Task 11 (unit) and Task 17 ("the sheet is non-modal and the map
   stays usable behind it").

## Decisions this plan makes (controller to confirm)

1. **Lazy stage budget: 340 KB gzip on the main thread** (proposed ≤ 250 KB cannot hold). Measured
   on the published tarball, `maplibre-gl@6.11.2` loads `maplibre-gl.mjs` (150.1 KB gzip) and
   `maplibre-gl-shared.mjs` (147.2 KB) on the main thread, 297.3 KB before any Darb code. The rest
   (`pmtiles` with `fflate`, `@darb/stage`, Director, CityMap and PlazaView) is about 20–30 KB. The
   worker (`maplibre-gl-worker.mjs`, 6.1 KB, plus the shared module it gets from the HTTP cache) is
   reported, not budgeted.
2. **MapLibre is vendored, not bundled.** `scripts/copy-map.mjs` copies MapLibre's ESM files to
   `public/map/vendor/maplibre-gl@6.11.2/`, and the stage imports them with
   `import(/* webpackIgnore: true */ /* turbopackIgnore: true */ url)`. This guarantees MapLibre is
   never in a route chunk, lets its module worker resolve itself from `import.meta.url` with no
   bundler plumbing, and lets the worker reuse the shared module from the HTTP cache (cached
   `immutable` under a versioned path). Types still come from the `maplibre-gl` package.
3. **No RTL text plugin.** MapLibre 6.9.0+ shapes Arabic and Hebrew itself (CHANGELOG #8343) and
   deprecates `setRTLTextPlugin`.
4. **No sprite.** Every icon layer goes: OSM points of interest (also halal: they include bars and
   pubs), road shields, one-way arrows and town dots. Administrative boundaries are dropped too,
   because Darb maps places, not borders. Live places are drawn as circles in our own GeoJSON layer.
5. **Glyphs: Noto Sans Regular PBFs** (SIL OFL) from `protomaps/basemaps-assets` commit
   `028c18f713baecad011301ff7a69acc39bcc2ae7`, 13 ranges (Latin, Latin Extended, combining marks,
   Cyrillic, Hebrew, Arabic, Arabic Supplement and Extended-A, punctuation, Arabic presentation forms
   A and B), about 1.4 MB, committed under `apps/web/map-assets/glyphs/` with `OFL.txt`. Map labels
   are Noto Sans, while VC9 (Heebo, Cairo, Ubuntu) stays the rule for HTML text.
6. **Tiles:** Israel bbox `34.2,29.45,35.95,33.35`, `--maxzoom=14`, from the newest Protomaps daily
   build. A dry run on build 20261010 reported 18,154 tiles and a 92 MB archive (maxzoom 13: 46 MB).
   Locally it lives at `apps/web/.tiles/israel.pmtiles` (git-ignored) and is served by
   `/api/tiles/[name]` with HTTP Range. `NEXT_PUBLIC_MAP_TILES_URL` points elsewhere (R2 in Plan 4).
   CI never downloads tiles: it uses a 1,075-byte generated fixture committed at
   `apps/web/e2e/tiles/israel.pmtiles`.
7. **Which view where.** Level 0 (and `/k/{kind}`): map. Levels 1–2: plaza. Levels 3–4: map at the
   place with business pins (spec §3.2 "list + map"). A soon place shows the map at that place.
   `/search` and `/for-business` have no stage.
8. **Layout.** On desktop with the stage, the list column (≤ 600 px) sits at the inline start and the
   stage fills the rest (VC5 is amended to VC13). On phones the list stays exactly as in 2A. A
   "Map"/"List" pill opens the stage full-screen at levels 0–2, and it closes itself at level 3.
9. **Plaza doors are SVG scenery plus real HTML `<Link>`s.** Links are positioned over the drawn
   doors, carry the same hrefs as the list doors and come in list order. They follow the list in the
   DOM, so Tab reaches the list first. Alternative if the controller prefers: `aria-hidden`
   plaza with `tabindex="-1"` links (pointer-only mirror).
10. **Pre-paint decision.** An inline `<head>` script marks the page `data-stage-capable` when
    `WebGL2RenderingContext` and `Worker` exist and data saver is off. A device that has the API but
    refuses a context falls back after the stage tries, which is one layout change, rare and pinned
    by e2e.
11. **Density endpoint** `GET /density` returns `{ [liveSettlementSlug]: publishedBusinessCount }`
    over each settlement's subtree, counting only businesses whose primary kind is active.
12. **60 fps proxy:** in e2e (desktop project, Chromium with SwiftShader, fixture tiles), no
    `longtask` entry over 50 ms starts while the stage is moving during a map-to-plaza fly.
13. **The map is pointer-only** (`keyboard: false`, canvas `tabindex="-1"`, `role="img"`, an
    accessible name). Phones keep 2A's modal bottom sheet, and only the desktop side panel becomes
    non-modal.

## Visual criteria

VC1–VC10 from Plan 2A still apply to every list view and to the fallback. VC5 now reads "Desktop
without the stage: content column at most 1200 px, centred". Add:

- **VC11 Map:** night/forest land and water, gold highways and major roads, forest minor roads,
  ivory or sage labels in the page language. Live places glow gold, larger where there are more
  businesses. There are no white or grey tiles, no POI icons and no borders, and "Map data:
  © OpenStreetMap · Protomaps" is visible.
- **VC12 Plaza:** the Darb gate (doorway silhouette, gold rim) is centred at the head of the
  streets. Each door is the doorway silhouette with a thin gold rim and a gold count, and empty doors
  are dimmer but present. Streets glow in the sector accent, and labels sit under their doors with no
  overlap and no clipping.
- **VC13 Desktop with the stage:** the list column (≤ 600 px) is at the inline start with the header
  aligned to it, and the stage fills the rest. At level 4 the sheet covers the stage's inline end,
  and the map (with pins) stays visible between the list and the sheet.
- **VC14 Phone:** the "Map"/"List" pill sits centred above the docked search bar. The stage view
  fills the screen, and the shoot report gives `small: []` with the stage open.
- **VC15 Right to left:** in Hebrew and Arabic the stage is on the left, the list on the right, and
  the plaza's first door at the right.
- **VC16 Fallback:** with WebGL off, every page matches 2A's screenshots (VC1–VC10).

---

## File map

```
pnpm-workspace.yaml                         catalog: maplibre-gl, pmtiles, @protomaps/basemaps
.gitignore .prettierignore eslint.config.mjs public/map and .tiles ignored
.github/workflows/ci.yml                    test-tiles reproducibility step
README.md                                   map tiles, licences, attribution
packages/stage/                             NEW @darb/stage (DOM-free)
  src/types.ts easing.ts camera.ts density.ts gesture.ts plaza.ts index.ts (+ *.test.ts)
packages/contracts/src/schemas.ts contract.ts     DensitySchema, businesses.density
apps/api/src/businesses/businesses.repository.ts  density()
apps/api/src/businesses/businesses.controller.ts  density handler
apps/api/src/businesses/density.test.ts
packages/i18n/src/messages/{he,ar,en}.ts    mapLabel plazaLabel showMap showList mapData
apps/web/
  package.json next.config.ts .env.example playwright.config.ts
  map-assets/glyphs/Noto Sans Regular/*.pbf, map-assets/glyphs/OFL.txt   (committed)
  scripts/copy-map.mjs                      public/map: vendor, glyphs, styles
  scripts/map/style.mjs fetch-glyphs.mjs    Darb style builder; one-off glyph download
  scripts/tiles/pmtiles-writer.mjs make-test-tiles.mjs extract-israel.mjs
  scripts/check-budget.mjs                  + lazy stage budget
  e2e/tiles/israel.pmtiles                  (committed fixture, 1,075 bytes)
  e2e/fixtures.ts                           settleStage()
  e2e/stage.spec.ts                         NEW
  e2e/a11y.spec.ts visual.spec.ts sheet.spec.ts   updated
  src/app/api/city/route.ts (+test)         live places with density, localized
  src/app/api/tiles/[name]/route.ts (+test) PMTiles with HTTP Range
  src/app/[locale]/layout.tsx               boot script, .city wrapper, StageMount
  src/app/[locale]/page.tsx [place]/page.tsx [place]/[sector]/page.tsx
  src/app/[locale]/[place]/[sector]/[kind]/layout.tsx k/[kind]/page.tsx   StageData
  src/app/globals.css                       desktop split
  src/lib/api.ts (+test)                    getDensity
  src/lib/byte-range.ts (+test)             parseRange
  src/lib/stage-boot.ts (+test)             stageAllowed, stageBootScript
  src/lib/stage-data.ts (+test)             StageLevel builders
  src/lib/stage-store.ts                    level store
  src/lib/use-media.ts                      matchMedia hook
  src/components/StageData.tsx (+test)      publishes the level
  src/components/StageMount.tsx (+test) StageMount.module.css
  src/components/Sheet.tsx Sheet.module.css Sheet.test.tsx   non-modal desktop
  src/components/Header.module.css          stacking above the stage
  src/stage/                                NEW, lazy chunk only
    vendor.ts types.ts load-maplibre.ts map-style.ts map-layers.ts city-map.ts
    fade.ts director.ts PlazaView.tsx plaza.module.css Stage.tsx stage.module.css (+ tests)
```

---

### Task 1: Branch, dependencies and the vendored MapLibre

**Files:**
- Modify: `pnpm-workspace.yaml` (catalog)
- Modify: `apps/web/package.json`
- Create: `apps/web/scripts/copy-map.mjs`
- Create: `apps/web/src/stage/vendor.ts`
- Test: `apps/web/src/stage/vendor.test.ts`
- Modify: `apps/web/next.config.ts`, `apps/web/src/lib/next-config.test.ts`
- Modify: `.gitignore`, `.prettierignore`, `eslint.config.mjs`

**Interfaces:**
- Produces: `buildMapAssets(target: string): { vendor: string }`, `maplibreVersion(): string`,
  `VENDOR_FILES: string[]` (from `scripts/copy-map.mjs`; Task 8 extends `buildMapAssets`).
- Produces (`@/stage/vendor`): `MAPLIBRE_VERSION = "6.11.2"`, `VENDOR_DIR`, `MAPLIBRE_URL`,
  `MAPLIBRE_CSS_URL`, `TILES_URL`, `styleUrl(locale: Locale): string`.

- [ ] **Step 1: Create the branch**

```bash
cd /Users/zangeel/Documents/GitHub/Darb-City
git switch feat/plan-2a-web-city && git pull --ff-only
git switch -c feat/plan-2b-map-plaza
```

Expected: `Switched to a new branch 'feat/plan-2b-map-plaza'`. If the branch already exists, run
`git switch feat/plan-2b-map-plaza` instead.

- [ ] **Step 2: Confirm versions and licences before pinning**

```bash
npm view maplibre-gl@6.11.2 license time.6.11.2
npm view pmtiles@4.5.0 license time.4.5.0
npm view @protomaps/basemaps@5.7.2 license time.5.7.2
```

Expected: `BSD-3-Clause` and a date before 2026-09-28 for each (6.11.2: 2026-09-24; 4.5.0:
2026-08-10; 5.7.2: 2026-03-10). If any date is later, stop and report it to the controller.

- [ ] **Step 3: Add the catalog entries**

In `pnpm-workspace.yaml`, under `catalog:`, add these three lines in alphabetical position (after
`"@prisma/client"`, after `jsdom`, after `pg` respectively):

```yaml
  "@protomaps/basemaps": 5.7.2
  maplibre-gl: 6.11.2
  pmtiles: 4.5.0
```

In `apps/web/package.json`, add to `"dependencies"` (keep alphabetical order):

```json
    "maplibre-gl": "catalog:",
    "pmtiles": "catalog:",
```

and to `"devDependencies"`:

```json
    "@protomaps/basemaps": "catalog:",
```

and replace the `dev` and `build` scripts, adding `map`:

```json
    "map": "node scripts/copy-map.mjs",
    "dev": "node scripts/copy-brand.mjs && node scripts/copy-map.mjs && next dev --port 3000",
    "build": "node scripts/copy-brand.mjs && node scripts/copy-map.mjs && next build",
```

Run: `pnpm install`
Expected: exits 0 and `pnpm-lock.yaml` gains `maplibre-gl@6.11.2`, `pmtiles@4.5.0` and
`@protomaps/basemaps@5.7.2`. pnpm's minimum release age resolves each transitive range (for
example `fflate` under `pmtiles`) to a version old enough. If it reports `ERR_PNPM_…RELEASE_AGE…`,
do not add exclusions: stop and report.

- [ ] **Step 4: Write the failing test**

Create `apps/web/src/stage/vendor.test.ts`:

```ts
// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, it } from "vitest";
import { buildMapAssets, maplibreVersion, VENDOR_FILES } from "../../scripts/copy-map.mjs";
import { MAPLIBRE_CSS_URL, MAPLIBRE_URL, MAPLIBRE_VERSION, styleUrl, TILES_URL } from "./vendor";

it("pins the vendored MapLibre to the installed version", () => {
  expect(MAPLIBRE_VERSION).toBe(maplibreVersion());
  expect(MAPLIBRE_URL).toBe(`/map/vendor/maplibre-gl@${MAPLIBRE_VERSION}/maplibre-gl.mjs`);
  expect(MAPLIBRE_CSS_URL).toBe(`/map/vendor/maplibre-gl@${MAPLIBRE_VERSION}/maplibre-gl.css`);
});

it("serves tiles from the local route unless an R2 URL is configured", () => {
  expect(TILES_URL).toBe("/api/tiles/israel.pmtiles");
  expect(styleUrl("ar")).toBe("/map/style/ar.json");
});

it("copies the MapLibre modules where the stage imports them", () => {
  const target = mkdtempSync(join(tmpdir(), "darb-map-"));
  const { vendor } = buildMapAssets(target);
  expect(vendor).toBe(join(target, "vendor", `maplibre-gl@${MAPLIBRE_VERSION}`));
  for (const file of VENDOR_FILES) expect(existsSync(join(vendor, file)), file).toBe(true);
  // The main module imports its shared half by relative URL, so both must sit side by side.
  expect(readFileSync(join(vendor, "maplibre-gl.mjs"), "utf8")).toContain(
    'from"./maplibre-gl-shared.mjs"',
  );
});
```

- [ ] **Step 5: Run it to verify it fails**

Run: `pnpm --filter @darb/web exec vitest run src/stage/vendor.test.ts`
Expected: FAIL, `Failed to resolve import "../../scripts/copy-map.mjs"`.

- [ ] **Step 6: Implement**

Create `apps/web/scripts/copy-map.mjs`:

```js
// Builds public/map (served at /map/*). The lazy city stage imports MapLibre's ES modules from here
// at runtime, so MapLibre never enters a route's first-load JavaScript. Run by `dev` and `build`.
import { cpSync, mkdirSync, readFileSync, rmSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);

/** The main thread loads the first two, the worker the third (and the shared module from cache). */
export const VENDOR_FILES = [
  "maplibre-gl.mjs",
  "maplibre-gl-shared.mjs",
  "maplibre-gl-worker.mjs",
  "maplibre-gl.css",
];

export function maplibreVersion() {
  return JSON.parse(readFileSync(require.resolve("maplibre-gl/package.json"), "utf8")).version;
}

export function buildMapAssets(target) {
  rmSync(target, { recursive: true, force: true });
  const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
  const vendor = join(target, "vendor", `maplibre-gl@${maplibreVersion()}`);
  mkdirSync(vendor, { recursive: true });
  for (const file of VENDOR_FILES) cpSync(join(dist, file), join(vendor, file));
  return { vendor };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { vendor } = buildMapAssets(fileURLToPath(new URL("../public/map", import.meta.url)));
  console.log(`map: vendor -> ${vendor}`);
}
```

Create `apps/web/src/stage/vendor.ts`:

```ts
import type { Locale } from "@darb/core";

/** Equal to the installed maplibre-gl (vendor.test.ts checks it); copy-map.mjs serves it here. */
export const MAPLIBRE_VERSION = "6.11.2";
export const VENDOR_DIR = `/map/vendor/maplibre-gl@${MAPLIBRE_VERSION}`;
export const MAPLIBRE_URL = `${VENDOR_DIR}/maplibre-gl.mjs`;
export const MAPLIBRE_CSS_URL = `${VENDOR_DIR}/maplibre-gl.css`;

/**
 * The Israel PMTiles archive: the local route in development and self-hosting, an R2 URL in
 * production (Plan 4). Inlined at build time.
 */
export const TILES_URL = process.env.NEXT_PUBLIC_MAP_TILES_URL || "/api/tiles/israel.pmtiles";

/** One Darb style per locale (labels in that language), written by copy-map.mjs. */
export const styleUrl = (locale: Locale): string => `/map/style/${locale}.json`;
```

- [ ] **Step 7: Run it to verify it passes**

Run: `pnpm --filter @darb/web exec vitest run src/stage/vendor.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 8: Cache the vendored modules forever (versioned path)**

Add to `apps/web/src/lib/next-config.test.ts`:

```ts
it("caches the vendored MapLibre forever and the glyphs for a day", async () => {
  const { default: config } = await import("../../next.config");
  const headers = await config.headers!();
  expect(headers).toContainEqual({
    source: "/map/vendor/:path*",
    headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
  });
  expect(headers).toContainEqual({
    source: "/map/glyphs/:path*",
    headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
  });
});
```

Run: `pnpm --filter @darb/web exec vitest run src/lib/next-config.test.ts`
Expected: FAIL (`config.headers is not a function`).

In `apps/web/next.config.ts`, add to the `config` object (after `outputFileTracingRoot`):

```ts
  // /map/vendor paths carry the MapLibre version, so they never change; glyphs change rarely.
  headers: async () => [
    {
      source: "/map/vendor/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    },
    {
      source: "/map/glyphs/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
    },
  ],
```

Run: `pnpm --filter @darb/web exec vitest run src/lib/next-config.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 9: Ignore the generated folders**

Append to `.gitignore`:

```
apps/web/public/map/
apps/web/.tiles/
```

Append to `.prettierignore`:

```
apps/web/public/map
apps/web/.tiles
apps/web/map-assets
apps/web/e2e/tiles
```

In `eslint.config.mjs`, add to the `globalIgnores([...])` list:

```js
    "apps/web/public/map/**",
    "apps/web/.tiles/**",
```

and, in the `files: ["**/*.mjs"]` block, extend `languageOptions.globals` with the Node and browser
names the new scripts use (tiles and glyph scripts, `shoot.mjs`'s in-page callbacks):

```js
        Buffer: "readonly",
        fetch: "readonly",
        innerWidth: "readonly",
```

Run: `pnpm --filter @darb/web map && ls apps/web/public/map/vendor/maplibre-gl@6.11.2`
Expected: `map: vendor -> …` then the four files `maplibre-gl-shared.mjs maplibre-gl-worker.mjs maplibre-gl.css maplibre-gl.mjs`;
`git status --short` does not list `public/map`.

- [ ] **Step 10: Commit**

```bash
pnpm format && pnpm lint
git add pnpm-workspace.yaml pnpm-lock.yaml apps/web/package.json apps/web/scripts/copy-map.mjs \
  apps/web/src/stage/vendor.ts apps/web/src/stage/vendor.test.ts apps/web/next.config.ts \
  apps/web/src/lib/next-config.test.ts .gitignore .prettierignore eslint.config.mjs
git commit -m "build(web): vendor MapLibre 6.11.2 and add pmtiles and Protomaps basemaps"
```

---

### Task 2: `@darb/stage`: level model, cameras, transitions, easing, density and gestures

**Files:**
- Create: `packages/stage/package.json`, `tsconfig.json`, `tsconfig.build.json`, `vitest.config.ts`
- Create: `packages/stage/src/types.ts`, `easing.ts`, `camera.ts`, `density.ts`, `gesture.ts`, `index.ts`
- Test: `packages/stage/src/types.test.ts`, `easing.test.ts`, `camera.test.ts`, `density.test.ts`, `gesture.test.ts`
- Modify: `apps/web/package.json` (dependency `@darb/stage`)

**Interfaces:**
- Produces (all exported from `@darb/stage`):
  - Types: `LngLat = [number, number]`; `StagePlace { slug; name; lat; lng }`;
    `StageDoor { slug; href; label; count; accent }`; `StageSector { slug; name; accent }`;
    `StagePin { key; href; name; lat; lng }`; `CityDot { slug; name; lat; lng; count; href }`;
    `StageLevel = { depth: 0 } | { depth: 1; place; doors } | { depth: 2; place; sector; doors } | { depth: 3; place; pins }`;
    `PlazaLevel = Extract<StageLevel, { depth: 1 | 2 }>`; `StageView = "map" | "plaza"`;
    `Camera = { center: LngLat; zoom: number } | { bounds: [LngLat, LngLat]; maxZoom: number }`;
    `Fade { kind: "cross" | "through"; duration; outScale; inScale }`;
    `Transition { view; camera; motion: "fly" | "jump"; duration; fade: Fade | null; direction: "in" | "out" | "none" }`.
  - `isStageLevel(value: unknown): value is StageLevel`
  - `cubicBezier(x1, y1, x2, y2): (t: number) => number`, `parseCubicBezier(css: string): [n, n, n, n]`, `easeOut: (t: number) => number`
  - `MOTION = { move: 550, fade: 400 }`, `ISRAEL_NORTH: Camera`, `PLACE_ZOOM = 13.5`, `STREET_ZOOM = 14`
  - `viewFor(level): StageView`, `sceneKey(level): string`, `cameraFor(level, dots?): Camera`,
    `planTransition(from: StageLevel | null, to: StageLevel, dots: readonly CityDot[], options: { reducedMotion: boolean }): Transition`
  - `glowRadius(count: number, max: number): number`, `cityCollection(dots)`, `pinCollection(pins, activeHref: string | null)`
    returning `FeatureCollection<P>` (`{ type: "FeatureCollection"; features: PointFeature<P>[] }`)
  - `distance(a: [number, number], b: [number, number]): number`, `PINCH_OUT_RATIO = 0.7`,
    `isPinchOut(start: number, now: number): boolean`, `zoomedOut(target: number, zoom: number): boolean`

- [ ] **Step 1: Scaffold the package**

Create `packages/stage/package.json`:

```json
{
  "name": "@darb/stage",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    ".": {
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "dependencies": {
    "@darb/tokens": "workspace:*"
  },
  "devDependencies": {
    "typescript": "catalog:",
    "vitest": "catalog:"
  },
  "files": [
    "dist"
  ]
}
```

Create `packages/stage/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "outDir": "dist", "rootDir": "src" },
  "include": ["src"]
}
```

Create `packages/stage/tsconfig.build.json`:

```json
{ "extends": "./tsconfig.json", "exclude": ["src/**/*.test.ts"] }
```

Create `packages/stage/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

`tsconfig.base.json` already sets `"lib": ["ES2023"]` and `"types": []`, so any DOM or `node:*` use
fails to compile. That is the "DOM-free" guarantee.

In `apps/web/package.json` `"dependencies"`, add `"@darb/stage": "workspace:*",` (alphabetical,
after `"@darb/i18n"`). Run `pnpm install`. Expected: exits 0.

- [ ] **Step 2: Write the failing tests**

Create `packages/stage/src/types.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { isStageLevel } from "./types.js";

const place = { slug: "sakhnin", name: "Sakhnin", lat: 32.86, lng: 35.3 };
const door = { slug: "beauty", href: "/sakhnin/beauty", label: "Beauty", count: 3, accent: "#d9aaa2" };

describe("isStageLevel", () => {
  it("accepts each depth", () => {
    expect(isStageLevel({ depth: 0 })).toBe(true);
    expect(isStageLevel({ depth: 1, place, doors: [door] })).toBe(true);
    expect(
      isStageLevel({ depth: 2, place, sector: { slug: "beauty", name: "B", accent: "#d9aaa2" }, doors: [] }),
    ).toBe(true);
    expect(isStageLevel({ depth: 3, place, pins: [] })).toBe(true);
  });
  it("rejects anything else", () => {
    for (const value of [null, {}, { depth: 4 }, { depth: 1, place }, { depth: 3, pins: [] }, "x"])
      expect(isStageLevel(value), JSON.stringify(value)).toBe(false);
  });
});
```

Create `packages/stage/src/easing.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cubicBezier, easeOut, parseCubicBezier } from "./easing.js";

describe("easing", () => {
  it("parses a CSS cubic-bezier", () => {
    expect(parseCubicBezier("cubic-bezier(0.22, 1, 0.36, 1)")).toEqual([0.22, 1, 0.36, 1]);
    expect(() => parseCubicBezier("ease")).toThrow();
  });
  it("is the identity for a linear curve", () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0, 0.3, 0.5, 0.9, 1]) expect(linear(t)).toBeCloseTo(t, 5);
  });
  it("follows the Darb ease-out: fast start, gentle landing", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.25)).toBeCloseTo(0.7649, 3);
    expect(easeOut(0.5)).toBeCloseTo(0.9614, 3);
    let last = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      expect(easeOut(t)).toBeGreaterThanOrEqual(last);
      last = easeOut(t);
    }
  });
});
```

Create `packages/stage/src/camera.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  cameraFor,
  ISRAEL_NORTH,
  MOTION,
  planTransition,
  PLACE_ZOOM,
  sceneKey,
  STREET_ZOOM,
  viewFor,
} from "./camera.js";
import type { CityDot, StageLevel } from "./types.js";

const sakhnin = { slug: "sakhnin", name: "Sakhnin", lat: 32.8638, lng: 35.3023 };
const door = (slug: string) => ({ slug, href: `/sakhnin/${slug}`, label: slug, count: 1, accent: "#d9aaa2" });
const country: StageLevel = { depth: 0 };
const place: StageLevel = { depth: 1, place: sakhnin, doors: [door("beauty"), door("food")] };
const sector: StageLevel = {
  depth: 2,
  place: sakhnin,
  sector: { slug: "beauty", name: "Beauty", accent: "#d9aaa2" },
  doors: [door("barbershops")],
};
const kind: StageLevel = {
  depth: 3,
  place: sakhnin,
  pins: [{ key: "sakhnin/a", href: "/sakhnin/beauty/barbershops/a", name: "A", lat: 32.86, lng: 35.3 }],
};
const dots: CityDot[] = [
  { slug: "sakhnin", name: "Sakhnin", lat: 32.86, lng: 35.3, count: 40, href: "/sakhnin" },
  { slug: "haifa", name: "Haifa", lat: 32.79, lng: 34.99, count: 90, href: "/haifa" },
];
const motionOff = { reducedMotion: false };

describe("views and cameras", () => {
  it("shows the map at levels 0 and 3, the plaza at 1 and 2", () => {
    expect([country, place, sector, kind].map(viewFor)).toEqual(["map", "plaza", "plaza", "map"]);
  });
  it("shows the map for a place with no doors (a soon place)", () => {
    expect(viewFor({ depth: 1, place: sakhnin, doors: [] })).toBe("map");
  });
  it("frames every live place at level 0, or the north before they load", () => {
    expect(cameraFor(country)).toEqual(ISRAEL_NORTH);
    const camera = cameraFor(country, dots);
    expect("bounds" in camera && camera.bounds[0][0]).toBeLessThan(34.99);
    expect("bounds" in camera && camera.bounds[1][1]).toBeGreaterThan(32.86);
  });
  it("centres on the place, closer at street level", () => {
    expect(cameraFor(place)).toEqual({ center: [35.3023, 32.8638], zoom: PLACE_ZOOM });
    expect(cameraFor(kind)).toEqual({ center: [35.3023, 32.8638], zoom: STREET_ZOOM });
  });
  it("frames the pins when there are several", () => {
    const two: StageLevel = {
      ...kind,
      pins: [...kind.pins, { key: "sakhnin/b", href: "/b", name: "B", lat: 32.87, lng: 35.31 }],
    };
    expect(cameraFor(two)).toMatchObject({ maxZoom: 15 });
  });
  it("keys plaza scenes by place and sector", () => {
    expect(sceneKey(place)).toBe("place:sakhnin");
    expect(sceneKey(sector)).toBe("sector:sakhnin/beauty");
  });
});

describe("planTransition", () => {
  it("appears without flying the first time", () => {
    const plan = planTransition(null, place, dots, motionOff);
    expect(plan).toMatchObject({ view: "plaza", motion: "jump", duration: 0, direction: "none" });
    expect(plan.fade).toEqual({ kind: "cross", duration: MOTION.move, outScale: 1, inScale: 1 });
  });
  it("flies into a place and crossfades the map into its plaza", () => {
    const plan = planTransition(country, place, dots, motionOff);
    expect(plan).toMatchObject({ view: "plaza", motion: "fly", duration: 550, direction: "in" });
    expect(plan.fade).toEqual({ kind: "cross", duration: 550, outScale: 1.08, inScale: 0.94 });
  });
  it("zooms through the plaza into a sector and back out", () => {
    expect(planTransition(place, sector, dots, motionOff).fade).toEqual({
      kind: "through",
      duration: 550,
      outScale: 1.08,
      inScale: 0.94,
    });
    expect(planTransition(sector, place, dots, motionOff).fade).toEqual({
      kind: "through",
      duration: 550,
      outScale: 0.94,
      inScale: 1.08,
    });
  });
  it("crossfades the plaza back to the map at street level", () => {
    const plan = planTransition(sector, kind, dots, motionOff);
    expect(plan).toMatchObject({ view: "map", direction: "in" });
    expect(plan.fade?.kind).toBe("cross");
  });
  it("only moves the camera between two map levels", () => {
    const plan = planTransition(kind, country, dots, motionOff);
    expect(plan).toMatchObject({ view: "map", motion: "fly", direction: "out", fade: null });
  });
  it("does nothing visible for the same plaza scene", () => {
    expect(planTransition(place, { ...place }, dots, motionOff).fade).toBeNull();
  });
  it("never flies with reduced motion: a 400 ms fade, no scaling", () => {
    const plan = planTransition(country, place, dots, { reducedMotion: true });
    expect(plan).toMatchObject({ motion: "jump", duration: 0 });
    expect(plan.fade).toEqual({ kind: "cross", duration: MOTION.fade, outScale: 1, inScale: 1 });
  });
  it("keeps every move and fade within 400–700 ms", () => {
    for (const d of Object.values(MOTION)) {
      expect(d).toBeGreaterThanOrEqual(400);
      expect(d).toBeLessThanOrEqual(700);
    }
  });
});
```

Create `packages/stage/src/density.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { cityCollection, glowRadius, pinCollection } from "./density.js";

describe("density", () => {
  it("glows nothing for an empty place and most for the busiest", () => {
    expect(glowRadius(0, 50)).toBe(0);
    expect(glowRadius(50, 50)).toBe(24);
    expect(glowRadius(1, 100)).toBe(7.8);
    expect(glowRadius(5, 0)).toBe(0);
  });
  it("turns live places into a GeoJSON collection with their glow", () => {
    const fc = cityCollection([
      { slug: "a", name: "A", lat: 32, lng: 35, count: 10, href: "/a" },
      { slug: "b", name: "B", lat: 33, lng: 35.5, count: 0, href: "/b" },
    ]);
    expect(fc.type).toBe("FeatureCollection");
    expect(fc.features[0]).toEqual({
      type: "Feature",
      geometry: { type: "Point", coordinates: [35, 32] },
      properties: { slug: "a", name: "A", href: "/a", count: 10, glow: 24 },
    });
    expect(fc.features[1]?.properties.glow).toBe(0);
  });
  it("marks the open business's pin", () => {
    const fc = pinCollection(
      [
        { key: "s/a", href: "/s/k/a", name: "A", lat: 32, lng: 35 },
        { key: "s/b", href: "/s/k/b", name: "B", lat: 32.1, lng: 35.1 },
      ],
      "/s/k/b",
    );
    expect(fc.features.map((f) => f.properties.active)).toEqual([false, true]);
  });
});
```

Create `packages/stage/src/gesture.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { distance, isPinchOut, zoomedOut } from "./gesture.js";

describe("gestures", () => {
  it("measures the distance between two fingers", () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
  });
  it("calls fingers moving together by 30% a pinch-out (up one level)", () => {
    expect(isPinchOut(200, 150)).toBe(false);
    expect(isPinchOut(200, 140)).toBe(true);
    expect(isPinchOut(0, 0)).toBe(false);
  });
  it("calls a user zoom of 1.5 levels below the camera a step up", () => {
    expect(zoomedOut(14, 13)).toBe(false);
    expect(zoomedOut(14, 12.5)).toBe(true);
  });
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm --filter @darb/stage test`
Expected: FAIL, five files cannot resolve `./types.js`, `./easing.js`, `./camera.js`,
`./density.js` and `./gesture.js`.

- [ ] **Step 4: Implement**

Create `packages/stage/src/types.ts`:

```ts
/**
 * The Zoomable City as plain data. Nothing here touches the DOM, so the Expo app can draw the same
 * levels and plaza with Skia. The web renderer lives in apps/web/src/stage.
 */
export type LngLat = [lng: number, lat: number];

export interface StagePlace {
  slug: string;
  /** Already in the page language. */
  name: string;
  lat: number;
  lng: number;
}

/** A door: a sector at level 1, a kind at level 2. `href` equals the list door's href. */
export interface StageDoor {
  slug: string;
  href: string;
  label: string;
  count: number;
  /** The sector accent, a warm desaturated hex. */
  accent: string;
}

export interface StageSector {
  slug: string;
  name: string;
  accent: string;
}

/** A business at level 3. `href` equals its list row's href (listed place first). */
export interface StagePin {
  key: string;
  href: string;
  name: string;
  lat: number;
  lng: number;
}

/** A live place on the level 0 map, glowing by its business count. */
export interface CityDot {
  slug: string;
  name: string;
  lat: number;
  lng: number;
  count: number;
  href: string;
}

/**
 * Depth follows the URL levels: 0 the country, 1 a place (its sectors), 2 a sector (its kinds),
 * 3 a kind in a place (its businesses; the business sheet opens over it). A soon place is depth 3
 * with no pins: the map at that place.
 */
export type StageLevel =
  | { depth: 0 }
  | { depth: 1; place: StagePlace; doors: StageDoor[] }
  | { depth: 2; place: StagePlace; sector: StageSector; doors: StageDoor[] }
  | { depth: 3; place: StagePlace; pins: StagePin[] };

export type PlazaLevel = Extract<StageLevel, { depth: 1 | 2 }>;

export type StageView = "map" | "plaza";

export type Camera =
  | { center: LngLat; zoom: number }
  | { bounds: [LngLat, LngLat]; maxZoom: number };

export interface Fade {
  /** cross: two layers swap; through: one plaza layer zooms out, changes scene, zooms back in. */
  kind: "cross" | "through";
  duration: number;
  outScale: number;
  inScale: number;
}

export interface Transition {
  view: StageView;
  camera: Camera;
  motion: "fly" | "jump";
  /** Camera move duration in ms (0 for a jump). */
  duration: number;
  fade: Fade | null;
  direction: "in" | "out" | "none";
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === "object" && v !== null;
const isPlace = (v: unknown) =>
  isObject(v) && typeof v.slug === "string" && typeof v.lat === "number" && typeof v.lng === "number";

/** A shallow shape check for levels that crossed a serialization boundary. */
export function isStageLevel(value: unknown): value is StageLevel {
  if (!isObject(value)) return false;
  switch (value.depth) {
    case 0:
      return true;
    case 1:
      return isPlace(value.place) && Array.isArray(value.doors);
    case 2:
      return isPlace(value.place) && isObject(value.sector) && Array.isArray(value.doors);
    case 3:
      return isPlace(value.place) && Array.isArray(value.pins);
    default:
      return false;
  }
}
```

Create `packages/stage/src/easing.ts`:

```ts
import { motion } from "@darb/tokens";

export function parseCubicBezier(css: string): [number, number, number, number] {
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(css.trim());
  const values = match?.[1]?.split(",").map((v) => Number(v.trim())) ?? [];
  if (values.length !== 4 || values.some((v) => Number.isNaN(v)))
    throw new Error(`Not a cubic-bezier: ${css}`);
  return values as [number, number, number, number];
}

/** The CSS timing function as t → progress (Newton's method, then bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-7) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-7) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-7) {
      if (sampleX(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

/** The Darb ease-out, for camera moves (MapLibre takes an easing function). */
export const easeOut = cubicBezier(...parseCubicBezier(motion.easeOut));
```

Create `packages/stage/src/camera.ts`:

```ts
import type { Camera, CityDot, LngLat, StageLevel, StageView, Transition } from "./types.js";

/** Camera moves and crossfades (ms): --dur and --dur-fast in apps/web/src/app/globals.css. */
export const MOTION = { move: 550, fade: 400 } as const;

/** Northern and Haifa districts, the launch region, before the live places load. */
export const ISRAEL_NORTH: Camera = {
  bounds: [
    [34.85, 32.35],
    [35.9, 33.35],
  ],
  maxZoom: 9,
};
export const PLACE_ZOOM = 13.5;
export const STREET_ZOOM = 14;

const ZOOM_IN = 1.08;
const ZOOM_OUT = 0.94;

export function viewFor(level: StageLevel): StageView {
  return (level.depth === 1 || level.depth === 2) && level.doors.length > 0 ? "plaza" : "map";
}

export function sceneKey(level: StageLevel): string {
  if (level.depth === 1) return `place:${level.place.slug}`;
  if (level.depth === 2) return `sector:${level.place.slug}/${level.sector.slug}`;
  return `map:${level.depth}`;
}

function boundsOf(points: readonly LngLat[], maxZoom: number, pad = 0.02): Camera | null {
  if (points.length === 0) return null;
  const lngs = points.map((p) => p[0]);
  const lats = points.map((p) => p[1]);
  return {
    bounds: [
      [Math.min(...lngs) - pad, Math.min(...lats) - pad],
      [Math.max(...lngs) + pad, Math.max(...lats) + pad],
    ],
    maxZoom,
  };
}

export function cameraFor(level: StageLevel, dots: readonly CityDot[] = []): Camera {
  if (level.depth === 0)
    return boundsOf(
      dots.map((d) => [d.lng, d.lat]),
      9,
      0.08,
    ) ?? ISRAEL_NORTH;
  const center: LngLat = [level.place.lng, level.place.lat];
  if (level.depth === 3) {
    if (level.pins.length > 1)
      return boundsOf(
        level.pins.map((p) => [p.lng, p.lat]),
        15,
      )!;
    return { center, zoom: STREET_ZOOM };
  }
  return { center, zoom: PLACE_ZOOM };
}

/**
 * How the stage moves from one level to the next (spec §3.5): the camera flies for 550 ms on the
 * Darb ease-out while the layers crossfade, or, with reduced motion, jumps under a 400 ms fade.
 */
export function planTransition(
  from: StageLevel | null,
  to: StageLevel,
  dots: readonly CityDot[],
  options: { reducedMotion: boolean },
): Transition {
  const view = viewFor(to);
  const camera = cameraFor(to, dots);
  const reduced = options.reducedMotion;
  const fadeMs = reduced ? MOTION.fade : MOTION.move;
  if (from === null)
    return {
      view,
      camera,
      motion: "jump",
      duration: 0,
      fade: { kind: "cross", duration: fadeMs, outScale: 1, inScale: 1 },
      direction: "none",
    };
  const direction = to.depth > from.depth ? "in" : to.depth < from.depth ? "out" : "none";
  const motion = reduced ? "jump" : "fly";
  const out = reduced ? 1 : direction === "in" ? ZOOM_IN : direction === "out" ? ZOOM_OUT : 1;
  const into = reduced ? 1 : direction === "in" ? ZOOM_OUT : direction === "out" ? ZOOM_IN : 1;
  const fromView = viewFor(from);
  let fade: Transition["fade"] = null;
  if (fromView !== view)
    fade = { kind: "cross", duration: fadeMs, outScale: out, inScale: into };
  else if (view === "plaza" && sceneKey(from) !== sceneKey(to))
    fade = { kind: "through", duration: fadeMs, outScale: out, inScale: into };
  return { view, camera, motion, duration: motion === "fly" ? MOTION.move : 0, fade, direction };
}
```

Create `packages/stage/src/density.ts`:

```ts
import type { CityDot, StagePin } from "./types.js";

export interface PointFeature<P> {
  type: "Feature";
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: P;
}
export interface FeatureCollection<P> {
  type: "FeatureCollection";
  features: PointFeature<P>[];
}

/** Glow radius in px at zoom 7: none for an empty place, 6–24 px by the square root of density. */
export function glowRadius(count: number, max: number): number {
  if (count <= 0 || max <= 0) return 0;
  return Math.round((6 + 18 * Math.sqrt(Math.min(count, max) / max)) * 10) / 10;
}

const point = <P>(lng: number, lat: number, properties: P): PointFeature<P> => ({
  type: "Feature",
  geometry: { type: "Point", coordinates: [lng, lat] },
  properties,
});

export function cityCollection(dots: readonly CityDot[]) {
  const max = Math.max(0, ...dots.map((d) => d.count));
  return {
    type: "FeatureCollection" as const,
    features: dots.map((d) =>
      point(d.lng, d.lat, {
        slug: d.slug,
        name: d.name,
        href: d.href,
        count: d.count,
        glow: glowRadius(d.count, max),
      }),
    ),
  };
}

export function pinCollection(pins: readonly StagePin[], activeHref: string | null) {
  return {
    type: "FeatureCollection" as const,
    features: pins.map((p) =>
      point(p.lng, p.lat, { key: p.key, name: p.name, href: p.href, active: p.href === activeHref }),
    ),
  };
}
```

Create `packages/stage/src/gesture.ts`:

```ts
export const PINCH_OUT_RATIO = 0.7;

export function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Two fingers moving together (zooming out) by 30% or more: go up one level (spec §3.3). */
export function isPinchOut(start: number, now: number): boolean {
  return start > 0 && now <= start * PINCH_OUT_RATIO;
}

/** The person zoomed the map out 1.5 levels or more below where the camera put it. */
export function zoomedOut(target: number, zoom: number): boolean {
  return zoom <= target - 1.5;
}
```

Create `packages/stage/src/index.ts`:

```ts
export * from "./types.js";
export * from "./easing.js";
export * from "./camera.js";
export * from "./density.js";
export * from "./gesture.js";
```

- [ ] **Step 5: Run them to verify they pass**

Run: `pnpm --filter @darb/tokens build && pnpm --filter @darb/stage test && pnpm --filter @darb/stage typecheck && pnpm --filter @darb/stage build`
Expected: 5 files, all tests PASS. Typecheck is clean, and `packages/stage/dist/index.js` exists.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add packages/stage apps/web/package.json pnpm-lock.yaml
git commit -m "feat(stage): DOM-free level model, cameras, transitions and easing"
```

---

### Task 3: The plaza scene model

**Files:**
- Create: `packages/stage/src/plaza.ts`
- Test: `packages/stage/src/plaza.test.ts`
- Modify: `packages/stage/src/index.ts`

**Interfaces:**
- Consumes: `StageDoor` (Task 2).
- Produces: `PLAZA` (layout constants, including `label: 40`, `minTarget: 44`, `top: 56`),
  `Box { x; y; w; h }`, `PlazaViewport { width; height; dir: "ltr" | "rtl" }`,
  `PlazaDoor extends StageDoor { index; row; lit: boolean; frame: Box; hit: Box }`,
  `PlazaRow { index; scale; parallax; doors: number[] }`,
  `PlazaStreet { door: number; from: [number, number]; to: [number, number]; width: number; color: string }`,
  `PlazaScene { width; height; dir; gate: Box; streets; rows; doors }`,
  `buildPlaza(doors: readonly StageDoor[], viewport: PlazaViewport): PlazaScene`.
  Coordinates are physical px from the scene's top-left (already mirrored for RTL). `frame` is the
  drawn doorway (100 × 150 aspect), and `hit` is the link box (the door plus its 40 px label beneath).

- [ ] **Step 1: Write the failing test**

Create `packages/stage/src/plaza.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { buildPlaza, PLAZA, type Box } from "./plaza.js";
import type { StageDoor } from "./types.js";

const doors = (n: number, count = 1): StageDoor[] =>
  Array.from({ length: n }, (_, i) => ({
    slug: `d${i}`,
    href: `/p/d${i}`,
    label: `Door ${i}`,
    count: i === 1 ? 0 : count,
    accent: "#d9aaa2",
  }));
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w - 1e-6 && b.x < a.x + a.w - 1e-6 && a.y < b.y + b.h - 1e-6 && b.y < a.y + a.h - 1e-6;
const inside = (b: Box, w: number, h: number) =>
  b.x >= -1e-6 && b.y >= -1e-6 && b.x + b.w <= w + 1e-6 && b.y + b.h <= h + 1e-6;

const SIZES = [
  [320, 568],
  [390, 780],
  [768, 900],
  [840, 900],
  [1024, 700],
] as const;
const COUNTS = [1, 5, 12, 18, 30];

describe("buildPlaza", () => {
  for (const [width, height] of SIZES)
    for (const n of COUNTS)
      it(`${n} doors at ${width}×${height}: 44 px targets, no overlap, inside the scene`, () => {
        const scene = buildPlaza(doors(n), { width, height, dir: "ltr" });
        expect(scene.doors).toHaveLength(n);
        for (const d of scene.doors) {
          expect(d.hit.w).toBeGreaterThanOrEqual(PLAZA.minTarget);
          expect(d.hit.h).toBeGreaterThanOrEqual(PLAZA.minTarget);
          expect(d.frame.w).toBeGreaterThanOrEqual(PLAZA.minTarget);
          expect(d.frame.h / d.frame.w).toBeCloseTo(1.5, 6);
          expect(inside(d.hit, scene.width, scene.height)).toBe(true);
          expect(inside(d.frame, scene.width, scene.height)).toBe(true);
        }
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++)
            expect(overlaps(scene.doors[i]!.hit, scene.doors[j]!.hit), `${i}/${j}`).toBe(false);
        expect(scene.height).toBeGreaterThanOrEqual(height);
        expect(scene.gate.y).toBeGreaterThanOrEqual(PLAZA.top - 1e-6);
      });

  it("keeps list order, so links come in the same order as the list's doors", () => {
    const scene = buildPlaza(doors(18), { width: 840, height: 900, dir: "ltr" });
    expect(scene.doors.map((d) => d.slug)).toEqual(doors(18).map((d) => d.slug));
    expect(scene.doors.map((d) => d.href)).toEqual(doors(18).map((d) => d.href));
  });

  it("puts the first doors in the front row, nearest and largest", () => {
    const scene = buildPlaza(doors(18), { width: 840, height: 900, dir: "ltr" });
    const front = scene.doors[0]!;
    const back = scene.doors[17]!;
    expect(front.row).toBe(0);
    expect(front.frame.y).toBeGreaterThan(back.frame.y);
    expect(front.frame.w).toBeGreaterThanOrEqual(back.frame.w);
    expect(scene.rows[0]!.parallax).toBeGreaterThan(scene.rows[scene.rows.length - 1]!.parallax);
  });

  it("mirrors right to left: the first door stands at the right", () => {
    const ltr = buildPlaza(doors(5), { width: 390, height: 780, dir: "ltr" });
    const rtl = buildPlaza(doors(5), { width: 390, height: 780, dir: "rtl" });
    expect(rtl.doors[0]!.frame.x).toBeGreaterThan(rtl.doors[1]!.frame.x);
    for (let i = 0; i < 5; i++) {
      expect(rtl.doors[i]!.hit.x).toBeCloseTo(390 - ltr.doors[i]!.hit.x - ltr.doors[i]!.hit.w, 6);
      expect(rtl.doors[i]!.frame.y).toBe(ltr.doors[i]!.frame.y);
    }
  });

  it("centres the gate and runs one lit street from it to each door", () => {
    const scene = buildPlaza(doors(6), { width: 840, height: 900, dir: "ltr" });
    expect(scene.gate.x + scene.gate.w / 2).toBeCloseTo(420, 6);
    expect(scene.streets).toHaveLength(6);
    for (const s of scene.streets) {
      expect(s.from).toEqual([420, scene.gate.y + scene.gate.h]);
      const door = scene.doors[s.door]!;
      expect(s.to).toEqual([door.frame.x + door.frame.w / 2, door.frame.y + door.frame.h]);
      expect(s.color).toBe("#d9aaa2");
    }
  });

  it("dims empty doors but keeps them", () => {
    const scene = buildPlaza(doors(3), { width: 390, height: 780, dir: "ltr" });
    expect(scene.doors.map((d) => d.lit)).toEqual([true, false, true]);
  });

  it("is an empty plaza (gate only) with no doors", () => {
    const scene = buildPlaza([], { width: 390, height: 780, dir: "ltr" });
    expect(scene.doors).toEqual([]);
    expect(scene.height).toBe(780);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/stage exec vitest run src/plaza.test.ts`
Expected: FAIL, `Cannot find module './plaza.js'`.

- [ ] **Step 3: Implement**

Create `packages/stage/src/plaza.ts`:

```ts
import type { StageDoor } from "./types.js";

/** Layout constants in CSS px. `label` is the room under each door for two lines of its name. */
export const PLAZA = {
  margin: 16,
  /** Room above the gate for the plaza caption. */
  top: 56,
  gap: 12,
  label: 40,
  minTarget: 44,
  maxDoor: 96,
  /** Preferred slot width: 4 doors a row on a phone, up to 6 on desktop. */
  slot: 88,
  rowShrink: 0.08,
  minRowScale: 0.6,
  gateMin: 64,
  gateMax: 128,
} as const;

export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface PlazaViewport {
  width: number;
  height: number;
  dir: "ltr" | "rtl";
}

export interface PlazaDoor extends StageDoor {
  index: number;
  row: number;
  lit: boolean;
  /** The drawn doorway, 2:3 like DOOR_PATH's 100 × 150 box. */
  frame: Box;
  /** The link: the doorway and its label beneath, never under 44 × 44 px. */
  hit: Box;
}

export interface PlazaRow {
  index: number;
  scale: number;
  /** 1 for the front row (moves most), down to 0.4 for the back row. */
  parallax: number;
  doors: number[];
}

export interface PlazaStreet {
  door: number;
  from: [number, number];
  to: [number, number];
  width: number;
  color: string;
}

export interface PlazaScene {
  width: number;
  /** At least the viewport height; taller when the doors need it (the plaza then scrolls). */
  height: number;
  dir: "ltr" | "rtl";
  gate: Box;
  streets: PlazaStreet[];
  rows: PlazaRow[];
  doors: PlazaDoor[];
}

const rowScale = (row: number) => Math.max(PLAZA.minRowScale, 1 - PLAZA.rowShrink * row);

/** Doors per row: as many as fit, but never so many that the back row drops under 44 px. */
function rowLayout(count: number, inner: number): { perRow: number; rows: number } {
  let perRow = Math.min(6, Math.max(3, Math.floor(inner / PLAZA.slot)));
  for (;;) {
    const rows = Math.max(1, Math.ceil(count / perRow));
    const backSlot = (inner * rowScale(rows - 1)) / perRow;
    if (perRow === 1 || backSlot - PLAZA.gap >= PLAZA.minTarget) return { perRow, rows };
    perRow -= 1;
  }
}

/**
 * The 2.5D plaza: the Darb gate at the head, doors in rows that recede toward it (the first doors
 * nearest, in front), and a lit street from the gate to every door. Pure: same input, same scene.
 */
export function buildPlaza(doors: readonly StageDoor[], viewport: PlazaViewport): PlazaScene {
  const { margin, gap, label, minTarget } = PLAZA;
  const width = Math.max(viewport.width, 2 * margin + minTarget + gap);
  const inner = width - 2 * margin;
  const { perRow, rows: rowCount } = rowLayout(doors.length, inner);
  const sizes = Array.from({ length: rowCount }, (_, r) => {
    const scale = rowScale(r);
    const slot = (inner * scale) / perRow;
    const w = Math.max(minTarget, Math.min(PLAZA.maxDoor * scale, slot - gap));
    return { scale, slot, w, h: w * 1.5 };
  });
  const rowsHeight =
    doors.length === 0
      ? 0
      : sizes.reduce((sum, s) => sum + s.h + label, 0) + gap * (rowCount - 1);
  const gateW = Math.min(PLAZA.gateMax, Math.max(PLAZA.gateMin, width * 0.14));
  const gateH = gateW * 1.5;
  const height = Math.max(viewport.height, PLAZA.top + gateH + 2 * gap + rowsHeight + margin);
  const mirror = (box: Box): Box =>
    viewport.dir === "rtl" ? { ...box, x: width - box.x - box.w } : box;

  const rows: PlazaRow[] = [];
  const placed: PlazaDoor[] = [];
  let bottom = height - margin;
  if (doors.length > 0)
    for (let r = 0; r < rowCount; r++) {
      const { scale, slot, w, h } = sizes[r]!;
      const members = doors.slice(r * perRow, (r + 1) * perRow);
      const top = bottom - h - label;
      const rowWidth = inner * scale;
      const start = margin + (inner - rowWidth) / 2 + (rowWidth - members.length * slot) / 2;
      const indexes: number[] = [];
      members.forEach((door, i) => {
        const index = r * perRow + i;
        const left = start + i * slot;
        indexes.push(index);
        placed.push({
          ...door,
          index,
          row: r,
          lit: door.count > 0,
          frame: mirror({ x: left + (slot - w) / 2, y: top, w, h }),
          hit: mirror({ x: left + gap / 2, y: top, w: slot - gap, h: h + label }),
        });
      });
      rows.push({
        index: r,
        scale,
        parallax: rowCount === 1 ? 1 : 1 - (0.6 * r) / (rowCount - 1),
        doors: indexes,
      });
      bottom = top - gap;
    }

  const gateBottom = doors.length === 0 ? height - margin : bottom + gap - 2 * gap;
  const gate: Box = { x: (width - gateW) / 2, y: gateBottom - gateH, w: gateW, h: gateH };
  const from: [number, number] = [width / 2, gate.y + gate.h];
  const streets: PlazaStreet[] = placed.map((d) => ({
    door: d.index,
    from,
    to: [d.frame.x + d.frame.w / 2, d.frame.y + d.frame.h],
    width: 2 + 4 * rows[d.row]!.scale,
    color: d.accent,
  }));
  return { width, height, dir: viewport.dir, gate, streets, rows, doors: placed };
}
```

In `packages/stage/src/index.ts`, add: `export * from "./plaza.js";`

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @darb/stage test && pnpm --filter @darb/stage typecheck`
Expected: PASS (31 plaza tests plus Task 2's), typecheck clean.

- [ ] **Step 5: Commit**

```bash
pnpm format && pnpm lint
git add packages/stage/src/plaza.ts packages/stage/src/plaza.test.ts packages/stage/src/index.ts
git commit -m "feat(stage): plaza scene model with gate, lit streets and receding door rows"
```

---

### Task 4: API: business density per live place

**Files:**
- Modify: `packages/contracts/src/schemas.ts`, `packages/contracts/src/contract.ts`
- Test: `packages/contracts/src/schemas.test.ts`
- Modify: `apps/api/src/businesses/businesses.repository.ts`, `businesses.controller.ts`
- Test: `apps/api/src/businesses/density.test.ts`

**Interfaces:**
- Produces: `DensitySchema`, `type DensityDto = Record<string, number>`;
  `contract.businesses.density` (`GET /density`, 200 `DensitySchema`);
  `BusinessesRepository.density(): Promise<Record<string, number>>`.

- [ ] **Step 1: Write the failing tests**

Append to `packages/contracts/src/schemas.test.ts` (add `DensitySchema` to the import list from
`./schemas.js`):

```ts
describe("DensitySchema", () => {
  it("maps place slugs to non-negative whole counts", () => {
    expect(DensitySchema.parse({ sakhnin: 2, tamra: 0 })).toEqual({ sakhnin: 2, tamra: 0 });
    expect(() => DensitySchema.parse({ sakhnin: -1 })).toThrow();
    expect(() => DensitySchema.parse({ sakhnin: 1.5 })).toThrow();
  });
  it("is served at GET /density", () => {
    expect(contract.businesses.density.path).toBe("/density");
    expect(contract.businesses.density.method).toBe("GET");
  });
});
```

Create `apps/api/src/businesses/density.test.ts`:

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
  const fx = await seedFixtures(created.prisma);
  // Published, but its primary kind is hidden: it never counts.
  await created.prisma.business.create({
    data: {
      slug: "hidden-shop",
      name: { en: "Hidden" },
      tagline: { en: "x" },
      address: { en: "Main st" },
      hours: { weekly: {}, exceptions: [] },
      experience: { title: { en: "x" } },
      tier: "example",
      source: "seed",
      status: "published",
      placeId: fx.tamra.id,
      lat: 32.853,
      lng: 35.198,
      primaryKindId: fx.hidden.id,
      kinds: { create: [{ kindId: fx.hidden.id }] },
    },
  });
});
afterAll(() => app.close());

it("counts published businesses of active kinds in every live settlement", async () => {
  const res = await request(app.getHttpServer()).get("/density");
  expect(res.status).toBe(200);
  // Sakhnin: abu-salim and little-cuts (draft-barber is a draft). Tamra: tamra-barber only.
  // Eilat is soon; Israel and the district are not settlements.
  expect(res.body).toEqual({ sakhnin: 2, tamra: 1 });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @darb/contracts test && pnpm infra:up && pnpm --filter @darb/api exec vitest run src/businesses/density.test.ts`
Expected: the contracts test FAILS (`DensitySchema` is not exported), and the API test FAILS with
status 404.

- [ ] **Step 3: Implement**

Append to `packages/contracts/src/schemas.ts`, after `KindCountsSchema`:

```ts
/**
 * Published businesses (primary kind active) in each live settlement's subtree, by place slug.
 * Every live city, town and village is present, with 0 when it has none. Feeds the map's glow.
 */
export const DensitySchema = z.record(z.string(), z.number().int().nonnegative());
export type DensityDto = z.infer<typeof DensitySchema>;
```

In `packages/contracts/src/contract.ts`, import `DensitySchema` and add to the `businesses` router
(after `nearestPlaces`):

```ts
    density: {
      method: "GET",
      path: "/density",
      responses: { 200: DensitySchema },
    },
```

In `apps/api/src/businesses/businesses.repository.ts`, add to `BusinessesRepository`:

```ts
  /** See DensitySchema. One query; places' materialized paths end with '/'. */
  async density(): Promise<Record<string, number>> {
    const rows = await this.prisma.$queryRaw<{ slug: string; n: number }[]>`
      SELECT s.slug, (COUNT(DISTINCT b.id) FILTER (WHERE pk.id IS NOT NULL))::int AS n
      FROM "Place" s
      LEFT JOIN "Place" p ON p.path LIKE s.path || '%'
      LEFT JOIN "Business" b ON b."placeId" = p.id AND b.status = 'published'
      LEFT JOIN "Kind" pk ON pk.id = b."primaryKindId" AND pk.status = 'active'
      WHERE s.status = 'live' AND s.type IN ('city', 'town', 'village')
      GROUP BY s.slug
      ORDER BY s.slug`;
    return Object.fromEntries(rows.map((r) => [r.slug, r.n]));
  }
```

In `apps/api/src/businesses/businesses.controller.ts`, add to the `tsRestHandler` object (after
`nearestPlaces`):

```ts
      density: async () => ({ status: 200, body: await this.businesses.density() }),
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @darb/contracts build && pnpm --filter @darb/contracts test && pnpm --filter @darb/api test`
Expected: PASS, including the new density test. All earlier API tests stay green.

- [ ] **Step 5: Commit**

```bash
pnpm format && pnpm lint
git add packages/contracts/src apps/api/src/businesses
git commit -m "feat(api): business density per live settlement for the map glow"
```

---

### Task 5: Web: live places with density (`/api/city`)

**Files:**
- Modify: `apps/web/src/lib/api.ts`, `apps/web/src/lib/api.test.ts`
- Create: `apps/web/src/app/api/city/route.ts`
- Test: `apps/web/src/app/api/city/route.test.ts`

**Interfaces:**
- Consumes: `contract.businesses.density` (Task 4), `CityDot` (Task 2).
- Produces: `getDensity(): Promise<DensityDto>` (throws `ApiUnavailableError`).
  `GET /api/city?locale=he|ar|en` → `200 { dots: CityDot[] }` (`Cache-Control: public, max-age=300`),
  `400` for a bad locale, and `503` when the API is down.

- [ ] **Step 1: Write the failing tests**

Add `getDensity` to the import list in `apps/web/src/lib/api.test.ts` and append inside
`describe("api client", …)`:

```ts
  it("fetches density with the businesses and places tags", async () => {
    fetchMock.mockResolvedValue(Response.json({ sakhnin: 4 }));
    expect(await getDensity()).toEqual({ sakhnin: 4 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/density");
    expect((init as RequestInit & { next?: unknown }).next).toEqual({
      revalidate: 300,
      tags: ["businesses", "places"],
    });
  });
```

Create `apps/web/src/app/api/city/route.test.ts`:

```ts
// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const getPlaces = vi.fn();
const getDensity = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiUnavailableError: class ApiUnavailableError extends Error {},
  getPlaces,
  getDensity,
}));
const api = await import("@/lib/api");
const { GET } = await import("./route");

afterEach(() => vi.resetAllMocks());

const get = (query: string) => GET(new Request(`http://web.test/api/city?${query}`));
const sakhnin = {
  id: "p1",
  slug: "sakhnin",
  type: "city",
  name: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" },
  status: "live",
  lat: 32.86,
  lng: 35.3,
  parentId: "r1",
};

it("returns live places as localized dots with their density and level-1 href", async () => {
  getPlaces.mockResolvedValue([sakhnin, { ...sakhnin, slug: "tamra", name: { he: "טמרה" } }]);
  getDensity.mockResolvedValue({ sakhnin: 7 });
  const res = await get("locale=ar");
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  expect(getPlaces).toHaveBeenCalledWith("live");
  expect(await res.json()).toEqual({
    dots: [
      { slug: "sakhnin", name: "سخنين", lat: 32.86, lng: 35.3, count: 7, href: "/ar/sakhnin" },
      { slug: "tamra", name: "טמרה", lat: 32.86, lng: 35.3, count: 0, href: "/ar/tamra" },
    ],
  });
});

it("answers 400 for an unknown locale", async () => {
  expect((await get("locale=fr")).status).toBe(400);
});

it("answers 503 when the API is down", async () => {
  getPlaces.mockRejectedValue(new api.ApiUnavailableError("down"));
  getDensity.mockResolvedValue({});
  expect((await get("locale=he")).status).toBe(503);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/lib/api.test.ts src/app/api/city/route.test.ts`
Expected: FAIL, `getDensity is not a function` and `Cannot find module './route'`.

- [ ] **Step 3: Implement**

In `apps/web/src/lib/api.ts`, add `type DensityDto` to the `@darb/contracts` import and append:

```ts
/** Business counts per live settlement (the map's glow). Throws when the API is down. */
export async function getDensity(): Promise<DensityDto> {
  const res = await call(() =>
    client().businesses.density({
      fetchOptions: fetchOptions(cached(REVALIDATE.lists, tags.businesses, tags.places)),
    }),
  );
  if (res.status === 200) return res.body;
  throw new ApiUnavailableError(res);
}
```

Create `apps/web/src/app/api/city/route.ts`:

```ts
import { pickText } from "@darb/core";
import type { CityDot } from "@darb/stage";
import { z } from "zod";
import { ApiUnavailableError, getDensity, getPlaces } from "@/lib/api";
import { href, paths } from "@/lib/routes";

const Query = z.object({ locale: z.enum(["he", "ar", "en"]) });

/** The level 0 map's live places, named in the page language, with their business counts. */
export async function GET(request: Request): Promise<Response> {
  const parsed = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ message: "Bad query" }, { status: 400 });
  const { locale } = parsed.data;
  try {
    const [places, density] = await Promise.all([getPlaces("live"), getDensity()]);
    const dots: CityDot[] = places.map((p) => ({
      slug: p.slug,
      name: pickText(p.name, locale),
      lat: p.lat,
      lng: p.lng,
      count: density[p.slug] ?? 0,
      href: href(locale, paths.place(p.slug)),
    }));
    return Response.json({ dots }, { headers: { "Cache-Control": "public, max-age=300" } });
  } catch (error) {
    if (error instanceof ApiUnavailableError)
      return Response.json({ message: "Unavailable" }, { status: 503 });
    throw error;
  }
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/lib/api.test.ts src/app/api/city/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/lib/api.ts apps/web/src/lib/api.test.ts apps/web/src/app/api/city
git commit -m "feat(web): live places with density for the map"
```

---

### Task 6: Tiles over HTTP Range (`/api/tiles/[name]`)

**Files:**
- Create: `apps/web/src/lib/byte-range.ts`
- Test: `apps/web/src/lib/byte-range.test.ts`
- Create: `apps/web/src/app/api/tiles/[name]/route.ts`
- Test: `apps/web/src/app/api/tiles/[name]/route.test.ts`
- Modify: `apps/web/.env.example`

**Interfaces:**
- Produces: `parseRange(header: string | null, size: number): { start: number; end: number } | null | "unsatisfiable"`
  (`end` inclusive; `null` means serve the whole file).
- Produces: `GET`/`HEAD /api/tiles/{name}` where `name` matches `/^[a-z0-9-]+\.pmtiles$/`, read from
  `MAP_TILES_DIR` (server env, resolved against the web app's working directory, default `.tiles`).
  The route answers `206` with `Content-Range` for a range, `200` with the whole file otherwise,
  `416` for an unsatisfiable range and `404` for anything else. It always sends `Accept-Ranges: bytes`
  and a strong `ETag`. PMTiles' `FetchSource` refuses a `200` larger than the bytes it asked for, so
  real range support is required.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/byte-range.test.ts`:

```ts
// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseRange } from "./byte-range";

describe("parseRange", () => {
  it("reads one closed range", () => {
    expect(parseRange("bytes=0-16383", 100_000)).toEqual({ start: 0, end: 16383 });
  });
  it("clamps the end to the file", () => {
    expect(parseRange("bytes=90-200", 100)).toEqual({ start: 90, end: 99 });
  });
  it("reads open and suffix ranges", () => {
    expect(parseRange("bytes=10-", 100)).toEqual({ start: 10, end: 99 });
    expect(parseRange("bytes=-4", 100)).toEqual({ start: 96, end: 99 });
    expect(parseRange("bytes=-400", 100)).toEqual({ start: 0, end: 99 });
  });
  it("serves everything for no header, other units or several ranges", () => {
    expect(parseRange(null, 100)).toBeNull();
    expect(parseRange("items=0-1", 100)).toBeNull();
    expect(parseRange("bytes=0-1,5-6", 100)).toBeNull();
    expect(parseRange("bytes=-", 100)).toBeNull();
  });
  it("refuses ranges that start past the end or run backwards", () => {
    expect(parseRange("bytes=100-", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=9-3", 100)).toBe("unsatisfiable");
    expect(parseRange("bytes=-0", 100)).toBe("unsatisfiable");
  });
});
```

Create `apps/web/src/app/api/tiles/[name]/route.test.ts`:

```ts
// @vitest-environment node
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, HEAD } from "./route";

const dir = mkdtempSync(join(tmpdir(), "darb-tiles-"));
const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
writeFileSync(join(dir, "israel.pmtiles"), bytes);

beforeEach(() => vi.stubEnv("MAP_TILES_DIR", dir));
afterEach(() => vi.unstubAllEnvs());

const context = (name: string) => ({ params: Promise.resolve({ name }) });
const request = (name: string, range?: string) =>
  new Request(`http://web.test/api/tiles/${name}`, { headers: range ? { range } : {} });
const body = async (res: Response) => [...new Uint8Array(await res.arrayBuffer())];

it("serves a byte range as 206 with Content-Range", async () => {
  const res = await GET(request("israel.pmtiles", "bytes=10-19"), context("israel.pmtiles"));
  expect(res.status).toBe(206);
  expect(res.headers.get("content-range")).toBe("bytes 10-19/256");
  expect(res.headers.get("content-length")).toBe("10");
  expect(res.headers.get("accept-ranges")).toBe("bytes");
  expect(await body(res)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
});

it("clamps a range that runs past the end (PMTiles asks for 16 KB headers)", async () => {
  const res = await GET(request("israel.pmtiles", "bytes=0-16383"), context("israel.pmtiles"));
  expect(res.status).toBe(206);
  expect(res.headers.get("content-range")).toBe("bytes 0-255/256");
  expect((await body(res)).length).toBe(256);
});

it("serves the whole file without a Range header, with a strong ETag", async () => {
  const res = await GET(request("israel.pmtiles"), context("israel.pmtiles"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-length")).toBe("256");
  expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
  expect((await body(res)).length).toBe(256);
});

it("answers 416 for a range past the end", async () => {
  const res = await GET(request("israel.pmtiles", "bytes=300-"), context("israel.pmtiles"));
  expect(res.status).toBe(416);
  expect(res.headers.get("content-range")).toBe("bytes */256");
});

it("answers 404 for anything that is not an archive in the tiles folder", async () => {
  for (const name of ["../israel.pmtiles", "israel.mbtiles", "Israel.pmtiles", "missing.pmtiles"])
    expect((await GET(request(name), context(name))).status, name).toBe(404);
});

it("answers HEAD with the headers and no body", async () => {
  const res = await HEAD(request("israel.pmtiles"), context("israel.pmtiles"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-length")).toBe("256");
  expect(res.body).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/lib/byte-range.test.ts "src/app/api/tiles"`
Expected: FAIL, both modules missing.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/byte-range.ts`:

```ts
export interface ByteRange {
  start: number;
  /** Inclusive. */
  end: number;
}

/**
 * One `bytes=` range (RFC 9110 §14), which is all PMTiles readers send. `null`: no usable Range
 * header, so serve the whole file (allowed for other units and multiple ranges). "unsatisfiable":
 * answer 416.
 */
export function parseRange(header: string | null, size: number): ByteRange | null | "unsatisfiable" {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, first = "", last = ""] = match;
  if (first === "" && last === "") return null;
  let start: number;
  let end: number;
  if (first === "") {
    const suffix = Number(last);
    if (suffix === 0) return "unsatisfiable";
    start = Math.max(0, size - suffix);
    end = size - 1;
  } else {
    start = Number(first);
    end = last === "" ? size - 1 : Math.min(Number(last), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}
```

Create `apps/web/src/app/api/tiles/[name]/route.ts`:

```ts
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { parseRange } from "@/lib/byte-range";

/** Archive names only: no paths, so nothing outside the tiles folder can be read. */
const NAME = /^[a-z0-9-]+\.pmtiles$/;

type Context = { params: Promise<{ name: string }> };

/**
 * PMTiles archives (the Israel extract, or the e2e fixture) from MAP_TILES_DIR, with HTTP Range.
 * For development and self-hosting; production points NEXT_PUBLIC_MAP_TILES_URL at R2 (Plan 4).
 */
async function serve(request: Request, name: string, withBody: boolean): Promise<Response> {
  if (!NAME.test(name)) return new Response(null, { status: 404 });
  const file = path.join(path.resolve(process.cwd(), process.env.MAP_TILES_DIR ?? ".tiles"), name);
  let size: number;
  let modified: number;
  try {
    const info = await stat(file);
    if (!info.isFile()) return new Response(null, { status: 404 });
    size = info.size;
    modified = Math.floor(info.mtimeMs);
  } catch {
    return new Response(null, { status: 404 });
  }
  const headers = new Headers({
    "Accept-Ranges": "bytes",
    "Content-Type": "application/octet-stream",
    "Cache-Control": "public, max-age=3600",
    ETag: `"${size.toString(16)}-${modified.toString(16)}"`,
  });
  const range = parseRange(request.headers.get("range"), size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  const { start, end } = range ?? { start: 0, end: size - 1 };
  headers.set("Content-Length", String(Math.max(0, end - start + 1)));
  if (range) headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  const body =
    withBody && size > 0
      ? (Readable.toWeb(createReadStream(file, { start, end })) as unknown as ReadableStream<Uint8Array>)
      : null;
  return new Response(body, { status: range ? 206 : 200, headers });
}

export async function GET(request: Request, { params }: Context): Promise<Response> {
  return serve(request, (await params).name, true);
}

export async function HEAD(request: Request, { params }: Context): Promise<Response> {
  return serve(request, (await params).name, false);
}
```

Append to `apps/web/.env.example`:

```
# Map tiles. MAP_TILES_DIR holds israel.pmtiles for /api/tiles (default .tiles; create it with
# `pnpm --filter @darb/web tiles:israel`). NEXT_PUBLIC_MAP_TILES_URL overrides the tiles URL at
# build time (R2 in production).
# MAP_TILES_DIR=.tiles
# NEXT_PUBLIC_MAP_TILES_URL=
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/lib/byte-range.test.ts "src/app/api/tiles"`
Expected: PASS (5 + 6 tests).

- [ ] **Step 5: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/lib/byte-range.ts apps/web/src/lib/byte-range.test.ts "apps/web/src/app/api/tiles" apps/web/.env.example
git commit -m "feat(web): serve PMTiles archives with HTTP Range"
```

---

### Task 7: Tiles tooling: a reproducible test fixture and the Israel extract

**Files:**
- Create: `apps/web/scripts/tiles/pmtiles-writer.mjs`
- Create: `apps/web/scripts/tiles/make-test-tiles.mjs`
- Create: `apps/web/scripts/tiles/extract-israel.mjs`
- Create (generated, committed): `apps/web/e2e/tiles/israel.pmtiles`
- Test: `apps/web/src/lib/tiles-tooling.test.ts`
- Modify: `apps/web/package.json` (scripts `tiles:israel`, `tiles:test`)

**Interfaces:**
- Produces (`pmtiles-writer.mjs`): `EXTENT`, `testTile(): Buffer`, `zxyToTileId(z, x, y): number`,
  `buildArchive({ bbox: [w, s, e, n], minZoom, maxZoom }): Buffer`.
- Produces (`make-test-tiles.mjs`): `FIXTURE` (absolute path of `e2e/tiles/israel.pmtiles`),
  `FIXTURE_OPTIONS = { bbox: [34.9, 32.5, 35.7, 33.2], minZoom: 0, maxZoom: 12 }`. As a CLI it writes
  the fixture, and `--check` exits 1 if the committed file differs.
- Produces (`extract-israel.mjs`): `CLI_VERSION = "1.31.2"`, `CLI_ASSETS`, `ISRAEL_BBOX`,
  `MAX_ZOOM = 14`, `assetFor(platform, arch)`, `latestBuild(builds)`, `extractArgs(build, output)`.
  As a CLI it writes `apps/web/.tiles/israel.pmtiles` and `israel.json`.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/lib/tiles-tooling.test.ts`:

```ts
// @vitest-environment node
import { readFileSync } from "node:fs";
import { PMTiles, zxyToTileId as referenceTileId, type Source } from "pmtiles";
import { describe, expect, it } from "vitest";
import {
  assetFor,
  CLI_ASSETS,
  extractArgs,
  ISRAEL_BBOX,
  latestBuild,
  MAX_ZOOM,
} from "../../scripts/tiles/extract-israel.mjs";
import { FIXTURE, FIXTURE_OPTIONS } from "../../scripts/tiles/make-test-tiles.mjs";
import { buildArchive, testTile, zxyToTileId } from "../../scripts/tiles/pmtiles-writer.mjs";

const source = (buf: Buffer): Source => ({
  getKey: () => "fixture",
  getBytes: async (offset: number, length: number) => ({
    data: buf.buffer.slice(
      buf.byteOffset + offset,
      buf.byteOffset + Math.min(offset + length, buf.length),
    ) as ArrayBuffer,
  }),
});

describe("PMTiles writer", () => {
  it("numbers tiles along the Hilbert curve like the pmtiles library", () => {
    for (const [z, x, y] of [
      [0, 0, 0],
      [1, 1, 0],
      [5, 17, 11],
      [12, 2449, 1655],
    ] as const)
      expect(zxyToTileId(z, x, y)).toBe(referenceTileId(z, x, y));
  });
  it("writes an archive the pmtiles library reads back", async () => {
    const archive = new PMTiles(source(buildArchive(FIXTURE_OPTIONS)));
    const header = await archive.getHeader();
    expect([header.minZoom, header.maxZoom, header.tileType]).toEqual([0, 12, 1]);
    // Sakhnin at zoom 12 is inside the fixture; the Atlantic is not.
    const tile = await archive.getZxy(12, 2449, 1655);
    expect(Buffer.from(tile!.data).equals(testTile())).toBe(true);
    expect(await archive.getZxy(12, 0, 0)).toBeUndefined();
    const metadata = (await archive.getMetadata()) as { vector_layers: { id: string }[] };
    expect(metadata.vector_layers.map((l) => l.id)).toEqual(["earth", "roads"]);
  });
  it("keeps the committed e2e fixture tiny and reproducible", () => {
    const committed = readFileSync(FIXTURE);
    expect(committed.length).toBeLessThan(2048);
    expect(committed.equals(buildArchive(FIXTURE_OPTIONS))).toBe(true);
  });
});

describe("Israel extract", () => {
  it("pins a checksum for every supported platform", () => {
    expect(assetFor("darwin", "arm64")).toEqual(CLI_ASSETS["darwin-arm64"]);
    expect(assetFor("linux", "x64").file).toBe("go-pmtiles_1.31.2_Linux_x86_64.tar.gz");
    for (const asset of Object.values(CLI_ASSETS)) expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(() => assetFor("win32", "x64")).toThrow(/Unsupported platform/);
  });
  it("takes the newest daily build", () => {
    expect(
      latestBuild([
        { key: "20261010.pmtiles", version: "4.15.2" },
        { key: "20261012.pmtiles", version: "4.15.2" },
        { key: "20261011.pmtiles", version: "4.15.2" },
      ]),
    ).toBe("20261012.pmtiles");
    expect(() => latestBuild([])).toThrow();
  });
  it("extracts Israel to zoom 14", () => {
    expect(ISRAEL_BBOX).toBe("34.2,29.45,35.95,33.35");
    expect(MAX_ZOOM).toBe(14);
    expect(extractArgs("20261012.pmtiles", "/tmp/x.pmtiles")).toEqual([
      "extract",
      "https://build.protomaps.com/20261012.pmtiles",
      "/tmp/x.pmtiles",
      "--bbox=34.2,29.45,35.95,33.35",
      "--maxzoom=14",
    ]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/web exec vitest run src/lib/tiles-tooling.test.ts`
Expected: FAIL, the three script modules cannot be resolved.

- [ ] **Step 3: Write the PMTiles writer**

Create `apps/web/scripts/tiles/pmtiles-writer.mjs`:

```js
// A minimal, dependency-free writer for small PMTiles v3 archives of Mapbox Vector Tiles, used to
// generate the e2e fixture. Specs: github.com/protomaps/PMTiles/blob/main/spec/v3/spec.md and
// github.com/mapbox/vector-tile-spec/tree/master/2.1

// ---- Protocol buffers ----
function varint(out, value) {
  let v = BigInt(value);
  while (v >= 0x80n) {
    out.push(Number((v & 0x7fn) | 0x80n));
    v >>= 7n;
  }
  out.push(Number(v));
}
const zigzag = (n) => (n << 1) ^ (n >> 31);
const tag = (field, wire) => (field << 3) | wire;
function bytesField(out, field, bytes) {
  varint(out, tag(field, 2));
  varint(out, bytes.length);
  for (const b of bytes) out.push(b);
}
function uintField(out, field, value) {
  varint(out, tag(field, 0));
  varint(out, value);
}
function packedField(out, field, values) {
  const body = [];
  for (const v of values) varint(body, v);
  bytesField(out, field, body);
}
const utf8 = (text) => [...Buffer.from(text, "utf8")];

// ---- Mapbox Vector Tile 2.1 ----
export const EXTENT = 4096;
const command = (id, count) => (id & 7) | (count << 3);

/** Rings or lines in tile coordinates; `close` adds ClosePath (polygons). */
function geometry(parts, close) {
  const out = [];
  let x = 0;
  let y = 0;
  for (const [first, ...rest] of parts) {
    out.push(command(1, 1), zigzag(first[0] - x), zigzag(first[1] - y));
    [x, y] = first;
    out.push(command(2, rest.length));
    for (const [nx, ny] of rest) {
      out.push(zigzag(nx - x), zigzag(ny - y));
      [x, y] = [nx, ny];
    }
    if (close) out.push(command(7, 1));
  }
  return out;
}

/** features: { type: 1 point | 2 line | 3 polygon, geometry: number[], properties: { [k]: string } } */
function layer(name, features) {
  const keys = [];
  const values = [];
  const indexOf = (list, value) => {
    const found = list.indexOf(value);
    return found >= 0 ? found : list.push(value) - 1;
  };
  const out = [];
  uintField(out, 15, 2);
  bytesField(out, 1, utf8(name));
  for (const feature of features) {
    const tags = Object.entries(feature.properties).flatMap(([k, v]) => [
      indexOf(keys, k),
      indexOf(values, v),
    ]);
    const body = [];
    packedField(body, 2, tags);
    uintField(body, 3, feature.type);
    packedField(body, 4, feature.geometry);
    bytesField(out, 2, body);
  }
  for (const k of keys) bytesField(out, 3, utf8(k));
  for (const v of values) {
    const value = [];
    bytesField(value, 1, utf8(v));
    bytesField(out, 4, value);
  }
  uintField(out, 5, EXTENT);
  return out;
}

/** One tile: land over the whole tile (Protomaps "earth") and a diagonal highway ("roads"). */
export function testTile() {
  const out = [];
  // Exterior rings wind clockwise in tile coordinates (y down), as the MVT spec requires.
  const land = [
    [0, 0],
    [EXTENT, 0],
    [EXTENT, EXTENT],
    [0, EXTENT],
  ];
  const road = [
    [0, 0],
    [EXTENT, EXTENT],
  ];
  bytesField(
    out,
    3,
    layer("earth", [{ type: 3, geometry: geometry([land], true), properties: { kind: "earth" } }]),
  );
  bytesField(
    out,
    3,
    layer("roads", [{ type: 2, geometry: geometry([road], false), properties: { kind: "highway" } }]),
  );
  return Buffer.from(out);
}

// ---- PMTiles v3 ----
/** The Hilbert tile id of z/x/y (PMTiles v3 spec, "Tile ID"). */
export function zxyToTileId(z, x, y) {
  let id = 0;
  for (let t = 0; t < z; t++) id += 4 ** t;
  let px = x;
  let py = y;
  for (let s = 2 ** z / 2; s >= 1; s /= 2) {
    const rx = (px & s) > 0 ? 1 : 0;
    const ry = (py & s) > 0 ? 1 : 0;
    id += s * s * ((3 * rx) ^ ry);
    if (ry === 0) {
      if (rx === 1) {
        px = s - 1 - px;
        py = s - 1 - py;
      }
      [px, py] = [py, px];
    }
  }
  return id;
}

const lonToX = (lon, z) => Math.floor(((lon + 180) / 360) * 2 ** z);
const latToY = (lat, z) => {
  const r = (lat * Math.PI) / 180;
  return Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z);
};

/** Every tile of the bbox at minZoom..maxZoom, all sharing one copy of testTile(). */
export function buildArchive({ bbox, minZoom, maxZoom }) {
  const [west, south, east, north] = bbox;
  const tile = testTile();
  const ids = [];
  for (let z = minZoom; z <= maxZoom; z++)
    for (let x = lonToX(west, z); x <= lonToX(east, z); x++)
      for (let y = latToY(north, z); y <= latToY(south, z); y++) ids.push(zxyToTileId(z, x, y));
  ids.sort((a, b) => a - b);

  const directory = [];
  varint(directory, ids.length);
  let last = 0;
  for (const id of ids) {
    varint(directory, id - last);
    last = id;
  }
  for (let i = 0; i < ids.length; i++) varint(directory, 1); // run lengths
  for (let i = 0; i < ids.length; i++) varint(directory, tile.length); // lengths
  for (let i = 0; i < ids.length; i++) varint(directory, 1); // offset 0, stored as offset + 1
  const root = Buffer.from(directory);
  const metadata = Buffer.from(
    JSON.stringify({
      name: "darb-test-tiles",
      attribution: "Darb test fixture",
      vector_layers: [
        { id: "earth", fields: { kind: "String" } },
        { id: "roads", fields: { kind: "String" } },
      ],
    }),
  );

  const header = Buffer.alloc(127);
  const u64 = (at, value) => header.writeBigUInt64LE(BigInt(value), at);
  const e7 = (degrees) => Math.round(degrees * 1e7);
  header.write("PMTiles", 0, "ascii");
  header.writeUInt8(3, 7);
  const rootAt = 127;
  const metadataAt = rootAt + root.length;
  const tilesAt = metadataAt + metadata.length;
  u64(8, rootAt);
  u64(16, root.length);
  u64(24, metadataAt);
  u64(32, metadata.length);
  u64(40, tilesAt); // no leaf directories
  u64(48, 0);
  u64(56, tilesAt);
  u64(64, tile.length);
  u64(72, ids.length); // addressed tiles
  u64(80, ids.length); // tile entries
  u64(88, 1); // tile contents
  header.writeUInt8(0, 96); // not clustered: every entry points at the same bytes
  header.writeUInt8(1, 97); // internal compression: none
  header.writeUInt8(1, 98); // tile compression: none
  header.writeUInt8(1, 99); // tile type: MVT
  header.writeUInt8(minZoom, 100);
  header.writeUInt8(maxZoom, 101);
  header.writeInt32LE(e7(west), 102);
  header.writeInt32LE(e7(south), 106);
  header.writeInt32LE(e7(east), 110);
  header.writeInt32LE(e7(north), 114);
  header.writeUInt8(Math.floor((minZoom + maxZoom) / 2), 118);
  header.writeInt32LE(e7((west + east) / 2), 119);
  header.writeInt32LE(e7((south + north) / 2), 123);
  return Buffer.concat([header, root, metadata, tile]);
}
```

- [ ] **Step 4: Write the fixture CLI and generate the fixture**

Create `apps/web/scripts/tiles/make-test-tiles.mjs`:

```js
// The e2e map fixture: a ~1 KB PMTiles archive covering the Galilee and Haifa (zooms 0–12), so CI
// never downloads real tiles. `node scripts/tiles/make-test-tiles.mjs` writes it; `--check` fails
// when the committed file differs from what the writer produces.
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { buildArchive } from "./pmtiles-writer.mjs";

export const FIXTURE = fileURLToPath(new URL("../../e2e/tiles/israel.pmtiles", import.meta.url));
export const FIXTURE_OPTIONS = { bbox: [34.9, 32.5, 35.7, 33.2], minZoom: 0, maxZoom: 12 };

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const archive = buildArchive(FIXTURE_OPTIONS);
  if (process.argv.includes("--check")) {
    const same = readFileSync(FIXTURE).equals(archive);
    console.log(same ? "test tiles: up to date" : "test tiles: out of date, run tiles:test");
    process.exit(same ? 0 : 1);
  }
  mkdirSync(dirname(FIXTURE), { recursive: true });
  writeFileSync(FIXTURE, archive);
  console.log(`test tiles: ${archive.length} bytes -> ${FIXTURE}`);
}
```

Add to `apps/web/package.json` `"scripts"`:

```json
    "tiles:israel": "node scripts/tiles/extract-israel.mjs",
    "tiles:test": "node scripts/tiles/make-test-tiles.mjs",
```

Run: `pnpm --filter @darb/web tiles:test`
Expected: `test tiles: 1075 bytes -> …/apps/web/e2e/tiles/israel.pmtiles`.

- [ ] **Step 5: Write the extract CLI**

Create `apps/web/scripts/tiles/extract-israel.mjs`:

```js
// Extracts Israel from the newest Protomaps daily build into apps/web/.tiles/israel.pmtiles for
// /api/tiles. Downloads the pinned go-pmtiles CLI (BSD-3-Clause) on first use and checks its
// SHA-256. Map data: © OpenStreetMap contributors (ODbL), tiles by Protomaps.
// Usage: pnpm --filter @darb/web tiles:israel [-- --build=20261012.pmtiles]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, renameSync, rmSync, statSync, writeFileSync } from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const CLI_VERSION = "1.31.2";
const RELEASE = `https://github.com/protomaps/go-pmtiles/releases/download/v${CLI_VERSION}`;
/** SHA-256 digests published with the v1.31.2 release assets on GitHub. */
export const CLI_ASSETS = {
  "darwin-arm64": {
    file: "go-pmtiles-1.31.2_Darwin_arm64.zip",
    sha256: "40528f7f616fcbf91207cd48c8fc023d213f6d86c0cbf1f748732803d1880f3d",
  },
  "darwin-x64": {
    file: "go-pmtiles-1.31.2_Darwin_x86_64.zip",
    sha256: "1f0dc02eee6c58312dd6c509faee1b5c32f0596568af1bf51f1b034e7a88a65b",
  },
  "linux-arm64": {
    file: "go-pmtiles_1.31.2_Linux_arm64.tar.gz",
    sha256: "f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1",
  },
  "linux-x64": {
    file: "go-pmtiles_1.31.2_Linux_x86_64.tar.gz",
    sha256: "3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f",
  },
};
/** All of Israel, Eilat to the Hermon (west, south, east, north). */
export const ISRAEL_BBOX = "34.2,29.45,35.95,33.35";
/** 92 MB for build 20261010 (zoom 13 would be 46 MB); MapLibre overzooms beyond it. */
export const MAX_ZOOM = 14;
const BUILDS = "https://build-metadata.protomaps.dev/builds.json";

export function assetFor(os, cpu) {
  const asset = CLI_ASSETS[`${os}-${cpu}`];
  if (!asset) throw new Error(`Unsupported platform ${os}-${cpu}: install go-pmtiles by hand`);
  return asset;
}

/** builds.json lists { key: "YYYYMMDD.pmtiles", … }; the newest key sorts last. */
export function latestBuild(builds) {
  const keys = builds.map((b) => b.key).filter((k) => /^\d{8}\.pmtiles$/.test(k)).sort();
  if (keys.length === 0) throw new Error("No Protomaps daily builds listed");
  return keys[keys.length - 1];
}

export function extractArgs(build, output) {
  return [
    "extract",
    `https://build.protomaps.com/${build}`,
    output,
    `--bbox=${ISRAEL_BBOX}`,
    `--maxzoom=${MAX_ZOOM}`,
  ];
}

async function ensureCli(dir) {
  const bin = join(dir, "pmtiles");
  if (existsSync(bin)) return bin;
  const asset = assetFor(platform(), arch());
  const res = await fetch(`${RELEASE}/${asset.file}`);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${asset.file}`);
  const archive = Buffer.from(await res.arrayBuffer());
  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== asset.sha256) throw new Error(`Checksum mismatch for ${asset.file}: ${digest}`);
  const download = join(dir, asset.file);
  writeFileSync(download, archive);
  if (asset.file.endsWith(".zip")) execFileSync("unzip", ["-o", download, "pmtiles", "-d", dir]);
  else execFileSync("tar", ["-xzf", download, "-C", dir, "pmtiles"]);
  rmSync(download);
  return bin;
}

async function main() {
  const { values } = parseArgs({ options: { build: { type: "string" } } });
  const dir = fileURLToPath(new URL("../../.tiles/", import.meta.url));
  mkdirSync(join(dir, "bin"), { recursive: true });
  const cli = await ensureCli(join(dir, "bin"));
  const build =
    values.build ?? latestBuild(await (await fetch(BUILDS)).json());
  const partial = join(dir, "israel.partial.pmtiles");
  const output = join(dir, "israel.pmtiles");
  console.log(`tiles: extracting Israel from ${build} (maxzoom ${MAX_ZOOM})…`);
  execFileSync(cli, extractArgs(build, partial), { stdio: "inherit" });
  execFileSync(cli, ["verify", partial], { stdio: "inherit" });
  renameSync(partial, output);
  const bytes = statSync(output).size;
  writeFileSync(
    join(dir, "israel.json"),
    JSON.stringify(
      { build, bbox: ISRAEL_BBOX, maxzoom: MAX_ZOOM, bytes, extractedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(`tiles: ${(bytes / 1e6).toFixed(1)} MB -> ${output}`);
  console.log(JSON.parse(readFileSync(join(dir, "israel.json"), "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
```

- [ ] **Step 6: Run the tests to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/lib/tiles-tooling.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 7: Extract real tiles once (developer machine, needs network, about a minute)**

Run: `pnpm --filter @darb/web tiles:israel`
Expected: the log `tiles: extracting Israel from 2026101X.pmtiles (maxzoom 14)…`, then pmtiles
progress and `Completed verify`, then `tiles: 9x.x MB -> …/apps/web/.tiles/israel.pmtiles`.
`git status --short` does not list `.tiles`. If the network is unavailable, skip this step and note
it: dev then falls back to the list, and e2e uses the fixture.

- [ ] **Step 8: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/scripts/tiles apps/web/e2e/tiles/israel.pmtiles apps/web/src/lib/tiles-tooling.test.ts apps/web/package.json
git commit -m "build(web): Israel tiles extract and a reproducible PMTiles test fixture"
```

---

### Task 8: Glyphs and the Darb map style

**Files:**
- Create: `apps/web/scripts/map/fetch-glyphs.mjs`
- Create (downloaded once, committed): `apps/web/map-assets/glyphs/Noto Sans Regular/*.pbf` (13 files), `apps/web/map-assets/glyphs/OFL.txt`
- Create: `apps/web/scripts/map/style.mjs`
- Modify: `apps/web/scripts/copy-map.mjs`
- Test: `apps/web/src/stage/map-assets.test.ts`

**Interfaces:**
- Produces (`fetch-glyphs.mjs`): `GLYPHS_COMMIT`, `FONT = "Noto Sans Regular"`, `RANGES` (13 strings),
  `GLYPHS_DIR` (absolute path of `apps/web/map-assets/glyphs`).
- Produces (`style.mjs`): `MAP_FONT`, `GLYPHS_URL = "/map/glyphs/{fontstack}/{range}.pbf"`,
  `PROTOMAPS_SOURCE = "protomaps"`, `ATTRIBUTION`, `DROPPED_LAYERS`, `darbFlavor()`,
  `darbStyle(locale: "he" | "ar" | "en"): StyleSpecification-shaped object` (no `sprite`; the source URL
  is the placeholder `pmtiles:///api/tiles/israel.pmtiles`, and the client replaces it).
- `buildMapAssets(target)` now also writes `target/glyphs/…` and `target/style/{he,ar,en}.json` and
  returns `{ vendor, glyphs, styles: string[] }`.

- [ ] **Step 1: Download the glyphs once (developer machine, needs network)**

Create `apps/web/scripts/map/fetch-glyphs.mjs`:

```js
// One-off: downloads the Noto Sans Regular glyph ranges the map needs (Latin, Cyrillic, Hebrew,
// Arabic and its presentation forms, punctuation) from protomaps/basemaps-assets at a pinned
// commit, into apps/web/map-assets/glyphs (committed). Fonts: SIL Open Font License 1.1 (OFL.txt).
// Usage: node apps/web/scripts/map/fetch-glyphs.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

export const GLYPHS_COMMIT = "028c18f713baecad011301ff7a69acc39bcc2ae7";
export const FONT = "Noto Sans Regular";
export const RANGES = [
  "0-255",
  "256-511",
  "768-1023",
  "1024-1279",
  "1280-1535",
  "1536-1791",
  "1792-2047",
  "2048-2303",
  "8192-8447",
  "64256-64511",
  "64512-64767",
  "64768-65023",
  "65024-65279",
];
export const GLYPHS_DIR = fileURLToPath(new URL("../../map-assets/glyphs/", import.meta.url));
const BASE = `https://raw.githubusercontent.com/protomaps/basemaps-assets/${GLYPHS_COMMIT}/fonts`;

async function download(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  return Buffer.from(await res.arrayBuffer());
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  mkdirSync(join(GLYPHS_DIR, FONT), { recursive: true });
  writeFileSync(join(GLYPHS_DIR, "OFL.txt"), await download(`${BASE}/OFL.txt`));
  let total = 0;
  for (const range of RANGES) {
    const bytes = await download(`${BASE}/${encodeURIComponent(FONT)}/${range}.pbf`);
    writeFileSync(join(GLYPHS_DIR, FONT, `${range}.pbf`), bytes);
    total += bytes.length;
  }
  console.log(`glyphs: ${RANGES.length} ranges, ${(total / 1e6).toFixed(2)} MB -> ${GLYPHS_DIR}`);
}
```

Run: `node apps/web/scripts/map/fetch-glyphs.mjs`
Expected: `glyphs: 13 ranges, 1.41 MB -> …/apps/web/map-assets/glyphs/` (±0.01 MB).

- [ ] **Step 2: Write the failing test**

Create `apps/web/src/stage/map-assets.test.ts`:

```ts
// @vitest-environment node
import { existsSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { colors } from "@darb/tokens";
import { describe, expect, it } from "vitest";
import { buildMapAssets } from "../../scripts/copy-map.mjs";
import { FONT, GLYPHS_DIR, RANGES } from "../../scripts/map/fetch-glyphs.mjs";
import {
  ATTRIBUTION,
  darbStyle,
  DROPPED_LAYERS,
  GLYPHS_URL,
  MAP_FONT,
  PROTOMAPS_SOURCE,
} from "../../scripts/map/style.mjs";

describe("glyphs", () => {
  it("ships every range the map asks for, with the font licence", () => {
    for (const range of RANGES)
      expect(statSync(join(GLYPHS_DIR, FONT, `${range}.pbf`)).size, range).toBeGreaterThan(1000);
    expect(readFileSync(join(GLYPHS_DIR, "OFL.txt"), "utf8")).toContain("SIL OPEN FONT LICENSE");
  });
});

describe("the Darb style", () => {
  const style = darbStyle("ar");
  const json = JSON.stringify(style);

  it("uses only self-hosted glyphs and one font, and no sprite", () => {
    expect(style.glyphs).toBe(GLYPHS_URL);
    expect(style).not.toHaveProperty("sprite");
    expect(new Set(json.match(/"Noto[^"]*"/g))).toEqual(new Set([JSON.stringify(MAP_FONT)]));
    expect(MAP_FONT).toBe(FONT);
    expect(json).not.toMatch(/"icon-/);
  });
  it("links nowhere but the attribution", () => {
    const urls = (json.match(/https?:\/\/[^"\\ ]+/g) ?? []).sort();
    expect(urls).toEqual(["https://protomaps.com", "https://www.openstreetmap.org/copyright"]);
    expect(style.sources[PROTOMAPS_SOURCE].attribution).toBe(ATTRIBUTION);
  });
  it("drops points of interest, shields, arrows and borders", () => {
    const ids = style.layers.map((l: { id: string }) => l.id);
    for (const id of DROPPED_LAYERS) expect(ids).not.toContain(id);
    expect(ids).toContain("earth");
    expect(ids).toContain("roads_highway");
    expect(ids).toContain("places_locality");
  });
  it("paints night and forest land, gold roads and ivory labels", () => {
    const paint = (id: string) =>
      style.layers.find((l: { id: string }) => l.id === id)?.paint as Record<string, unknown>;
    expect(paint("background")["background-color"]).toBe(colors.night);
    expect(paint("earth")["fill-color"]).toBe(colors.forest950);
    expect(paint("roads_highway")["line-color"]).toBe(colors.gold600);
    expect(paint("places_locality")["text-color"]).toBe(colors.ivory);
  });
  it("labels places in the page language", () => {
    expect(JSON.stringify(darbStyle("he"))).toContain('"name:he"');
    expect(json).toContain('"name:ar"');
    expect(JSON.stringify(darbStyle("en"))).toContain('"name:en"');
  });
});

describe("buildMapAssets", () => {
  it("writes the vendor modules, the glyphs and one style per locale", () => {
    const target = mkdtempSync(join(tmpdir(), "darb-map-"));
    const { styles } = buildMapAssets(target);
    expect(styles.sort()).toEqual(["ar", "en", "he"].map((l) => join(target, "style", `${l}.json`)));
    expect(existsSync(join(target, "glyphs", FONT, "1536-1791.pbf"))).toBe(true);
    expect(JSON.parse(readFileSync(join(target, "style", "he.json"), "utf8")).version).toBe(8);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @darb/web exec vitest run src/stage/map-assets.test.ts`
Expected: FAIL, `Failed to resolve import "../../scripts/map/style.mjs"`.

- [ ] **Step 4: Implement the style builder**

Create `apps/web/scripts/map/style.mjs`:

```js
// The Darb map style, built from Protomaps basemaps (BSD-3-Clause) at build time, one per locale:
// night and forest land, gold roads, ivory labels. No icons (so no sprite), no points of interest
// (OSM POIs include bars and pubs: halal rule), no borders. Glyphs are self-hosted Noto Sans.
import { colors } from "@darb/tokens";
import { layers, namedFlavor } from "@protomaps/basemaps";

export const MAP_FONT = "Noto Sans Regular";
export const GLYPHS_URL = "/map/glyphs/{fontstack}/{range}.pbf";
export const PROTOMAPS_SOURCE = "protomaps";
export const ATTRIBUTION =
  '<a href="https://protomaps.com">Protomaps</a> © <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
export const DROPPED_LAYERS = [
  "pois",
  "roads_shields",
  "roads_oneway",
  "address_label",
  "boundaries",
  "boundaries_country",
];
/** Secondary text on dark surfaces (globals.css --text-muted). */
const SAGE = "#a9b8ad";

export function darbFlavor() {
  const c = colors;
  const casing = c.night;
  return {
    ...namedFlavor("dark"),
    background: c.night,
    earth: c.forest950,
    water: c.night,
    glacier: c.forest950,
    sand: c.forest950,
    beach: c.forest900,
    park_a: c.forest900,
    park_b: c.forest900,
    wood_a: c.forest900,
    wood_b: c.forest900,
    scrub_a: c.forest950,
    scrub_b: c.forest950,
    hospital: c.forest900,
    industrial: c.forest950,
    school: c.forest900,
    pedestrian: c.forest900,
    aerodrome: c.forest950,
    zoo: c.forest900,
    military: c.forest950,
    runway: c.forest800,
    pier: c.forest800,
    buildings: c.forest900,
    highway: c.gold600,
    highway_casing_early: casing,
    highway_casing_late: casing,
    major: c.gold900,
    major_casing_early: casing,
    major_casing_late: casing,
    link: c.gold900,
    link_casing: casing,
    minor_a: c.forest800,
    minor_b: c.forest800,
    minor_casing: casing,
    minor_service: c.forest800,
    minor_service_casing: casing,
    other: c.forest800,
    railway: c.forest600,
    tunnel_highway: c.gold900,
    tunnel_major: c.forest800,
    tunnel_link: c.forest800,
    tunnel_minor: c.forest800,
    tunnel_other: c.forest800,
    tunnel_highway_casing: casing,
    tunnel_major_casing: casing,
    tunnel_link_casing: casing,
    tunnel_minor_casing: casing,
    tunnel_other_casing: casing,
    bridges_highway: c.gold600,
    bridges_major: c.gold900,
    bridges_link: c.gold900,
    bridges_minor: c.forest800,
    bridges_other: c.forest800,
    bridges_highway_casing: casing,
    bridges_major_casing: casing,
    bridges_link_casing: casing,
    bridges_minor_casing: casing,
    bridges_other_casing: casing,
    boundaries: c.forest600,
    roads_label_minor: SAGE,
    roads_label_minor_halo: c.night,
    roads_label_major: c.ivory200,
    roads_label_major_halo: c.night,
    ocean_label: SAGE,
    subplace_label: c.ivory200,
    subplace_label_halo: c.night,
    city_label: c.ivory,
    city_label_halo: c.night,
    state_label: SAGE,
    state_label_halo: c.night,
    country_label: SAGE,
    address_label: SAGE,
    address_label_halo: c.night,
    landcover: {
      grassland: c.forest900,
      barren: c.forest950,
      urban_area: c.forest900,
      farmland: c.forest900,
      glacier: c.forest950,
      scrub: c.forest950,
      forest: c.forest900,
    },
  };
}

/** A MapLibre style for one locale. The client sets the real tiles URL (see map-style.ts). */
export function darbStyle(locale) {
  const kept = layers(PROTOMAPS_SOURCE, darbFlavor(), { lang: locale })
    .filter((layer) => !DROPPED_LAYERS.includes(layer.id))
    .map((layer) => {
      if (!layer.layout) return layer;
      const layout = Object.fromEntries(
        Object.entries(layer.layout).filter(([key]) => !key.startsWith("icon-")),
      );
      return { ...layer, layout };
    });
  // Every font stack (Medium, Italic, Devanagari…) becomes the one we host.
  const json = JSON.stringify(kept).replace(/"Noto [^"]*"/g, JSON.stringify(MAP_FONT));
  return {
    version: 8,
    name: `Darb (${locale})`,
    glyphs: GLYPHS_URL,
    sources: {
      [PROTOMAPS_SOURCE]: {
        type: "vector",
        url: "pmtiles:///api/tiles/israel.pmtiles",
        attribution: ATTRIBUTION,
      },
    },
    layers: JSON.parse(json),
  };
}
```

Replace `apps/web/scripts/copy-map.mjs` with:

```js
// Builds public/map (served at /map/*): the vendored MapLibre modules, the self-hosted glyphs and
// one Darb style per locale. The lazy city stage imports MapLibre from here at runtime, so it never
// enters a route's first-load JavaScript. Run by `dev` and `build`; needs no network.
import { cpSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { GLYPHS_DIR } from "./map/fetch-glyphs.mjs";
import { darbStyle } from "./map/style.mjs";

const require = createRequire(import.meta.url);
const LOCALES = ["he", "ar", "en"];

/** The main thread loads the first two, the worker the third (and the shared module from cache). */
export const VENDOR_FILES = [
  "maplibre-gl.mjs",
  "maplibre-gl-shared.mjs",
  "maplibre-gl-worker.mjs",
  "maplibre-gl.css",
];

export function maplibreVersion() {
  return JSON.parse(readFileSync(require.resolve("maplibre-gl/package.json"), "utf8")).version;
}

export function buildMapAssets(target) {
  rmSync(target, { recursive: true, force: true });
  const dist = join(dirname(require.resolve("maplibre-gl/package.json")), "dist");
  const vendor = join(target, "vendor", `maplibre-gl@${maplibreVersion()}`);
  mkdirSync(vendor, { recursive: true });
  for (const file of VENDOR_FILES) cpSync(join(dist, file), join(vendor, file));
  const glyphs = join(target, "glyphs");
  cpSync(GLYPHS_DIR, glyphs, { recursive: true });
  mkdirSync(join(target, "style"), { recursive: true });
  const styles = LOCALES.map((locale) => {
    const file = join(target, "style", `${locale}.json`);
    writeFileSync(file, JSON.stringify(darbStyle(locale)));
    return file;
  });
  return { vendor, glyphs, styles };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const { vendor, styles } = buildMapAssets(fileURLToPath(new URL("../public/map", import.meta.url)));
  console.log(`map: vendor -> ${vendor}; glyphs; ${styles.length} styles`);
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/stage/map-assets.test.ts src/stage/vendor.test.ts`
Expected: PASS (7 + 3 tests).

Run: `pnpm --filter @darb/web map && ls "apps/web/public/map/glyphs/Noto Sans Regular" | wc -l && ls apps/web/public/map/style`
Expected: `map: vendor -> …; glyphs; 3 styles`, then `13`, then `ar.json en.json he.json`.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/scripts/map apps/web/scripts/copy-map.mjs apps/web/map-assets apps/web/src/stage/map-assets.test.ts
git commit -m "feat(web): Darb map style per locale with self-hosted Noto Sans glyphs"
```

---

### Task 9: Interface copy for the stage

**Files:**
- Modify: `packages/i18n/src/messages/en.ts`, `he.ts`, `ar.ts`
- Test: `packages/i18n/src/index.test.ts`

**Interfaces:**
- Produces keys: `mapLabel`, `plazaLabel` (`{place}`), `showMap`, `showList`, `mapData`.

- [ ] **Step 1: Write the failing test**

Append to `packages/i18n/src/index.test.ts`:

```ts
describe("stage copy", () => {
  it("names the map, the plaza and the Map/List switch in every language", () => {
    expect(t("en", "mapLabel")).toBe("Map of Darb's live places");
    expect(t("en", "plazaLabel", { place: "Sakhnin" })).toBe("Sakhnin: streets and doors");
    expect(t("he", "plazaLabel", { place: "סח'נין" })).toBe("סח'נין: רחובות ודלתות");
    expect(t("ar", "plazaLabel", { place: "سخنين" })).toBe("سخنين: الشوارع والأبواب");
    expect([t("he", "showMap"), t("ar", "showMap"), t("en", "showMap")]).toEqual(["מפה", "خريطة", "Map"]);
    expect([t("he", "showList"), t("ar", "showList"), t("en", "showList")]).toEqual(["רשימה", "قائمة", "List"]);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/i18n test`
Expected: FAIL, TypeScript/Vitest reports `mapLabel` is not a key (the test fails on `t("en", "mapLabel")`).

- [ ] **Step 3: Implement**

Append to the `en` object in `packages/i18n/src/messages/en.ts` (before the closing `};`):

```ts
  mapLabel: "Map of Darb's live places",
  plazaLabel: "{place}: streets and doors",
  showMap: "Map",
  showList: "List",
  mapData: "Map data",
```

Append to `he` in `he.ts`:

```ts
  mapLabel: "מפת המקומות הפעילים בדרב",
  plazaLabel: "{place}: רחובות ודלתות",
  showMap: "מפה",
  showList: "רשימה",
  mapData: "נתוני מפה",
```

Append to `ar` in `ar.ts`:

```ts
  mapLabel: "خريطة الأماكن الفعّالة في درب",
  plazaLabel: "{place}: الشوارع والأبواب",
  showMap: "خريطة",
  showList: "قائمة",
  mapData: "بيانات الخريطة",
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @darb/i18n test && pnpm --filter @darb/i18n build`
Expected: PASS, including the key-parity and placeholder-parity tests.

- [ ] **Step 5: Commit**

```bash
pnpm format && pnpm lint
git add packages/i18n/src
git commit -m "feat(i18n): copy for the map, the plaza and the Map/List switch"
```

---

### Task 10: Stage data on every level

**Files:**
- Create: `apps/web/src/lib/stage-store.ts`
- Create: `apps/web/src/lib/stage-data.ts`
- Test: `apps/web/src/lib/stage-data.test.ts`
- Create: `apps/web/src/components/StageData.tsx`
- Test: `apps/web/src/components/StageData.test.tsx`
- Modify: `apps/web/src/app/[locale]/page.tsx`, `[place]/page.tsx`, `[place]/[sector]/page.tsx`,
  `[place]/[sector]/[kind]/layout.tsx`, `k/[kind]/page.tsx`

**Interfaces:**
- Consumes: `StageLevel`, `StageDoor`, `StagePin`, `StagePlace` (Task 2); `href`, `paths`; `toBusinessRow`, `RowContext`; `TaxonomyIndex`.
- Produces: `stageStore { get(): StageLevel | null; set(level: StageLevel | null): void; subscribe(listener: () => void): () => void }`.
- Produces: `COUNTRY_STAGE: StageLevel`,
  `placeStage(locale: Locale, place: PlaceDetailDto, index: TaxonomyIndex, totals: Map<string, number>): StageLevel`,
  `sectorStage(locale, place, sector: SectorDto, index, counts: Record<string, number>): StageLevel`,
  `kindStage(locale, place, items: readonly BusinessSummaryDto[], ctx: RowContext): StageLevel`,
  `soonStage(locale, place): StageLevel`.
- Produces: `<StageData level={StageLevel} />`, a client component that renders nothing. It publishes
  `level` to `stageStore` on mount and clears it on unmount (only if it is still its level).

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/stage-data.test.ts`:

```ts
import type { BusinessSummaryDto, PlaceDetailDto, TaxonomyDto } from "@darb/contracts";
import { describe, expect, it } from "vitest";
import { placeNames } from "./rows";
import { COUNTRY_STAGE, kindStage, placeStage, sectorStage, soonStage } from "./stage-data";
import { indexTaxonomy } from "./taxonomy";

const kind = (id: string, slug: string, parentKindId: string | null = null, order = 1) => ({
  id,
  slug,
  sectorId: "s1",
  parentKindId,
  name: { he: slug, en: slug.toUpperCase() },
  template: "booking" as const,
  attributes: [],
  icon: null,
  order,
});
const index = indexTaxonomy({
  sectors: [
    {
      id: "s1",
      slug: "beauty",
      name: { he: "יופי", en: "Beauty" },
      tagline: { en: "t" },
      accent: "#d9aaa2",
      order: 1,
      kinds: [kind("k1", "barbershops"), kind("k2", "nails", null, 2), kind("k3", "kids", "k1")],
    },
  ],
} satisfies TaxonomyDto);
const haifa = {
  slug: "haifa",
  name: { he: "חיפה", en: "Haifa" },
  lat: 32.79,
  lng: 34.99,
  children: [{ slug: "kiryat-haim", name: { en: "Kiryat Haim" } }],
} as unknown as PlaceDetailDto;
const business = (slug: string, placeSlug: string): BusinessSummaryDto => ({
  id: slug,
  slug,
  name: { en: slug },
  tagline: { en: "" },
  tier: "example",
  primaryKindId: "k1",
  placeId: placeSlug,
  placeSlug,
  lat: 32.8,
  lng: 35.01,
  photo: null,
  openNow: null,
});

describe("stage levels", () => {
  it("is the country map at level 0", () => {
    expect(COUNTRY_STAGE).toEqual({ depth: 0 });
  });
  it("gives a place one door per sector, with the list door's href and total", () => {
    expect(placeStage("en", haifa, index, new Map([["beauty", 12]]))).toEqual({
      depth: 1,
      place: { slug: "haifa", name: "Haifa", lat: 32.79, lng: 34.99 },
      doors: [
        { slug: "beauty", href: "/en/haifa/beauty", label: "Beauty", count: 12, accent: "#d9aaa2" },
      ],
    });
  });
  it("gives a sector one door per top-level kind, zero counts included", () => {
    const level = sectorStage("he", haifa, index.sectorBySlug.get("beauty")!, index, {
      barbershops: 3,
    });
    expect(level).toMatchObject({ depth: 2, sector: { slug: "beauty", name: "יופי", accent: "#d9aaa2" } });
    expect(level.depth === 2 && level.doors).toEqual([
      { slug: "barbershops", href: "/haifa/beauty/barbershops", label: "barbershops", count: 3, accent: "#d9aaa2" },
      { slug: "nails", href: "/haifa/beauty/nails", label: "nails", count: 0, accent: "#d9aaa2" },
    ]);
  });
  it("pins each listed business at its row's href, sub-place businesses under the listed place", () => {
    const ctx = { locale: "en" as const, index, names: placeNames(haifa), here: "haifa" };
    const level = kindStage("en", haifa, [business("a", "haifa"), business("b", "kiryat-haim")], ctx);
    expect(level.depth === 3 && level.pins).toEqual([
      { key: "haifa/a", href: "/en/haifa/beauty/barbershops/a", name: "a", lat: 32.8, lng: 35.01 },
      {
        key: "kiryat-haim/b",
        href: "/en/haifa/beauty/barbershops/kiryat-haim/b",
        name: "b",
        lat: 32.8,
        lng: 35.01,
      },
    ]);
  });
  it("shows a soon place as the map at that place", () => {
    expect(soonStage("en", haifa)).toEqual({
      depth: 3,
      place: { slug: "haifa", name: "Haifa", lat: 32.79, lng: 34.99 },
      pins: [],
    });
  });
});
```

Create `apps/web/src/components/StageData.test.tsx`:

```tsx
import { render } from "@testing-library/react";
import { afterEach, expect, it } from "vitest";
import type { StageLevel } from "@darb/stage";
import { stageStore } from "@/lib/stage-store";
import { StageData } from "./StageData";

afterEach(() => stageStore.set(null));

const place: StageLevel = {
  depth: 3,
  place: { slug: "sakhnin", name: "Sakhnin", lat: 32.86, lng: 35.3 },
  pins: [],
};

it("publishes its level while mounted and clears it after", () => {
  const seen: (StageLevel | null)[] = [];
  const stop = stageStore.subscribe(() => seen.push(stageStore.get()));
  const { container, unmount } = render(<StageData level={place} />);
  expect(container.innerHTML).toBe("");
  expect(stageStore.get()).toBe(place);
  unmount();
  expect(stageStore.get()).toBeNull();
  expect(seen).toEqual([place, null]);
  stop();
});

it("never clears a level a newer page already published", () => {
  const { unmount } = render(<StageData level={place} />);
  const next: StageLevel = { depth: 0 };
  stageStore.set(next);
  unmount();
  expect(stageStore.get()).toBe(next);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/lib/stage-data.test.ts src/components/StageData.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/stage-store.ts`:

```ts
import type { StageLevel } from "@darb/stage";

/**
 * The level the page shows, for the lazy stage. Level pages publish it through <StageData>; the
 * stage reads it with useSyncExternalStore. Null: the page is not a city level.
 */
let current: StageLevel | null = null;
const listeners = new Set<() => void>();

export const stageStore = {
  get: (): StageLevel | null => current,
  set(level: StageLevel | null): void {
    if (level === current) return;
    current = level;
    for (const listener of listeners) listener();
  },
  subscribe(listener: () => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};
```

Create `apps/web/src/lib/stage-data.ts`:

```ts
import { pickText, type Locale } from "@darb/core";
import type { BusinessSummaryDto, PlaceDetailDto, SectorDto } from "@darb/contracts";
import type { StageLevel, StagePlace } from "@darb/stage";
import { href, paths } from "./routes";
import { toBusinessRow, type RowContext } from "./rows";
import type { TaxonomyIndex } from "./taxonomy";

/** Every door and pin href below equals the href of the list door or row it mirrors. */
export const COUNTRY_STAGE: StageLevel = { depth: 0 };

const stagePlace = (locale: Locale, place: PlaceDetailDto): StagePlace => ({
  slug: place.slug,
  name: pickText(place.name, locale),
  lat: place.lat,
  lng: place.lng,
});

export function placeStage(
  locale: Locale,
  place: PlaceDetailDto,
  index: TaxonomyIndex,
  totals: Map<string, number>,
): StageLevel {
  return {
    depth: 1,
    place: stagePlace(locale, place),
    doors: index.sectors.map((s) => ({
      slug: s.slug,
      href: href(locale, paths.sector(place.slug, s.slug)),
      label: pickText(s.name, locale),
      count: totals.get(s.slug) ?? 0,
      accent: s.accent,
    })),
  };
}

export function sectorStage(
  locale: Locale,
  place: PlaceDetailDto,
  sector: SectorDto,
  index: TaxonomyIndex,
  counts: Record<string, number>,
): StageLevel {
  return {
    depth: 2,
    place: stagePlace(locale, place),
    sector: { slug: sector.slug, name: pickText(sector.name, locale), accent: sector.accent },
    doors: (index.doorsBySector.get(sector.id) ?? []).map((k) => ({
      slug: k.slug,
      href: href(locale, paths.kind(place.slug, sector.slug, k.slug)),
      label: pickText(k.name, locale),
      count: counts[k.slug] ?? 0,
      accent: sector.accent,
    })),
  };
}

export function kindStage(
  locale: Locale,
  place: PlaceDetailDto,
  items: readonly BusinessSummaryDto[],
  ctx: RowContext,
): StageLevel {
  return {
    depth: 3,
    place: stagePlace(locale, place),
    pins: items.flatMap((b) => {
      const row = toBusinessRow(b, ctx);
      return row ? [{ key: row.key, href: row.href, name: row.name, lat: b.lat, lng: b.lng }] : [];
    }),
  };
}

export function soonStage(locale: Locale, place: PlaceDetailDto): StageLevel {
  return { depth: 3, place: stagePlace(locale, place), pins: [] };
}
```

Create `apps/web/src/components/StageData.tsx`:

```tsx
"use client";

import { useEffect } from "react";
import type { StageLevel } from "@darb/stage";
import { stageStore } from "@/lib/stage-store";

/** Publishes this page's level to the lazy stage. Renders nothing: the list is the page. */
export function StageData({ level }: { level: StageLevel }) {
  useEffect(() => {
    stageStore.set(level);
    return () => {
      if (stageStore.get() === level) stageStore.set(null);
    };
  }, [level]);
  return null;
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/lib/stage-data.test.ts src/components/StageData.test.tsx`
Expected: PASS.

- [ ] **Step 5: Publish the level from every level page**

`apps/web/src/app/[locale]/page.tsx`: import `{ StageData }` from `@/components/StageData` and
`{ COUNTRY_STAGE }` from `@/lib/stage-data`, and render `<StageData level={COUNTRY_STAGE} />` as the
first child of the returned fragment (before `<CityBar …/>`).

`apps/web/src/app/[locale]/k/[kind]/page.tsx`: the same, `<StageData level={COUNTRY_STAGE} />`
first in its fragment.

`apps/web/src/app/[locale]/[place]/page.tsx`: import `StageData` and
`{ placeStage, soonStage }`. In the `soon` branch, render `<StageData level={soonStage(locale, place)} />`
right after `{bar}`. In the live branch, render
`<StageData level={placeStage(locale, place, index, totals)} />` right after `{bar}`.

`apps/web/src/app/[locale]/[place]/[sector]/page.tsx`: import `StageData` and `{ sectorStage }`, and
render `<StageData level={sectorStage(locale, place, sector, index, counts)} />` right after `<CityBar …/>`.

`apps/web/src/app/[locale]/[place]/[sector]/[kind]/layout.tsx`: import `StageData` and
`{ kindStage }`. Build the row context once and use it for both:

```tsx
  const ctx = { locale, index, names: placeNames(place), here: place.slug };
  const rows = toRows(page.items, ctx);
```

Then render `<StageData level={kindStage(locale, place, page.items, ctx)} />` right after
`{children}`. The business pages under this layout publish nothing of their own, so the sheet sits
over the kind's map.

- [ ] **Step 6: Verify the pages still render**

Run: `pnpm --filter @darb/web typecheck && pnpm --filter @darb/web test`
Expected: clean typecheck and every unit test PASS.

- [ ] **Step 7: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/lib/stage-store.ts apps/web/src/lib/stage-data.ts apps/web/src/lib/stage-data.test.ts \
  apps/web/src/components/StageData.tsx apps/web/src/components/StageData.test.tsx "apps/web/src/app/[locale]"
git commit -m "feat(web): every level publishes its stage level"
```

---

### Task 11: The non-modal desktop sheet (I5)

**Files:**
- Create: `apps/web/src/lib/use-media.ts`
- Modify: `apps/web/src/components/Sheet.tsx`, `apps/web/src/components/Sheet.module.css`
- Test: `apps/web/src/components/Sheet.test.tsx`, `apps/web/e2e/sheet.spec.ts`

**Interfaces:**
- Produces: `useMedia(query: string): boolean` (`false` on the server and wherever `matchMedia` is
  missing), `DESKTOP = "(min-width: 900px)"`, `REDUCED_MOTION = "(prefers-reduced-motion: reduce)"`.
- Changes `Sheet` behaviour (props unchanged). On phones it is still a modal bottom sheet (scrim,
  `aria-modal="true"`, inert background). On desktop it is a non-modal side panel: no scrim, no
  `aria-modal`, nothing inert, and the list and the map stay usable. The Tab loop stays scoped to the
  panel on both, and Escape ignores events that are already `defaultPrevented`.

- [ ] **Step 1: Write the failing tests**

In `apps/web/src/components/Sheet.test.tsx`, change the vitest import to
`import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";` (unchanged if already so),
and append:

```tsx
function stubDesktop() {
  vi.stubGlobal("matchMedia", (media: string) => ({
    matches: media === "(min-width: 900px)",
    media,
    addEventListener: () => {},
    removeEventListener: () => {},
  }));
}

describe("Sheet on desktop", () => {
  beforeEach(stubDesktop);
  afterEach(() => vi.unstubAllGlobals());

  it("is a non-modal side panel: no scrim, nothing inert", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    expect(dialog.hasAttribute("aria-modal")).toBe(false);
    expect(document.querySelector("[data-sheet] > [aria-hidden='true']")).toBeNull();
    for (const id of ["site-header", "city-bar", "city-list"])
      expect(document.getElementById(id)?.hasAttribute("inert")).toBe(false);
    expect(document.activeElement?.getAttribute("data-sheet-close")).toBe("");
  });

  it("still loops Tab inside the panel", () => {
    renderSheet();
    const dialog = screen.getByRole("dialog");
    screen.getByRole("button", { name: "Share" }).focus();
    fireEvent.keyDown(dialog, { key: "Tab" });
    expect(document.activeElement?.getAttribute("data-sheet-handle")).toBe("");
  });

  it("gives focus back to its row on close", () => {
    const { unmount } = renderSheet();
    unmount();
    expect(document.activeElement?.getAttribute("data-business-link")).toBe(
      "sakhnin/samers-barbershop",
    );
  });
});

it("ignores an Escape that something else already handled", () => {
  renderSheet();
  const event = new KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true });
  event.preventDefault();
  document.body.dispatchEvent(event);
  expect(push).not.toHaveBeenCalled();
});
```

In `apps/web/e2e/sheet.spec.ts`, append:

```ts
test("desktop: the side panel is non-modal and the city behind it stays usable", async ({
  page,
}, info) => {
  test.skip(isPhone(info), "desktop only");
  await page.goto(LEVELS.business);
  const dialog = page.getByRole("dialog");
  await expect(dialog).toBeVisible();
  await expect(dialog).not.toHaveAttribute("aria-modal", "true");
  await expect(page.locator("#site-header")).not.toHaveAttribute("inert", "");
  await expect(page.locator("#city-list")).not.toHaveAttribute("inert", "");
  // The path bar's up arrow, behind the panel, still works and closes the sheet.
  await page.locator("[data-path-bar] [data-up]").click();
  await expect(page).toHaveURL(LEVELS.kind);
  await expect(dialog).toHaveCount(0);
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/components/Sheet.test.tsx`
Expected: FAIL. The desktop tests find `aria-modal="true"` and an inert header, and the Escape test
sees `push` called.

- [ ] **Step 3: Implement**

Create `apps/web/src/lib/use-media.ts`:

```ts
import { useSyncExternalStore } from "react";

export const DESKTOP = "(min-width: 900px)";
export const REDUCED_MOTION = "(prefers-reduced-motion: reduce)";

const supported = () => typeof window !== "undefined" && typeof window.matchMedia === "function";

/** A media query as state. False on the server (and in tests without matchMedia). */
export function useMedia(query: string): boolean {
  return useSyncExternalStore(
    (onChange) => {
      if (!supported()) return () => {};
      const list = window.matchMedia(query);
      list.addEventListener("change", onChange);
      return () => list.removeEventListener("change", onChange);
    },
    () => supported() && window.matchMedia(query).matches,
    () => false,
  );
}
```

In `apps/web/src/components/Sheet.tsx`:

1. Add `import { DESKTOP, useMedia } from "@/lib/use-media";`.
2. Inside `Sheet`, after `const [snap, setSnap] = useState<Snap>("half");`, add
   `const desktop = useMedia(DESKTOP);`.
3. Replace the single `useEffect(() => { const restore = …; … }, [returnFocusTo]);` with these two
   effects, **in this order**. Cleanups run in declaration order, so the background is no longer
   inert when focus returns to the row:

```tsx
  // Phone: a modal bottom sheet over the city. Desktop: a non-modal side panel beside the list
  // and the map, which stay usable (Plan 2A ruling I5).
  useEffect(() => {
    if (desktop || !root.current) return;
    return inertBackground(root.current);
  }, [desktop]);

  useEffect(() => {
    closeButton.current?.focus();
    // On the document, so Escape works wherever focus is (even if it left the panel), unless
    // something else (a menu, the map) already handled this Escape.
    const onEscape = (event: globalThis.KeyboardEvent) => {
      if (event.key !== "Escape" || event.defaultPrevented) return;
      event.preventDefault();
      closeRef.current();
    };
    document.addEventListener("keydown", onEscape);
    return () => {
      document.removeEventListener("keydown", onEscape);
      const row = document.querySelector<HTMLElement>(`[data-business-link="${returnFocusTo}"]`);
      (row ?? document.getElementById("main-heading"))?.focus();
    };
  }, [returnFocusTo]);
```

4. In the returned JSX, render the scrim only on phones and the modal flag only on phones:

```tsx
      {desktop ? null : <div className={styles.scrim} aria-hidden="true" onClick={close} />}
      <div
        ref={panel}
        role="dialog"
        aria-modal={desktop ? undefined : "true"}
```

(Keep every other attribute of the panel as it is.)

In `apps/web/src/components/Sheet.module.css`, inside `@media (min-width: 900px) { … }`, replace

```css
  .scrim {
    background: rgb(3 17 12 / 0.35);
  }
```

with

```css
  /* Server HTML still has the scrim until the client knows it is on desktop: never show it here. */
  .scrim {
    display: none;
  }
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/components/Sheet.test.tsx src/lib/styles.test.ts`
Expected: PASS. The earlier modal tests still pass because jsdom has no `matchMedia`, so the sheet is
the phone's modal.

Run (Docker up, seeded API, no other server on :3000/:3001):
`pnpm --filter @darb/web build && pnpm --filter @darb/web exec playwright test e2e/sheet.spec.ts`
Expected: every sheet test passes in both projects, including the new desktop test. The existing
"stay trapped" test still passes on desktop, because the Tab loop is scoped to the panel.

- [ ] **Step 5: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/lib/use-media.ts apps/web/src/components/Sheet.tsx apps/web/src/components/Sheet.module.css \
  apps/web/src/components/Sheet.test.tsx apps/web/e2e/sheet.spec.ts
git commit -m "feat(web): non-modal desktop sheet; Escape respects defaultPrevented"
```

---

### Task 12: The map view (`CityMap`)

**Files:**
- Create: `apps/web/src/stage/types.ts`
- Create: `apps/web/src/stage/load-maplibre.ts`
- Create: `apps/web/src/stage/map-style.ts`, test `map-style.test.ts`
- Create: `apps/web/src/stage/map-layers.ts`, test `map-layers.test.ts`
- Create: `apps/web/src/stage/city-map.ts`

**Interfaces:**
- Consumes: `MAPLIBRE_URL`, `MAPLIBRE_CSS_URL`, `TILES_URL`, `styleUrl` (Task 1); `ISRAEL_NORTH`,
  `cityCollection`, `pinCollection`, `easeOut`, `zoomedOut`, `Camera`, `CityDot`, `StagePin` (Task 2);
  the style files and `MAP_FONT` (Task 8).
- Produces (`@/stage/types`):
  - `StageMap { move(camera: Camera, duration: number, insetEnd: number): Promise<void>; setDots(dots): void; setPins(pins, activeHref: string | null): void; pointOf(id: string): [number, number] | null; destroy(): void }`
  - `StageLabels { map; plaza; showMap; showList; mapData; businessCount }`. `plaza` keeps `{place}`
    and `businessCount` keeps `{count}`.
  - `StageProps { locale: Locale; labels: StageLabels; onFail: () => void }`
- Produces: `loadMapLibre(): Promise<typeof import("maplibre-gl")>`; `PROTOMAPS_SOURCE`,
  `prepareStyle(style, { origin, tilesUrl }): StyleSpecification`; `CITY_SOURCE`, `PIN_SOURCE`,
  `CITY_GLOW`, `CITY_DOT`, `CITY_LABEL`, `PIN_LAYER`, `MAP_FONT`, `darbLayers(): LayerSpecification[]`;
  `CityMap.create(options: CityMapOptions): Promise<CityMap>` with
  `CityMapOptions { container: HTMLElement; locale: Locale; dir: "ltr" | "rtl"; label: string; onPick(href: string, kind: "place" | "business"): void; onZoomOut(): void }`.
  `CityMap` implements `StageMap` and adds `center(): [number, number]`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/stage/map-style.test.ts`:

```ts
// @vitest-environment node
import type { StyleSpecification } from "maplibre-gl";
import { describe, expect, it } from "vitest";
import { prepareStyle } from "./map-style";

const style = {
  version: 8,
  glyphs: "/map/glyphs/{fontstack}/{range}.pbf",
  sources: {
    protomaps: { type: "vector", url: "pmtiles:///api/tiles/israel.pmtiles", attribution: "x" },
  },
  layers: [{ id: "background", type: "background" }],
} as StyleSpecification;
const at = { origin: "http://localhost:3000", tilesUrl: "/api/tiles/israel.pmtiles" };

describe("prepareStyle", () => {
  it("makes the glyph URL absolute without encoding its tokens", () => {
    expect(prepareStyle(style, at).glyphs).toBe(
      "http://localhost:3000/map/glyphs/{fontstack}/{range}.pbf",
    );
  });
  it("points the tiles at the configured archive, local or on R2", () => {
    expect(prepareStyle(style, at).sources.protomaps).toEqual({
      type: "vector",
      url: "pmtiles://http://localhost:3000/api/tiles/israel.pmtiles",
      attribution: "x",
    });
    const r2 = prepareStyle(style, { ...at, tilesUrl: "https://tiles.darb.co.il/israel.pmtiles" });
    expect(r2.sources.protomaps).toMatchObject({ url: "pmtiles://https://tiles.darb.co.il/israel.pmtiles" });
  });
  it("leaves the fetched style untouched", () => {
    const copy = structuredClone(style);
    prepareStyle(style, at).layers.push({ id: "x", type: "background" });
    expect(style).toEqual(copy);
  });
  it("refuses a style without the Protomaps source", () => {
    expect(() => prepareStyle({ ...style, sources: {} }, at)).toThrow(/protomaps/);
  });
});
```

Create `apps/web/src/stage/map-layers.test.ts`:

```ts
// @vitest-environment node
import { colors } from "@darb/tokens";
import { expect, it } from "vitest";
import { MAP_FONT as STYLE_FONT } from "../../scripts/map/style.mjs";
import {
  CITY_DOT,
  CITY_GLOW,
  CITY_LABEL,
  CITY_SOURCE,
  darbLayers,
  MAP_FONT,
  PIN_LAYER,
  PIN_SOURCE,
} from "./map-layers";

it("draws live places as gold glows and dots with ivory names, and business pins on top", () => {
  const layers = darbLayers();
  expect(layers.map((l) => l.id)).toEqual([CITY_GLOW, CITY_DOT, CITY_LABEL, PIN_LAYER]);
  for (const layer of layers.slice(0, 3)) expect(layer).toMatchObject({ source: CITY_SOURCE });
  expect(layers[3]).toMatchObject({ source: PIN_SOURCE });
  const json = JSON.stringify(layers);
  expect(json).not.toMatch(/icon-/);
  for (const colour of [colors.gold, colors.gold300, colors.ivory, colors.night])
    expect(json).toContain(colour);
});

it("labels places with the one self-hosted font", () => {
  expect(MAP_FONT).toBe(STYLE_FONT);
  expect(darbLayers()[2]).toMatchObject({ layout: { "text-font": [MAP_FONT] } });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/stage/map-style.test.ts src/stage/map-layers.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the pure parts**

Create `apps/web/src/stage/types.ts`:

```ts
import type { Locale } from "@darb/core";
import type { Camera, CityDot, StagePin } from "@darb/stage";

/** What the Director needs from the map. CityMap implements it; tests fake it. */
export interface StageMap {
  /**
   * Resolves when the camera arrives (at once for a jump). `insetEnd`: px of the map hidden at the
   * inline end (the desktop sheet), so the subject stays in view beside it.
   */
  move(camera: Camera, duration: number, insetEnd: number): Promise<void>;
  setDots(dots: readonly CityDot[]): void;
  setPins(pins: readonly StagePin[], activeHref: string | null): void;
  /** Viewport px of a live place (slug) or a business (key): for e2e. */
  pointOf(id: string): [number, number] | null;
  destroy(): void;
}

/** Interface copy for the stage, from t() in the layout. Placeholders are filled on the client. */
export interface StageLabels {
  map: string;
  /** Holds "{place}". */
  plaza: string;
  showMap: string;
  showList: string;
  mapData: string;
  /** Holds "{count}". */
  businessCount: string;
}

export interface StageProps {
  locale: Locale;
  labels: StageLabels;
  /** The stage could not start (no WebGL2 context, tiles or style failed): the list is the city. */
  onFail: () => void;
}
```

Create `apps/web/src/stage/map-style.ts`:

```ts
import type { StyleSpecification } from "maplibre-gl";

export const PROTOMAPS_SOURCE = "protomaps";

/**
 * The fetched Darb style, ready for MapLibre: glyphs as an absolute same-origin URL (the worker
 * resolves URLs against its own location) and the vector source on the configured PMTiles archive.
 */
export function prepareStyle(
  style: StyleSpecification,
  at: { origin: string; tilesUrl: string },
): StyleSpecification {
  const source = style.sources[PROTOMAPS_SOURCE];
  if (!source || source.type !== "vector")
    throw new Error("The Darb style has no protomaps vector source");
  const tiles = new URL(at.tilesUrl, at.origin).href;
  return {
    ...style,
    glyphs: style.glyphs?.startsWith("/") ? `${at.origin}${style.glyphs}` : style.glyphs,
    sources: { ...style.sources, [PROTOMAPS_SOURCE]: { ...source, url: `pmtiles://${tiles}` } },
    layers: [...style.layers],
  };
}
```

Create `apps/web/src/stage/map-layers.ts`:

```ts
import type { LayerSpecification } from "maplibre-gl";
import { colors } from "@darb/tokens";

export const CITY_SOURCE = "darb-city";
export const PIN_SOURCE = "darb-pins";
export const CITY_GLOW = "darb-city-glow";
export const CITY_DOT = "darb-city-dot";
export const CITY_LABEL = "darb-city-label";
export const PIN_LAYER = "darb-pin";
/** The one self-hosted glyph font (scripts/map/style.mjs MAP_FONT). */
export const MAP_FONT = "Noto Sans Regular";

/** Darb's own layers over the basemap: live places glowing by density, then business pins. */
export function darbLayers(): LayerSpecification[] {
  return [
    {
      id: CITY_GLOW,
      type: "circle",
      source: CITY_SOURCE,
      filter: [">", ["get", "glow"], 0],
      paint: {
        "circle-radius": [
          "interpolate",
          ["linear"],
          ["zoom"],
          7,
          ["get", "glow"],
          12,
          ["*", ["get", "glow"], 2.5],
        ],
        "circle-color": colors.gold,
        "circle-opacity": 0.32,
        "circle-blur": 0.9,
      },
    },
    {
      id: CITY_DOT,
      type: "circle",
      source: CITY_SOURCE,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 7, 3.5, 12, 6],
        "circle-color": colors.gold300,
        "circle-stroke-color": colors.night,
        "circle-stroke-width": 1.5,
      },
    },
    {
      id: CITY_LABEL,
      type: "symbol",
      source: CITY_SOURCE,
      minzoom: 7,
      layout: {
        "text-field": ["get", "name"],
        "text-font": [MAP_FONT],
        "text-size": 13,
        "text-offset": [0, 0.9],
        "text-anchor": "top",
        "symbol-sort-key": ["-", 0, ["get", "count"]],
      },
      paint: {
        "text-color": colors.ivory,
        "text-halo-color": colors.night,
        "text-halo-width": 1.4,
      },
    },
    {
      id: PIN_LAYER,
      type: "circle",
      source: PIN_SOURCE,
      paint: {
        "circle-radius": ["case", ["get", "active"], 9, 6],
        "circle-color": colors.gold,
        "circle-stroke-color": colors.ivory,
        "circle-stroke-width": ["case", ["get", "active"], 2.5, 1.5],
      },
    },
  ];
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/stage/map-style.test.ts src/stage/map-layers.test.ts`
Expected: PASS (4 + 2 tests).

- [ ] **Step 5: Implement the loader and the map**

Create `apps/web/src/stage/load-maplibre.ts`:

```ts
import { MAPLIBRE_CSS_URL, MAPLIBRE_URL } from "./vendor";

export type MapLibre = typeof import("maplibre-gl");

let loading: Promise<MapLibre> | null = null;

/**
 * MapLibre's ES modules from /map/vendor (copied by scripts/copy-map.mjs), imported at runtime so
 * the bundler never pulls them into a chunk. Its module worker finds itself from import.meta.url.
 */
export function loadMapLibre(): Promise<MapLibre> {
  loading ??= (async () => {
    if (!document.querySelector("link[data-maplibre-css]")) {
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href = MAPLIBRE_CSS_URL;
      link.setAttribute("data-maplibre-css", "");
      document.head.append(link);
    }
    return (await import(/* webpackIgnore: true */ /* turbopackIgnore: true */ MAPLIBRE_URL)) as MapLibre;
  })();
  loading.catch(() => {
    loading = null;
  });
  return loading;
}
```

Create `apps/web/src/stage/city-map.ts`:

```ts
import type { GeoJSONSource, Map as MapLibreMap, StyleSpecification } from "maplibre-gl";
import { Protocol } from "pmtiles";
import type { Locale } from "@darb/core";
import {
  cityCollection,
  easeOut,
  ISRAEL_NORTH,
  pinCollection,
  zoomedOut,
  type Camera,
  type CityDot,
  type StagePin,
} from "@darb/stage";
import { loadMapLibre } from "./load-maplibre";
import { CITY_DOT, CITY_GLOW, CITY_SOURCE, darbLayers, PIN_LAYER, PIN_SOURCE } from "./map-layers";
import { prepareStyle, PROTOMAPS_SOURCE } from "./map-style";
import type { StageMap } from "./types";
import { styleUrl, TILES_URL } from "./vendor";

const READY_TIMEOUT = 15_000;
const PADDING = 48;
const PICKABLE = [PIN_LAYER, CITY_DOT, CITY_GLOW];

let protocol: Protocol | null = null;

export interface CityMapOptions {
  container: HTMLElement;
  locale: Locale;
  dir: "ltr" | "rtl";
  /** The canvas's accessible name. */
  label: string;
  onPick: (href: string, kind: "place" | "business") => void;
  /** The person zoomed well out of a street-level view: go up a level. */
  onZoomOut: () => void;
}

/** MapLibre with the Darb style over PMTiles, the live places by density and a kind's businesses. */
export class CityMap implements StageMap {
  private dots: readonly CityDot[] = [];
  private pins: readonly StagePin[] = [];
  private target = 0;

  private constructor(
    private readonly map: MapLibreMap,
    private readonly dir: "ltr" | "rtl",
  ) {}

  static async create(options: CityMapOptions): Promise<CityMap> {
    const maplibre = await loadMapLibre();
    if (!protocol) {
      protocol = new Protocol();
      maplibre.addProtocol("pmtiles", protocol.tile);
    }
    const res = await fetch(styleUrl(options.locale));
    if (!res.ok) throw new Error(`Map style: ${res.status}`);
    const style = prepareStyle((await res.json()) as StyleSpecification, {
      origin: window.location.origin,
      tilesUrl: TILES_URL,
    });
    style.sources[CITY_SOURCE] = { type: "geojson", data: cityCollection([]) };
    style.sources[PIN_SOURCE] = { type: "geojson", data: pinCollection([], null) };
    style.layers.push(...darbLayers());
    // Throws GPUInitializationError when the device will not give a WebGL2 context.
    const map = new maplibre.Map({
      container: options.container,
      style,
      bounds: "bounds" in ISRAEL_NORTH ? ISRAEL_NORTH.bounds : undefined,
      fitBoundsOptions: { padding: PADDING },
      // Attribution is the stage's own always-visible line (no 24 px toggle under 44 px).
      attributionControl: false,
      // Pointer-only: keyboard users have the list (spec §8).
      keyboard: false,
      dragRotate: false,
      pitchWithRotate: false,
      touchPitch: false,
      maxPitch: 0,
    });
    const city = new CityMap(map, options.dir);
    try {
      await city.ready();
    } catch (error) {
      map.remove();
      throw error;
    }
    city.wire(options);
    return city;
  }

  /** The first idle frame; fails if the tiles cannot be read (a 404 archive, a bad URL). */
  private ready(): Promise<void> {
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error?: unknown) => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.map.off("error", onError);
        if (error) reject(error);
        else resolve();
      };
      const onError = (event: { error: Error }) => {
        if ((event as { sourceId?: string }).sourceId === PROTOMAPS_SOURCE) finish(event.error);
      };
      const timer = window.setTimeout(() => finish(new Error("The map took too long")), READY_TIMEOUT);
      this.map.on("error", onError);
      this.map.once("idle", () => finish());
    });
  }

  private wire(options: CityMapOptions): void {
    const canvas = this.map.getCanvas();
    canvas.setAttribute("role", "img");
    canvas.setAttribute("aria-label", options.label);
    canvas.setAttribute("tabindex", "-1");
    this.map.on("click", (event) => {
      const [top] = this.map.queryRenderedFeatures(event.point, { layers: PICKABLE });
      const href = top?.properties?.href;
      if (top && typeof href === "string")
        options.onPick(href, top.layer.id === PIN_LAYER ? "business" : "place");
    });
    this.map.on("mousemove", (event) => {
      const over = this.map.queryRenderedFeatures(event.point, { layers: PICKABLE }).length > 0;
      canvas.style.cursor = over ? "pointer" : "";
    });
    this.map.on("zoomend", (event) => {
      if (event.originalEvent && zoomedOut(this.target, this.map.getZoom())) options.onZoomOut();
    });
  }

  move(camera: Camera, duration: number, insetEnd: number): Promise<void> {
    const start = this.dir === "rtl" ? insetEnd : 0;
    const end = this.dir === "rtl" ? 0 : insetEnd;
    return new Promise((resolve) => {
      let settled = false;
      const done = () => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timer);
        this.map.off("moveend", done);
        this.target = this.map.getZoom();
        resolve();
      };
      const timer = window.setTimeout(done, duration + 250);
      this.map.on("moveend", done);
      if ("bounds" in camera) {
        // fitBounds adds the map's own padding to its own: reset it first.
        this.map.setPadding({ top: 0, bottom: 0, left: 0, right: 0 });
        this.map.fitBounds(camera.bounds, {
          padding: { top: PADDING, bottom: PADDING, left: PADDING + start, right: PADDING + end },
          maxZoom: camera.maxZoom,
          duration,
          easing: easeOut,
          essential: true,
        });
        return;
      }
      const padding = { top: 0, bottom: 0, left: start, right: end };
      if (duration > 0)
        this.map.flyTo({
          center: camera.center,
          zoom: camera.zoom,
          padding,
          duration,
          easing: easeOut,
          essential: true,
        });
      else this.map.jumpTo({ center: camera.center, zoom: camera.zoom, padding });
    });
  }

  setDots(dots: readonly CityDot[]): void {
    this.dots = dots;
    this.map.getSource<GeoJSONSource>(CITY_SOURCE)?.setData(cityCollection(dots));
  }

  setPins(pins: readonly StagePin[], activeHref: string | null): void {
    this.pins = pins;
    this.map.getSource<GeoJSONSource>(PIN_SOURCE)?.setData(pinCollection(pins, activeHref));
  }

  pointOf(id: string): [number, number] | null {
    const at = this.dots.find((d) => d.slug === id) ?? this.pins.find((p) => p.key === id);
    if (!at) return null;
    const point = this.map.project([at.lng, at.lat]);
    const box = this.map.getCanvas().getBoundingClientRect();
    return [box.left + point.x, box.top + point.y];
  }

  center(): [number, number] {
    const { lng, lat } = this.map.getCenter();
    return [lng, lat];
  }

  destroy(): void {
    this.map.remove();
  }
}
```

- [ ] **Step 6: Typecheck**

Run: `pnpm --filter @darb/stage build && pnpm --filter @darb/web typecheck`
Expected: clean. If `maplibre-gl`'s types reject a literal paint expression in `map-layers.ts`
(for example `"circle-radius"`), type that layer's `paint` value with `satisfies` against
`CircleLayerSpecification["paint"]` imported from `maplibre-gl`, and do not cast to `any`.

- [ ] **Step 7: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/stage/types.ts apps/web/src/stage/load-maplibre.ts apps/web/src/stage/map-style.ts \
  apps/web/src/stage/map-style.test.ts apps/web/src/stage/map-layers.ts apps/web/src/stage/map-layers.test.ts \
  apps/web/src/stage/city-map.ts
git commit -m "feat(web): city map on MapLibre with PMTiles, density glow and business pins"
```

---

### Task 13: The plaza view (`PlazaView`)

**Files:**
- Create: `apps/web/src/stage/PlazaView.tsx`, `apps/web/src/stage/plaza.module.css`
- Test: `apps/web/src/stage/PlazaView.test.tsx`

**Interfaces:**
- Consumes: `PlazaScene`, `Box`, `distance`, `isPinchOut` (Tasks 2–3); `DOOR_PATH`, `colors`
  (`@darb/tokens`); the global `#darb-gold-stroke` gradient (2A `DoorDefs`, in the root layout).
- Produces:
  `PlazaView({ scene, caption, label, countText(n), countLabel(n), parallax, onPinchOut }): JSX`. It
  renders `<nav aria-label={label} data-plaza>` holding a decorative SVG (gate, lit streets, doors,
  counts) and an `<ol dir="ltr">` of `next/link` doors positioned over the drawn ones, in list order,
  each with `data-plaza-door={slug}`, `data-count` and `data-empty` when the count is 0.

- [ ] **Step 1: Write the failing test**

Create `apps/web/src/stage/PlazaView.test.tsx`:

```tsx
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeAll, expect, it, vi } from "vitest";
import { buildPlaza } from "@darb/stage";
import { PlazaView } from "./PlazaView";

beforeAll(() => {
  // jsdom may lack PointerEvent; React reads pointerType and pointerId from the native event.
  if (!("PointerEvent" in window)) {
    class PointerEventPolyfill extends MouseEvent {
      pointerId: number;
      pointerType: string;
      constructor(type: string, init: PointerEventInit = {}) {
        super(type, init);
        this.pointerId = init.pointerId ?? 0;
        this.pointerType = init.pointerType ?? "";
      }
    }
    vi.stubGlobal("PointerEvent", PointerEventPolyfill);
  }
});

const doors = [
  { slug: "beauty", href: "/sakhnin/beauty", label: "יופי", count: 3, accent: "#d9aaa2" },
  { slug: "food", href: "/sakhnin/food", label: "אוכל", count: 0, accent: "#c9a36b" },
];
const scene = buildPlaza(doors, { width: 390, height: 780, dir: "rtl" });

const view = (onPinchOut = vi.fn()) =>
  render(
    <PlazaView
      scene={scene}
      caption="סח'נין"
      label="סח'נין: רחובות ודלתות"
      countText={String}
      countLabel={(n) => `עסקים: ${n}`}
      parallax={false}
      onPinchOut={onPinchOut}
    />,
  );

it("is a labelled navigation of real links, in the list's order", () => {
  view();
  const nav = screen.getByRole("navigation", { name: "סח'נין: רחובות ודלתות" });
  const links = within(nav).getAllByRole("link");
  expect(links.map((l) => l.getAttribute("href"))).toEqual(["/sakhnin/beauty", "/sakhnin/food"]);
  expect(links[0]!.textContent).toBe("יופיעסקים: 3");
  expect(links[1]!.hasAttribute("data-empty")).toBe(true);
});

it("places each link over its drawn door, in scene coordinates", () => {
  view();
  const item = screen.getAllByRole("link")[0]!.parentElement!;
  expect(item.parentElement!.getAttribute("dir")).toBe("ltr");
  expect(item.style.insetInlineStart).toBe(`${scene.doors[0]!.hit.x}px`);
  expect(item.style.insetBlockStart).toBe(`${scene.doors[0]!.hit.y}px`);
  expect(item.style.inlineSize).toBe(`${scene.doors[0]!.hit.w}px`);
});

it("draws the gate, the streets and the doors as decoration", () => {
  const { container } = view();
  const svg = container.querySelector("svg")!;
  expect(svg.getAttribute("aria-hidden")).toBe("true");
  expect(svg.querySelectorAll("[data-plaza-gate]")).toHaveLength(1);
  expect(svg.querySelectorAll("[data-plaza-street]")).toHaveLength(2);
  expect(svg.querySelectorAll("[data-plaza-frame]")).toHaveLength(2);
});

it("goes up a level when two fingers pinch together", () => {
  const onPinchOut = vi.fn();
  view(onPinchOut);
  const nav = screen.getByRole("navigation");
  fireEvent.pointerDown(nav, { pointerId: 1, pointerType: "touch", clientX: 100, clientY: 400 });
  fireEvent.pointerDown(nav, { pointerId: 2, pointerType: "touch", clientX: 300, clientY: 400 });
  fireEvent.pointerMove(nav, { pointerId: 2, pointerType: "touch", clientX: 200, clientY: 400 });
  expect(onPinchOut).toHaveBeenCalledTimes(1);
  fireEvent.pointerMove(nav, { pointerId: 2, pointerType: "touch", clientX: 150, clientY: 400 });
  expect(onPinchOut).toHaveBeenCalledTimes(1);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/web exec vitest run src/stage/PlazaView.test.tsx`
Expected: FAIL, `Cannot find module './PlazaView'`.

- [ ] **Step 3: Implement**

Create `apps/web/src/stage/plaza.module.css`:

```css
.plaza {
  position: absolute;
  inset: 0;
  overflow-x: hidden;
  overflow-y: auto;
  overscroll-behavior: contain;
  touch-action: pan-y;
  background:
    radial-gradient(90% 55% at 50% 12%, rgb(217 165 76 / 0.12) 0%, transparent 60%),
    linear-gradient(180deg, var(--night) 0%, var(--forest-950) 100%);
}

.caption {
  position: absolute;
  inset-block-start: var(--space-4);
  inset-inline: var(--gutter);
  z-index: 1;
  margin: 0;
  color: var(--text-soft);
  font-weight: 700;
  text-align: center;
}

.canvas {
  position: relative;
  inline-size: 100%;
}

.scenery {
  position: absolute;
  inset-block-start: 0;
  inset-inline-start: 0;
  display: block;
  overflow: visible;
}

/* Parallax: --px (-1…1) follows the pointer; nearer rows (--parallax 1) move most. */
.row,
.item {
  transform: translateX(calc(var(--px, 0) * var(--parallax, 0) * 12px));
  transition: transform var(--dur) var(--ease-out);
}

.links {
  position: absolute;
  inset: 0;
  margin: 0;
  padding: 0;
  list-style: none;
}

.item {
  position: absolute;
}

.door {
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  align-items: center;
  inline-size: 100%;
  block-size: 100%;
  padding-block-end: 2px;
  border-radius: var(--radius-s);
  color: var(--text);
  text-decoration: none;
}

.label {
  display: -webkit-box;
  max-inline-size: 100%;
  overflow: hidden;
  -webkit-box-orient: vertical;
  -webkit-line-clamp: 2;
  font-size: 0.8125rem;
  font-weight: 700;
  line-height: 1.25;
  text-align: center;
}

.door:hover .label,
.door:focus-visible .label {
  color: var(--gold-300);
}

.door[data-empty] .label {
  color: var(--text-muted);
}
```

Create `apps/web/src/stage/PlazaView.tsx`:

```tsx
"use client";

import Link from "next/link";
import { useRef, type CSSProperties, type PointerEvent } from "react";
import { DOOR_PATH } from "@darb/tokens";
import { distance, isPinchOut, type Box, type PlazaScene } from "@darb/stage";
import styles from "./plaza.module.css";

export interface PlazaViewProps {
  scene: PlazaScene;
  /** Shown above the gate: the place (and sector). */
  caption: string;
  /** The navigation's accessible name. */
  label: string;
  countText: (count: number) => string;
  /** "Businesses: 3", for screen readers. */
  countLabel: (count: number) => string;
  /** Follow a fine pointer (desktop, motion allowed). */
  parallax: boolean;
  onPinchOut: () => void;
}

/** DOOR_PATH is drawn in a 100 × 150 box. */
const doorTransform = (b: Box) => `translate(${b.x} ${b.y}) scale(${b.w / 100} ${b.h / 150})`;
const vars = (values: Record<string, string | number>) => values as CSSProperties;

/**
 * The 2.5D plaza (spec §3.1): SVG scenery under real links. The links carry the list doors' hrefs,
 * in the list's order, and follow the list in the DOM, so Tab reaches the list first.
 */
export function PlazaView({
  scene,
  caption,
  label,
  countText,
  countLabel,
  parallax,
  onPinchOut,
}: PlazaViewProps) {
  const root = useRef<HTMLElement>(null);
  const touches = useRef(new Map<number, [number, number]>());
  const pinchStart = useRef<number | null>(null);

  const pair = (): number | null => {
    const points = [...touches.current.values()];
    return points.length === 2 ? distance(points[0]!, points[1]!) : null;
  };

  function onPointerDown(event: PointerEvent<HTMLElement>) {
    if (event.pointerType !== "touch") return;
    touches.current.set(event.pointerId, [event.clientX, event.clientY]);
    pinchStart.current = pair();
  }

  function onPointerMove(event: PointerEvent<HTMLElement>) {
    if (event.pointerType === "touch") {
      if (!touches.current.has(event.pointerId)) return;
      touches.current.set(event.pointerId, [event.clientX, event.clientY]);
      const now = pair();
      if (pinchStart.current !== null && now !== null && isPinchOut(pinchStart.current, now)) {
        pinchStart.current = null;
        onPinchOut();
      }
      return;
    }
    if (!parallax || !root.current) return;
    const box = root.current.getBoundingClientRect();
    const px = ((event.clientX - box.left) / box.width) * 2 - 1;
    root.current.style.setProperty("--px", px.toFixed(3));
  }

  function onPointerEnd(event: PointerEvent<HTMLElement>) {
    touches.current.delete(event.pointerId);
    if (touches.current.size < 2) pinchStart.current = null;
  }

  const gateCenter = scene.gate.x + scene.gate.w / 2;
  return (
    <nav
      ref={root}
      aria-label={label}
      className={styles.plaza}
      data-plaza=""
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerEnd}
      onPointerCancel={onPointerEnd}
      onPointerLeave={() => root.current?.style.setProperty("--px", "0")}
    >
      <p className={styles.caption} aria-hidden="true">
        {caption}
      </p>
      <div className={styles.canvas} style={{ blockSize: scene.height }}>
        <svg
          className={styles.scenery}
          width={scene.width}
          height={scene.height}
          viewBox={`0 0 ${scene.width} ${scene.height}`}
          aria-hidden="true"
          focusable="false"
        >
          <defs>
            <radialGradient id="plaza-gate-glow">
              <stop offset="0" stopColor="var(--gold)" stopOpacity="0.45" />
              <stop offset="1" stopColor="var(--gold)" stopOpacity="0" />
            </radialGradient>
            <linearGradient id="plaza-door-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="var(--forest-800)" />
              <stop offset="0.7" stopColor="var(--forest-950)" />
              <stop offset="1" stopColor="var(--night)" />
            </linearGradient>
          </defs>
          <g className={styles.row} style={vars({ "--parallax": 0.2 })}>
            <ellipse
              cx={gateCenter}
              cy={scene.gate.y + scene.gate.h * 0.6}
              rx={scene.gate.w * 1.6}
              ry={scene.gate.h * 0.9}
              fill="url(#plaza-gate-glow)"
            />
            {scene.streets.map((street) => {
              const lit = scene.doors[street.door]?.lit ?? false;
              return (
                <line
                  key={street.door}
                  data-plaza-street=""
                  x1={street.from[0]}
                  y1={street.from[1]}
                  x2={street.to[0]}
                  y2={street.to[1]}
                  stroke={street.color}
                  strokeWidth={street.width}
                  strokeOpacity={lit ? 0.55 : 0.18}
                  strokeLinecap="round"
                />
              );
            })}
            <path
              data-plaza-gate=""
              d={DOOR_PATH}
              transform={doorTransform(scene.gate)}
              fill="url(#plaza-door-fill)"
              stroke="url(#darb-gold-stroke)"
              strokeWidth={2}
              vectorEffect="non-scaling-stroke"
            />
          </g>
          {scene.rows.map((row) => (
            <g key={row.index} className={styles.row} style={vars({ "--parallax": row.parallax })}>
              {row.doors.map((i) => {
                const door = scene.doors[i]!;
                const cx = door.frame.x + door.frame.w / 2;
                return (
                  <g key={door.slug} opacity={door.lit ? 1 : 0.55}>
                    <ellipse
                      cx={cx}
                      cy={door.frame.y + door.frame.h}
                      rx={door.frame.w * 0.7}
                      ry={door.frame.w * 0.22}
                      fill={door.accent}
                      opacity={door.lit ? 0.35 : 0.08}
                    />
                    <path
                      data-plaza-frame=""
                      d={DOOR_PATH}
                      transform={doorTransform(door.frame)}
                      fill="url(#plaza-door-fill)"
                      stroke="url(#darb-gold-stroke)"
                      strokeWidth={1.25}
                      vectorEffect="non-scaling-stroke"
                    />
                    <text
                      x={cx}
                      y={door.frame.y + door.frame.h * 0.66}
                      textAnchor="middle"
                      fontSize={Math.max(12, Math.round(door.frame.w * 0.26))}
                      fontWeight={700}
                      style={{ fill: door.lit ? "var(--gold-300)" : "var(--text-muted)" }}
                    >
                      {countText(door.count)}
                    </text>
                  </g>
                );
              })}
            </g>
          ))}
        </svg>
        <ol className={styles.links} dir="ltr">
          {scene.doors.map((door) => (
            <li
              key={door.slug}
              className={styles.item}
              style={vars({
                insetInlineStart: `${door.hit.x}px`,
                insetBlockStart: `${door.hit.y}px`,
                inlineSize: `${door.hit.w}px`,
                blockSize: `${door.hit.h}px`,
                "--parallax": scene.rows[door.row]?.parallax ?? 1,
              })}
            >
              <Link
                href={door.href}
                prefetch={false}
                className={styles.door}
                data-plaza-door={door.slug}
                data-count={door.count}
                data-empty={door.count === 0 ? "" : undefined}
              >
                <span className={styles.label} dir={scene.dir}>
                  {door.label}
                </span>
                <span className="visually-hidden">{countLabel(door.count)}</span>
              </Link>
            </li>
          ))}
        </ol>
      </div>
    </nav>
  );
}
```

- [ ] **Step 4: Run it to verify it passes**

Run: `pnpm --filter @darb/web exec vitest run src/stage/PlazaView.test.tsx src/lib/styles.test.ts`
Expected: PASS (4 tests, plus the style guard on `plaza.module.css`).

- [ ] **Step 5: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/stage/PlazaView.tsx apps/web/src/stage/plaza.module.css apps/web/src/stage/PlazaView.test.tsx
git commit -m "feat(web): SVG plaza with the Darb gate, lit streets and gold door links"
```

---

### Task 14: The stage: the Director and its camera moves

**Files:**
- Create: `apps/web/src/stage/fade.ts`, test `fade.test.ts`
- Create: `apps/web/src/stage/director.ts`, test `director.test.ts`
- Create: `apps/web/src/stage/Stage.tsx`, `apps/web/src/stage/stage.module.css`

**Interfaces:**
- Consumes: `StageMap`, `StageProps` (Task 12); `CityMap` (Task 12); `PlazaView` (Task 13);
  `planTransition`, `viewFor`, `buildPlaza` (Tasks 2–3); `stageStore` (Task 10); `useMedia`,
  `DESKTOP`, `REDUCED_MOTION` (Task 11); `motion.easeOut` (`@darb/tokens`).
- Produces: `Frame { opacity; scale }`, `fadeLayer(el, from: Frame, to: Frame, duration, easing): Promise<void>`
  (Web Animations, opacity and transform only), `nextFrame(): Promise<void>`.
- Produces: `class Director(deps: DirectorDeps)` with `attachMap(map: StageMap)`,
  `setDots(dots)`, `get depth(): number | null`, and `show(level: StageLevel, path: string): Promise<void>`.
  `DirectorDeps { host; layers: Record<StageView, HTMLElement>; showPlaza(level: PlazaLevel): void; fade; frame(): Promise<void>; reducedMotion(): boolean; insetEnd(level): number }`.
- Produces: `Stage(props: StageProps)` (default client component of the lazy chunk) and
  `STAGE_CHUNK_MARKER = "darb:stage-chunk"`. The host is `[data-stage-host]`, with the attributes
  `data-stage-state` (`loading`|`ready`), `data-stage-level`, `data-stage-view`, `data-stage-path`
  (set when a move settles), `data-stage-moving` (while moving), `data-stage-motion` (`fly`|`jump`),
  `data-stage-fade` (ms), `data-stage-place` and `data-stage-active-pin`. The layers are
  `[data-stage-layer="map"|"plaza"]`, the active one carries `data-active`, and the others are `inert`
  and `aria-hidden`. The phone pill is `[data-stage-toggle]`, and an open phone stage sets
  `html[data-stage-open]`. With `window.__DARB_E2E__` set, it exposes
  `window.darbStage = { pointOf(id), center() }`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/stage/fade.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import { fadeLayer } from "./fade";

describe("fadeLayer", () => {
  it("animates only opacity and transform, holding the last frame", async () => {
    const animate = vi.fn(() => ({ finished: Promise.resolve() }));
    const el = { animate } as unknown as HTMLElement;
    await fadeLayer(el, { opacity: 0, scale: 0.94 }, { opacity: 1, scale: 1 }, 550, "ease");
    expect(animate).toHaveBeenCalledWith(
      [
        { opacity: 0, transform: "scale(0.94)" },
        { opacity: 1, transform: "none" },
      ],
      { duration: 550, easing: "ease", fill: "forwards" },
    );
  });
  it("does nothing for a zero duration or without the Web Animations API", async () => {
    const animate = vi.fn();
    await fadeLayer({ animate } as unknown as HTMLElement, { opacity: 0, scale: 1 }, { opacity: 1, scale: 1 }, 0, "ease");
    expect(animate).not.toHaveBeenCalled();
    await expect(
      fadeLayer({} as HTMLElement, { opacity: 0, scale: 1 }, { opacity: 1, scale: 1 }, 400, "ease"),
    ).resolves.toBeUndefined();
  });
  it("settles even when the animation is cancelled", async () => {
    const el = { animate: () => ({ finished: Promise.reject(new Error("AbortError")) }) };
    await expect(
      fadeLayer(el as unknown as HTMLElement, { opacity: 1, scale: 1 }, { opacity: 0, scale: 1 }, 400, "ease"),
    ).resolves.toBeUndefined();
  });
});
```

Create `apps/web/src/stage/director.test.ts`:

```ts
import { describe, expect, it, vi } from "vitest";
import type { PlazaLevel, StageLevel } from "@darb/stage";
import { Director, type DirectorDeps } from "./director";
import type { Frame } from "./fade";
import type { StageMap } from "./types";

const sakhnin = { slug: "sakhnin", name: "Sakhnin", lat: 32.8638, lng: 35.3023 };
const door = (slug: string) => ({ slug, href: `/sakhnin/${slug}`, label: slug, count: 1, accent: "#d9aaa2" });
const place: StageLevel = { depth: 1, place: sakhnin, doors: [door("beauty")] };
const sector: StageLevel = {
  depth: 2,
  place: sakhnin,
  sector: { slug: "beauty", name: "Beauty", accent: "#d9aaa2" },
  doors: [door("barbershops")],
};
const pin = { key: "sakhnin/a", href: "/sakhnin/beauty/barbershops/a", name: "A", lat: 32.86, lng: 35.3 };
const kind: StageLevel = { depth: 3, place: sakhnin, pins: [pin] };

function setup(options: { reduced?: boolean; gate?: Promise<void> } = {}) {
  const host = document.createElement("div");
  const layers = { map: document.createElement("div"), plaza: document.createElement("div") };
  const log: string[] = [];
  const fades: { layer: string; from: Frame; to: Frame; duration: number }[] = [];
  const map: StageMap = {
    move: vi.fn(async () => {}),
    setDots: vi.fn(),
    setPins: vi.fn(),
    pointOf: () => null,
    destroy: vi.fn(),
  };
  const deps: DirectorDeps = {
    host,
    layers,
    showPlaza: vi.fn((level: PlazaLevel) => {
      log.push(`plaza ${level.depth}`);
    }),
    fade: async (el, from, to, duration) => {
      const layer = el === layers.map ? "map" : "plaza";
      log.push(`fade ${layer} ${from.opacity}->${to.opacity}`);
      fades.push({ layer, from, to, duration });
      await options.gate;
    },
    frame: async () => {},
    reducedMotion: () => options.reduced ?? false,
    insetEnd: (level) => (level.depth === 3 ? 480 : 0),
  };
  const director = new Director(deps);
  director.attachMap(map);
  return { host, layers, map, deps, director, log, fades };
}

describe("Director", () => {
  it("starts with both layers hidden from people and assistive tech", () => {
    const { layers } = setup();
    for (const el of Object.values(layers)) {
      expect(el.hasAttribute("inert")).toBe(true);
      expect(el.getAttribute("aria-hidden")).toBe("true");
    }
  });

  it("shows a place's plaza without flying the first time", async () => {
    const { host, layers, map, deps, director, fades } = setup();
    await director.show(place, "/sakhnin");
    expect(map.move).toHaveBeenCalledWith({ center: [35.3023, 32.8638], zoom: 13.5 }, 0, 0);
    expect(deps.showPlaza).toHaveBeenCalledWith(place);
    expect(layers.plaza.hasAttribute("data-active")).toBe(true);
    expect(layers.plaza.hasAttribute("inert")).toBe(false);
    expect(layers.map.hasAttribute("inert")).toBe(true);
    expect(fades).toEqual([
      { layer: "plaza", from: { opacity: 0, scale: 1 }, to: { opacity: 1, scale: 1 }, duration: 550 },
    ]);
    expect({ ...host.dataset }).toEqual({
      stageLevel: "1",
      stageView: "plaza",
      stageMotion: "jump",
      stageFade: "550",
      stagePlace: "sakhnin",
      stagePath: "/sakhnin",
    });
  });

  it("zooms through the plaza into a sector, swapping scenes in the dark", async () => {
    const { map, director, log, fades } = setup();
    await director.show(place, "/sakhnin");
    log.length = 0;
    fades.length = 0;
    await director.show(sector, "/sakhnin/beauty");
    expect(map.move).toHaveBeenLastCalledWith({ center: [35.3023, 32.8638], zoom: 13.5 }, 550, 0);
    expect(log).toEqual(["fade plaza 1->0", "plaza 2", "fade plaza 0->1"]);
    expect(fades.map((f) => [f.to.scale, f.from.scale, f.duration])).toEqual([
      [1.08, 1, 275],
      [1, 0.94, 275],
    ]);
  });

  it("crossfades into the street map with pins, beside the desktop sheet", async () => {
    const { host, layers, map, director, fades } = setup();
    await director.show(sector, "/sakhnin/beauty");
    fades.length = 0;
    await director.show(kind, pin.href);
    expect(map.setPins).toHaveBeenLastCalledWith([pin], pin.href);
    expect(map.move).toHaveBeenLastCalledWith({ center: [35.3023, 32.8638], zoom: 14 }, 550, 480);
    expect(layers.map.hasAttribute("data-active")).toBe(true);
    expect(layers.plaza.hasAttribute("inert")).toBe(true);
    expect(fades.map((f) => `${f.layer} ${f.from.opacity}->${f.to.opacity}`).sort()).toEqual([
      "map 0->1",
      "plaza 1->0",
    ]);
    expect(host.dataset.stageActivePin).toBe("sakhnin/a");
    expect(host.dataset.stageView).toBe("map");
  });

  it("never flies with reduced motion: a 400 ms fade without scaling", async () => {
    const { map, director, fades } = setup({ reduced: true });
    await director.show({ depth: 0 }, "/");
    fades.length = 0;
    await director.show(place, "/sakhnin");
    expect(map.move).toHaveBeenLastCalledWith({ center: [35.3023, 32.8638], zoom: 13.5 }, 0, 0);
    for (const f of fades) {
      expect(f.duration).toBe(400);
      expect([f.from.scale, f.to.scale]).toEqual([1, 1]);
    }
  });

  it("ends where the last URL ends when a move is overtaken", async () => {
    let open: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      open = resolve;
    });
    const { host, director } = setup({ gate });
    const first = director.show(place, "/sakhnin");
    const second = director.show({ depth: 0 }, "/");
    expect(host.dataset.stageMoving).toBe("");
    open();
    await Promise.all([first, second]);
    expect(host.dataset.stagePath).toBe("/");
    expect(host.dataset.stageLevel).toBe("0");
    expect(host.dataset.stageMoving).toBeUndefined();
  });

  it("shows the plaza even before the map is ready", async () => {
    const { deps } = setup();
    const director = new Director(deps);
    await director.show(place, "/sakhnin");
    expect(deps.showPlaza).toHaveBeenCalledWith(place);
    expect(director.depth).toBe(1);
  });
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/stage/fade.test.ts src/stage/director.test.ts`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement the fade and the Director**

Create `apps/web/src/stage/fade.ts`:

```ts
export interface Frame {
  opacity: number;
  scale: number;
}

const keyframe = ({ opacity, scale }: Frame): Keyframe => ({
  opacity,
  transform: scale === 1 ? "none" : `scale(${scale})`,
});

/**
 * Fades and scales a layer with the Web Animations API (only opacity and transform, spec §3.5).
 * Holds the last frame until the Director cancels it, then the layer's CSS state takes over.
 */
export function fadeLayer(
  el: HTMLElement,
  from: Frame,
  to: Frame,
  duration: number,
  easing: string,
): Promise<void> {
  if (duration <= 0 || typeof el.animate !== "function") return Promise.resolve();
  return el
    .animate([keyframe(from), keyframe(to)], { duration, easing, fill: "forwards" })
    .finished.then(
      () => undefined,
      () => undefined,
    );
}

export const nextFrame = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => resolve()));
```

Create `apps/web/src/stage/director.ts`:

```ts
import { motion } from "@darb/tokens";
import {
  planTransition,
  viewFor,
  type CityDot,
  type PlazaLevel,
  type StageLevel,
  type StageView,
} from "@darb/stage";
import type { Frame } from "./fade";
import type { StageMap } from "./types";

export interface DirectorDeps {
  /** Carries the data-stage-* state that e2e and CSS read. */
  host: HTMLElement;
  layers: Record<StageView, HTMLElement>;
  /** Renders a plaza scene (React state in Stage). */
  showPlaza: (level: PlazaLevel) => void;
  fade: (el: HTMLElement, from: Frame, to: Frame, duration: number, easing: string) => Promise<void>;
  /** Resolves after the next paint, so a newly rendered plaza can fade in. */
  frame: () => Promise<void>;
  reducedMotion: () => boolean;
  /** Px of the map hidden under the desktop sheet for this level. */
  insetEnd: (level: StageLevel) => number;
}

const SHOWN: Frame = { opacity: 1, scale: 1 };

function mark(host: HTMLElement, values: Record<string, string | null>): void {
  for (const [key, value] of Object.entries(values)) {
    if (value === null) delete host.dataset[key];
    else host.dataset[key] = value;
  }
}

/** The active layer takes pointer and focus; the other is inert and hidden from assistive tech. */
function activate(layers: Record<StageView, HTMLElement>, view: StageView | null): void {
  for (const [name, el] of Object.entries(layers)) {
    const on = name === view;
    el.toggleAttribute("data-active", on);
    el.toggleAttribute("inert", !on);
    if (on) el.removeAttribute("aria-hidden");
    else el.setAttribute("aria-hidden", "true");
  }
}

/**
 * Turns each level change into a camera move (spec §3.5): the map flies on the Darb ease-out while
 * the layers crossfade, or a plaza zooms through to the next. The content is already on screen
 * (the list renders first), so motion never blocks reading. One move at a time: a newer move
 * overtakes the running one, and only the last URL settles.
 */
export class Director {
  private shown: StageLevel | null = null;
  private run = 0;
  private map: StageMap | null = null;
  private dots: readonly CityDot[] = [];

  constructor(private readonly deps: DirectorDeps) {
    activate(deps.layers, null);
  }

  attachMap(map: StageMap): void {
    this.map = map;
    map.setDots(this.dots);
  }

  setDots(dots: readonly CityDot[]): void {
    this.dots = dots;
    this.map?.setDots(dots);
  }

  get depth(): number | null {
    return this.shown ? this.shown.depth : null;
  }

  async show(level: StageLevel, path: string): Promise<void> {
    const run = ++this.run;
    const { host, layers, fade, frame } = this.deps;
    const plan = planTransition(this.shown, level, this.dots, {
      reducedMotion: this.deps.reducedMotion(),
    });
    const fromView = this.shown ? viewFor(this.shown) : null;
    this.shown = level;
    mark(host, {
      stageMoving: "",
      stageLevel: String(level.depth),
      stageView: plan.view,
      stageMotion: plan.motion,
      stageFade: String(plan.fade?.duration ?? 0),
      stagePlace: level.depth === 0 ? null : level.place.slug,
      stageActivePin:
        level.depth === 3 ? (level.pins.find((p) => p.href === path)?.key ?? null) : null,
    });
    this.map?.setPins(level.depth === 3 ? level.pins : [], path);
    const camera = this.map
      ? this.map.move(plan.camera, plan.duration, this.deps.insetEnd(level))
      : Promise.resolve();
    const easing = motion.easeOut;
    const fadeIn: Frame = plan.fade ? { opacity: 0, scale: plan.fade.inScale } : SHOWN;
    const fadeOut: Frame = plan.fade ? { opacity: 0, scale: plan.fade.outScale } : SHOWN;
    let fading: Promise<unknown> = Promise.resolve();

    if (plan.fade?.kind === "through") {
      const half = plan.fade.duration / 2;
      fading = (async () => {
        await fade(layers.plaza, SHOWN, fadeOut, half, easing);
        if (run !== this.run) return;
        this.deps.showPlaza(level as PlazaLevel);
        await frame();
        await fade(layers.plaza, fadeIn, SHOWN, half, easing);
      })();
    } else {
      if (plan.view === "plaza") {
        this.deps.showPlaza(level as PlazaLevel);
        await frame();
        if (run !== this.run) return;
      }
      activate(layers, plan.view);
      if (plan.fade) {
        const outgoing = fromView && fromView !== plan.view ? layers[fromView] : null;
        fading = Promise.all([
          fade(layers[plan.view], fadeIn, SHOWN, plan.fade.duration, easing),
          outgoing ? fade(outgoing, SHOWN, fadeOut, plan.fade.duration, easing) : null,
        ]);
      }
    }

    await Promise.all([camera, fading]);
    if (run !== this.run) return;
    for (const el of Object.values(layers))
      for (const animation of el.getAnimations?.() ?? []) animation.cancel();
    mark(host, { stageMoving: null, stagePath: path });
  }
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/stage/fade.test.ts src/stage/director.test.ts`
Expected: PASS (3 + 7 tests).

- [ ] **Step 5: Implement the Stage component**

Create `apps/web/src/stage/stage.module.css`:

```css
.host {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.layer {
  position: absolute;
  inset: 0;
  opacity: 0;
  pointer-events: none;
}

.layer[data-active] {
  opacity: 1;
  pointer-events: auto;
}

.map {
  position: absolute;
  inset: 0;
}

.attribution {
  position: absolute;
  inset-block-end: var(--space-2);
  inset-inline-end: var(--space-3);
  margin: 0;
  padding: 2px var(--space-2);
  border-radius: var(--radius-s);
  background: rgb(3 17 12 / 0.75);
  color: var(--text-muted);
  font-size: 0.75rem;
  line-height: 1.5;
}

.attribution a {
  color: var(--text-soft);
}

/* Phone only: Map ⇄ List, centred above the docked search bar. */
.toggle {
  position: fixed;
  inset-block-end: calc(88px + env(safe-area-inset-bottom));
  inset-inline: 0;
  z-index: 35;
  inline-size: max-content;
  min-block-size: var(--tap);
  margin-inline: auto;
  padding-inline: var(--space-5);
  border: 1px solid var(--line);
  border-radius: var(--radius-pill);
  background: var(--surface-2);
  box-shadow: var(--shadow-panel);
  color: var(--gold-300);
  font: inherit;
  font-weight: 700;
  cursor: pointer;
}

@media (min-width: 900px) {
  .toggle {
    display: none;
  }
}
```

Create `apps/web/src/stage/Stage.tsx`:

```tsx
"use client";

import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";
import { dir } from "@darb/i18n";
import { buildPlaza, type CityDot, type PlazaLevel, type StageLevel } from "@darb/stage";
import { INTL_TAG } from "@/lib/locale";
import { stageStore } from "@/lib/stage-store";
import { DESKTOP, REDUCED_MOTION, useMedia } from "@/lib/use-media";
import { CityMap } from "./city-map";
import { Director } from "./director";
import { fadeLayer, nextFrame } from "./fade";
import { PlazaView } from "./PlazaView";
import type { StageProps } from "./types";
import styles from "./stage.module.css";

/** check-budget.mjs finds this string in an async chunk and in no first-load chunk. */
export const STAGE_CHUNK_MARKER = "darb:stage-chunk";
const COUNTRY: StageLevel = { depth: 0 };
/** The desktop sheet's width (Sheet.module.css): the map keeps its subject beside it. */
const SHEET_INSET = 480;

const fill = (template: string, name: string, value: string) => template.replace(`{${name}}`, value);

async function loadDots(locale: string): Promise<CityDot[]> {
  try {
    const res = await fetch(`/api/city?locale=${locale}`);
    return res.ok ? ((await res.json()) as { dots: CityDot[] }).dots : [];
  } catch {
    return [];
  }
}

/** The path bar's "up one level" link: where Back-like gestures go. */
const upHref = () =>
  document.querySelector<HTMLAnchorElement>("[data-path-bar] [data-up]")?.getAttribute("href") ??
  null;

/**
 * The Zoomable City (spec §3.1): the map at levels 0 and 3–4, the plaza at 1–2, moved by the
 * Director on every level change. Desktop: beside the list. Phone: behind a Map/List pill at levels
 * 0–2. Loaded lazily by StageMount; any failure hands the city back to the list (spec §7).
 */
export function Stage({ locale, labels, onFail }: StageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const desktop = useMedia(DESKTOP);
  const reduced = useMedia(REDUCED_MOTION);
  const level = useSyncExternalStore(stageStore.subscribe, stageStore.get, () => null) ?? COUNTRY;
  const [open, setOpen] = useState(false);
  const [ready, setReady] = useState(false);
  const [plaza, setPlaza] = useState<PlazaLevel | null>(null);
  const [size, setSize] = useState<{ width: number; height: number } | null>(null);
  const host = useRef<HTMLDivElement>(null);
  const mapLayer = useRef<HTMLDivElement>(null);
  const mapBox = useRef<HTMLDivElement>(null);
  const plazaLayer = useRef<HTMLDivElement>(null);
  const director = useRef<Director | null>(null);
  const city = useRef<CityMap | null>(null);
  const started = useRef(false);
  const alive = useRef(true);
  const reducedNow = useRef(reduced);
  const desktopNow = useRef(desktop);
  const textDir = dir(locale);
  const showToggle = !desktop && level.depth <= 2;
  const visible = desktop || (open && showToggle);

  useEffect(() => {
    reducedNow.current = reduced;
    desktopNow.current = desktop;
  });

  const goUp = useCallback(() => {
    const up = upHref();
    if (up) router.push(up);
  }, [router]);

  // The Director, once the layers exist; the map is torn down with the stage.
  useEffect(() => {
    if (!host.current || !mapLayer.current || !plazaLayer.current) return;
    director.current = new Director({
      host: host.current,
      layers: { map: mapLayer.current, plaza: plazaLayer.current },
      showPlaza: setPlaza,
      fade: fadeLayer,
      frame: nextFrame,
      reducedMotion: () => reducedNow.current,
      insetEnd: (l) => (desktopNow.current && l.depth === 3 ? SHEET_INSET : 0),
    });
    alive.current = true;
    return () => {
      alive.current = false;
      director.current = null;
      city.current?.destroy();
      city.current = null;
    };
  }, []);

  // The plaza is laid out for the stage's size.
  useEffect(() => {
    const el = host.current;
    if (!el || typeof ResizeObserver !== "function") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry)
        setSize({
          width: Math.round(entry.contentRect.width),
          height: Math.round(entry.contentRect.height),
        });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Phone: the open stage covers the city, which stops taking focus until "List". Declared before
  // the map effect so the stage is displayed (has a size) when the map is created.
  useEffect(() => {
    if (desktop || !visible) return;
    const root = document.documentElement;
    const behind = [document.querySelector("[data-city]"), document.getElementById("site-header")]
      .filter((el): el is HTMLElement => el !== null);
    root.setAttribute("data-stage-open", "");
    for (const el of behind) el.setAttribute("inert", "");
    return () => {
      root.removeAttribute("data-stage-open");
      for (const el of behind) el.removeAttribute("inert");
    };
  }, [desktop, visible]);

  // The map and the live places, the first time the stage is visible.
  useEffect(() => {
    if (!visible || started.current || !mapBox.current) return;
    started.current = true;
    Promise.all([
      CityMap.create({
        container: mapBox.current,
        locale,
        dir: textDir,
        label: labels.map,
        onPick: (href, kind) => router.push(href, { scroll: kind === "place" }),
        onZoomOut: () => {
          if (director.current?.depth === 3) goUp();
        },
      }),
      loadDots(locale),
    ]).then(
      ([map, dots]) => {
        if (!alive.current) {
          map.destroy();
          return;
        }
        city.current = map;
        director.current?.setDots(dots);
        director.current?.attachMap(map);
        setReady(true);
      },
      () => {
        if (alive.current) onFail();
      },
    );
  }, [visible, locale, textDir, labels.map, router, goUp, onFail]);

  // Every level change is a camera move.
  useEffect(() => {
    if (!visible || !ready) return;
    void director.current?.show(level, pathname);
  }, [visible, ready, level, pathname]);

  // e2e only: where a place or business is on screen, and where the map looks.
  useEffect(() => {
    if (!ready || !("__DARB_E2E__" in window)) return;
    Object.assign(window, {
      darbStage: {
        pointOf: (id: string) => city.current?.pointOf(id) ?? null,
        center: () => city.current?.center() ?? null,
      },
    });
  }, [ready]);

  const scene = useMemo(
    () => (plaza && size ? buildPlaza(plaza.doors, { ...size, dir: textDir }) : null),
    [plaza, size, textDir],
  );
  const numbers = useMemo(() => new Intl.NumberFormat(INTL_TAG[locale]), [locale]);
  const caption = plaza
    ? plaza.depth === 2
      ? `${plaza.sector.name} · ${plaza.place.name}`
      : plaza.place.name
    : "";

  return (
    <>
      <div
        ref={host}
        className={styles.host}
        data-stage-host=""
        data-stage-state={ready ? "ready" : "loading"}
        data-stage-chunk={STAGE_CHUNK_MARKER}
      >
        <div ref={mapLayer} className={styles.layer} data-stage-layer="map">
          <div ref={mapBox} className={styles.map} />
          <p className={styles.attribution} data-stage-attribution="">
            {labels.mapData}:{" "}
            <bdi>
              <a href="https://www.openstreetmap.org/copyright" rel="noreferrer">
                © OpenStreetMap
              </a>{" "}
              ·{" "}
              <a href="https://protomaps.com" rel="noreferrer">
                Protomaps
              </a>
            </bdi>
          </p>
        </div>
        <div ref={plazaLayer} className={styles.layer} data-stage-layer="plaza">
          {scene && plaza ? (
            <PlazaView
              scene={scene}
              caption={caption}
              label={fill(labels.plaza, "place", caption)}
              countText={(n) => numbers.format(n)}
              countLabel={(n) => fill(labels.businessCount, "count", numbers.format(n))}
              parallax={desktop && !reduced}
              onPinchOut={goUp}
            />
          ) : null}
        </div>
      </div>
      {showToggle
        ? createPortal(
            <button
              type="button"
              className={styles.toggle}
              data-stage-toggle=""
              onClick={() => setOpen((v) => !v)}
            >
              {open ? labels.showList : labels.showMap}
            </button>,
            document.body,
          )
        : null}
    </>
  );
}
```

- [ ] **Step 6: Typecheck, lint and run the unit suite**

Run: `pnpm --filter @darb/web typecheck && pnpm lint && pnpm --filter @darb/web test`
Expected: clean, all PASS. `react-hooks` must report nothing. The Director is an imperative class
called from effects, and every `setState` happens in callbacks, never synchronously in an effect
body. If the linter flags a synchronous `setState` in an effect, move that call into the callback
it belongs to rather than disabling the rule.

- [ ] **Step 7: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/stage/fade.ts apps/web/src/stage/fade.test.ts apps/web/src/stage/director.ts \
  apps/web/src/stage/director.test.ts apps/web/src/stage/Stage.tsx apps/web/src/stage/stage.module.css
git commit -m "feat(web): stage director: camera flights, crossfades and plaza zooms"
```

---

### Task 15: Boot, mount and the desktop split layout

**Files:**
- Create: `apps/web/src/lib/stage-boot.ts`, test `stage-boot.test.ts`
- Create: `apps/web/src/components/StageMount.tsx`, `StageMount.module.css`, test `StageMount.test.tsx`
- Modify: `apps/web/src/app/[locale]/layout.tsx`, `apps/web/src/app/globals.css`,
  `apps/web/src/components/Header.module.css`, `apps/web/scripts/shoot.mjs`

**Interfaces:**
- Consumes: `Stage`, `StageProps`, `StageLabels` (Tasks 12, 14).
- Produces: `STAGE_EXCLUDED: RegExp`, `stageAllowed(pathname: string): boolean`,
  `stageBootScript(): string` (inline `<head>` script that sets `html[data-stage-capable]` and
  `html[data-stage="on"|"off"]` before the first paint).
- Produces: `StageMount({ locale, labels })`, rendered once in the root layout after the city. It
  holds `<div id="stage" data-stage-root>` and loads `Stage` with `next/dynamic` (`ssr: false`) after
  `load` and idle time. It keeps `html[data-stage]` in step with the path, and sets it to `off` for
  the rest of the visit when the stage fails.
- The root layout wraps `{children}` in `<div className="city" data-city>`.

- [ ] **Step 1: Write the failing tests**

Create `apps/web/src/lib/stage-boot.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stageAllowed, stageBootScript } from "./stage-boot";

const html = document.documentElement;
const boot = () => new Function(stageBootScript())();

beforeEach(() => {
  html.removeAttribute("data-stage");
  html.removeAttribute("data-stage-capable");
});
afterEach(() => {
  vi.unstubAllGlobals();
  window.history.pushState({}, "", "/");
});

describe("stageAllowed", () => {
  it("shows the stage on city pages only", () => {
    for (const path of ["/", "/ar", "/sakhnin", "/en/k/barbershops", "/haifa/beauty/barbershops"])
      expect(stageAllowed(path), path).toBe(true);
    for (const path of ["/for-business", "/ar/for-business", "/search", "/en/search"])
      expect(stageAllowed(path), path).toBe(false);
  });
});

describe("the boot script", () => {
  it("marks a WebGL2 device and turns the stage on for a city page", () => {
    vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {});
    vi.stubGlobal("Worker", function Worker() {});
    window.history.pushState({}, "", "/sakhnin");
    boot();
    expect(html.hasAttribute("data-stage-capable")).toBe(true);
    expect(html.getAttribute("data-stage")).toBe("on");
  });
  it("keeps it off on the marketing page", () => {
    vi.stubGlobal("WebGL2RenderingContext", function WebGL2RenderingContext() {});
    vi.stubGlobal("Worker", function Worker() {});
    window.history.pushState({}, "", "/en/for-business");
    boot();
    expect(html.getAttribute("data-stage")).toBe("off");
  });
  it("leaves a device without WebGL2 as the plain list", () => {
    vi.stubGlobal("WebGL2RenderingContext", undefined);
    vi.stubGlobal("Worker", function Worker() {});
    boot();
    expect(html.hasAttribute("data-stage-capable")).toBe(false);
    expect(html.hasAttribute("data-stage")).toBe(false);
  });
});
```

Create `apps/web/src/components/StageMount.test.tsx`:

```tsx
import { render, screen } from "@testing-library/react";
import type { ComponentType } from "react";
import { afterEach, beforeEach, expect, it, vi } from "vitest";

let pathname = "/sakhnin";
let failOnMount = false;
vi.mock("next/navigation", () => ({ usePathname: () => pathname }));
vi.mock("next/dynamic", async () => {
  const React = await import("react");
  return {
    default: (loader: () => Promise<ComponentType<Record<string, unknown>>>) => {
      const Lazy = React.lazy(async () => ({ default: await loader() }));
      return (props: Record<string, unknown>) =>
        React.createElement(React.Suspense, { fallback: null }, React.createElement(Lazy, props));
    },
  };
});
vi.mock("@/stage/Stage", async () => {
  const React = await import("react");
  return {
    Stage: ({ onFail }: { onFail: () => void }) => {
      React.useEffect(() => {
        if (failOnMount) onFail();
      }, [onFail]);
      return React.createElement("div", { "data-testid": "stage" });
    },
  };
});
const { StageMount } = await import("./StageMount");

const html = document.documentElement;
const labels = {
  map: "Map",
  plaza: "{place}",
  showMap: "Map",
  showList: "List",
  mapData: "Map data",
  businessCount: "Businesses: {count}",
};
const mount = () => render(<StageMount locale="en" labels={labels} />);
const settle = () => new Promise((resolve) => setTimeout(resolve, 600));

beforeEach(() => {
  pathname = "/sakhnin";
  failOnMount = false;
  html.setAttribute("data-stage-capable", "");
  html.setAttribute("data-stage", "on");
});
afterEach(() => {
  html.removeAttribute("data-stage-capable");
  html.removeAttribute("data-stage");
});

it("loads the stage after the page loads and the browser is idle", async () => {
  mount();
  expect(screen.queryByTestId("stage")).toBeNull();
  expect(await screen.findByTestId("stage", {}, { timeout: 2000 })).toBeTruthy();
  expect(html.getAttribute("data-stage")).toBe("on");
  expect(document.getElementById("stage")?.hasAttribute("data-stage-root")).toBe(true);
});

it("never loads it on a device the boot script did not mark", async () => {
  html.removeAttribute("data-stage-capable");
  html.removeAttribute("data-stage");
  mount();
  await settle();
  expect(screen.queryByTestId("stage")).toBeNull();
  expect(html.hasAttribute("data-stage")).toBe(false);
});

it("keeps it off on the marketing page", async () => {
  pathname = "/en/for-business";
  mount();
  await settle();
  expect(screen.queryByTestId("stage")).toBeNull();
  expect(html.getAttribute("data-stage")).toBe("off");
});

it("hands the city back to the list when the stage fails", async () => {
  failOnMount = true;
  mount();
  await settle();
  await vi.waitFor(() => expect(html.getAttribute("data-stage")).toBe("off"));
  expect(screen.queryByTestId("stage")).toBeNull();
});
```

- [ ] **Step 2: Run them to verify they fail**

Run: `pnpm --filter @darb/web exec vitest run src/lib/stage-boot.test.ts src/components/StageMount.test.tsx`
Expected: FAIL, modules not found.

- [ ] **Step 3: Implement boot and mount**

Create `apps/web/src/lib/stage-boot.ts`:

```ts
/** Pages that are not part of the city show no stage. */
export const STAGE_EXCLUDED = /^(?:\/(?:ar|en))?\/(?:for-business|search)(?:\/|$)/;

export function stageAllowed(pathname: string): boolean {
  return !STAGE_EXCLUDED.test(pathname);
}

/**
 * Runs in <head> before the first paint, so the desktop split layout never shifts the page. It
 * marks a device that can draw the stage (WebGL2 and workers, no data saver) and whether this path
 * shows it. A device that has the API but refuses a context falls back once the stage tries.
 */
export function stageBootScript(): string {
  return `(function(){try{var d=document.documentElement,n=navigator;if(!window.WebGL2RenderingContext||typeof Worker!=="function"||(n.connection&&n.connection.saveData))return;d.setAttribute("data-stage-capable","");d.setAttribute("data-stage",new RegExp(${JSON.stringify(STAGE_EXCLUDED.source)}).test(location.pathname)?"off":"on")}catch(e){}})();`;
}
```

Create `apps/web/src/components/StageMount.module.css`:

```css
/* Off by default: without the stage the list is the whole city (spec §7). */
.stage {
  display: none;
}

/* Desktop: the stage fills the page beside the list column (globals.css --city-column). */
@media (min-width: 900px) {
  :global(html[data-stage="on"]) .stage {
    display: block;
    position: fixed;
    inset-block: 0;
    inset-inline-start: var(--city-column);
    inset-inline-end: 0;
    z-index: 0;
    overflow: hidden;
    background:
      radial-gradient(80% 60% at 50% 40%, var(--forest-900) 0%, transparent 70%), var(--night);
  }
}

/* Phone: full screen while open (the Map pill). */
@media (max-width: 899px) {
  :global(html[data-stage="on"][data-stage-open]) .stage {
    display: block;
    position: fixed;
    inset: 0;
    z-index: 30;
    overflow: hidden;
    background: var(--night);
  }
}
```

Create `apps/web/src/components/StageMount.tsx`:

```tsx
"use client";

import dynamic from "next/dynamic";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState, useSyncExternalStore } from "react";
import type { Locale } from "@darb/core";
import { stageAllowed } from "@/lib/stage-boot";
import type { StageLabels, StageProps } from "@/stage/types";
import styles from "./StageMount.module.css";

/** If the stage's chunk cannot load, the city stays a list. */
function StageUnavailable({ onFail }: StageProps) {
  useEffect(() => onFail(), [onFail]);
  return null;
}

/** The map and plaza live in an async chunk, fetched only when StageMount renders <Stage>. */
const Stage = dynamic<StageProps>(
  () =>
    import("@/stage/Stage").then(
      (m) => m.Stage,
      () => StageUnavailable,
    ),
  { ssr: false },
);

const noSubscription = () => () => {};
const isCapable = () => document.documentElement.hasAttribute("data-stage-capable");

/**
 * The Zoomable City's mount point (spec §6.3): waits until the list is interactive (page loaded,
 * browser idle), then loads the stage. Keeps html[data-stage] in step with the path.
 */
export function StageMount({ locale, labels }: { locale: Locale; labels: StageLabels }) {
  const pathname = usePathname();
  const capable = useSyncExternalStore(noSubscription, isCapable, () => false);
  const [failed, setFailed] = useState(false);
  const [wanted, setWanted] = useState(false);
  const allowed = capable && !failed && stageAllowed(pathname);
  const onFail = useCallback(() => setFailed(true), []);

  useEffect(() => {
    if (capable) document.documentElement.setAttribute("data-stage", allowed ? "on" : "off");
  }, [capable, allowed]);

  useEffect(() => {
    if (!allowed || wanted) return;
    let idle = 0;
    let timer = 0;
    const start = () => {
      if ("requestIdleCallback" in window)
        idle = window.requestIdleCallback(() => setWanted(true), { timeout: 2000 });
      else timer = window.setTimeout(() => setWanted(true), 300);
    };
    if (document.readyState === "complete") start();
    else window.addEventListener("load", start, { once: true });
    return () => {
      window.removeEventListener("load", start);
      if (idle) window.cancelIdleCallback(idle);
      window.clearTimeout(timer);
    };
  }, [allowed, wanted]);

  return (
    <div id="stage" className={styles.stage} data-stage-root="">
      {allowed && wanted ? <Stage locale={locale} labels={labels} onFail={onFail} /> : null}
    </div>
  );
}
```

- [ ] **Step 4: Run them to verify they pass**

Run: `pnpm --filter @darb/web exec vitest run src/lib/stage-boot.test.ts src/components/StageMount.test.tsx`
Expected: PASS (4 + 4 tests).

- [ ] **Step 5: Wire the layout and the split**

In `apps/web/src/app/[locale]/layout.tsx`:

1. Add imports:

```tsx
import type { Locale } from "@darb/core";
import { StageMount } from "@/components/StageMount";
import { stageBootScript } from "@/lib/stage-boot";
import type { StageLabels } from "@/stage/types";
```

2. Add, above `export default async function RootLayout`:

```tsx
const stageLabels = (locale: Locale): StageLabels => ({
  map: t(locale, "mapLabel"),
  plaza: t(locale, "plazaLabel"),
  showMap: t(locale, "showMap"),
  showList: t(locale, "showList"),
  mapData: t(locale, "mapData"),
  businessCount: t(locale, "businessCount"),
});
```

3. On `<html …>`, add `suppressHydrationWarning`, because the boot script sets `data-stage*` before
   React hydrates.
4. In `<head>`, after the tokens `<style>`, add:

```tsx
        <script id="darb-stage-boot" dangerouslySetInnerHTML={{ __html: stageBootScript() }} />
```

5. Replace `{children}` in `<body>` with:

```tsx
        <div className="city" data-city="">
          {children}
        </div>
        <StageMount locale={locale} labels={stageLabels(locale)} />
```

Append to `apps/web/src/app/globals.css` (before the final reduced-motion block):

```css
/*
 * The Zoomable City (Plan 2B). The boot script in <head> sets html[data-stage] before the first
 * paint. Desktop with the stage: the list column at the inline start, the stage beside it. Without
 * it (no WebGL2, a failed map, /for-business), this block never applies and the layout is 2A's.
 */
@media (min-width: 900px) {
  html[data-stage="on"] {
    --city-column: min(600px, 44vw);
  }

  html[data-stage="on"] .city {
    position: relative;
    z-index: 1;
    inline-size: var(--city-column);
    min-block-size: 100dvh;
    background: var(--night);
    border-inline-end: 1px solid var(--line-soft);
  }

  html[data-stage="on"] [data-site-header] > .frame {
    inline-size: 100%;
  }
}
```

In `apps/web/src/components/Header.module.css`, add to `.header`:

```css
  position: relative;
  z-index: 2;
```

(The translucent header lies over the top of the desktop stage, and the stage fills the page beside
the list.)

In `apps/web/scripts/shoot.mjs`, wait for the stage to settle before each screenshot, and open it
on phones when `STAGE_OPEN=1`. Replace

```js
    await page.goto(base + path, { waitUntil: "networkidle" });
```

with

```js
    await page.goto(base + path, { waitUntil: "networkidle" });
    if (name === "phone" && process.env.STAGE_OPEN === "1")
      await page.locator("[data-stage-toggle]").click({ timeout: 10_000 }).catch(() => {});
    // The stage loads after idle: wait until it settled, fell back, or is closed on a phone.
    await page
      .waitForFunction(
        () => {
          const d = document.documentElement;
          if (d.getAttribute("data-stage") !== "on") return true;
          const host = document.querySelector("[data-stage-host]");
          const open = innerWidth >= 900 || d.hasAttribute("data-stage-open");
          if (!open) return host !== null;
          return host?.getAttribute("data-stage-state") === "ready" && !host.hasAttribute("data-stage-moving");
        },
        null,
        { timeout: 20_000 },
      )
      .catch(() => console.log(JSON.stringify({ path, stage: "did not settle" })));
```

- [ ] **Step 6: See it work**

Run (Docker up, seeded API on :4000):

```bash
cd /Users/zangeel/Documents/GitHub/Darb-City
pnpm --filter @darb/stage build && pnpm --filter @darb/web build
(cd apps/web && MAP_TILES_DIR=e2e/tiles pnpm start > /tmp/darb-web.log 2>&1 &)
sleep 8
node apps/web/scripts/shoot.mjs / /sakhnin /en/sakhnin/beauty /en/sakhnin/beauty/barbershops/samers-barbershop /for-business
STAGE_OPEN=1 node apps/web/scripts/shoot.mjs /sakhnin /ar/sakhnin/beauty
pkill -f next-server
```

Expected: every JSON line has `"small":[]` and `"overflow":false` and no `"stage":"did not settle"`.
Open the PNGs in `apps/web/.screens/` with the Read tool. The desktop ones show the list column on
the inline start, with the map at `/` (live places glowing gold), the plaza at `/sakhnin` and
`/en/sakhnin/beauty`, and the sheet over the map at the business. `/for-business` matches 2A. The
phone `STAGE_OPEN` ones show the plaza full-screen with the List pill. The fixture tiles draw plain
forest land with a gold diagonal per tile; real streets need `.tiles/israel.pmtiles` (Task 7 Step 7)
and `MAP_TILES_DIR=.tiles`. Check VC11–VC15 and fix anything that fails in its owning file.

- [ ] **Step 7: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/src/lib/stage-boot.ts apps/web/src/lib/stage-boot.test.ts apps/web/src/components/StageMount.tsx \
  apps/web/src/components/StageMount.module.css apps/web/src/components/StageMount.test.tsx \
  "apps/web/src/app/[locale]/layout.tsx" apps/web/src/app/globals.css apps/web/src/components/Header.module.css \
  apps/web/scripts/shoot.mjs
git commit -m "feat(web): mount the stage after the list is interactive, beside it on desktop"
```

---

### Task 16: Budget: the lazy stage, measured

**Files:**
- Modify: `apps/web/scripts/check-budget.mjs`

**Interfaces:**
- Consumes: `STAGE_CHUNK_MARKER = "darb:stage-chunk"` (Task 14, rendered as `data-stage-chunk`); the
  vendored MapLibre files (Tasks 1, 8).
- Produces: `pnpm --filter @darb/web budget` prints the 2A route lines and then one `stage` line. It
  fails when a route breaks 2A's budget, when the stage's main-thread JS (all async chunks plus
  `maplibre-gl.mjs` and `maplibre-gl-shared.mjs`) exceeds 340 KB gzip, when the marker appears in any
  first-load chunk, or when no async chunk carries it.

- [ ] **Step 1: Replace the script**

Replace `apps/web/scripts/check-budget.mjs` with:

```js
// JavaScript budgets, gzip-compressed, from the Next build output. Fails (exit 1) when exceeded:
// - level routes, spec §9.1 as amended by the controller ruling of 2026-10-12 (the Next 16 +
//   React 19 runtime alone is ~130 KB gzip): first-load JS <= 180 KB in total and <= 40 KB
//   route-specific (beyond the shared root chunks);
// - the lazy city stage (Plan 2B decision 1), loaded after the list is interactive: main-thread
//   JS <= 340 KB, i.e. every async chunk plus MapLibre's two main-thread modules (~297 KB for
//   6.11.2). Its code must never reach a first load: the stage marker string is in some async chunk
//   and in no first-load chunk. The worker module is reported, not budgeted (it runs off the main
//   thread and reuses the shared module from the HTTP cache).
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const LIMIT = 180 * 1024;
const ROUTE_LIMIT = 40 * 1024;
const STAGE_LIMIT = 340 * 1024;
const STAGE_MARKER = "darb:stage-chunk";
const NEXT = fileURLToPath(new URL("../.next/", import.meta.url));
const require = createRequire(import.meta.url);
const MAPLIBRE = JSON.parse(readFileSync(require.resolve("maplibre-gl/package.json"), "utf8")).version;
const VENDOR = fileURLToPath(new URL(`../public/map/vendor/maplibre-gl@${MAPLIBRE}/`, import.meta.url));
const ROUTES = [
  "/[locale]/page",
  "/[locale]/[place]/page",
  "/[locale]/[place]/[sector]/page",
  "/[locale]/[place]/[sector]/[kind]/page",
  "/[locale]/[place]/[sector]/[kind]/[business]/page",
  "/[locale]/[place]/[sector]/[kind]/[business]/[...rest]/page",
  "/[locale]/k/[kind]/page",
];

const build = JSON.parse(readFileSync(join(NEXT, "build-manifest.json"), "utf8"));
const sizes = new Map();
const gz = (path) => {
  if (!sizes.has(path)) sizes.set(path, gzipSync(readFileSync(path)).length);
  return sizes.get(path);
};
const strip = (f) => f.replace(/^\/?_next\//, "");
const sum = (files) => [...files].reduce((total, file) => total + gz(join(NEXT, file)), 0);
const kb = (bytes) => `${(bytes / 1024).toFixed(1).padStart(6)} KB`;

/** Every route's client manifest: route → entry JS files. */
function manifests(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return manifests(path);
    return entry.name.endsWith("_client-reference-manifest.js") ? [path] : [];
  });
}
const entries = new Map();
for (const file of manifests(join(NEXT, "server/app"))) {
  const sandbox = {};
  vm.runInNewContext(readFileSync(file, "utf8"), sandbox);
  for (const [route, manifest] of Object.entries(sandbox.__RSC_MANIFEST ?? {}))
    entries.set(route, Object.values(manifest.entryJSFiles ?? {}).flat().map(strip));
}

let failed = false;
const shared = new Set(build.rootMainFiles.map(strip));
console.log(`shared root chunks ${kb(sum(shared))}`);
for (const route of ROUTES) {
  const files = entries.get(route);
  if (!files) throw new Error(`No client manifest for ${route}`);
  const own = new Set(files.filter((f) => !shared.has(f)));
  const total = sum(shared) + sum(own);
  const ok = total <= LIMIT && sum(own) <= ROUTE_LIMIT;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${kb(total)} total ${kb(sum(own))} route  ${route}`);
}

// The stage: everything no route loads first is lazy (async chunks), apart from legacy polyfills.
const initial = new Set(shared);
for (const files of entries.values()) for (const f of files) initial.add(f);
const polyfills = new Set((build.polyfillFiles ?? []).map(strip));
const asyncChunks = readdirSync(join(NEXT, "static/chunks"))
  .filter((f) => f.endsWith(".js"))
  .map((f) => `static/chunks/${f}`)
  .filter((f) => !initial.has(f) && !polyfills.has(f));
const marked = (files) =>
  [...files].filter((f) => readFileSync(join(NEXT, f), "utf8").includes(STAGE_MARKER));
const leaked = marked(initial);
const carriers = marked(asyncChunks);
const own = sum(asyncChunks);
const maplibre = gz(join(VENDOR, "maplibre-gl.mjs")) + gz(join(VENDOR, "maplibre-gl-shared.mjs"));
const worker = gz(join(VENDOR, "maplibre-gl-worker.mjs"));
const mainThread = own + maplibre;
const stageOk = mainThread <= STAGE_LIMIT && leaked.length === 0 && carriers.length > 0;
failed ||= !stageOk;
console.log(
  `${stageOk ? "ok  " : "FAIL"} ${kb(mainThread)} stage main thread ` +
    `(async chunks ${kb(own).trim()} + MapLibre ${MAPLIBRE} ${kb(maplibre).trim()}), worker ${kb(worker).trim()}`,
);
if (leaked.length > 0) console.error(`Stage code in first-load chunks: ${leaked.join(", ")}`);
if (carriers.length === 0)
  console.error("No async chunk carries the stage: is Stage still loaded through next/dynamic?");

if (failed) {
  console.error(
    `Budgets: first-load JS <= ${LIMIT / 1024} KB total and ${ROUTE_LIMIT / 1024} KB per route ` +
      `(spec §9.1, ruling 2026-10-12); stage main thread <= ${STAGE_LIMIT / 1024} KB (Plan 2B).`,
  );
  process.exit(1);
}
```

- [ ] **Step 2: Run it**

Run: `pnpm --filter @darb/stage build && pnpm --filter @darb/web build && pnpm --filter @darb/web budget`
Expected: seven route lines start with `ok`. The route-specific numbers move by at most about 2 KB
from 2A's (22.5–25.6 KB), because only `StageMount`, `StageData` and the store are new in first
loads. Then a last line like
`ok    3xx.x KB stage main thread (async chunks 2x.x KB + MapLibre 6.11.2 297.x KB), worker 6.0 KB`,
under 340 KB. Exit code 0.

- [ ] **Step 3: Prove the gate bites**

Temporarily change `const STAGE_LIMIT = 340 * 1024;` to `100 * 1024`, run
`pnpm --filter @darb/web budget`, and expect `FAIL … stage main thread` with exit code 1. Then
restore `340`. Do not commit the temporary change.

- [ ] **Step 4: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/scripts/check-budget.mjs
git commit -m "build(web): budget the lazy stage and keep it out of every first load"
```

---

### Task 17: End-to-end: the stage

**Files:**
- Modify: `apps/web/playwright.config.ts`
- Modify: `apps/web/e2e/fixtures.ts` (`settleStage`)
- Create: `apps/web/e2e/stage.spec.ts`
- Modify: `apps/web/e2e/a11y.spec.ts`, `apps/web/e2e/visual.spec.ts`

**Interfaces:**
- Consumes: every `data-stage-*` attribute and `window.darbStage` from Task 14; `LEVELS`, `HAIFA`,
  `BUSINESS_KEY`, `localePath`, `isPhone` from `e2e/fixtures.ts`; the fixture tiles (Task 7).
- Produces: `settleStage(page: Page): Promise<void>`.

- [ ] **Step 1: Configure Playwright for WebGL and the fixture tiles**

In `apps/web/playwright.config.ts`:

1. Add above `export default`:

```ts
/** Headless Chromium draws WebGL2 in software (SwiftShader), so the map renders without a GPU. */
const WEBGL = {
  args: ["--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"],
};
/** The 1 KB fixture archive (scripts/tiles/make-test-tiles.mjs): CI never downloads tiles. */
const TILES = { MAP_TILES_DIR: "e2e/tiles" };
```

2. In both projects' `use`, add `launchOptions: WEBGL,`.
3. In the `pnpm start` web server, change `env` to
   `{ API_URL: "http://localhost:4000", SITE_URL: WEB, ...TILES }`. In the `:3001` web server, change
   it to `{ API_URL: "http://127.0.0.1:9", SITE_URL: WEB_API_DOWN, ...TILES }`.

- [ ] **Step 2: Add the settle helper**

Append to `apps/web/e2e/fixtures.ts` (and add `Page` to the type import from `@playwright/test`,
i.e. `import type { Page, TestInfo } from "@playwright/test";`):

```ts
/**
 * Waits for the lazy stage: settled on desktop (or an open phone stage), mounted behind its pill on
 * a closed phone, or off (no WebGL2, failed, or a page outside the city).
 */
export async function settleStage(page: Page): Promise<void> {
  await page.waitForFunction(
    () => {
      const d = document.documentElement;
      if (d.getAttribute("data-stage") !== "on") return true;
      const host = document.querySelector("[data-stage-host]");
      if (innerWidth < 900 && !d.hasAttribute("data-stage-open")) return host !== null;
      return (
        host?.getAttribute("data-stage-state") === "ready" && !host.hasAttribute("data-stage-moving")
      );
    },
    null,
    { timeout: 30_000 },
  );
}
```

- [ ] **Step 3: Write the stage suite**

Create `apps/web/e2e/stage.spec.ts`:

```ts
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";
import { BUSINESS_KEY, HAIFA, LEVELS, localePath } from "./fixtures";

test.describe.configure({ timeout: 60_000 });

type DarbStage = { pointOf(id: string): [number, number] | null; center(): [number, number] };
const host = (page: Page) => page.locator("[data-stage-host]");
const html = (page: Page) => page.locator("html");

test.beforeEach(async ({ page }) => {
  await page.addInitScript(() => Object.assign(window, { __DARB_E2E__: true }));
});

/** Opens a page and waits until the stage shows it. */
async function stageAt(page: Page, path: string) {
  await page.goto(path);
  await expect(host(page)).toHaveAttribute("data-stage-state", "ready", { timeout: 30_000 });
  await expect(host(page)).toHaveAttribute("data-stage-path", new URL(page.url()).pathname);
}

/** Where a live place (slug) or business (key) is on screen. */
async function pointOf(page: Page, id: string): Promise<[number, number]> {
  const point = await page.evaluate(
    (key) => (window as unknown as { darbStage: DarbStage }).darbStage.pointOf(key),
    id,
  );
  expect(point, id).not.toBeNull();
  return point!;
}

const center = (page: Page) =>
  page.evaluate(() => (window as unknown as { darbStage: DarbStage }).darbStage.center());

/** The list is the whole city: no stage pane, the 2A column, every door. */
async function expectListOnly(page: Page) {
  await expect(page.locator("#stage")).toBeHidden();
  await expect(page.locator("[data-door]")).toHaveCount(18);
  expect((await page.locator("[data-city]").boundingBox())!.width).toBeGreaterThan(1400);
}

test.describe("desktop", () => {
  test.skip(({ isMobile }) => isMobile, "desktop only");

  test("the map loads in the Darb style from self-hosted tiles and glyphs, no third party", async ({
    page,
  }) => {
    const hosts = new Set<string>();
    const status = new Map<string, number>();
    page.on("request", (r) => hosts.add(new URL(r.url()).host));
    page.on("response", (r) => {
      const path = new URL(r.url()).pathname;
      for (const kind of ["api/tiles", "map/glyphs", "map/vendor"])
        if (path.startsWith(`/${kind}/`)) status.set(kind, r.status());
    });
    await stageAt(page, LEVELS.country);
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    const canvas = page.locator('[data-stage-layer="map"] canvas');
    await expect(canvas).toBeVisible();
    await expect(canvas).toHaveAttribute("role", "img");
    await expect(canvas).toHaveAttribute("aria-label", "מפת המקומות הפעילים בדרב");
    await expect(canvas).toHaveAttribute("tabindex", "-1");
    await expect(page.locator("[data-stage-attribution]")).toContainText("OpenStreetMap");
    await expect.poll(() => status.get("api/tiles")).toBe(206);
    await expect.poll(() => status.get("map/vendor")).toBe(200);
    await expect.poll(() => status.get("map/glyphs")).toBe(200);
    expect([...hosts]).toEqual([new URL(page.url()).host]);
  });

  test("a place's plaza mirrors its list doors, in the same order", async ({ page }) => {
    await stageAt(page, LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-view", "plaza");
    await expect(host(page)).toHaveAttribute("data-stage-level", "1");
    const hrefs = (selector: string) =>
      page.locator(selector).evaluateAll((els) => els.map((el) => el.getAttribute("href")));
    const doors = await hrefs("[data-door]");
    expect(doors).toHaveLength(18);
    expect(await hrefs("[data-plaza-door]")).toEqual(doors);
    await expect(page.getByRole("navigation", { name: /: רחובות ודלתות$/ })).toBeVisible();
  });

  for (const [locale, rtl] of [
    ["he", true],
    ["en", false],
  ] as const)
    test(`${locale}: the stage and the plaza's first door sit at the ${rtl ? "left / right" : "right / left"}`, async ({
      page,
    }) => {
      await stageAt(page, localePath(locale, LEVELS.place));
      const first = (await page.locator("[data-plaza-door]").nth(0).boundingBox())!;
      const second = (await page.locator("[data-plaza-door]").nth(1).boundingBox())!;
      expect(first.x > second.x).toBe(rtl);
      expect((await page.locator("#stage").boundingBox())!.x < 10).toBe(rtl);
    });

  test("the camera follows each level to the right URL", async ({ page }) => {
    await stageAt(page, LEVELS.country);
    await page.mouse.click(...(await pointOf(page, "sakhnin")));
    await expect(page).toHaveURL(LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-view", "plaza");
    await expect(host(page)).toHaveAttribute("data-stage-motion", "fly");
    await expect(host(page)).toHaveAttribute("data-stage-fade", "550");
    await page.locator('[data-plaza-door="beauty"]').click();
    await expect(page).toHaveURL(LEVELS.sector);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.sector);
    await expect(host(page)).toHaveAttribute("data-stage-level", "2");
    await page.locator('[data-plaza-door="barbershops"]').click();
    await expect(page).toHaveURL(LEVELS.kind);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.kind);
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    await page.mouse.click(...(await pointOf(page, BUSINESS_KEY)));
    await expect(page).toHaveURL(new RegExp(`${LEVELS.kind}/[a-z0-9-]+$`));
    await expect(page.getByRole("dialog")).toBeVisible();
  });

  test("Back goes up a level, and the camera with it", async ({ page }) => {
    await stageAt(page, LEVELS.place);
    await page.locator('[data-plaza-door="beauty"]').click();
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.sector);
    await page.goBack();
    await expect(page).toHaveURL(LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-level", "1");
  });

  test("navigation during a camera move ends where the URL ends", async ({ page }) => {
    await stageAt(page, LEVELS.place);
    await page.locator('[data-plaza-door="beauty"]').click();
    await expect(page).toHaveURL(LEVELS.sector);
    await page.goBack();
    await expect(page).toHaveURL(LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-level", "1");
    await expect(host(page)).not.toHaveAttribute("data-stage-moving", "");
  });

  test("content appears before the camera settles", async ({ page }) => {
    await stageAt(page, LEVELS.place);
    const heading = await page.locator('[data-plaza-door="beauty"] span').first().innerText();
    const timing = page.evaluate(
      ({ heading, path }) =>
        new Promise<{ content: number; settled: number }>((resolve) => {
          let content = 0;
          const stage = document.querySelector("[data-stage-host]")!;
          const observer = new MutationObserver(() => {
            if (!content && document.querySelector("#main-heading")?.textContent === heading)
              content = performance.now();
            if (content && stage.getAttribute("data-stage-path") === path) {
              observer.disconnect();
              resolve({ content, settled: performance.now() });
            }
          });
          observer.observe(document.body, {
            subtree: true,
            childList: true,
            characterData: true,
            attributes: true,
          });
        }),
      { heading, path: LEVELS.sector },
    );
    await page.locator('[data-plaza-door="beauty"]').click();
    const { content, settled } = await timing;
    expect(content).toBeLessThan(settled);
  });

  test("the sheet is non-modal and the map stays usable behind it", async ({ page }) => {
    const business = localePath("en", LEVELS.business);
    await stageAt(page, business);
    await expect(host(page)).toHaveAttribute("data-stage-view", "map");
    const dialog = page.getByRole("dialog");
    await expect(dialog).not.toHaveAttribute("aria-modal", "true");
    const list = (await page.locator("[data-city]").boundingBox())!;
    const sheet = (await dialog.boundingBox())!;
    const x = (list.x + list.width + sheet.x) / 2;
    const y = 450;
    expect(await page.evaluate(([px, py]) => document.elementFromPoint(px!, py!)?.tagName, [x, y])).toBe(
      "CANVAS",
    );
    const before = await center(page);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x - 120, y + 60, { steps: 8 });
    await page.mouse.up();
    await expect.poll(() => center(page)).not.toEqual(before);
    await expect(page).toHaveURL(business);
    await expect(dialog).toBeVisible();
  });

  test("a neighbourhood business keeps the listed place's camera", async ({ page }) => {
    await stageAt(page, HAIFA.subPlaceBusiness);
    await expect(page).toHaveURL(HAIFA.subPlaceBusiness);
    await expect(host(page)).toHaveAttribute("data-stage-level", "3");
    await expect(host(page)).toHaveAttribute("data-stage-place", "haifa");
    await expect(host(page)).toHaveAttribute("data-stage-active-pin", HAIFA.subPlaceKey);
  });

  test("no long task over 50 ms while the camera flies into a place", async ({ page }) => {
    await stageAt(page, LEVELS.country);
    await page.evaluate(() => {
      const w = window as unknown as {
        __moves: [number, number][];
        __tasks: { start: number; duration: number }[];
      };
      w.__moves = [];
      w.__tasks = [];
      const stage = document.querySelector("[data-stage-host]")!;
      let start = 0;
      new MutationObserver(() => {
        const moving = stage.hasAttribute("data-stage-moving");
        if (moving && !start) start = performance.now();
        if (!moving && start) {
          w.__moves.push([start, performance.now()]);
          start = 0;
        }
      }).observe(stage, { attributes: true, attributeFilter: ["data-stage-moving"] });
      new PerformanceObserver((list) => {
        for (const e of list.getEntries()) w.__tasks.push({ start: e.startTime, duration: e.duration });
      }).observe({ type: "longtask" });
    });
    await page.mouse.click(...(await pointOf(page, "sakhnin")));
    await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
    await page.waitForTimeout(300); // long-task entries arrive after their task
    const { moves, tasks } = await page.evaluate(() => {
      const w = window as unknown as {
        __moves: [number, number][];
        __tasks: { start: number; duration: number }[];
      };
      return { moves: w.__moves, tasks: w.__tasks };
    });
    expect(moves.length).toBeGreaterThan(0);
    const [from, to] = moves[moves.length - 1]!;
    const during = tasks.filter((t) => t.start + t.duration > from && t.start < to);
    console.log(`long tasks during the fly (${Math.round(to - from)} ms): ${JSON.stringify(during)}`);
    expect(during.filter((t) => t.duration > 50)).toEqual([]);
  });

  test.describe("reduced motion", () => {
    test.use({ reducedMotion: "reduce" });
    test("levels switch with a short fade and no flying", async ({ page }) => {
      await stageAt(page, LEVELS.country);
      await page.locator('#places a[href="/sakhnin"]').click();
      await expect(host(page)).toHaveAttribute("data-stage-path", LEVELS.place);
      await expect(host(page)).toHaveAttribute("data-stage-motion", "jump");
      await expect(host(page)).toHaveAttribute("data-stage-fade", "400");
    });
  });

  test("no WebGL2 at all: the list is the whole city", async ({ page }) => {
    await page.addInitScript(() => {
      Reflect.deleteProperty(window, "WebGL2RenderingContext");
    });
    const vendor: string[] = [];
    page.on("request", (r) => {
      if (r.url().includes("/map/vendor/")) vendor.push(r.url());
    });
    await page.goto(LEVELS.place);
    await page.waitForLoadState("networkidle");
    await page.waitForTimeout(2500); // past the idle point where the stage would load
    await expect(html(page)).not.toHaveAttribute("data-stage-capable", "");
    await expectListOnly(page);
    expect(vendor).toEqual([]);
  });

  test("a GPU that refuses WebGL2: the stage steps aside", async ({ page }) => {
    await page.addInitScript(() => {
      const original = HTMLCanvasElement.prototype.getContext;
      Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
        value: function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
          if (type === "webgl2" || type === "webgl") return null;
          return Reflect.apply(original, this, [type, ...rest]);
        },
      });
    });
    await page.goto(LEVELS.place);
    await expect(html(page)).toHaveAttribute("data-stage", "off", { timeout: 30_000 });
    await expectListOnly(page);
  });

  test("a failed tile load: the stage steps aside", async ({ page }) => {
    await page.route("**/api/tiles/**", (route) => route.fulfill({ status: 404, body: "" }));
    await page.goto(LEVELS.place);
    await expect(html(page)).toHaveAttribute("data-stage", "off", { timeout: 30_000 });
    await expectListOnly(page);
  });
});

test.describe("phone", () => {
  test.skip(({ isMobile }) => !isMobile, "phone only");

  async function openStage(page: Page, path: string) {
    await page.goto(path);
    const toggle = page.locator("[data-stage-toggle]");
    await expect(toggle).toHaveText("מפה", { timeout: 30_000 });
    await toggle.click();
    await expect(html(page)).toHaveAttribute("data-stage-open", "");
    await expect(host(page)).toHaveAttribute("data-stage-state", "ready", { timeout: 30_000 });
    await expect(host(page)).toHaveAttribute("data-stage-path", path);
  }

  test("the Map pill opens the plaza with 44 px doors, and pinch-out goes up a level", async ({
    page,
  }) => {
    await openStage(page, LEVELS.sector);
    await expect(host(page)).toHaveAttribute("data-stage-view", "plaza");
    await expect(page.locator("[data-city]")).toHaveAttribute("inert", "");
    await expect(page.locator("[data-stage-toggle]")).toHaveText("רשימה");
    const boxes = await page
      .locator("[data-plaza-door]")
      .evaluateAll((els) => els.map((el) => el.getBoundingClientRect().toJSON() as DOMRect));
    expect(boxes.length).toBeGreaterThan(0);
    for (const box of boxes) expect(Math.min(box.width, box.height)).toBeGreaterThanOrEqual(44);
    const plaza = (await page.locator("[data-plaza]").boundingBox())!;
    const cx = plaza.x + plaza.width / 2;
    const cy = plaza.y + plaza.height / 2;
    const cdp = await page.context().newCDPSession(page);
    const touch = (type: string, points: [number, number][]) =>
      cdp.send("Input.dispatchTouchEvent", {
        type: type as "touchStart",
        touchPoints: points.map(([x, y], id) => ({ x, y, id })),
      });
    await touch("touchStart", [
      [cx - 120, cy],
      [cx + 120, cy],
    ]);
    for (const d of [90, 60, 30])
      await touch("touchMove", [
        [cx - d, cy],
        [cx + d, cy],
      ]);
    await touch("touchEnd", []);
    await expect(page).toHaveURL(LEVELS.place);
    await expect(host(page)).toHaveAttribute("data-stage-level", "1");
  });

  test("level 3 hands the phone back to the list", async ({ page }) => {
    await openStage(page, LEVELS.sector);
    await page.locator('[data-plaza-door="barbershops"]').click();
    await expect(page).toHaveURL(LEVELS.kind);
    await expect(html(page)).not.toHaveAttribute("data-stage-open", "");
    await expect(page.locator("[data-stage-toggle]")).toHaveCount(0);
    await expect(page.locator(`[data-business-link="${BUSINESS_KEY}"]`)).toBeVisible();
  });

  test("the open stage has no WCAG A/AA violations", async ({ page }) => {
    await openStage(page, LEVELS.place);
    const { violations } = await new AxeBuilder({ page })
      .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa"])
      .analyze();
    expect(
      violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target.join(" ")).join(" | ")}`),
    ).toEqual([]);
  });
});
```

- [ ] **Step 4: Settle the stage before axe and screenshots**

In `apps/web/e2e/a11y.spec.ts`, import `settleStage` from `./fixtures` and add
`await settleStage(page);` right after `await page.waitForLoadState("networkidle");`. Desktop then
checks every level with the map or plaza on, and phones with the stage closed behind its pill.

Replace `apps/web/e2e/visual.spec.ts` with:

```ts
import { test } from "@playwright/test";
import { EMPTY_KIND, LEVELS, localePath, settleStage } from "./fixtures";

const SHOTS: [string, string][] = [
  ...Object.entries(LEVELS).map(([name, path]) => [name, path] as [string, string]),
  ["empty-kind", EMPTY_KIND],
  ["ar-business", localePath("ar", LEVELS.business)],
  ["en-business", localePath("en", LEVELS.business)],
  ["for-business", "/for-business"],
  ["not-found", "/sakhnim"],
];
/** The stage open on phones too (VC11–VC15). */
const STAGE_SHOTS: [string, string][] = [
  ["stage-place", LEVELS.place],
  ["stage-ar-sector", localePath("ar", LEVELS.sector)],
  ["stage-en-place", localePath("en", LEVELS.place)],
];

test.use({ reducedMotion: "reduce" });

for (const [name, path] of SHOTS) {
  test(`screenshot ${name}`, async ({ page }, info) => {
    await page.goto(path);
    await page.waitForLoadState("networkidle");
    await settleStage(page);
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  });
}

for (const [name, path] of STAGE_SHOTS) {
  test(`screenshot ${name} with the stage open`, async ({ page }, info) => {
    test.setTimeout(60_000);
    await page.goto(path);
    if (info.project.name === "phone")
      await page.locator("[data-stage-toggle]").click({ timeout: 30_000 });
    await settleStage(page);
    await page.screenshot({ path: `test-results/screens/${info.project.name}-${name}.png` });
  });
}
```

- [ ] **Step 5: Run the whole suite**

Run (Docker up, seeded API, no other server on :3000/:3001):

```bash
cd /Users/zangeel/Documents/GitHub/Darb-City
pnpm --filter @darb/stage build && pnpm --filter @darb/web build
pnpm --filter @darb/web exec playwright test e2e/stage.spec.ts
pnpm --filter @darb/web e2e
```

Expected: `stage.spec.ts` passes in both projects (desktop tests skip on phone and phone tests skip
on desktop). The long-task test logs its tasks and asserts none over 50 ms. Then the full suite
passes, axe reports 0 violations everywhere, and `test-results/screens/` holds the new
`*-stage-*.png`. If the first test fails because WebGL2 is unavailable (the canvas never appears),
confirm the `WEBGL` launch args reached Chromium (`chrome://gpu` in a headed run) before changing
any app code. If only the long-task assertion fails, report the logged durations to the controller
rather than raising the threshold.

- [ ] **Step 6: Commit**

```bash
pnpm format && pnpm lint
git add apps/web/playwright.config.ts apps/web/e2e
git commit -m "test(web): e2e for the map, plaza, camera, fallbacks and the non-modal sheet"
```

---

### Task 18: CI and documentation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Modify: `README.md`

**Interfaces:**
- Consumes: `make-test-tiles.mjs --check` (Task 7); the budget (Task 16); the e2e config (Task 17).

- [ ] **Step 1: Check the fixture in CI (never download tiles)**

In `.github/workflows/ci.yml`, add after the `Unit and API integration tests` step:

```yaml
      # CI never downloads map tiles: e2e serves the committed 1 KB fixture (MAP_TILES_DIR in
      # apps/web/playwright.config.ts). This keeps the fixture equal to what its generator writes.
      - name: Map test tiles are reproducible
        run: pnpm --filter @darb/web exec node scripts/tiles/make-test-tiles.mjs --check
```

Rename the budget step to `First-load JS and lazy stage budgets` (the command is unchanged:
`pnpm --filter @darb/web budget`). The e2e step needs no change, because Playwright passes the WebGL
flags and the tiles directory itself.

- [ ] **Step 2: Document the map**

Append to `README.md`:

```markdown
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
```

- [ ] **Step 3: Verify locally what CI runs**

Run: `pnpm --filter @darb/web exec node scripts/tiles/make-test-tiles.mjs --check && pnpm format:check`
Expected: `test tiles: up to date`, and Prettier is clean.

- [ ] **Step 4: Commit**

```bash
pnpm format && pnpm lint
git add .github/workflows/ci.yml README.md
git commit -m "ci: check the map test fixture; document tiles, glyphs and attribution"
```

---

### Task 19: Final verification and visual review

**Files:**
- Modify: none, unless a check fails (fix it in the owning task's files, with its own commit).

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
pnpm --filter @darb/web exec node scripts/tiles/make-test-tiles.mjs --check
pnpm --filter @darb/api db:deploy && pnpm --filter @darb/api db:seed
pnpm --filter @darb/web budget
pnpm --filter @darb/web e2e
```

Expected: every command exits 0. The budget prints seven route `ok` lines and one stage `ok` line,
and the e2e summary shows no failures.

- [ ] **Step 2: Spec walk-through.** With `pnpm dev` running and real tiles
  (`MAP_TILES_DIR=.tiles` after Task 7 Step 7), check each item by hand and note it in the ledger:
  - §3.1: `/` shows the Darb-styled map of the north with live places glowing (busier places
    larger). Clicking Haifa flies in and crossfades into Haifa's plaza (gate, lit streets, 18 doors).
  - §3.2: every plaza door goes to the same URL as its list door. A business opened from Haifa's
    list for a Kiryat Haim business keeps the URL `/haifa/…/kiryat-haim/…` and Haifa's camera.
  - §3.3: browser Back and the path bar step up one level with the camera. Pinch-out on a phone
    plaza goes up, and the locale switch keeps the path.
  - §3.5: moves take about half a second on the ease-out, the list text is readable before the
    stage settles, and with macOS "Reduce motion" on, levels fade without flying.
  - §7: Chrome with `--disable-webgl` and `--disable-3d-apis` shows 2A's layout with the full list,
    and renaming `.tiles/israel.pmtiles` gives the same.
  - §8: Tab from the top of `/sakhnin` goes through the list doors before any plaza door, the map
    is never a tab stop, and VoiceOver names the map and the plaza navigation.

- [ ] **Step 3: Visual review.** Open every PNG in `apps/web/test-results/screens/` (from
  `visual.spec.ts`) and check VC1–VC16 at both sizes. Also run, with real tiles,
  `node apps/web/scripts/shoot.mjs / /haifa /ar/haifa/food /en/haifa/beauty/barbershops/kiryat-haim/samers-barbershop`
  and `STAGE_OPEN=1 node apps/web/scripts/shoot.mjs /haifa /ar/haifa/food`. Confirm real streets in
  gold and forest, ivory Hebrew, Arabic and English labels shaped correctly (joined Arabic letters,
  right-to-left), no POI icons and no borders.

- [ ] **Step 4: Report** (no commit unless a fix was needed). Summarise for the controller: gates
  passed, the stage budget line, the long-task durations logged by e2e, any VC item that needed a
  fix, and the tiles build used for the real-tile review.

---

## Self-review notes (writer's checklist, kept for the reviewer)

- Spec coverage. §3.1 is covered by Tasks 12–15. §3.2 levels and URLs by Tasks 10, 14 and 17. §3.3
  Back and pinch-out by Tasks 2, 13, 14 and 17. §3.5 motion by Tasks 2, 14 and 17. §6.3 lazy stage
  by Tasks 15 and 16. §6.4 PMTiles on R2 by Tasks 1, 6 and 7 (R2 upload itself is Plan 4). §7
  fallbacks by Tasks 14, 15 and 17. §8 accessibility by Tasks 11–15 and 17. §9.1 budgets and 60 fps
  proxy by Tasks 16 and 17. §9.2 axe by Task 17. §9.3 e2e and screenshots by Task 17. Follow-ups:
  I5 (non-modal sheet) is Task 11, and the sub-place URL is handled in Tasks 10 and 17.
- Deferred, not in 2B. Business pins carry no labels or popups (the sheet is the detail). Level-3
  filters stay in Plan 3. Uploading tiles to R2 and the CORS for `NEXT_PUBLIC_MAP_TILES_URL` are
  Plan 4. A `<link rel="preload">` for MapLibre is deliberately absent.

---

## Controller rulings (2026-10-12, plan approved by the controller on the owner's delegation)

These override the task text above wherever they differ.

1. **Branch.** Plan 2A is merged into `main`, so `feat/plan-2b-map-plaza` is created from `origin/main`, not from `feat/plan-2a-web-city`. Task 1's branch step is already done.
2. **Lazy budget.** The lazy map/plaza chunk budget is accepted at 340 KB gzip (MapLibre 6.11.2's main-thread modules alone are ~297 KB). Level-route first-load budgets stay at 180 KB total / 40 KB route-specific; the stage must never enter them.
3. **Delivery and style.** Vendored MapLibre under `/map/vendor` loaded at runtime, no RTL plugin, no sprite, POIs/shields/one-way arrows/borders dropped. Accepted. Dropping POIs also keeps bars and other forbidden places off the map.
4. **Glyphs.** Noto Sans (OFL) glyph PBFs committed (~1.4 MB) with the licence file alongside. Folder names may contain spaces only if a test proves Next serves them (URL-encoded); otherwise use hyphenated folder names and matching fontstack names.
5. **Tiles.** Israel extract at maxzoom 14 (~92 MB) stays git-ignored and is produced by the script; CI and tests use the small committed fixture. OSM/Protomaps attribution must be visible on the map.
6. **Layout.** Desktop list column (≤600 px) beside the stage; phones get a Map/List pill; levels 3–4 show business pins. Accepted.
7. **Plaza doors.** Real links after the list in DOM order. Accepted.
8. **Performance gate.** The long-task (>50 ms) check during a fly is a hard failure locally on real GPUs and is reported but non-failing in CI (software WebGL is too noisy to gate on). The CI log must still print the measured long tasks.
9. **WebGL2 refusal.** When the stage cannot start, it must fall back to the list before any layout change is committed (no visible collapse); add a test that forces WebGL off and asserts no layout shift of the list.
