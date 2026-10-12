# Darb-City v1 (the showroom): design

Date: 2026-10-12
Status: draft, awaiting review
Scope: sub-projects 0 (Foundation), 1 (Discovery web) and 2 (Smart search)

## 1. Intent

Darb (درب, "path") becomes **Darb-City**: one place where anyone can find any halal business, of
any kind, in any city, town or village, and reach it in a few taps. It replaces the current
darb.co.il, whose long, scroll-driven 3D "Universe" made people travel through the whole city
before reaching anything.

Darb-City grows in two phases on one structure:

- **Phase A, showroom (this spec).** The city is filled with clearly labelled example businesses
  that show what Darb builds for every kind of business, next to Darb's real clients.
- **Phase B, directory (later specs).** Real businesses join: anyone may list for free, the Darb
  team seeds listings that owners later claim, and Darb-built web and native apps are the paid
  upgrade. Example and real businesses live side by side.

Priorities, in order: experience and smoothness, speed, ease of use, then everything else.

### Success criteria for v1

1. Every sector, kind and launch place is reachable in at most three taps from the home screen,
   with no forced scrolling.
2. A person can type a need in Hebrew, Arabic or English, in their own words, and land on the
   right kind in the right place.
3. Adding a city, village or business kind requires data only, no code.
4. Performance budgets in section 9 hold on a mid-range Android phone over 4G.
5. darb.co.il switches to Darb-City without losing the old site as a fallback.

### Fixed constraints

- **Halal only.** No alcohol, pork, gambling, nightlife, tattoo or immodest businesses. Enforced
  by a curated taxonomy (section 4.3), not by moderation alone.
- **Identity carries over unchanged** (section 10).
- **Launch country:** Israel. Languages: Hebrew (default, at `/`), Arabic (`/ar`), English (`/en`).
- **Launch region:** all of northern Israel (section 11).
- **Stack:** pnpm + Turborepo monorepo; Next.js web; NestJS + Prisma + PostgreSQL API; Clerk auth;
  Expo for mobile (later sub-project, but shared packages are built ready for it now).
- **Repository:** `b14ckPanther/Darb-City` at `~/Documents/GitHub/Darb-City`, starting empty. The
  old `Darb` and `Darb-2.0` repos are references only; no code is carried over.

## 2. Product decomposition

| # | Sub-project | In this spec |
|---|---|---|
| 0 | Foundation: monorepo, tokens, data model, API, auth, contracts, i18n | yes |
| 1 | Discovery (web): the Zoomable City and experience sheets | yes |
| 2 | Smart search: instant + AI lanes | yes |
| 3 | Owner studio: sign-up, claims, editing, verification, moderation | no |
| 4 | Mobile app (Expo) | no |
| 5 | Actions: real bookings, orders, quote requests, notifications | no |
| 6 | Premium tier: billing, plans, Darb-built app integration | no |

Each later sub-project gets its own spec, plan and build cycle. v1 must not implement them, but its
data model and module boundaries must accept them without restructuring.

## 3. Experience

### 3.1 Navigation model: the Zoomable City

Two visual layers, one continuous motion:

- **Places** are a real map (MapLibre GL with a custom Darb style).
- **Inside a place**, the map crossfades into a **2.5D plaza**: the Darb gate at the centre,
  sectors as lit streets, kinds as gold doors. Drawn with Canvas/SVG on the web (Skia on Expo
  later), layered for depth and parallax, never full 3D.

### 3.2 Levels and URLs

Every level is a real, shareable, server-rendered URL. Locale prefix: none (he), `/ar`, `/en`.
Slugs are English transliterations and stay the same in every locale.

| Level | URL | Content |
|---|---|---|
| 0 Country | `/` | Map of Israel. Live places glow by business density. Search bar in focus. |
| 1 Place | `/{place}` | Map flies in and crossfades into the place's plaza of sectors. |
| 2 Sector | `/{place}/{sector}` | The sector's doors, one per kind, each with a live count. |
| 3 Kind | `/{place}/{sector}/{kind}` | Businesses as list + map (side by side on desktop, bottom sheet over map on mobile). Filters: open now, near me, delivers, other kind attributes. |
| 4 Business | `/{place}/{sector}/{kind}/{business}` | The experience sheet (section 3.4). |
| Kind, nationwide | `/k/{kind}` | That kind across all live places. |
| Kind, in a place | `/{place}/k/{kind}` | Shortcut used by search, skipping the sector. |

