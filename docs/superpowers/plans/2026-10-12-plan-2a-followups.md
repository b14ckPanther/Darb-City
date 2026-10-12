# Plan 2A follow-ups

Carried from the Plan 2A execution ledger (2026-10-12). Rulings made on the owner's behalf, and deferred findings to schedule in Plans 2B, 3 and 4.

## Rulings

- Ruling: Task 1 Step 1 skipped — branch already created with the plan commit e42f32f — cost: none.
- Ruling: briefs may display compressed through the session tooling; implementers read briefs in <=150-line chunks and use headroom_retrieve on any compression marker — cost: none.
- Task 5: complete (11f4219..7f8e474) — Ruling: controller reviewed the 132-line copy diff directly (brief-verbatim strings, parity tests green) — cost if wrong: final review re-reads i18n
- Ruling: later briefs stop the web server with `pkill -f next-server` (not "next start") — cost: none.
- Ruling: VC2 widened to accept gold on region names, Example badge, nearest-place distances and the active chip (brief-mandated accents, still sparing) — cost: none.
- Ruling (owner confirmed 2026-10-12): founder@darb.co.il real; Instagram darbco correct; client links caramel/raghad/paz public. App-store copy reworded to what Darb does for the client ("We publish it for you on the App Store and Google Play…"), plus <bdi> around Latin store names in Arabic — fold into next dispatch
- Ruling: custom cacheHandler is gated to self-hosting (enabled only when VERCEL env is unset) and documented as a private Next internal pinned to 16.3.6; Plan 4 decides Vercel vs self-hosted web and the Vercel-side API-down behaviour — re-review found it displaces Vercel platform cache — cost if wrong: on Vercel an uncached page with API down returns 500 until Plan 4. Queue for next fix dispatch.
- Ruling: add Meisar (649, Arab village in Wadi Ara) and Ghajar (4501, Alawite Arab) to the Arab/Druze weekend list; Hossen 662 stays default (Jewish moshav) — cost if wrong: two villages show Saturday-closed examples
- Ruling: Christian-village pattern = Saturday takes Sunday hours, Sunday closed, Friday unchanged (implementer reading of ruling 3) — accepted — cost if wrong: 4 villages show a different Sunday
- Ruling: fold the user-visible Arabic minors (grammar, brand constructions, hijama cta gender, catering date, tutors 5 units) into the same content pass, and rename the e2e test — all are cheap user-visible copy; final review would mark them must-fix before preview anyway — cost: none
- Ruling: one fix wave = I1 (validate slugs before API path, test), M1 (ci permissions + !cancelled()), I2 (rows opened from a parent place keep the listed place's URL and list; close returns there; e2e Haifa→Kiryat Haim row)
- Ruling: I3 (open-now frozen under ISR) → Plan 4, gated before preview deploy; render open state client-side from hours with isOpenAt — cost if wrong: stale Open badge on low-traffic pages until then
- Ruling: I4 (level-3 filters: open now, delivers, near-me distance) → Plan 3 (search & filters), API openNow path reworked first — owner delegated; filters belong with search — cost: spec §3.2 filters arrive one plan later
- Ruling: I5 (modal sheet blocks map) → Plan 2B design input: non-modal desktop panel, no scrim, Escape respects defaultPrevented
- Ruling: final-review Plan-4 bucket (timingSafeEqual, siteUrl throw, server-only, NearMe coords POST/rounding, live region, CLS, path bar ellipsis, revalidate expire:0, robots/sitemap/noindex, 404 cache growth, prefetch=false on long indices) recorded for Plan 4
- Ruling: accept sub-place row URL /{listed}/{sector}/{kind}/{ownPlace}/{slug} — seed twins (all 205 Kiryat Haim slugs also exist in Haifa) make the 4-segment form ambiguous; canonical points to own place — cost if wrong: one more URL shape for 2B camera/links

## Deferred findings

- Task 1: minor (deferred): openNow=true loads all candidates then filters; limit change between pages skews offset; subtreeIds startsWith needs trailing-slash comment
- Task 7: minor (deferred): revalidate secret uses !==; no server-only import in api.ts/site.ts; siteUrl falls back to localhost in prod; style guard misses s-units; links test lacks //evil.com case; reduced-motion is a cut, not a short fade
- Task 8: minor (deferred): web /api/businesses returns 404 for malformed cursor (getBusinesses maps any non-200 to null)
- Task 10: minor (deferred): phone path bar wraps up to 4 lines (consider middle-crumb ellipsis); route.ts locale enum hard-coded; dropped metric fallback may shift layout
- Task 16: minor (deferred): drag past full unclamped; returnFocusTo lacks CSS.escape; duplicate app link keys; taxonomy load not cached
- Task 18: minor (deferred): coords in GET query (round to ~2 decimals or POST); role=status mounted populated; distinct 404/503 messages
- Task 20: minor (deferred): owner must confirm contact email, Instagram handle, App Store/Google Play claim; Arabic bidi around "App Store وGoogle Play"
- Fix A: minor (deferred): navigator.share non-abort failures swallowed; ink not guarded against surface colour; Escape listener ignores defaultPrevented; ApiBadRequestError uncaught in kind layout
- Task 21: minor (deferred): sheet position read before animation settles; ci.yml lacks permissions: contents: read, uses always() not !cancelled(); bdi not asserted in rendered HTML; retries:1 in CI
- Task 24: minor (deferred): rose-valley-cabins is a thin rename of Ein Al Ward
- Final fix: minor (deferred): rows use primary kind (secondary/sub-kind listing opens under another kind); business tag for parent-place level 4 is business:haifa/slug — Plan 4 revalidation must also send businesses tag
