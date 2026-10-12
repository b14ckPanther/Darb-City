# Plan 1 follow-ups

Carried from the Plan 1 execution ledger (2026-10-12). Rulings made on the user's behalf, and deferred review findings to schedule in Plans 2–4.

## Rulings

- Ruling: add `varsIgnorePattern: "^_"` to the Task 1 ESLint rule — keeps Task 14's planned destructure lint-clean — cost if wrong: none.
- Ruling: add `packages/seed/data/*.json` to `.prettierignore` in Task 1 — generated data, formatting churn adds nothing — cost if wrong: data JSON unformatted by Prettier (it is still written with 2-space indentation).
- Ruling: skip Task 1 Step 1 (branch exists) — controller created `feat/plan-1-foundation` — cost: none.
- Ruling: batch Tasks 1–5 into one dispatch and one review — all fully specified, small, sequential, same package/tooling — cost if wrong: a larger single review.
- Ruling: turbo 2.11 writes an AGENTS.md agent-guidance block; opt out with `"agentGuidance": false` in turbo.json and delete the untracked AGENTS.md (folded into Task 6 dispatch) — the repo's own rules belong in docs, not a vendor-managed file — cost if wrong: agents lose turbo's version-docs hint (trivial).
- Ruling: Task 7 base image → official multi-arch postgres:17-bookworm + apt postgresql-17-postgis-3 + postgresql-17-pgvector (PGDG repo is preconfigured) — postgis/postgis has no arm64 build; official base avoids emulation and unofficial images — cost if wrong: slower first image build (~1 min).
- Ruling: pnpm 11 replaced onlyBuiltDependencies with allowBuilds — keep allowBuilds — plan's key is obsolete — cost: none.
- Ruling: remove minimumReleaseAgeExclude and pin @swc/core to 1.16.2 (2026-09-04) instead of 1.16.18 (published 2026-10-11, 1 day old) — never bypass the release-age supply-chain guard — cost if wrong: an older swc lacks a fix we never needed.
- Ruling: Task 9 drift — declare point as `Unsupported("geography(Point,4326)")? @default(dbgenerated("(st_setsrid(st_makepoint(lng, lat), 4326))::geography"))` (exact expression as Postgres reports it) plus `@@index([point], type: Gist)` on Place and Business; keep the hand-edited GENERATED ALWAYS migration — Prisma introspects the generation expression as a default, so declaring it makes diffs empty — cost if wrong: a future Prisma version may try to rewrite the column; drift check in CI would catch it.
- Ruling: promote review minor "global-setup can DROP SCHEMA on the dev DB" into Task 11 dispatch: refuse unless TEST_DATABASE_URL's db name ends in _test — data-loss guard is cheap — cost if wrong: none.
- Ruling: `stations` (Fuel and service stations, Paz's trade) uses template `listing` (station services, fuel and hours), not the implementer's `schedule`; Task 15 adds its hand-written he/ar/en screen to extra-screens.json — customers browse services, shift scheduling is the owner-side app — cost if wrong: one kind's template changes later.
- Ruling: kind count is 205 everywhere the plan says 204 (flagship coverage = 205 kinds) — source of truth is Darb-2.0 data — cost: none.
- Ruling: fold into Task 15 — Hebrew haram blocklist matches with an optional one-letter prefix (ה ב ל ו ש כ מ), terms regex-escaped, comment noting Arabic tests are gated by Task 15 — cheap hardening before synonyms are added — cost: none.
- Ruling: all kinds stay `active` pending the user's halal decision on spas (mixed massage), escape-rooms and 11 others listed in task-15-report.md — plan says ask the user, never decide; asked in final summary — cost if wrong: questionable kinds visible in dev seed until user answers (flip status to hidden).
- Ruling: scoped re-review of d85c662 done by controller reading the 11-line diff (each finding visibly addressed, no other lines touched) instead of a subagent — dispatch cost exceeds the change — cost if wrong: final whole-branch review re-checks kinds.json.
- Ruling: exclude CBS military camps (names starting "מחנה", 8 rows) from places — not civilian settlements, no businesses, placeholder coordinates — apply in Task 16 fix round — cost if wrong: 8 camps missing from the map.
- Ruling: `type` is fixed in this round for all CBS rows — city = municipal city status (עירייה), town = local council, village = everything else; no CBS row is `neighbourhood` — Plan 2 sizes the map by type — cost if wrong: a few places sized wrongly on the map.
- Ruling: slug fixes (nahariya, tamra-yizreel name) ride with Important #2 since slugs are permanent URLs — cost: none.
- Ruling: businesses.json drops the repeated `experience`; loadBusinesses() attaches `experience: loadScreens()[primaryKind]` at load time (SeedBusiness type unchanged), file written compact-per-record; rewrite unpushed commit 81de5cf so the 34MB blob never enters history — a 34MB data file of duplicated screens bloats the repo forever — cost if wrong: per-business custom experience needs the field back (owner studio adds it in the DB, not seed).
- Ruling: run prettier on packages/seed/scripts/fetch-places.ts (Task 16 left it unformatted) in this same fix — cost: none.
- Ruling: one fix wave = Important 1+2, tagline typos, i18n t(), RESERVED_SLUGS, turbo api test cache off. Loader reconciles (cbsCode-keyed upsert, hide missing kinds, suspend missing source=seed businesses, single transaction per entity group); field ownership vs admin edits decided at Plan 4 — cost if wrong: Plan 4 revisits loader.
- Ruling: civic place-named brands, Saturday hours, Arabic brand names, pagination → first tasks of Plan 2 (gated before preview deploy) — cost: none until deploy.

## Deferred findings

- Task 4: minor (deferred): hours.ts does not validate HH:MM; malformed → NaN → reads closed (contracts HoursSchema regex in Task 10 guards API input)
- Task 4: minor (deferred): open == close semantics (24h + tail) undocumented/untested
- Task 4: minor (deferred): DST test name — 22:30Z is before the repeated hour
- Task 3: minor (deferred): slug.ts combining-mark range written as literal chars; prefer ̀-ͯ escapes
- Task 7: minor (deferred): postgres:17-bookworm floating tag; pin digest before production use
- Task 10: minor (deferred): empty lat= coerces to 0 (passes range) — should 400
- Task 10: minor (deferred): website field not URL-validated; apps.* accept non-http schemes (web must render http(s) only)
- Task 10: minor (deferred): exception date regex accepts impossible dates; open may be 24:00
- Task 10: minor (deferred): no router/taxonomy-schema tests
- Task 9: minor (deferred): config missing-var message is zod's generic "Required"
- Task 9: minor (deferred): point columns must only change via hand-written SQL; document in API README
- Task 8: minor (deferred): all api tests require Postgres (global setup)
- Task 13: minor (deferred): openNow false (not null) on days without hours when only exceptions exist; hours JSON cast unvalidated
- Task 13: minor (deferred): hidden kind ids can appear in primaryKindId/kindIds (plan-mandated)
- Task 11: minor (deferred): "never soon" nearest test lacks status 200 assertion; tier ordering untested
- Task 11: minor (deferred): path index lacks text_pattern_ops for startsWith
- Task 13: minor (deferred): businesses list unbounded (no pagination) — Plan 2/3 must address before /israel lists
- Task 14: minor (deferred): haram gate scans kind names/synonyms only, not screen text
- Task 15: minor (deferred): taglines tech بجيب→بتجيب, home بحتاجه→بيحتاجه (user-visible; fix before merge)
- Task 15: minor (deferred): لحام on butchers vs welding; سمكري homograph
- Task 15: minor (deferred): haram regex lacks Arabic attached prefixes (ال/و/ب/ل); Hebrew prefix blocks שבר/כבר
- Task 15: minor (deferred): import-universe.ts re-run wipes Arabic/synonyms — add guard or one-shot comment
- Task 15: minor (deferred): coach/كوتش across trainers/courses/tour-buses; פרגולה on curtains; فطور on hummus
- Task 16: minor (deferred): wrong Arabic on several Jewish localities (yesodot, meitsar, magen-shaul, tel-katzir, allone-abba, zurit, ein-hod); twin -<cbs> slugs share names; aliases repeat uppercase CBS string
- Task 16: minor (deferred): no explicit test for apostrophe-cap en names (fixed in data + titleCase)
- Task 17: minor (deferred): showroom hours close Saturday everywhere — wrong for Arab towns (Sat workday, Fri short); revisit per-place weekend pattern
- Task 17: minor (deferred): 200/205 brand names and showroom screens lack Arabic (falls back to Hebrew) — planned content follow-up
- Task 17: minor (deferred): place-specific brands (e.g. "Umm al Fahm Municipality") replicated into every town
- Task 17: minor (deferred): flagship test covers only sakhnin; missing-screen throw untested
- Task 18: minor (deferred): non-null lookups give opaque errors on bad refs; no tx; cycle/unknown-place paths untested