Sub-places (neighbourhoods) narrow level 3 with a filter rather than adding URL depth.

A door for a kind with no businesses in the current place stays visible and opens to
"None in {place} yet", plus the nearest places that have one, ordered by distance.

### 3.3 Persistent controls

- **Path bar:** a breadcrumb (`Israel ▸ Haifa ▸ Beauty ▸ Barber`). Any step flies back to that
  level. Browser back and pinch-out go up one level.
- **Search:** top bar plus ⌘K on the web; a bottom bar within thumb reach on mobile. A chosen
  result flies the camera to its level.
- **Near me:** asks for location only when tapped, then jumps to the nearest live place, or
  filters the current kind by distance.
- **Locale switch** keeps the current URL.
- **For businesses:** a link from the gate to `/for-business`, the marketing page (what Darb
  builds, live client work, contact). People looking for a business never have to pass through it.

### 3.4 Experience sheets and templates

Opening a business shows its **experience sheet**. It's a sheet on mobile (peek, half and full
snap points) and a side panel on desktop, so the city stays visible behind it.

Each kind names one **experience template**, and the business's content fills it. v1 templates
(from the existing Universe archetypes): `menu`, `booking`, `shop`, `portfolio`, `listing`,
`schedule`, `quote`, `donate`, `tracker`, `pass`, `builder`.

Every sheet has: name, kind, "Example" or tier badge, open-now state, photos, the template body,
one **primary action**, and secondary actions (call, WhatsApp, directions, share). In v1, primary
actions that need sub-project 5 (book, order, request a quote) open WhatsApp or a phone call with a
prefilled message. `darb`-tier businesses also show **Open the app** (web, App Store, Google Play
links).

Templates are React components in `ui-web`, each with its own content schema (section 4.3). A new
template is the only kind of growth that needs code.

### 3.5 Motion

- Level changes are camera moves (fly, zoom, crossfade) of 400–700ms with the Darb ease-out
  curve. Content appears before the motion finishes, so motion never blocks reading.
- Only transform and opacity are animated.
- With `prefers-reduced-motion`, levels switch with a short fade and no flying.

## 4. Data model

Everything that grows is data. Text fields that face people use `Localized = { he?, ar?, en? }`
with at least one value. Display fallback is the requested locale, then Hebrew ↔ Arabic (whichever
exists), then English.

### 4.1 Place

- `id`, `slug` (unique), `type` (country, region, city, town, village, neighbourhood), `parentId`
  (unbounded tree), `path` (materialized ancestry for subtree queries)
- `name: Localized`, `aliases: string[]` (all known spellings in all scripts, including
  transliterations)
- `point` and optional `boundary` (PostGIS), `population`, `cbsCode` (official locality code)
- `status`: `live` or `soon`

### 4.2 Sector

`id`, `slug`, `name`, `tagline`, `accent` (hex, warm and desaturated), `order`. The 18 sectors of
the current Universe are the seed. The UI calls them by their own names ("Beauty Row"). The word
"district" is avoided in the data because Israel's official districts are Places.

### 4.3 Kind

- `id`, `slug`, `sectorId`, optional `parentKindId` (sub-kinds, for example Restaurant → Hummus)
- `name: Localized`, `synonyms: { he: string[]; ar: string[]; en: string[] }` (colloquial and slang
  forms)
- `template` (one of section 3.4), `contentSchema` (JSON schema validating `Business.experience`)
- `attributes`: the filter attributes this kind supports (delivers, women-only hours, parking…)
- `icon`, `order`, `status` (`active` or `hidden`)

Only curated kinds exist. Each kind passes a halal review before it is set to `active`, and owners
can choose only from active kinds.

### 4.4 Business

- `id`, `slug` (unique within its place), `name: Localized`, `tagline: Localized`
- `primaryKindId`, `kindIds[]`, `placeId` (the most specific place containing `point`), `point`,
  `address: Localized`
