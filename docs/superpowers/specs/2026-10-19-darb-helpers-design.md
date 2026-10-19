# Darb Helpers: friends who add businesses from their own towns

Date: 2026-10-19 · Status: draft for the owner's review

## 1. What it is

A small installable app (PWA) inside Darb where approved helpers add businesses they walk past,
anywhere in the north. It reuses "Add from the street", the admin capture tool, and the same review
queue. A helper never publishes anything: every addition waits for an admin.

### Decisions the owner made (2026-10-19)

| Question | Decision |
|---|---|
| Who can join | Anyone can sign up; they wait for an admin to approve them |
| Where they can add | Anywhere in the north, no per-town limit |
| Public credit | The helper's choice: an on/off toggle in their profile |
| Rewards | Not in this version |

## 2. Who sees what

| | Visitor | Signed up, waiting | Approved helper | Suspended helper | Admin |
|---|---|---|---|---|---|
| Helper app home | sign-in screen | "waiting for approval" | capture + my list | "access paused" | yes (admins are helpers too) |
| Add a business | no | no | yes, lands as a draft | no | yes |
| Their own additions | no | no | yes (status only) | read only | all |
| Edit or delete existing businesses | no | no | no | no | yes |
| Admin dashboard | no | no | no | no | yes |

## 3. User flow

1. **Sign up.** A friend opens `darb.co.il/helpers` (or `/ar/helpers`, `/en/helpers`), signs in with
   Clerk (phone or Google, same Clerk app as the admin), then fills a one-screen form: display name,
   phone, home town (free choice from the places list, information only) and a short "why"
   (optional). They see "Thanks, we will let you know".
2. **Approval.** The admin sidebar gets a **Helpers** screen: Waiting / Active / Paused tabs, with
   approve, pause and resume buttons. The Overview shows a count of waiting helpers.
   (Notification to the helper is the screen itself on next open; no SMS or email in this version.)
3. **Install.** Once approved, the home screen shows an "Add to home screen" card (iOS steps shown as
   text, Android uses the install prompt). The helper app has its own manifest, name and icon, with
   `start_url` and `scope` set to `/helpers`, so it opens straight into the capture screen and never
   into the admin or the public map.
4. **Capture.** The same flow as admin street capture: storefront photo, sign reading, GPS pin or a
   pasted map link, name, kind, phone, duplicate check, offline queue with retry.
5. **My additions.** A list with each item's state: waiting, live (links to the public card), not
   added (with the admin's reason). A header line: "You added 23 · 18 live".
6. **Profile.** Display name, the public credit toggle (off by default), sign out.

## 4. Data

`User` gains:

- `helperStatus` enum `none | pending | approved | paused`, default `none`
- `helperName String?`, `helperPhone String?`, `helperPlaceId String?` (home town, information only),
  `helperNote String?`
- `helperCredit Boolean @default(false)`: show "Added by <helperName>" publicly
- `helperAppliedAt DateTime?`, `helperDecidedAt DateTime?`

No new table: helper additions are `JoinRequest` rows with `source = field` and `createdById` set,
exactly as admin captures are today. The admin queue tells them apart by the creator's `isAdmin`.

## 5. API

- New `HelperGuard`: the same Clerk token check and `User` upsert as `AdminGuard`, then requires
  `helperStatus = approved` **or** `isAdmin`. A shared helper extracts the token/upsert code so the
  two guards cannot drift.
- `POST helpers/apply`, `GET helpers/me`, `PATCH helpers/me` (name, credit toggle): signed in only.
- `helpers/field/*`: the field endpoints (photo, read, duplicates, create, mine) mounted a second time
  behind `HelperGuard`. `FieldService` takes the actor as it does now; no logic forks.
- `admin/helpers` list/approve/pause/resume behind `AdminGuard`, written to `AuditLog`
  (new entity `helper`).

### Limits for helpers (admins keep today's limits)

- 40 additions per helper per day, 20 sign readings per helper per day (the sign reader costs money).
- The duplicate check is mandatory before submit: a helper cannot skip a strong match, only mark
  "this is a different place" with a required note.
- Uploads keep today's size cap and metadata-free WebP conversion.

## 6. Admin changes

- **Helpers** screen (sidebar item, mobile-first like the rest of the redesign).
- Join request rows and detail show "From the field · <helperName>" with a link to that helper's
  additions, and a per-helper acceptance rate on the Helpers screen so careless helpers stand out.
- Approving a helper's addition is unchanged.

## 7. Public credit

When a business that came from a helper is published and that helper's toggle is on, the card shows
a quiet line: "Added by <helperName>" (all three languages). Turning the toggle off hides it on every
card at once (read at render time, not copied into the business).

## 8. Web routes and auth

- `/helpers` lives beside `/admin` in the proxy: Clerk runs on it, nonce CSP, `noindex`, `no-store`.
  Public pages still never load Clerk.
- Same three locales and RTL as the rest of the site. Copy follows Darb's rules: no dashes, colloquial
  Arabic, no "AI" wording, no language names.
- Separate manifest and icon (the Darb mark with a small badge), light and dark like the main app.

## 9. Out of scope (this version)

Rewards, leaderboards, notifications by SMS/email, per-town limits, helpers editing existing
businesses, helpers uploading more than the storefront photo.

## 10. Testing

- API: guard matrix (none, pending, approved, paused, admin) against every helper and admin route;
  daily limits; a helper cannot read another helper's additions; apply is idempotent.
- Web: unit tests for each helper screen state; e2e for sign up → admin approves → capture lands in
  the queue marked with the helper's name → approve → public card shows credit only with the toggle on.
- Copy check on all three locales for the dash and wording rules.

## 11. Risks

- **Spam sign-ups:** approval gate plus rate limits; nothing reaches the public site unreviewed.
- **Phone numbers in captures:** same no-store handling as admin captures; helpers see only their own.
- **Sign reader cost:** per-helper daily cap; the admin can pause a helper in one tap.
