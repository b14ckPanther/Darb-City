# Plan 3 follow-ups

Carried from the Plan 3 execution ledger (2026-10-13). Rulings made on the owner's behalf, and deferred findings to schedule in Plan 4 and later.

## Before the Anthropic or Voyage keys go live (Plan 4 blockers)

- Global model-call budget in Redis with an in-memory fallback that degrades to lane 1; IPv6 bucketed by /64; IP_HASH_SALT required in production; short negative cache for unhelpful answers; optional circuit breaker.
- Enforce SEARCH_PROXY_KEY (>= 32 chars) on API and web in production; tie to the Vercel vs self-host decision.
- Stable intent-cache key (active kind slugs only); non-blocking SearchEvents.changed; refresh the model's kind list without restart; cross-replica instant-index invalidation; runtime (not build-time) browser instant index for admin-added places.
- Embedding content hash (skip unchanged rows), Voyage 429 backoff, seeding without embeddings in deploy pipelines; confirm voyage-4-lite 512-dim against the live API.

## Rulings

- Ruling: briefs may display compressed; workers read <=150-line chunks, copy code with sed, use headroom_retrieve — cost: none
- Ruling: عرق stays blocked only with a drink companion word or alone — avoid blocking عرق سوس (licorice) — cost: none
- Ruling: accept msgpackr-extract denied in allowBuilds (msgpackr falls back to pure JS; fewer native build scripts) — cost: slightly slower BullMQ serialization
- Ruling: killed stale API on :4100 left by the deleted PR #3 CI-fix worktree — cost: none
- Ruling: only businesses in live places are searchable (soon places are not open yet) — cost if wrong: soon-place businesses invisible to search until live
- Ruling: accept BullMQ deduplication id with keepLastIfActive instead of jobId (fixed jobId would drop later edits) — cost: none
- Ruling: no nextCursor on /search (ranked top 30, results page has no Show more) — cost: deep results need refinement via chips
- Ruling: add model-only quality cases (queries lane 1 cannot explain, e.g. symptoms/needs like "my car makes a noise") with hand-authored recorded intents, so the set proves the model path — folded into the 15-17 fix round
- Ruling: Arabic UI copy stays in the existing register (consistent with the app); no Levantine rewrite now — cost: slightly formal tone
- Ruling: click logging limited to searches from the last 24 h (not result-membership) — cost: a click on any place/slug within 24 h of a real search is accepted
- Ruling: soon places stay in the instant index (their pages exist), but a kind+soon-place pick routes to the place page, never an empty kind list; web .env.example gets SEARCH_PROXY_KEY matching the API dev value — fold into Tasks 24-25 dispatch
- Ruling: Enter submits via client navigation (next/form Form, no-JS fallback kept) — owner prioritises smoothness; a full reload reboots the map — cost: none
- Ruling: fold minors into the same round: index load retry on next focus, always-rendered live region in SearchBox with correct count, single active highlight (no hover-sticky on touch), localized "nationwide" sublabel, localized chip quotes + replacer fn, prefer x-vercel-forwarded-for and document XFF trust, nationwide search fits pin bounds, refocus reopens list, hide native clear x (or 44px), dir=auto on input
- Ruling: /search chip edits go in the URL (?q=…&drop=…) and the server page uses /search/results when drop is present — shareable, reload-safe, no repeat model call — cost: none
- Ruling: fold minors: near-me callback uses latest filters; check force-dynamic caching of viewContext (prefer connection()); explicit retry href. Queued after Tasks 21-23 fix agent (shared files)
- Ruling: accept chips= (kept chips) instead of drop=, replaceState for chip edits, URL re-sync of filters, revalidate=0 for /search — cost: none
- Tasks 24-25: fix round 1/5 re-review: 6/7 ADDRESSED; item 5 (explicit retry href) NOT ADDRESSED — parked: href="" reloads the current URL and keeps locale; cosmetic — Ruling: park, fold into final review fix wave if one runs
- Tasks 26-27: implemented 46811d0..3574aea (unit 1006, quality 95/95, e2e 232/0 fail, axe 0/69) — Ruling: per-task review of 26-27 folded into the final whole-branch review (tests+docs only) — cost: none
- Ruling: one fix wave = I1 (context rule for عرق, allow عرق النسا), I2 (pin offline providers in vitest/quality/playwright, reuseExistingServer only outside CI on a dedicated port), M1 (Bar-Ilan / sports bar / mini bar look-alikes allowed), M2 (blocked check in results()), M3 (embed same text in search and results)
- Ruling: I3 global model-call budget + IPv6 /64 + required IP_HASH_SALT + negative cache; I4 enforced proxy key; I5 stable intent-cache key, non-blocking SearchEvents, kind list refresh, cross-replica invalidation, runtime instant index; I6 embedding content hash + 429 backoff → Plan 4, blockers before ANTHROPIC/VOYAGE keys go live

## Deferred findings

- Task 3: minor (deferred): duplicate في stopword; blocked test copies seed gate list; typo tolerance tight for 4-7 letter names
- Task 7: minor (deferred): darb_intervals IMMUTABLE calls STABLE to_char; Redis errors swallowed; RECORDINGS env read at import; kind list frozen at boot; open-now page query no row cap; web does not round near coords
- Task 11: minor (deferred): indexAll re-embeds unchanged rows (add content hash before Voyage goes live — Plan 4); nextCursor for /search results paging (decide in Task 16/17)
- Task 17: minor (deferred): open-now with zero results should say "nothing open now" and offer the same kind later, not list the searched place in nearest; config key is EMBEDDING_PROVIDER (docs must match)
- Task 15: minor (deferred): prod proxy key min length; intent cache key lacks taxonomy version; verify system prompt meets Haiku minimum cacheable length
- Task 19: minor (deferred): report terms are raw user text — Plan 4 admin must treat as sensitive; report has no per-locale breakdown
- Task 16: minor (deferred): COALESCE distance term in SQL pre-cut; SQL active-weight set derived from query vs rank() from candidates
- Task 18: minor (deferred): arabiziForm drops ي/و on both sides (rare collisions); only STRONG places claim words — watch quality runs
- Task 25: minor (deferred): ?open=1 shared link paints unfiltered then swaps; no-JS ignores filters; lazy-budget first-route-wins dedupe
- Task 22: minor (deferred): module-level /search query may replay on SearchBox remount (manual check in final review); stale 30KB comment
- Task 24: minor (deferred): chip edit after Near me does not update URL (reload restores earlier chips)
- Task 26: minor (deferred): Show more untestable in e2e (no seeded second page); open-now e2e clock-dependent