- `phone`, `whatsapp`, `website`, `photos[]` (R2 keys with alt text)
- `hours`: weekly intervals in `Asia/Jerusalem`, plus dated exceptions (holidays, Ramadan,
  closures), supporting overnight intervals
- `attributes`: values for the kind's attributes
- `experience`: JSON validated against the primary kind's `contentSchema`
- `tier`: `example`, `basic`, `verified` or `darb`; `apps`: `{ web?, ios?, android? }` (darb only)
- `source`: `seed`, `self` or `claimed`; `status`: `draft`, `published` or `suspended`
- `brandId` (optional): groups branches of one chain
- `organizationId` (optional): the owning organization

### 4.5 Ownership (schema in v1, flows in sub-project 3)

- **Organization:** mirrors a Clerk organization. Members have roles: owner, staff.
- **Claim:** `businessId`, `userId`, `method` (phone code or documents), `status` (pending,
  approved or rejected), `reviewedBy`.
- **User:** mirrors a Clerk user (id, locale, admin flag).

### 4.6 Search data

`SearchDocument`, one per place, kind and published business:

- `entityType`, `entityId`
- normalized text per language (section 5.1), trigram index, full-text vector
- `embedding` (pgvector), `point`, denormalized filter fields (place path, kind ids, attributes,
  tier)

It is rebuilt by a background job whenever its source row changes.

### 4.7 Search log

`SearchQuery`: normalized text, locale, parsed intent, result count, top result clicked (if any),
timestamp, with no user identity. It feeds the admin's **Missing kinds and places** report.

## 5. Smart search

### 5.1 Normalization (`packages/search-text`, shared by browser, phone and server)

- **Hebrew:** strip niqqud and cantillation; fold final letters (ך כ, ם מ, ן נ, ף פ, ץ צ); strip
  geresh and gershayim.
- **Arabic:** strip tashkeel and tatweel; fold أ إ آ ٱ → ا, ة → ه, ى → ي, ؤ → و, ئ → ي.
- **Latin:** lowercase, strip diacritics, and map Arabizi digits (2 → ء, 3 → ع, 5 → خ, 7 → ح, 9 → ق)
  to a second key.
- Remove punctuation and collapse whitespace. The same function runs at index time and at query
  time.

### 5.2 Lane 1: Instant

- A **compact index of all places and kinds** (names, aliases and synonyms, already normalized) is
  built at deploy time and shipped to the client as a static, cacheable file (target under 120KB
  compressed). Prefix and fuzzy matching run in the browser with no network call.
- Business-name suggestions come from `GET /search/suggest` (trigram plus prefix in Postgres,
  cached at the edge).
- Results are grouped: Places, Kinds, Businesses. Choosing one navigates to its URL.

### 5.3 Lane 2: Smart

Triggered when the query is submitted, or when it looks like a sentence (four or more words or a
question).

1. **Intent:** `POST /search` sends the query, locale and optional coordinates. The AI module asks
   Claude Haiku, through tool use with a strict schema, to return
   `{ kindIds[], placeId?, nearMe, openNow, attributes{}, freeText }`. The model receives the
   candidate kinds and places from Lane 1 matching (not the whole taxonomy) and may only return
   ids from those candidates or from the active-kind list.
2. **Retrieval:** a single Postgres query filters by kind (including sub-kinds), place subtree
   or radius, published status, open-now (computed from hours at query time) and attributes.
3. **Ranking:** a weighted blend of text score, vector similarity between the query embedding and
   the business embedding, distance (when known), completeness, and a tier boost capped so it can
   only reorder results of similar relevance. Weights live in config and are covered by the ranking
   tests (section 9.3).
4. **Response:** results plus the parsed intent, rendered as **editable chips**. Removing a chip
   re-runs retrieval without calling the model again.

### 5.4 Guarantees

- **Fallback:** if the model call fails or exceeds 1.5s, the response is built from Lane 1 matching
  alone, and the UI shows nothing unusual.
- **Cost:** intents are cached in Redis by normalized query and locale for 7 days. `/search` is
  rate-limited per IP (default 30 per minute).
