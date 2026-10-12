# Plan 2B follow-ups

Carried from the Plan 2B execution ledger (2026-10-12). Rulings made on the owner's behalf, and deferred findings to schedule in Plans 3 and 4.

## Rulings

- Ruling: Task 1 branch step done by controller — cost: none
- Ruling: briefs may display compressed; workers read <=150-line chunks, copy code with sed, use headroom_retrieve — cost: none
- Ruling: ship MapLibre LICENSE.txt beside vendored modules (copy-map.mjs) and fade on every level change under reduced motion — fold into Tasks 8-11 dispatch (licence obligation + spec constraint) — cost: none
- Ruling: extract default stays "latest" but prints and records the chosen build; --build validated against /^\d{8}$/ — reproducibility comes from israel.json + --build — cost: none
- Ruling (owner 2026-10-12): the app never brands itself "halal" — the halal-only selection is the owner's private choice, not the product theme. Queued after Tasks 12-15: tagline in he/ar/en → "Every business, in every city, town and village."; kind "Halal butchers" display name → "Butchers" (synonyms keep "halal meat" for search); README wording. Example businesses that mention halal food as their own detail: pending owner answer
- Ruling: accept VC13 deviation — header spans full width over stage (600px column fails tap sizes) — cost: none
- Ruling (owner delegated 2026-10-12): (1) remove country/territory/region labels from the basemap style (keeps the map neutral, focused on towns); (2) basemap labels in the page language only, no second-script line; (3) keep "halal" inside example businesses' own descriptions (realistic business claims). Items 1-2 queued after Tasks 16-18 (style.mjs + test)
- Ruling: first CI run on the PR is the real verification of the SwiftShader path; if phone LCP fails there, drop --use-angle=swiftshader in CI — cost: one CI iteration
- Ruling: fix wave = I1 (header stacking: header z-index 2, Sheet via portal, e2e NearMe topmost), I2 (desktop sheet must not trap Tab), I3 (44px map hit box + pickable labels, nearest feature). I4 (tiles env guard, R2 CORS, CSP) → Plan 4; I5 (stage budget counts all lazy chunks) → Plan 3 first task; M5 (search combobox must preventDefault Escape) → Plan 3
- Ruling: accept phone stage ending above the pill with search usable over it (VC14 amended) — search reachable on every view is worth 144px — cost: smaller phone map

## Deferred findings

- Task 3: minor (deferred): plaza narrow-width degenerate case <130px; streets to front-row doors cross back rows (check visually Task 14/17)
- Task 6: minor (deferred): no Last-Modified/304/If-Range; case-sensitive bytes unit; stat errors all 404; abort path untested; NEXT_PUBLIC_MAP_TILES_URL unconsumed until stage/Plan 4
- Task 4: minor (deferred): density joins non-live sub-places; API sends no cache header
- Task 8: minor (deferred): glyph range 512-767 skipped; SAGE hard-coded in style.mjs; Escape test only in phone mode
- Task 15: minor (deferred): post-ready WebGL/source failures not handed to onFail; window.darbStage not removed; spurious show() on client nav; refreshed() heuristic loose; plaza street web / label overlap / empty space at level 2; level 0 density visual
- Task 15: minor (deferred): no-op move settles via 800ms fallback; phone padding ignores safe-area inset; duplicated PADDING constants
- Task 17: minor (deferred): navigate-during-move test has a non-atomic read race; weak long-task sanity guard; sub-place test checks attribute not camera centre; budget counts every lazy chunk as stage
- final: minor (deferred): desktop sheet DOM order (Tab goes to chrome); pre-hydration sheet under header on slow JS; label beats pin at exact tap; hit test anchored on dot