- **Halal:** a list of blocked terms in three languages (alcohol, gambling, nightlife…) short-circuits
  to a respectful "not on Darb" state without calling the model.
- **Privacy:** coordinates are sent only after "Near me" and are never stored. The search log keeps
  no identity.

## 6. Architecture

### 6.1 Repository layout

```
apps/
  web/           Next.js App Router: city, search, sheets, /for-business, /admin
  api/           NestJS: places, taxonomy, businesses, search, ai, admin, media
packages/
  contracts/     zod schemas + typed client (ts-rest)
  core/          pure domain logic: hours and open-now, tiers, slugs, locale fallback
  search-text/   normalization + instant index builder and matcher
  tokens/        brand tokens (colour, type, spacing, motion) + mark assets
  ui-web/        web components and experience templates
  i18n/          interface copy (he, ar, en), typed so a missing string fails the build
  seed/          reviewed data files: places, sectors, kinds, showroom businesses
infra/           Dockerfiles, docker-compose for Postgres (PostGIS + pgvector) and Redis
```

`apps/mobile` arrives in sub-project 4 and depends on `contracts`, `core`, `search-text`,
`tokens` and `i18n` unchanged. Those packages must not import DOM or Node-only APIs.

### 6.2 API (NestJS)

Modules own their tables and expose services. Other modules call those services, never each
other's tables.

- **Places:** the tree, lookups by slug or coordinates, nearest live places.
- **Taxonomy:** sectors, kinds, schemas.
- **Businesses:** reads, the admin writes, validation of `experience` against the kind schema.
- **Search:** suggest, search, indexing jobs (BullMQ), and the search log.
- **AI:** the intent extraction client and embeddings client, behind interfaces so providers can be
  swapped.
- **Admin:** guarded by Clerk and the admin flag; CRUD for everything in v1.
- **Media:** signed R2 uploads, image variants.

Writes emit domain events. A listener re-indexes the affected `SearchDocument` rows and calls the
web revalidation endpoint for the affected URLs.

Prisma holds the schema. PostGIS and pgvector columns are declared as `Unsupported` and queried
through typed raw SQL in the Search and Places repositories only.

### 6.3 Web (Next.js)

- Pages for levels 0–4 render on the server with incremental static regeneration, are cached at
  the edge, and are revalidated on demand by the API.
- The map and plaza are client components loaded after the search bar and the list fallback are
  interactive.
- `/admin`, guarded by Clerk, is for the Darb team to manage places, kinds, showroom businesses
  and the Missing kinds and places report.

### 6.4 Hosting and services

| Need | Choice |
|---|---|
| Web | Vercel |
| API | Railway, Docker, EU region |
| Database | Neon PostgreSQL with PostGIS and pgvector, EU region |
| Cache, rate limits, jobs | Redis on Railway (next to the API) + BullMQ |
| Images | Cloudflare R2 + image resizing |
| Map tiles | Protomaps PMTiles extract of Israel on R2, Darb style |
| AI | Claude Haiku (intent), Voyage AI multilingual embeddings (models pinned during planning) |
| Auth | Clerk (admin only in v1) |

### 6.5 Local development

`pnpm dev` starts Postgres, Redis, the API and web, runs migrations and loads the seed. Exact
dependency versions are pinned during planning.

## 7. Errors and empty states

- **API unreachable:** pre-rendered pages still render. Search drops to Lane 1 places and kinds, and
  a quiet notice offers a retry.
- **No results:** show the parsed chips, suggest removing the narrowest one, and list nearest places
  that have the kind.
- **Unknown URL slug:** fuzzy-match against places and kinds and offer the closest match, otherwise
  show a 404 inside the city frame.
- **Map or plaza fails to load** (old device, WebGL off): the list view is the full experience.
- **Location denied:** "Near me" explains in one line and opens place search.

## 8. Accessibility and localization

- Every level has a complete list-and-link view. The map and plaza are enhancements. Keyboard and
  screen-reader users get the same city.
- Hebrew and Arabic are right-to-left, English left-to-right, with logical CSS properties
  throughout. Numbers, phone numbers and opening hours are formatted per locale.
- Touch targets of at least 44px, visible focus, and WCAG AA contrast on forest and night
  backgrounds.
- Fonts: Ubuntu (Latin), Heebo (Hebrew), Cairo (Arabic), each limited to the scripts it covers.

## 9. Quality

### 9.1 Performance budgets (enforced in CI)

- Mid-range Android over 4G: Largest Contentful Paint under 1.5s, first-load JavaScript under
  150KB compressed for levels 0–4, before the map and plaza chunk.
- Instant suggestions under 50ms on device. Smart results under 1s at p95 with a warm cache.
- 60fps during level transitions on a mid-range phone.

### 9.2 Accessibility checks

axe checks on every level in all three locales, as part of the end-to-end tests.

### 9.3 Tests

- **Unit (Vitest):** normalization for all three scripts and Arabizi; hours and open-now (overnight,
  Friday, Saturday, Ramadan, holiday exceptions); slugs; locale fallback; mapping from intent to
  filters.
- **Search quality:** a fixed set of at least 60 real-world queries (20 per language), each with the
  kind and place it must find in its top 3. Runs against the seed database, with the model call
  recorded for repeatable results.
- **API integration:** each module against a disposable Postgres instance.
- **End-to-end (Playwright):** every level, search, near me (mocked location), the path bar and the
  locale switch, at phone and desktop sizes, with screenshot comparison.
- **CI** on every pull request: typecheck, lint, tests, budgets.

## 10. Identity

Copied as-is, never redrawn:

- **The Darb doorway mark:** the approved raster masters from `Darb-2.0/public/brand`
  (`darb-mark-*.webp`, icons, Open Graph images). The doorway silhouette path in
  `Darb-2.0/src/components/brand/Door.tsx` is used for door shapes and clip masks.
- **The bilingual wordmark** Darb / درب.
- **Palette:** night `#03110c`; forest `#051811` `#08241a` `#0e3527` `#1d5a43` `#3f8a6c`; gold
  `#6d4c17` `#b9852f` `#d9a54c` `#f0c77a` `#fbe7bd`; ivory `#fbf7ec` `#efe8d6`; ink `#0b2219`
  `#4c5f56`. Sector accents come from the existing Universe data.
- **Motion curves:** ease-out `cubic-bezier(0.22, 1, 0.36, 1)`, ease-in-out
  `cubic-bezier(0.65, 0, 0.35, 1)`.
- **Rules:** those in the old `Darb/docs/BRAND.md`. The doorway is a permanent brand primitive.
  Business identity (names, photos, template palettes) stays separate from Darb's corporate
  styling.

## 11. Seed content

- **Places:** every locality in Israel from the official CBS list, with HE/AR/EN names, aliases and
  coordinates, all marked `soon` except the launch region.
- **Launch region, `live`:** every city, town and village in the **Northern and Haifa districts**,
  Arab, Jewish and Druze alike. That includes Haifa, Akko, Judeida-Makr, Sakhnin, the Krayot
  (Kiryat Ata, Bialik, Motzkin, Yam, Haim), Ma'alot-Tarshiha, Nahef, Tamra and Nazareth.
- **Flagship density:** Haifa, Akko, Judeida-Makr, Sakhnin, the Krayot, Ma'alot-Tarshiha, Nahef and
  Tamra each get at least one example business for every active kind. Other live places get
  examples in the most common kinds, and every door still works through the nearest-place fallback.
- **Taxonomy:** the 18 sectors and roughly 200 kinds of the current Universe data, re-reviewed for
  halal, given templates, content schemas and synonyms in all three languages.
- **Showroom businesses:** fictional but specific, tagged `example`, generated from the existing
  Universe screen content and reviewed before publishing. Caramel, Raghad and Paz are seeded as
  real `darb`-tier clients linking to their live sites.

## 12. Launch

1. Deploy to a preview URL and pass all section 9 checks there.
2. Point darb.co.il at the Darb-City Vercel project. The old project stays deployable for two
   weeks as a rollback.
3. Retire admin.darb.co.il.

## 13. Out of scope for v1

Owner sign-up, claims and editing (3); the Expo app (4); real bookings, orders and quotes inside
Darb (5); billing and plans (6); countries other than Israel; user accounts for the public.
