# Darb-City Plan 1: Foundation and data API

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A working monorepo where `pnpm dev` starts Postgres and Redis, migrates the database,
loads every place, sector, kind and showroom business, and serves them from a typed NestJS API
that web and mobile will consume.

**Architecture:** pnpm + Turborepo workspace. Pure TypeScript packages (`core`, `tokens`, `i18n`,
`contracts`, `seed`) build to ESM with `tsc` and carry no DOM or Node-only APIs (except `seed`'s
scripts). `apps/api` is NestJS 11 (ESM) with Prisma 7 on PostgreSQL + PostGIS + pgvector, and
exposes the ts-rest contract from `packages/contracts`. Seed content is reviewed JSON in
`packages/seed/data`, produced once by scripts and validated by tests.

**Tech Stack:** Node ≥ 22.12, pnpm 11.24.0, Turborepo 2.11.7, TypeScript 6.0.3, NestJS 11.2.7,
Prisma 7.10.0 (`prisma-client` generator + `@prisma/adapter-pg`), PostgreSQL 17 + PostGIS 3.5 +
pgvector, Redis 7, ts-rest 3.52.1, zod 3.25.76, Vitest 5.0.3 (+ unplugin-swc for Nest),
ajv 8.20.0, ESLint 10 + typescript-eslint 8.71.1, Prettier 3.9.10.

**Spec:** `docs/superpowers/specs/2026-10-12-darb-city-v1-design.md`

## Where this plan sits

The spec covers three sub-projects and is delivered by four plans, each ending in working,
testable software:

| Plan | Delivers | Spec sections |
|---|---|---|
| **1 (this)** | Monorepo, tooling, `core`, `tokens`, `i18n`, `contracts`, database, read API, seed content | 1, 4, 6.1, 6.2 (read side), 6.5, 10, 11 |
| 2 | Discovery web: levels 0–4, path bar, map + plaza, experience sheets, `/for-business`, locales, performance and accessibility gates | 3, 6.3, 7, 8, 9 |
| 3 | Smart search: `search-text`, instant index, `/search/suggest`, `/search` with Claude intent and embeddings, search log, ranking test set | 4.6, 4.7, 5 |
| 4 | Admin and launch: Clerk, admin writes and `/admin` UI, Missing-kinds report, real clients (Caramel, Raghad, Paz), deploy and cut-over | 4.5 flows, 6.2 admin, 11 real clients, 12 |

Plans 2–4 are written after this plan lands, against the interfaces it actually produced.

## Global Constraints

- Every package is ESM (`"type": "module"`), compiled with `module`/`moduleResolution` `NodeNext`;
  relative imports end in `.js`.
- Exact dependency versions only (`save-exact=true`); shared versions live in the pnpm `catalog`.
- `packages/core`, `tokens`, `i18n`, `contracts` must not import `node:*`, DOM globals or any
  server-only library (they are reused unchanged by Expo in sub-project 4).
- Localized text is `{ he?: string; ar?: string; en?: string }` with at least one non-empty value.
  Fallback order: he → he, ar, en; ar → ar, he, en; en → en, he, ar.
- Slugs match `^[a-z0-9]+(?:-[a-z0-9]+)*$` and are the same in every locale.
- Times are interpreted in `Asia/Jerusalem`.
- Halal only: no alcohol, pork, gambling, nightlife, tattoo or immodest businesses in any seed data.
- Brand assets are copied byte-for-byte from `~/Documents/GitHub/Darb-2.0/public/brand`; never redrawn.
- Launch region: CBS sub-districts 21, 22, 23, 24, 25, 29 (Northern District) and 31, 32 (Haifa
  District) are `live`. Sub-districts 71–77 (Judea and Samaria) are excluded entirely. All other
  Israeli localities are `soon`.
- Commit messages: conventional style (`feat:`, `chore:`, `test:`), no AI attribution lines.
- Docker Desktop must be running for Tasks 7 onwards.

## Review Focus

1. **Overnight and exception hours.** A business open Friday 20:00–02:00 must read as open at
   Saturday 01:30 Israel time, and a closure exception on Friday must also close that overnight
   tail. Pinned by Task 4's `isOpenAt` tests.
2. **Daylight-saving boundary.** Israel leaves summer time on 2026-10-25 at 02:00. `isOpenAt` must
   use real Israel time on both sides. Pinned by Task 4 (2026-10-25 01:30 and 2026-12-14 cases).
3. **Arabic falling back to Hebrew, never to an empty string.** Showroom business content exists in
   he/en only. An Arabic visitor must see Hebrew, not blanks. Pinned by Task 2's `pickText` tests and
   Task 13's API test that returns raw `Localized` (the client picks).
4. **Unknown or wrong-place slugs.** `/places/nowhere/businesses/x` and a business slug that exists
   in another place must both return 404, not another place's business. Pinned by Task 13.
5. **Ambiguous locality names.** CBS has two "Tamra" localities. The flagship is code 8900, not 547,
   and slugs must stay unique. Pinned by Task 16's validation test.

---

## File map

```
.editorconfig  .gitignore  .npmrc  .prettierignore  README.md
package.json  pnpm-workspace.yaml  turbo.json  tsconfig.base.json  eslint.config.mjs  prettier.config.mjs
infra/
  docker-compose.yml            Postgres (PostGIS + pgvector) and Redis for dev and tests
  postgres/Dockerfile           postgis/postgis:17-3.5 + postgresql-17-pgvector
  postgres/init.sql             creates darb_test
packages/core/src/
  index.ts                      re-exports
  locale.ts       (+ .test.ts)  Locale, Localized, LOCALES, pickText
  slug.ts         (+ .test.ts)  isSlug, toSlug
  hours.ts        (+ .test.ts)  Hours types, isOpenAt
  templates.ts                  TEMPLATES, Template, PLACE_TYPES, TIERS
packages/tokens/
  src/index.ts    (+ .test.ts)  colors, motion, fonts, door paths, mark metadata
  assets/brand/*                copied brand files
packages/i18n/src/
  index.ts        (+ .test.ts)  messages per locale, dir(), t()
  messages/he.ts ar.ts en.ts
packages/contracts/src/
  schemas.ts      (+ .test.ts)  zod schemas for every DTO
  contract.ts                   ts-rest router
  index.ts
packages/seed/
  src/index.ts                  typed loaders for data/*.json
  src/types.ts                  Seed* types
  src/screen-schema.ts          JSON schema of experience content (v1: shared by all templates)
  src/validate.test.ts          content validation (the gate for every data file)
  scripts/import-universe.ts    Darb-2.0 universe-data.ts → sectors.json, kinds.json, screens.json
  scripts/fetch-places.ts       data.gov.il + OpenStreetMap → places.json, places-review.md
  scripts/build-showroom.ts     kinds + screens + places → brands.json, businesses.json
  data/sectors.json kinds.json screens.json extra-screens.json places.json places-overrides.json
       brands.json businesses.json
apps/api/
  prisma.config.ts  prisma/schema.prisma  prisma/migrations/*
  vitest.config.ts  test/global-setup.ts  test/db.ts  test/fixtures.ts
  src/main.ts  src/app.module.ts  src/config.ts
  src/prisma/prisma.service.ts  src/prisma/prisma.module.ts
  src/health/health.controller.ts (+ test)
  src/places/places.module.ts places.controller.ts places.repository.ts place.mapper.ts (+ test)
  src/taxonomy/taxonomy.module.ts taxonomy.controller.ts taxonomy.mapper.ts (+ test)
  src/businesses/businesses.module.ts businesses.controller.ts business.mapper.ts (+ test)
  src/seed/load.ts (+ test)  src/seed/run.ts
```

---

### Task 1: Workspace root and tooling

**Files:**
- Create: `package.json`, `pnpm-workspace.yaml`, `.npmrc`, `turbo.json`, `tsconfig.base.json`,
  `eslint.config.mjs`, `prettier.config.mjs`, `.prettierignore`, `.editorconfig`, `README.md`
- Modify: `.gitignore`

**Interfaces:**
- Produces: root scripts `build`, `dev`, `test`, `typecheck`, `lint`, `format`, `format:check`,
  `infra:up`, `infra:down`; the `catalog:` versions every later task uses; `tsconfig.base.json`.

- [ ] **Step 1: Create the branch**

```bash
cd ~/Documents/GitHub/Darb-City
git checkout -b feat/plan-1-foundation
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "darb-city",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@11.24.0",
  "engines": { "node": ">=22.12.0", "pnpm": ">=11.0.0" },
  "scripts": {
    "build": "turbo run build",
    "dev": "pnpm infra:up && turbo run build --filter=@darb/api^... && pnpm --filter @darb/api db:deploy && pnpm --filter @darb/api db:seed && turbo run dev",
    "test": "turbo run test",
    "typecheck": "turbo run typecheck",
    "lint": "eslint .",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "infra:up": "docker compose -f infra/docker-compose.yml up -d --wait",
    "infra:down": "docker compose -f infra/docker-compose.yml down"
  },
  "devDependencies": {
    "@eslint/js": "catalog:",
    "eslint": "catalog:",
    "prettier": "catalog:",
    "turbo": "catalog:",
    "typescript": "catalog:",
    "typescript-eslint": "catalog:"
  }
}
```

- [ ] **Step 3: Write `pnpm-workspace.yaml` and `.npmrc`**

```yaml
packages:
  - apps/*
  - packages/*

catalog:
  "@eslint/js": 10.0.1
  "@nestjs/common": 11.2.7
  "@nestjs/core": 11.2.7
  "@nestjs/platform-express": 11.2.7
  "@nestjs/testing": 11.2.7
  "@prisma/adapter-pg": 7.10.0
  "@prisma/client": 7.10.0
  "@swc/core": 1.16.18
  "@ts-rest/core": 3.52.1
  "@ts-rest/nest": 3.52.1
  "@types/node": 22.20.5
  "@types/supertest": 7.2.1
  ajv: 8.20.0
  dotenv: 18.0.7
  eslint: 10.12.0
  prettier: 3.9.10
  prisma: 7.10.0
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

onlyBuiltDependencies:
  - "@prisma/engines"
  - "@swc/core"
  - esbuild
  - prisma
```

`.npmrc`:

```
engine-strict=true
save-exact=true
auto-install-peers=true
```

- [ ] **Step 4: Write `turbo.json`**

```json
{
  "$schema": "https://turbo.build/schema.json",
  "ui": "stream",
  "tasks": {
    "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"], "env": ["DATABASE_URL", "TEST_DATABASE_URL"] },
    "dev": { "dependsOn": ["^build"], "cache": false, "persistent": true }
  }
}
```

- [ ] **Step 5: Write `tsconfig.base.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "isolatedModules": true,
    "declaration": true,
    "sourceMap": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "types": []
  }
}
```

- [ ] **Step 6: Write lint and format config**

`eslint.config.mjs`:

```js
import eslint from "@eslint/js";
import { defineConfig, globalIgnores } from "eslint/config";
import tseslint from "typescript-eslint";

export default defineConfig(
  globalIgnores(["**/dist/**", "**/generated/**", "**/.turbo/**", "**/coverage/**", ".superpowers/**"]),
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
    },
  },
);
```

`prettier.config.mjs`:

```js
/** @type {import("prettier").Config} */
export default { endOfLine: "lf", printWidth: 100, semi: true, singleQuote: false, trailingComma: "all" };
```

`.prettierignore`:

```
pnpm-lock.yaml
**/dist
**/generated
**/prisma/migrations
.superpowers
docs
packages/seed/data/*.md
```

`.editorconfig`:

```
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true
```

Append to `.gitignore`:

```
dist/
.turbo/
coverage/
**/generated/
```

- [ ] **Step 7: Write `README.md`**

```markdown
# Darb-City

Every halal business, in every city, town and village, one search away.
Web (Next.js), API (NestJS + Prisma + PostgreSQL), mobile (Expo, later).

Design: `docs/superpowers/specs/2026-10-12-darb-city-v1-design.md`

## Run

Requires Node ≥ 22.12, pnpm 11 and Docker Desktop.

    pnpm install
    cp apps/api/.env.example apps/api/.env
    pnpm dev          # Postgres + Redis, migrations, seed, API on http://localhost:4000

    pnpm test         # needs `pnpm infra:up`
    pnpm typecheck && pnpm lint && pnpm format:check
```

- [ ] **Step 8: Install and verify**

Run: `pnpm install && pnpm lint && pnpm format:check`
Expected: install succeeds; ESLint prints nothing; Prettier reports all files formatted (run
`pnpm format` once if it lists the files just written).

- [ ] **Step 9: Commit**

```bash
git add -A
git commit -m "chore: set up pnpm and Turborepo workspace with lint and format tooling"
```

---

### Task 2: `@darb/core` package and localized text

**Files:**
- Create: `packages/core/package.json`, `packages/core/tsconfig.json`,
  `packages/core/tsconfig.build.json`, `packages/core/vitest.config.ts`,
  `packages/core/src/index.ts`, `packages/core/src/locale.ts`, `packages/core/src/locale.test.ts`

**Interfaces:**
- Produces: `type Locale = "he" | "ar" | "en"`, `LOCALES: readonly Locale[]`,
  `DEFAULT_LOCALE: "he"`, `type Localized = Partial<Record<Locale, string>>`,
  `pickText(value: Localized, locale: Locale): string`, `hasText(value: Localized): boolean`.

- [ ] **Step 1: Write the package files**

`packages/core/package.json`:

```json
{
  "name": "@darb/core",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": { ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" } },
  "scripts": {
    "build": "tsc -p tsconfig.build.json",
    "dev": "tsc -p tsconfig.build.json --watch --preserveWatchOutput",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "devDependencies": { "typescript": "catalog:", "vitest": "catalog:" }
}
```

`packages/core/tsconfig.json`:

```json
{ "extends": "../../tsconfig.base.json", "compilerOptions": { "outDir": "dist", "rootDir": "src" }, "include": ["src"] }
```

`packages/core/tsconfig.build.json`:

```json
{ "extends": "./tsconfig.json", "exclude": ["src/**/*.test.ts"] }
```

`packages/core/vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";

export default defineConfig({ test: { include: ["src/**/*.test.ts"] } });
```

The same four files (with the package name changed) are reused by `tokens`, `i18n`, `contracts`
and `seed` in later tasks.

- [ ] **Step 2: Write the failing test** — `packages/core/src/locale.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { hasText, pickText } from "./locale.js";

describe("pickText", () => {
  it("returns the requested locale when present", () => {
    expect(pickText({ he: "חיפה", ar: "حيفا", en: "Haifa" }, "ar")).toBe("حيفا");
  });
  it("falls back from Arabic to Hebrew before English", () => {
    expect(pickText({ he: "מספרה", en: "Barber" }, "ar")).toBe("מספרה");
  });
  it("falls back from Hebrew to Arabic before English", () => {
    expect(pickText({ ar: "حلاق", en: "Barber" }, "he")).toBe("حلاق");
  });
  it("falls back from English to Hebrew, then Arabic", () => {
    expect(pickText({ he: "ספר", ar: "حلاق" }, "en")).toBe("ספר");
    expect(pickText({ ar: "حلاق" }, "en")).toBe("حلاق");
  });
  it("treats blank strings as missing", () => {
    expect(pickText({ ar: "  ", he: "ספר" }, "ar")).toBe("ספר");
  });
  it("returns an empty string only when nothing exists", () => {
    expect(pickText({}, "he")).toBe("");
  });
});

describe("hasText", () => {
  it("is true when any locale has non-blank text", () => {
    expect(hasText({ en: "x" })).toBe(true);
    expect(hasText({ he: " " })).toBe(false);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm --filter @darb/core test`
Expected: FAIL, cannot resolve `./locale.js`.

- [ ] **Step 4: Implement** — `packages/core/src/locale.ts`

```ts
export type Locale = "he" | "ar" | "en";

export const LOCALES: readonly Locale[] = ["he", "ar", "en"];
export const DEFAULT_LOCALE: Locale = "he";

/** Text a person reads, in any of Darb's languages. At least one value must be non-blank. */
export type Localized = Partial<Record<Locale, string>>;

const FALLBACK: Record<Locale, readonly Locale[]> = {
  he: ["he", "ar", "en"],
  ar: ["ar", "he", "en"],
  en: ["en", "he", "ar"],
};

export function pickText(value: Localized, locale: Locale): string {
  for (const candidate of FALLBACK[locale]) {
    const text = value[candidate];
    if (text !== undefined && text.trim() !== "") return text;
  }
  return "";
}

export function hasText(value: Localized): boolean {
  return LOCALES.some((locale) => (value[locale] ?? "").trim() !== "");
}
```

`packages/core/src/index.ts`:

```ts
export * from "./locale.js";
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @darb/core test && pnpm --filter @darb/core build`
Expected: 7 passed; `packages/core/dist/index.js` exists.

- [ ] **Step 6: Commit**

```bash
git add packages/core pnpm-lock.yaml
git commit -m "feat(core): localized text with Hebrew/Arabic/English fallback"
```

---

### Task 3: Slugs

**Files:**
- Create: `packages/core/src/slug.ts`, `packages/core/src/slug.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `isSlug(value: string): boolean`, `toSlug(input: string): string` (throws `Error`
  when nothing usable remains).

- [ ] **Step 1: Write the failing test** — `packages/core/src/slug.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { isSlug, toSlug } from "./slug.js";

describe("toSlug", () => {
  it.each([
    ["Haifa", "haifa"],
    ["AKKO", "akko"],
    ["Kiryat Ata", "kiryat-ata"],
    ["Ma'alot-Tarshiha", "maalot-tarshiha"],
    ["TAMRA (YIZRE'EL)", "tamra-yizreel"],
    ["Café & Co.", "cafe-co"],
    ["  Judeida–Makr  ", "judeida-makr"],
  ])("%s → %s", (input, expected) => {
    expect(toSlug(input)).toBe(expected);
  });
  it("throws when nothing Latin remains", () => {
    expect(() => toSlug("חיפה")).toThrow(/slug/);
  });
});

describe("isSlug", () => {
  it("accepts lowercase words joined by single hyphens", () => {
    expect(isSlug("kiryat-ata")).toBe(true);
    expect(isSlug("a1")).toBe(true);
  });
  it.each(["Kiryat-ata", "kiryat--ata", "-haifa", "haifa-", "", "חיפה"])("rejects %s", (value) => {
    expect(isSlug(value)).toBe(false);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/core test`
Expected: FAIL, cannot resolve `./slug.js`.

- [ ] **Step 3: Implement** — `packages/core/src/slug.ts`

```ts
const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function isSlug(value: string): boolean {
  return SLUG.test(value);
}

/** Latin text to a URL slug. Apostrophes vanish ("Ma'alot" → "maalot"); other gaps become "-". */
export function toSlug(input: string): string {
  const slug = input
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/['’`]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  if (slug === "") throw new Error(`Cannot make a slug from "${input}"`);
  return slug;
}
```

Append to `packages/core/src/index.ts`:

```ts
export * from "./slug.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @darb/core test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): slug validation and generation"
```

---

### Task 4: Opening hours in Israel time

**Files:**
- Create: `packages/core/src/hours.ts`, `packages/core/src/hours.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces:
  - `type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6` (0 = Sunday, Israel local)
  - `interface Interval { open: string; close: string }` (`"HH:MM"`, close may be `"24:00"`;
    `close <= open` means the interval runs past midnight)
  - `interface Hours { weekly: Partial<Record<Weekday, Interval[]>>; exceptions: { date: string; intervals: Interval[] }[] }`
    (exception `date` is `YYYY-MM-DD` local; empty `intervals` = closed all day)
  - `isOpenAt(hours: Hours, at: Date): boolean`
  - `TIME_ZONE = "Asia/Jerusalem"`

- [ ] **Step 1: Write the failing test** — `packages/core/src/hours.test.ts`

All instants are UTC; the comments give Israel local time (verified with `Intl` for 2026).

```ts
import { describe, expect, it } from "vitest";
import { isOpenAt, type Hours } from "./hours.js";

const at = (iso: string) => new Date(iso);
const weekdays: Hours = { weekly: { 1: [{ open: "09:00", close: "17:00" }] }, exceptions: [] };

describe("isOpenAt", () => {
  it("is open inside a same-day interval", () => {
    expect(isOpenAt(weekdays, at("2026-10-12T06:30:00Z"))).toBe(true); // Mon 09:30
  });
  it("is closed before opening and exactly at closing", () => {
    expect(isOpenAt(weekdays, at("2026-10-12T05:30:00Z"))).toBe(false); // Mon 08:30
    expect(isOpenAt(weekdays, at("2026-10-12T14:00:00Z"))).toBe(false); // Mon 17:00
  });
  it("uses winter time after daylight saving ends", () => {
    expect(isOpenAt(weekdays, at("2026-12-14T07:30:00Z"))).toBe(true); // Mon 09:30 (UTC+2)
  });

  const friNight: Hours = { weekly: { 5: [{ open: "20:00", close: "02:00" }] }, exceptions: [] };
  it("carries an overnight interval into the next morning", () => {
    expect(isOpenAt(friNight, at("2026-10-16T22:30:00Z"))).toBe(true); // Sat 01:30
    expect(isOpenAt(friNight, at("2026-10-16T23:30:00Z"))).toBe(false); // Sat 02:30
  });
  it("lets an exception on the previous day cancel the overnight tail", () => {
    const closedFriday: Hours = { ...friNight, exceptions: [{ date: "2026-10-16", intervals: [] }] };
    expect(isOpenAt(closedFriday, at("2026-10-16T22:30:00Z"))).toBe(false); // Sat 01:30
  });
  it("lets an exception close a normal day", () => {
    const holiday: Hours = { ...weekdays, exceptions: [{ date: "2026-10-12", intervals: [] }] };
    expect(isOpenAt(holiday, at("2026-10-12T06:30:00Z"))).toBe(false);
  });
  it("lets an exception open a normally closed day", () => {
    const special: Hours = {
      weekly: {},
      exceptions: [{ date: "2026-10-12", intervals: [{ open: "09:00", close: "12:00" }] }],
    };
    expect(isOpenAt(special, at("2026-10-12T06:30:00Z"))).toBe(true);
  });
  it("handles the night daylight saving ends", () => {
    const satNight: Hours = { weekly: { 6: [{ open: "21:00", close: "03:00" }] }, exceptions: [] };
    expect(isOpenAt(satNight, at("2026-10-24T22:30:00Z"))).toBe(true); // Sun 01:30
  });
  it("treats 24:00 as the end of the day", () => {
    const lateSat: Hours = { weekly: { 6: [{ open: "18:00", close: "24:00" }] }, exceptions: [] };
    expect(isOpenAt(lateSat, at("2026-10-17T20:59:00Z"))).toBe(true); // Sat 23:59
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/core test`
Expected: FAIL, cannot resolve `./hours.js`.

- [ ] **Step 3: Implement** — `packages/core/src/hours.ts`

```ts
export const TIME_ZONE = "Asia/Jerusalem";

export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;

/** "HH:MM" local times. `close` may be "24:00"; `close <= open` runs past midnight. */
export interface Interval {
  open: string;
  close: string;
}

export interface Hours {
  weekly: Partial<Record<Weekday, Interval[]>>;
  /** Dated overrides (`YYYY-MM-DD`, Israel local). Empty `intervals` means closed all day. */
  exceptions: { date: string; intervals: Interval[] }[];
}

const WEEKDAYS: Record<string, Weekday> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

const formatter = new Intl.DateTimeFormat("en-US", {
  timeZone: TIME_ZONE,
  weekday: "short",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

interface LocalMoment {
  date: string;
  weekday: Weekday;
  minutes: number;
}

function local(at: Date): LocalMoment {
  const parts = Object.fromEntries(formatter.formatToParts(at).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    weekday: WEEKDAYS[parts.weekday as string] as Weekday,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function previousDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d - 1)).toISOString().slice(0, 10);
}

function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number) as [number, number];
  return h * 60 + m;
}

function intervalsFor(hours: Hours, date: string, weekday: Weekday): Interval[] {
  const exception = hours.exceptions.find((e) => e.date === date);
  return exception ? exception.intervals : (hours.weekly[weekday] ?? []);
}

export function isOpenAt(hours: Hours, at: Date): boolean {
  const now = local(at);
  for (const { open, close } of intervalsFor(hours, now.date, now.weekday)) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    if (c > o ? now.minutes >= o && now.minutes < c : now.minutes >= o) return true;
  }
  const yesterday = ((now.weekday + 6) % 7) as Weekday;
  for (const { open, close } of intervalsFor(hours, previousDate(now.date), yesterday)) {
    const o = toMinutes(open);
    const c = toMinutes(close);
    if (c <= o && now.minutes < c) return true;
  }
  return false;
}
```

Append to `packages/core/src/index.ts`:

```ts
export * from "./hours.js";
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @darb/core test`
Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add packages/core
git commit -m "feat(core): opening hours in Israel time with overnight and exception support"
```

---

### Task 5: Shared enums

**Files:**
- Create: `packages/core/src/enums.ts`, `packages/core/src/enums.test.ts`
- Modify: `packages/core/src/index.ts`

**Interfaces:**
- Produces: `TEMPLATES` / `Template`, `PLACE_TYPES` / `PlaceType`, `PLACE_STATUSES` /
  `PlaceStatus`, `TIERS` / `Tier`, each as `readonly` tuples with the union type of their values.
  The values must equal the Prisma enums in Task 9 exactly.

- [ ] **Step 1: Write the failing test** — `packages/core/src/enums.test.ts`

```ts
import { expect, it } from "vitest";
import { PLACE_STATUSES, PLACE_TYPES, TEMPLATES, TIERS } from "./enums.js";

it("lists the eleven experience templates from the spec", () => {
  expect(TEMPLATES).toEqual([
    "menu", "booking", "shop", "portfolio", "listing", "schedule",
    "quote", "donate", "tracker", "pass", "builder",
  ]);
});

it("lists place types, statuses and tiers", () => {
  expect(PLACE_TYPES).toEqual(["country", "region", "city", "town", "village", "neighbourhood"]);
  expect(PLACE_STATUSES).toEqual(["live", "soon"]);
  expect(TIERS).toEqual(["example", "basic", "verified", "darb"]);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/core test`
Expected: FAIL, cannot resolve `./enums.js`.

- [ ] **Step 3: Implement** — `packages/core/src/enums.ts`

```ts
export const TEMPLATES = [
  "menu", "booking", "shop", "portfolio", "listing", "schedule",
  "quote", "donate", "tracker", "pass", "builder",
] as const;
export type Template = (typeof TEMPLATES)[number];

export const PLACE_TYPES = ["country", "region", "city", "town", "village", "neighbourhood"] as const;
export type PlaceType = (typeof PLACE_TYPES)[number];

export const PLACE_STATUSES = ["live", "soon"] as const;
export type PlaceStatus = (typeof PLACE_STATUSES)[number];

export const TIERS = ["example", "basic", "verified", "darb"] as const;
export type Tier = (typeof TIERS)[number];
```

Append to `packages/core/src/index.ts`:

```ts
export * from "./enums.js";
```

- [ ] **Step 4: Run tests, build, commit**

Run: `pnpm --filter @darb/core test && pnpm --filter @darb/core build`
Expected: all pass.

```bash
git add packages/core
git commit -m "feat(core): template, place and tier enums"
```

---

### Task 6: `@darb/tokens` (brand) and `@darb/i18n`

**Files:**
- Create: `packages/tokens/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}`,
  `packages/tokens/src/index.ts`, `packages/tokens/src/index.test.ts`,
  `packages/tokens/assets/brand/*` (copied)
- Create: `packages/i18n/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}`,
  `packages/i18n/src/index.ts`, `packages/i18n/src/index.test.ts`,
  `packages/i18n/src/messages/{en,he,ar}.ts`

**Interfaces:**
- Produces (`@darb/tokens`): `colors` (object of the spec §10 hex values), `motion.easeOut`,
  `motion.easeInOut`, `fonts` (`{ latin: "Ubuntu", hebrew: "Heebo", arabic: "Cairo" }`),
  `DOOR_PATH`, `DOOR_CLIP_PATH`, `MARK_ASPECT = 769 / 660`, and the package export
  `@darb/tokens/assets/brand/*` for files.
- Produces (`@darb/i18n`): `type Messages`, `messages: Record<Locale, Messages>`,
  `dir(locale: Locale): "rtl" | "ltr"`.

- [ ] **Step 1: Create both packages from the Task 2 template**

Copy `packages/core/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}` into
`packages/tokens` and `packages/i18n`. Set `"name"` to `@darb/tokens` / `@darb/i18n`. Add
`"dependencies": { "@darb/core": "workspace:*" }` to `@darb/i18n`. In `@darb/tokens/package.json`,
replace `exports` with:

```json
"exports": {
  ".": { "types": "./dist/index.d.ts", "default": "./dist/index.js" },
  "./assets/*": "./assets/*"
},
"files": ["dist", "assets"]
```

- [ ] **Step 2: Copy the brand files byte-for-byte**

```bash
mkdir -p packages/tokens/assets/brand
cp ~/Documents/GitHub/Darb-2.0/public/brand/* packages/tokens/assets/brand/
ls packages/tokens/assets/brand
```

Expected: `apple-touch-icon.png darb-mark-192.webp darb-mark-480.webp darb-mark-96.webp
icon-192.png icon-32.png icon-512.png og-en.jpg og-he.jpg`.

- [ ] **Step 3: Write the failing tokens test** — `packages/tokens/src/index.test.ts`

```ts
import { expect, it } from "vitest";
import { colors, DOOR_CLIP_PATH, DOOR_PATH, fonts, MARK_ASPECT, motion } from "./index.js";

it("keeps the Darb palette exactly", () => {
  expect(colors).toEqual({
    night: "#03110c",
    forest950: "#051811", forest900: "#08241a", forest800: "#0e3527", forest600: "#1d5a43", forest400: "#3f8a6c",
    gold900: "#6d4c17", gold600: "#b9852f", gold: "#d9a54c", gold300: "#f0c77a", gold100: "#fbe7bd",
    ivory: "#fbf7ec", ivory200: "#efe8d6",
    ink: "#0b2219", inkMuted: "#4c5f56",
  });
});

it("keeps the motion curves, fonts and the doorway geometry", () => {
  expect(motion).toEqual({
    easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
    easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
  });
  expect(fonts).toEqual({ latin: "Ubuntu", hebrew: "Heebo", arabic: "Cairo" });
  expect(DOOR_PATH.startsWith("M0 150V52")).toBe(true);
  expect(DOOR_CLIP_PATH.startsWith("M0 1V.3467")).toBe(true);
  expect(MARK_ASPECT).toBeCloseTo(1.165, 3);
});
```

- [ ] **Step 4: Run it to verify it fails, then implement** — `packages/tokens/src/index.ts`

Run: `pnpm --filter @darb/tokens test` → FAIL (no `index.js`).

```ts
/** Darb corporate identity. Values are copied from the approved Darb 2.0 brand; never edit by eye. */
export const colors = {
  night: "#03110c",
  forest950: "#051811",
  forest900: "#08241a",
  forest800: "#0e3527",
  forest600: "#1d5a43",
  forest400: "#3f8a6c",
  gold900: "#6d4c17",
  gold600: "#b9852f",
  gold: "#d9a54c",
  gold300: "#f0c77a",
  gold100: "#fbe7bd",
  ivory: "#fbf7ec",
  ivory200: "#efe8d6",
  ink: "#0b2219",
  inkMuted: "#4c5f56",
} as const;

export const motion = {
  easeOut: "cubic-bezier(0.22, 1, 0.36, 1)",
  easeInOut: "cubic-bezier(0.65, 0, 0.35, 1)",
} as const;

export const fonts = { latin: "Ubuntu", hebrew: "Heebo", arabic: "Cairo" } as const;

/** The doorway of the Darb mark: a wall rising into one sloped gable, in a 100 x 150 box. */
export const DOOR_PATH =
  "M0 150V52C0 45.5 3.4 40.6 8.6 37.3L59.2 7.2C66.6 2.8 73.4 2.8 80.8 7.2L93.4 14.8C98 17.6 100 21.6 100 27V150Z";

/** The same doorway in 0..1 units, for `clipPathUnits="objectBoundingBox"`. */
export const DOOR_CLIP_PATH =
  "M0 1V.3467C0 .3033 .034 .2707 .086 .2487L.592 .048C.666 .0187 .734 .0187 .808 .048L.934 .0987C.98 .1173 1 .144 1 .18V1Z";

/** Height / width of the raster mark masters in `assets/brand`. */
export const MARK_ASPECT = 769 / 660;
```

Run: `pnpm --filter @darb/tokens test` → PASS.

- [ ] **Step 5: Write the failing i18n test** — `packages/i18n/src/index.test.ts`

```ts
import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import { dir, messages } from "./index.js";

it("has the same non-empty keys in every locale", () => {
  const keys = Object.keys(messages.en).sort();
  for (const locale of LOCALES) {
    expect(Object.keys(messages[locale]).sort()).toEqual(keys);
    for (const key of keys) expect(messages[locale][key as keyof typeof messages.en].trim()).not.toBe("");
  }
});

it("reads Hebrew and Arabic right to left", () => {
  expect(dir("he")).toBe("rtl");
  expect(dir("ar")).toBe("rtl");
  expect(dir("en")).toBe("ltr");
});
```

- [ ] **Step 6: Run it to verify it fails, then implement**

Run: `pnpm --filter @darb/core build && pnpm --filter @darb/i18n test` → FAIL.

`packages/i18n/src/messages/en.ts`:

```ts
export const en = {
  appName: "Darb",
  country: "Israel",
  searchPlaceholder: "What are you looking for, and where?",
  nearMe: "Near me",
  openNow: "Open now",
  closed: "Closed",
  delivers: "Delivers",
  example: "Example",
  forBusiness: "For businesses",
  noneHereYet: "None in {place} yet",
  nearestPlaces: "Nearest places that have one",
  openTheApp: "Open the app",
  call: "Call",
  whatsapp: "WhatsApp",
  directions: "Directions",
  share: "Share",
};

export type Messages = typeof en;
```

`packages/i18n/src/messages/he.ts`:

```ts
import type { Messages } from "./en.js";

export const he: Messages = {
  appName: "דרב",
  country: "ישראל",
  searchPlaceholder: "מה מחפשים, ואיפה?",
  nearMe: "קרוב אליי",
  openNow: "פתוח עכשיו",
  closed: "סגור",
  delivers: "משלוחים",
  example: "דוגמה",
  forBusiness: "לעסקים",
  noneHereYet: "עוד אין ב{place}",
  nearestPlaces: "המקומות הקרובים שיש בהם",
  openTheApp: "לאפליקציה",
  call: "חיוג",
  whatsapp: "וואטסאפ",
  directions: "ניווט",
  share: "שיתוף",
};
```

`packages/i18n/src/messages/ar.ts`:

```ts
import type { Messages } from "./en.js";

export const ar: Messages = {
  appName: "درب",
  country: "إسرائيل",
  searchPlaceholder: "عن ماذا تبحث، وأين؟",
  nearMe: "بالقرب مني",
  openNow: "مفتوح الآن",
  closed: "مغلق",
  delivers: "توصيل",
  example: "مثال",
  forBusiness: "للمصالح التجارية",
  noneHereYet: "لا يوجد في {place} بعد",
  nearestPlaces: "أقرب الأماكن التي يوجد فيها",
  openTheApp: "افتح التطبيق",
  call: "اتصال",
  whatsapp: "واتساب",
  directions: "الاتجاهات",
  share: "مشاركة",
};
```

`packages/i18n/src/index.ts`:

```ts
import type { Locale } from "@darb/core";
import { ar } from "./messages/ar.js";
import { en, type Messages } from "./messages/en.js";
import { he } from "./messages/he.js";

export type { Messages };

export const messages: Record<Locale, Messages> = { he, ar, en };

export function dir(locale: Locale): "rtl" | "ltr" {
  return locale === "en" ? "ltr" : "rtl";
}
```

Run: `pnpm --filter @darb/i18n test` → PASS.

- [ ] **Step 7: Build and commit**

Run: `pnpm build && pnpm lint`
Expected: all packages build; no lint errors.

```bash
git add packages/tokens packages/i18n pnpm-lock.yaml
git commit -m "feat: brand tokens with copied Darb assets, and he/ar/en interface messages"
```

---

### Task 7: Local infrastructure

**Files:**
- Create: `infra/docker-compose.yml`, `infra/postgres/Dockerfile`, `infra/postgres/init.sql`

**Interfaces:**
- Produces: Postgres on `localhost:5433` (user `darb`, password `darb`, databases `darb` and
  `darb_test`, extensions `postgis` and `vector` available) and Redis on `localhost:6380`.

- [ ] **Step 1: Write the files**

`infra/postgres/Dockerfile`:

```dockerfile
FROM postgis/postgis:17-3.5
RUN apt-get update \
  && apt-get install -y --no-install-recommends postgresql-17-pgvector \
  && rm -rf /var/lib/apt/lists/*
```

`infra/postgres/init.sql`:

```sql
CREATE DATABASE darb_test OWNER darb;
```

`infra/docker-compose.yml`:

```yaml
name: darb-city
services:
  postgres:
    build: ./postgres
    environment:
      POSTGRES_USER: darb
      POSTGRES_PASSWORD: darb
      POSTGRES_DB: darb
    ports: ["5433:5432"]
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./postgres/init.sql:/docker-entrypoint-initdb.d/20-darb-test.sql:ro
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U darb -d darb"]
      interval: 2s
      timeout: 3s
      retries: 30
  redis:
    image: redis:7.4-alpine
    ports: ["6380:6379"]
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 2s
      timeout: 3s
      retries: 30
volumes:
  pgdata:
```

- [ ] **Step 2: Start and verify the extensions**

Run:

```bash
pnpm infra:up
docker compose -f infra/docker-compose.yml exec postgres psql -U darb -d darb_test -c \
  "CREATE EXTENSION IF NOT EXISTS postgis; CREATE EXTENSION IF NOT EXISTS vector; SELECT extname FROM pg_extension ORDER BY 1;"
```

Expected: `plpgsql`, `postgis`, `vector` listed. If `postgresql-17-pgvector` is not found, the base
image's Postgres major changed: run `docker run --rm postgis/postgis:17-3.5 postgres --version`
and match the package name to that major version.

- [ ] **Step 3: Commit**

```bash
git add infra
git commit -m "chore(infra): local Postgres with PostGIS and pgvector, and Redis"
```

---

### Task 8: API skeleton with config and health check

**Files:**
- Create: `apps/api/package.json`, `apps/api/tsconfig.json`, `apps/api/tsconfig.build.json`,
  `apps/api/vitest.config.ts`, `apps/api/.env.example`, `apps/api/src/config.ts`,
  `apps/api/src/app.module.ts`, `apps/api/src/main.ts`,
  `apps/api/src/health/health.controller.ts`, `apps/api/src/health/health.controller.test.ts`

**Interfaces:**
- Produces: `loadConfig(env: NodeJS.ProcessEnv): AppConfig` where
  `AppConfig = { databaseUrl: string; port: number; webOrigin: string }`; the `APP_CONFIG`
  injection token; `AppModule`; `GET /health → { ok: true }`.

- [ ] **Step 1: Write the package files**

`apps/api/package.json`:

```json
{
  "name": "@darb/api",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "prisma generate && tsc -p tsconfig.build.json",
    "dev": "prisma generate && tsc -p tsconfig.build.json && (tsc -p tsconfig.build.json --watch --preserveWatchOutput & node --watch dist/main.js)",
    "start": "node dist/main.js",
    "typecheck": "prisma generate && tsc --noEmit",
    "test": "prisma generate && vitest run",
    "db:migrate": "prisma migrate dev",
    "db:deploy": "prisma migrate deploy",
    "db:seed": "prisma generate && tsx src/seed/run.ts"
  },
  "dependencies": {
    "@darb/contracts": "workspace:*",
    "@darb/core": "workspace:*",
    "@nestjs/common": "catalog:",
    "@nestjs/core": "catalog:",
    "@nestjs/platform-express": "catalog:",
    "@prisma/adapter-pg": "catalog:",
    "@prisma/client": "catalog:",
    "@ts-rest/core": "catalog:",
    "@ts-rest/nest": "catalog:",
    "dotenv": "catalog:",
    "reflect-metadata": "catalog:",
    "rxjs": "catalog:",
    "zod": "catalog:"
  },
  "devDependencies": {
    "@darb/seed": "workspace:*",
    "@nestjs/testing": "catalog:",
    "@swc/core": "catalog:",
    "@types/node": "catalog:",
    "@types/supertest": "catalog:",
    "prisma": "catalog:",
    "supertest": "catalog:",
    "tsx": "catalog:",
    "typescript": "catalog:",
    "unplugin-swc": "catalog:",
    "vitest": "catalog:"
  }
}
```

`dev` runs compiled output, not `tsx`: esbuild (inside tsx) does not emit decorator metadata, and
Nest's constructor injection needs it. `tsx` is only used for scripts without dependency injection.

`@darb/contracts` and `@darb/seed` do not exist until Tasks 10 and 14. Until then, remove those two
lines before `pnpm install` and add them back in those tasks.

`apps/api/tsconfig.json`:

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "dist",
    "rootDir": ".",
    "types": ["node"],
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true
  },
  "include": ["src", "test", "prisma.config.ts"]
}
```

`apps/api/tsconfig.build.json`:

```json
{
  "extends": "./tsconfig.json",
  "compilerOptions": { "rootDir": "src" },
  "include": ["src"],
  "exclude": ["src/**/*.test.ts"]
}
```

`apps/api/vitest.config.ts`:

```ts
import swc from "unplugin-swc";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [swc.vite({ module: { type: "es6" } })],
  test: {
    include: ["src/**/*.test.ts"],
    globalSetup: ["test/global-setup.ts"],
    fileParallelism: false,
  },
});
```

`apps/api/.env.example`:

```
DATABASE_URL=postgresql://darb:darb@localhost:5433/darb
TEST_DATABASE_URL=postgresql://darb:darb@localhost:5433/darb_test
PORT=4000
WEB_ORIGIN=http://localhost:3000
```

Create the real file: `cp apps/api/.env.example apps/api/.env` (git-ignored).

Until Task 9 adds it, create `apps/api/test/global-setup.ts` as:

```ts
export default function setup(): void {}
```

- [ ] **Step 2: Write the failing test** — `apps/api/src/health/health.controller.test.ts`

```ts
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import type { INestApplication } from "@nestjs/common";
import { HealthController } from "./health.controller.js";

let app: INestApplication;

beforeAll(async () => {
  const moduleRef = await Test.createTestingModule({ controllers: [HealthController] }).compile();
  app = moduleRef.createNestApplication();
  await app.init();
});
afterAll(() => app.close());

it("reports healthy", async () => {
  const res = await request(app.getHttpServer()).get("/health");
  expect(res.status).toBe(200);
  expect(res.body).toEqual({ ok: true });
});
```

Also add `apps/api/src/config.test.ts`:

```ts
import { expect, it } from "vitest";
import { loadConfig } from "./config.js";

it("reads and defaults the environment", () => {
  expect(loadConfig({ DATABASE_URL: "postgresql://a/b" })).toEqual({
    databaseUrl: "postgresql://a/b",
    port: 4000,
    webOrigin: "http://localhost:3000",
  });
});

it("refuses to start without a database", () => {
  expect(() => loadConfig({})).toThrow(/DATABASE_URL/);
});
```

- [ ] **Step 3: Run them to verify they fail**

Run: `pnpm install && pnpm --filter @darb/api exec vitest run`
Expected: FAIL, cannot resolve `./health.controller.js` and `./config.js`.

- [ ] **Step 4: Implement**

`apps/api/src/config.ts`:

```ts
import { z } from "zod";

export interface AppConfig {
  databaseUrl: string;
  port: number;
  webOrigin: string;
}

export const APP_CONFIG = Symbol("APP_CONFIG");

const schema = z.object({
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  PORT: z.coerce.number().int().positive().default(4000),
  WEB_ORIGIN: z.string().url().default("http://localhost:3000"),
});

export function loadConfig(env: NodeJS.ProcessEnv): AppConfig {
  const parsed = schema.safeParse(env);
  if (!parsed.success) {
    throw new Error(`Invalid environment: ${parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
  }
  return { databaseUrl: parsed.data.DATABASE_URL, port: parsed.data.PORT, webOrigin: parsed.data.WEB_ORIGIN };
}
```

`DATABASE_URL` missing produces the issue path `DATABASE_URL` (zod reports "Required"), so the
message contains `DATABASE_URL` and the test matches.

`apps/api/src/health/health.controller.ts`:

```ts
import { Controller, Get } from "@nestjs/common";

@Controller()
export class HealthController {
  @Get("health")
  health(): { ok: true } {
    return { ok: true };
  }
}
```

`apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";

@Module({ controllers: [HealthController] })
export class AppModule {}
```

`apps/api/src/main.ts`:

```ts
import "dotenv/config";
import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module.js";
import { loadConfig } from "./config.js";

const config = loadConfig(process.env);
const app = await NestFactory.create(AppModule);
app.enableCors({ origin: config.webOrigin });
app.enableShutdownHooks();
await app.listen(config.port);
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @darb/api exec vitest run`
Expected: 3 passed.

- [ ] **Step 6: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): NestJS skeleton with validated config and health check"
```

---

### Task 9: Database schema, migration and Prisma service

**Files:**
- Create: `apps/api/prisma.config.ts`, `apps/api/prisma/schema.prisma`,
  `apps/api/prisma/migrations/<timestamp>_init/migration.sql` (generated, then edited),
  `apps/api/src/prisma/prisma.service.ts`, `apps/api/src/prisma/prisma.module.ts`,
  `apps/api/test/global-setup.ts`, `apps/api/test/db.ts`, `apps/api/src/prisma/prisma.service.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `APP_CONFIG`, `loadConfig` (Task 8).
- Produces: Prisma models `Place`, `Sector`, `Kind`, `Brand`, `Business`, `BusinessKind`,
  `Organization`, `User`, `Membership`, `Claim`; `PrismaService` (extends the generated
  `PrismaClient`); `PrismaModule` (global); test helpers `testPrisma(): PrismaService` and
  `resetDatabase(prisma: PrismaService): Promise<void>`.

- [ ] **Step 1: Write `apps/api/prisma.config.ts`**

```ts
import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env["DATABASE_URL"] },
});
```

- [ ] **Step 2: Write `apps/api/prisma/schema.prisma`**

```prisma
generator client {
  provider            = "prisma-client"
  output              = "../src/generated/prisma"
  moduleFormat        = "esm"
  importFileExtension = "js"
}

datasource db {
  provider = "postgresql"
}

enum PlaceType {
  country
  region
  city
  town
  village
  neighbourhood
}

enum PlaceStatus {
  live
  soon
}

enum KindStatus {
  active
  hidden
}

enum Template {
  menu
  booking
  shop
  portfolio
  listing
  schedule
  quote
  donate
  tracker
  pass
  builder
}

enum Tier {
  example
  basic
  verified
  darb
}

enum BusinessSource {
  seed
  self
  claimed
}

enum BusinessStatus {
  draft
  published
  suspended
}

enum ClaimMethod {
  phone
  documents
}

enum ClaimStatus {
  pending
  approved
  rejected
}

enum OrgRole {
  owner
  staff
}

model Place {
  id         String                                    @id @default(uuid(7)) @db.Uuid
  slug       String                                    @unique
  type       PlaceType
  parentId   String?                                   @db.Uuid
  parent     Place?                                    @relation("PlaceTree", fields: [parentId], references: [id])
  children   Place[]                                   @relation("PlaceTree")
  /// Ancestry as "/israel/north/haifa/" for subtree queries.
  path       String
  name       Json
  aliases    String[]
  lat        Float
  lng        Float
  /// Generated from lat/lng in the migration; never written by Prisma.
  point      Unsupported("geography(Point,4326)")?
  boundary   Unsupported("geography(MultiPolygon,4326)")?
  population Int?
  cbsCode    String?                                   @unique
  status     PlaceStatus                               @default(soon)
  businesses Business[]

  @@index([path])
  @@index([status])
}

model Sector {
  id      String @id @default(uuid(7)) @db.Uuid
  slug    String @unique
  name    Json
  tagline Json
  accent  String
  order   Int
  kinds   Kind[]
}

model Kind {
  id            String         @id @default(uuid(7)) @db.Uuid
  slug          String         @unique
  sectorId      String         @db.Uuid
  sector        Sector         @relation(fields: [sectorId], references: [id])
  parentKindId  String?        @db.Uuid
  parent        Kind?          @relation("KindTree", fields: [parentKindId], references: [id])
  children      Kind[]         @relation("KindTree")
  name          Json
  synonyms      Json
  template      Template
  contentSchema Json
  attributes    String[]
  icon          String?
  order         Int
  status        KindStatus     @default(active)
  primaryFor    Business[]     @relation("PrimaryKind")
  businesses    BusinessKind[]

  @@index([sectorId])
}

model Brand {
  id         String     @id @default(uuid(7)) @db.Uuid
  slug       String     @unique
  name       Json
  businesses Business[]
}

model Business {
  id             String                               @id @default(uuid(7)) @db.Uuid
  slug           String
  name           Json
  tagline        Json
  primaryKindId  String                               @db.Uuid
  primaryKind    Kind                                 @relation("PrimaryKind", fields: [primaryKindId], references: [id])
  kinds          BusinessKind[]
  placeId        String                               @db.Uuid
  place          Place                                @relation(fields: [placeId], references: [id])
  lat            Float
  lng            Float
  point          Unsupported("geography(Point,4326)")?
  address        Json
  phone          String?
  whatsapp       String?
  website        String?
  photos         Json                                 @default("[]")
  hours          Json
  attributes     Json                                 @default("{}")
  experience     Json
  tier           Tier
  apps           Json                                 @default("{}")
  source         BusinessSource
  status         BusinessStatus                       @default(draft)
  brandId        String?                              @db.Uuid
  brand          Brand?                               @relation(fields: [brandId], references: [id])
  organizationId String?                              @db.Uuid
  organization   Organization?                        @relation(fields: [organizationId], references: [id])
  claims         Claim[]
  createdAt      DateTime                             @default(now())
  updatedAt      DateTime                             @updatedAt

  @@unique([placeId, slug])
  @@index([primaryKindId])
  @@index([status])
}

model BusinessKind {
  businessId String   @db.Uuid
  business   Business @relation(fields: [businessId], references: [id], onDelete: Cascade)
  kindId     String   @db.Uuid
  kind       Kind     @relation(fields: [kindId], references: [id])

  @@id([businessId, kindId])
  @@index([kindId])
}

model Organization {
  id         String       @id @default(uuid(7)) @db.Uuid
  clerkOrgId String       @unique
  name       String
  members    Membership[]
  businesses Business[]
}

model User {
  id          String       @id @default(uuid(7)) @db.Uuid
  clerkUserId String       @unique
  locale      String       @default("he")
  isAdmin     Boolean      @default(false)
  memberships Membership[]
  claims      Claim[]      @relation("ClaimUser")
  reviewed    Claim[]      @relation("ClaimReviewer")
}

model Membership {
  organizationId String       @db.Uuid
  organization   Organization @relation(fields: [organizationId], references: [id], onDelete: Cascade)
  userId         String       @db.Uuid
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  role           OrgRole

  @@id([organizationId, userId])
}

model Claim {
  id           String      @id @default(uuid(7)) @db.Uuid
  businessId   String      @db.Uuid
  business     Business    @relation(fields: [businessId], references: [id], onDelete: Cascade)
  userId       String      @db.Uuid
  user         User        @relation("ClaimUser", fields: [userId], references: [id])
  method       ClaimMethod
  status       ClaimStatus @default(pending)
  reviewedById String?     @db.Uuid
  reviewedBy   User?       @relation("ClaimReviewer", fields: [reviewedById], references: [id])
  createdAt    DateTime    @default(now())
  reviewedAt   DateTime?
}
```

- [ ] **Step 3: Generate the migration, then add extensions and generated columns**

Run: `pnpm --filter @darb/api exec prisma migrate dev --create-only --name init`

Edit the generated `apps/api/prisma/migrations/<timestamp>_init/migration.sql`:

1. Add as the first lines:

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS vector;
```

2. In `CREATE TABLE "Place"` and `CREATE TABLE "Business"`, replace the line
   `"point" geography(Point,4326),` with:

```sql
    "point" geography(Point,4326) GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint("lng", "lat"), 4326)::geography) STORED,
```

3. Append at the end:

```sql
CREATE INDEX "Place_point_idx" ON "Place" USING GIST ("point");
CREATE INDEX "Business_point_idx" ON "Business" USING GIST ("point");
```

Then run: `pnpm --filter @darb/api exec prisma migrate dev`
Expected: "Your database is now in sync with your schema." Then run
`pnpm --filter @darb/api exec prisma migrate dev --create-only --name drift_check` and
confirm it reports no changes (no new migration folder). If Prisma proposes altering `point`,
delete that new folder and stop: report it, because generated columns would then need a
different approach.

- [ ] **Step 4: Write the Prisma service and test helpers**

`apps/api/src/prisma/prisma.service.ts`:

```ts
import { Inject, Injectable, type OnModuleDestroy } from "@nestjs/common";
import { PrismaPg } from "@prisma/adapter-pg";
import { APP_CONFIG, type AppConfig } from "../config.js";
import { PrismaClient } from "../generated/prisma/client.js";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleDestroy {
  constructor(@Inject(APP_CONFIG) config: AppConfig) {
    super({ adapter: new PrismaPg({ connectionString: config.databaseUrl }) });
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }
}
```

`apps/api/src/prisma/prisma.module.ts`:

```ts
import { Global, Module } from "@nestjs/common";
import { APP_CONFIG, loadConfig } from "../config.js";
import { PrismaService } from "./prisma.service.js";

@Global()
@Module({
  providers: [{ provide: APP_CONFIG, useFactory: () => loadConfig(process.env) }, PrismaService],
  exports: [APP_CONFIG, PrismaService],
})
export class PrismaModule {}
```

Update `apps/api/src/app.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { HealthController } from "./health/health.controller.js";
import { PrismaModule } from "./prisma/prisma.module.js";

@Module({ imports: [PrismaModule], controllers: [HealthController] })
export class AppModule {}
```

`apps/api/test/global-setup.ts` (replaces the Task 8 stub). It points every test at the test
database and rebuilds its schema once per run:

```ts
import { execSync } from "node:child_process";
import { config } from "dotenv";
import pg from "pg";

export default async function setup(): Promise<void> {
  config({ path: new URL("../.env", import.meta.url) });
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) throw new Error("TEST_DATABASE_URL is not set (see apps/api/.env.example)");
  process.env["DATABASE_URL"] = url;
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  await client.query("DROP SCHEMA IF EXISTS public CASCADE; CREATE SCHEMA public;");
  await client.end();
  execSync("pnpm exec prisma migrate deploy", {
    cwd: new URL("..", import.meta.url),
    env: { ...process.env, DATABASE_URL: url },
    stdio: "inherit",
  });
}
```

`pg` is used directly here, so add `"pg": "8.23.1"` and `"@types/pg": "8.23.1"` to the catalog
and `"pg": "catalog:"`, `"@types/pg": "catalog:"` to `apps/api` devDependencies
(`@prisma/adapter-pg` already depends on `pg`).

The env change in global setup does not reach test workers, so the helpers read
`TEST_DATABASE_URL` themselves. `apps/api/test/db.ts`:

```ts
import { config } from "dotenv";
import { PrismaService } from "../src/prisma/prisma.service.js";

config({ path: new URL("../.env", import.meta.url) });

export const testDatabaseUrl = (): string => {
  const url = process.env["TEST_DATABASE_URL"];
  if (!url) throw new Error("TEST_DATABASE_URL is not set");
  process.env["DATABASE_URL"] = url;
  return url;
};

export function testPrisma(): PrismaService {
  return new PrismaService({ databaseUrl: testDatabaseUrl(), port: 0, webOrigin: "http://localhost" });
}

export async function resetDatabase(prisma: PrismaService): Promise<void> {
  await prisma.$executeRawUnsafe(
    `TRUNCATE "Claim", "Membership", "User", "Organization", "BusinessKind", "Business", "Brand", "Kind", "Sector", "Place" CASCADE`,
  );
}
```

- [ ] **Step 5: Write the test** — `apps/api/src/prisma/prisma.service.test.ts`

```ts
import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

it("derives a PostGIS point from lat/lng", async () => {
  await prisma.place.create({
    data: { slug: "haifa", type: "city", path: "/haifa/", name: { en: "Haifa" }, aliases: [], lat: 32.794, lng: 34.9896 },
  });
  const [row] = await prisma.$queryRaw<{ wkt: string }[]>`SELECT ST_AsText("point"::geometry) AS wkt FROM "Place"`;
  expect(row?.wkt).toBe("POINT(34.9896 32.794)");
});
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `pnpm --filter @darb/api test`
Expected: migrations apply to `darb_test`; 4 tests pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(api): Prisma schema for places, taxonomy, businesses and ownership with PostGIS points"
```

---

### Task 10: `@darb/contracts`: DTO schemas and the API router

**Files:**
- Create: `packages/contracts/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}`,
  `packages/contracts/src/schemas.ts`, `packages/contracts/src/schemas.test.ts`,
  `packages/contracts/src/contract.ts`, `packages/contracts/src/index.ts`

**Interfaces:**
- Consumes: `TEMPLATES`, `PLACE_TYPES`, `PLACE_STATUSES`, `TIERS`, `isSlug` from `@darb/core`.
- Produces (zod schemas and inferred types): `LocalizedSchema`, `HoursSchema`, `PlaceSchema` /
  `PlaceDto`, `PlaceDetailSchema` / `PlaceDetailDto`, `SectorSchema` / `SectorDto`,
  `KindSchema` / `KindDto`, `TaxonomySchema` / `TaxonomyDto`, `BusinessSummarySchema` /
  `BusinessSummaryDto`, `BusinessDetailSchema` / `BusinessDetailDto`, `NotFoundSchema`; and the
  ts-rest router `contract` with routes:
  - `places.list` `GET /places?status=live|soon` → `200 PlaceDto[]` (only city, town, village)
  - `places.get` `GET /places/:slug` → `200 PlaceDetailDto | 404`
  - `places.nearest` `GET /nearest-place?lat=&lng=` → `200 PlaceDto | 404`
  - `taxonomy.get` `GET /taxonomy` → `200 TaxonomyDto`
  - `businesses.list` `GET /places/:placeSlug/businesses?kind=&openNow=` → `200 BusinessSummaryDto[] | 404`
  - `businesses.get` `GET /places/:placeSlug/businesses/:slug` → `200 BusinessDetailDto | 404`

- [ ] **Step 1: Create the package**

Template from Task 2 with name `@darb/contracts`, plus:

```json
"dependencies": { "@darb/core": "workspace:*", "@ts-rest/core": "catalog:", "zod": "catalog:" }
```

- [ ] **Step 2: Write the failing test** — `packages/contracts/src/schemas.test.ts`

```ts
import { describe, expect, it } from "vitest";
import { BusinessDetailSchema, HoursSchema, LocalizedSchema, PlaceSchema } from "./schemas.js";

describe("LocalizedSchema", () => {
  it("accepts any one language", () => {
    expect(LocalizedSchema.parse({ ar: "حيفا" })).toEqual({ ar: "حيفا" });
  });
  it("rejects an object with no text", () => {
    expect(LocalizedSchema.safeParse({}).success).toBe(false);
    expect(LocalizedSchema.safeParse({ he: " " }).success).toBe(false);
  });
});

describe("HoursSchema", () => {
  it("accepts 24:00 and rejects malformed times", () => {
    const ok = { weekly: { "6": [{ open: "18:00", close: "24:00" }] }, exceptions: [] };
    expect(HoursSchema.safeParse(ok).success).toBe(true);
    const bad = { weekly: { "1": [{ open: "9:00", close: "17:00" }] }, exceptions: [] };
    expect(HoursSchema.safeParse(bad).success).toBe(false);
  });
});

describe("PlaceSchema", () => {
  it("rejects a non-slug", () => {
    const place = { id: "x", slug: "Haifa", type: "city", name: { en: "Haifa" }, status: "live", lat: 32.8, lng: 35, parentId: null };
    expect(PlaceSchema.safeParse(place).success).toBe(false);
  });
});

describe("BusinessDetailSchema", () => {
  it("parses a complete business", () => {
    const business = {
      id: "b1", slug: "abu-salim", name: { ar: "أبو سليم" }, tagline: { en: "Fades" }, tier: "example",
      primaryKindId: "k1", kindIds: ["k1"], placeId: "p1", placeSlug: "sakhnin", lat: 32.86, lng: 35.3,
      photo: null, openNow: true, address: { he: "הרחוב הראשי" }, phone: null, whatsapp: null, website: null,
      photos: [], hours: { weekly: {}, exceptions: [] }, attributes: { delivers: false },
      experience: { title: { en: "Book" } }, apps: {}, brandId: null,
    };
    expect(BusinessDetailSchema.parse(business).slug).toBe("abu-salim");
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm install && pnpm --filter @darb/contracts test`
Expected: FAIL, cannot resolve `./schemas.js`.

- [ ] **Step 4: Implement** — `packages/contracts/src/schemas.ts`

```ts
import { isSlug, PLACE_STATUSES, PLACE_TYPES, TEMPLATES, TIERS } from "@darb/core";
import { z } from "zod";

const text = z.string().optional();
export const LocalizedSchema = z
  .object({ he: text, ar: text, en: text })
  .refine((v) => [v.he, v.ar, v.en].some((t) => t !== undefined && t.trim() !== ""), {
    message: "At least one language must have text",
  });

export const SlugSchema = z.string().refine(isSlug, { message: "Invalid slug" });

const time = z.string().regex(/^(?:[01]\d|2[0-3]):[0-5]\d$|^24:00$/);
const IntervalSchema = z.object({ open: time, close: time });
export const HoursSchema = z.object({
  weekly: z.record(z.enum(["0", "1", "2", "3", "4", "5", "6"]), z.array(IntervalSchema)),
  exceptions: z.array(
    z.object({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), intervals: z.array(IntervalSchema) }),
  ),
});

export const PlaceSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  type: z.enum(PLACE_TYPES),
  name: LocalizedSchema,
  status: z.enum(PLACE_STATUSES),
  lat: z.number(),
  lng: z.number(),
  parentId: z.string().nullable(),
});
export type PlaceDto = z.infer<typeof PlaceSchema>;

export const PlaceDetailSchema = PlaceSchema.extend({
  /** Root first, excluding the place itself. */
  ancestors: z.array(PlaceSchema),
  children: z.array(PlaceSchema),
});
export type PlaceDetailDto = z.infer<typeof PlaceDetailSchema>;

export const SectorSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  accent: z.string().regex(/^#[0-9a-f]{6}$/),
  order: z.number().int(),
});
export type SectorDto = z.infer<typeof SectorSchema>;

export const KindSchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  sectorId: z.string(),
  parentKindId: z.string().nullable(),
  name: LocalizedSchema,
  template: z.enum(TEMPLATES),
  attributes: z.array(z.string()),
  icon: z.string().nullable(),
  order: z.number().int(),
});
export type KindDto = z.infer<typeof KindSchema>;

export const TaxonomySchema = z.object({
  sectors: z.array(SectorSchema.extend({ kinds: z.array(KindSchema) })),
});
export type TaxonomyDto = z.infer<typeof TaxonomySchema>;

export const BusinessSummarySchema = z.object({
  id: z.string(),
  slug: SlugSchema,
  name: LocalizedSchema,
  tagline: LocalizedSchema,
  tier: z.enum(TIERS),
  primaryKindId: z.string(),
  placeId: z.string(),
  placeSlug: SlugSchema,
  lat: z.number(),
  lng: z.number(),
  photo: z.string().nullable(),
  /** Null when the business has no hours at all. */
  openNow: z.boolean().nullable(),
});
export type BusinessSummaryDto = z.infer<typeof BusinessSummarySchema>;

export const BusinessDetailSchema = BusinessSummarySchema.extend({
  kindIds: z.array(z.string()),
  address: LocalizedSchema,
  phone: z.string().nullable(),
  whatsapp: z.string().nullable(),
  website: z.string().nullable(),
  photos: z.array(z.object({ key: z.string(), alt: LocalizedSchema })),
  hours: HoursSchema,
  attributes: z.record(z.string(), z.union([z.boolean(), z.string(), z.number()])),
  experience: z.record(z.string(), z.unknown()),
  apps: z.object({ web: z.string().url().optional(), ios: z.string().url().optional(), android: z.string().url().optional() }),
  brandId: z.string().nullable(),
});
export type BusinessDetailDto = z.infer<typeof BusinessDetailSchema>;

export const NotFoundSchema = z.object({ message: z.string() });
```

`packages/contracts/src/contract.ts`:

```ts
import { initContract } from "@ts-rest/core";
import { z } from "zod";
import {
  BusinessDetailSchema,
  BusinessSummarySchema,
  NotFoundSchema,
  PlaceDetailSchema,
  PlaceSchema,
  SlugSchema,
  TaxonomySchema,
} from "./schemas.js";

const c = initContract();

export const contract = c.router({
  places: {
    list: {
      method: "GET",
      path: "/places",
      query: z.object({ status: z.enum(["live", "soon"]).optional() }),
      responses: { 200: z.array(PlaceSchema) },
    },
    get: {
      method: "GET",
      path: "/places/:slug",
      pathParams: z.object({ slug: SlugSchema }),
      responses: { 200: PlaceDetailSchema, 404: NotFoundSchema },
    },
    nearest: {
      method: "GET",
      path: "/nearest-place",
      query: z.object({ lat: z.coerce.number().min(-90).max(90), lng: z.coerce.number().min(-180).max(180) }),
      responses: { 200: PlaceSchema, 404: NotFoundSchema },
    },
  },
  taxonomy: {
    get: { method: "GET", path: "/taxonomy", responses: { 200: TaxonomySchema } },
  },
  businesses: {
    list: {
      method: "GET",
      path: "/places/:placeSlug/businesses",
      pathParams: z.object({ placeSlug: SlugSchema }),
      query: z.object({
        kind: SlugSchema.optional(),
        openNow: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
      }),
      responses: { 200: z.array(BusinessSummarySchema), 404: NotFoundSchema },
    },
    get: {
      method: "GET",
      path: "/places/:placeSlug/businesses/:slug",
      pathParams: z.object({ placeSlug: SlugSchema, slug: SlugSchema }),
      responses: { 200: BusinessDetailSchema, 404: NotFoundSchema },
    },
  },
});
```

`packages/contracts/src/index.ts`:

```ts
export * from "./contract.js";
export * from "./schemas.js";
```

- [ ] **Step 5: Run tests and build**

Run: `pnpm --filter @darb/contracts test && pnpm --filter @darb/contracts build`
Expected: all pass, `dist/` written.

- [ ] **Step 6: Commit**

```bash
git add packages/contracts pnpm-lock.yaml
git commit -m "feat(contracts): typed DTO schemas and ts-rest router for places, taxonomy and businesses"
```

---

### Task 11: Places API

**Files:**
- Create: `apps/api/test/fixtures.ts`, `apps/api/src/places/place.mapper.ts`,
  `apps/api/src/places/places.repository.ts`, `apps/api/src/places/places.controller.ts`,
  `apps/api/src/places/places.module.ts`, `apps/api/src/places/places.controller.test.ts`,
  `apps/api/test/app.ts`
- Modify: `apps/api/package.json` (add `"@darb/contracts": "workspace:*"` back),
  `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `contract`, `PlaceDto`, `PlaceDetailDto` (Task 10); `PrismaService`,
  `testPrisma`, `resetDatabase` (Task 9).
- Produces: `toPlaceDto(row: Place): PlaceDto`; `PlacesRepository` with
  `bySlug(slug): Promise<Place | null>`, `ancestors(place): Promise<Place[]>`,
  `children(placeId): Promise<Place[]>`, `listSettlements(status?): Promise<Place[]>`,
  `nearestLive(lat, lng): Promise<Place | null>`, `subtreeIds(place): Promise<string[]>`;
  test helpers `seedFixtures(prisma): Promise<Fixtures>` and `createTestApp(): Promise<{ app, prisma }>`.

- [ ] **Step 1: Write the test fixtures** — `apps/api/test/fixtures.ts`

```ts
import type { PrismaService } from "../src/prisma/prisma.service.js";

const hours = {
  weekly: { 0: [{ open: "09:00", close: "19:00" }], 1: [{ open: "09:00", close: "19:00" }] },
  exceptions: [],
};

export async function seedFixtures(prisma: PrismaService) {
  const israel = await prisma.place.create({
    data: { slug: "israel", type: "country", path: "/israel/", name: { he: "ישראל", en: "Israel" }, aliases: [], lat: 31.5, lng: 34.9, status: "live" },
  });
  const north = await prisma.place.create({
    data: { slug: "northern-district", type: "region", parentId: israel.id, path: "/israel/northern-district/", name: { en: "Northern District" }, aliases: [], lat: 32.9, lng: 35.4, status: "live" },
  });
  const sakhnin = await prisma.place.create({
    data: { slug: "sakhnin", type: "city", parentId: north.id, path: "/israel/northern-district/sakhnin/", name: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" }, aliases: ["Sachnin"], lat: 32.8638, lng: 35.3023, status: "live", cbsCode: "7500" },
  });
  const tamra = await prisma.place.create({
    data: { slug: "tamra", type: "city", parentId: north.id, path: "/israel/northern-district/tamra/", name: { en: "Tamra" }, aliases: [], lat: 32.853, lng: 35.198, status: "live", cbsCode: "8900" },
  });
  const eilat = await prisma.place.create({
    data: { slug: "eilat", type: "city", parentId: israel.id, path: "/israel/eilat/", name: { en: "Eilat" }, aliases: [], lat: 29.557, lng: 34.952, status: "soon" },
  });
  const beauty = await prisma.sector.create({
    data: { slug: "beauty", name: { en: "Beauty Row" }, tagline: { en: "Appointments" }, accent: "#d9aaa2", order: 2 },
  });
  const food = await prisma.sector.create({
    data: { slug: "food", name: { en: "The Tasting Quarter" }, tagline: { en: "Plates" }, accent: "#d6a473", order: 1 },
  });
  const barbershops = await prisma.kind.create({
    data: { slug: "barbershops", sectorId: beauty.id, name: { en: "Barbershops" }, synonyms: { he: [], ar: [], en: [] }, template: "booking", contentSchema: {}, attributes: [], order: 1 },
  });
  const kidsCuts = await prisma.kind.create({
    data: { slug: "kids-haircuts", sectorId: beauty.id, parentKindId: barbershops.id, name: { en: "Kids' haircuts" }, synonyms: { he: [], ar: [], en: [] }, template: "booking", contentSchema: {}, attributes: [], order: 2 },
  });
  const hidden = await prisma.kind.create({
    data: { slug: "hidden-kind", sectorId: food.id, name: { en: "Hidden" }, synonyms: { he: [], ar: [], en: [] }, template: "menu", contentSchema: {}, attributes: [], order: 1, status: "hidden" },
  });
  const base = { tagline: { en: "x" }, address: { en: "Main st" }, hours, experience: { title: { en: "Book" } }, tier: "example" as const, source: "seed" as const, status: "published" as const };
  const abuSalim = await prisma.business.create({
    data: { ...base, slug: "abu-salim", name: { ar: "أبو سليم" }, primaryKindId: barbershops.id, placeId: sakhnin.id, lat: 32.864, lng: 35.303, kinds: { create: [{ kindId: barbershops.id }] } },
  });
  const littleCuts = await prisma.business.create({
    data: { ...base, slug: "little-cuts", name: { en: "Little Cuts" }, primaryKindId: kidsCuts.id, placeId: sakhnin.id, lat: 32.865, lng: 35.304, hours: { weekly: {}, exceptions: [] }, kinds: { create: [{ kindId: kidsCuts.id }] } },
  });
  const draft = await prisma.business.create({
    data: { ...base, slug: "draft-barber", name: { en: "Draft" }, status: "draft", primaryKindId: barbershops.id, placeId: sakhnin.id, lat: 32.866, lng: 35.305, kinds: { create: [{ kindId: barbershops.id }] } },
  });
  const tamraBarber = await prisma.business.create({
    data: { ...base, slug: "tamra-barber", name: { en: "Tamra Barber" }, primaryKindId: barbershops.id, placeId: tamra.id, lat: 32.853, lng: 35.198, kinds: { create: [{ kindId: barbershops.id }] } },
  });
  return { israel, north, sakhnin, tamra, eilat, beauty, food, barbershops, kidsCuts, hidden, abuSalim, littleCuts, draft, tamraBarber };
}

export type Fixtures = Awaited<ReturnType<typeof seedFixtures>>;
```

`apps/api/test/app.ts`:

```ts
import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { INestApplication } from "@nestjs/common";
import { AppModule } from "../src/app.module.js";
import { PrismaService } from "../src/prisma/prisma.service.js";
import { testDatabaseUrl } from "./db.js";

export async function createTestApp(): Promise<{ app: INestApplication; prisma: PrismaService }> {
  testDatabaseUrl();
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
  const app = moduleRef.createNestApplication();
  await app.init();
  return { app, prisma: app.get(PrismaService) };
}
```

- [ ] **Step 2: Write the failing test** — `apps/api/src/places/places.controller.test.ts`

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";

let app: INestApplication;

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  await seedFixtures(created.prisma);
});
afterAll(() => app.close());

describe("GET /places", () => {
  it("lists only settlements, filtered by status", async () => {
    const res = await request(app.getHttpServer()).get("/places?status=live");
    expect(res.status).toBe(200);
    expect(res.body.map((p: { slug: string }) => p.slug).sort()).toEqual(["sakhnin", "tamra"]);
  });
});

describe("GET /places/:slug", () => {
  it("returns the place with its ancestors (root first) and children", async () => {
    const res = await request(app.getHttpServer()).get("/places/northern-district");
    expect(res.status).toBe(200);
    expect(res.body.ancestors.map((p: { slug: string }) => p.slug)).toEqual(["israel"]);
    expect(res.body.children.map((p: { slug: string }) => p.slug).sort()).toEqual(["sakhnin", "tamra"]);
  });
  it("returns raw localized names for the client to pick", async () => {
    const res = await request(app.getHttpServer()).get("/places/sakhnin");
    expect(res.body.name).toEqual({ he: "סח'נין", ar: "سخنين", en: "Sakhnin" });
    expect(res.body.ancestors.map((p: { slug: string }) => p.slug)).toEqual(["israel", "northern-district"]);
  });
  it("404s for an unknown place", async () => {
    const res = await request(app.getHttpServer()).get("/places/nowhere");
    expect(res.status).toBe(404);
  });
});

describe("GET /nearest-place", () => {
  it("finds the nearest live settlement, skipping soon places", async () => {
    const res = await request(app.getHttpServer()).get("/nearest-place?lat=32.85&lng=35.21");
    expect(res.status).toBe(200);
    expect(res.body.slug).toBe("tamra");
  });
  it("never returns a soon place even when it is closest", async () => {
    const res = await request(app.getHttpServer()).get("/nearest-place?lat=29.55&lng=34.95");
    expect(res.body.slug).not.toBe("eilat");
  });
  it("rejects out-of-range coordinates", async () => {
    const res = await request(app.getHttpServer()).get("/nearest-place?lat=200&lng=35");
    expect(res.status).toBe(400);
  });
});
```

- [ ] **Step 3: Run it to verify it fails**

Run: `pnpm install && pnpm --filter @darb/api test`
Expected: FAIL (`/places` returns 404 because no controller exists).

- [ ] **Step 4: Implement**

`apps/api/src/places/place.mapper.ts`:

```ts
import type { Localized } from "@darb/core";
import type { PlaceDto } from "@darb/contracts";
import type { Place } from "../generated/prisma/client.js";

export function toPlaceDto(row: Place): PlaceDto {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    name: row.name as Localized,
    status: row.status,
    lat: row.lat,
    lng: row.lng,
    parentId: row.parentId,
  };
}
```

`apps/api/src/places/places.repository.ts`:

```ts
import { Injectable } from "@nestjs/common";
import type { Place, PlaceStatus } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";

const SETTLEMENTS = ["city", "town", "village"] as const;

@Injectable()
export class PlacesRepository {
  constructor(private readonly prisma: PrismaService) {}

  bySlug(slug: string): Promise<Place | null> {
    return this.prisma.place.findUnique({ where: { slug } });
  }

  /** Root first, excluding the place itself. Uses the materialized path. */
  async ancestors(place: Place): Promise<Place[]> {
    const slugs = place.path.split("/").filter(Boolean).slice(0, -1);
    const rows = await this.prisma.place.findMany({ where: { slug: { in: slugs } } });
    return slugs.map((s) => rows.find((r) => r.slug === s)).filter((r): r is Place => r !== undefined);
  }

  children(placeId: string): Promise<Place[]> {
    return this.prisma.place.findMany({ where: { parentId: placeId }, orderBy: { slug: "asc" } });
  }

  listSettlements(status?: PlaceStatus): Promise<Place[]> {
    return this.prisma.place.findMany({
      where: { type: { in: [...SETTLEMENTS] }, ...(status ? { status } : {}) },
      orderBy: { slug: "asc" },
    });
  }

  async nearestLive(lat: number, lng: number): Promise<Place | null> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      SELECT id FROM "Place"
      WHERE status = 'live' AND type IN ('city', 'town', 'village')
      ORDER BY "point" <-> ST_SetSRID(ST_MakePoint(${lng}, ${lat}), 4326)::geography
      LIMIT 1`;
    const id = rows[0]?.id;
    return id ? this.prisma.place.findUnique({ where: { id } }) : null;
  }

  /** The place and every place beneath it. */
  async subtreeIds(place: Place): Promise<string[]> {
    const rows = await this.prisma.place.findMany({ where: { path: { startsWith: place.path } }, select: { id: true } });
    return rows.map((r) => r.id);
  }
}
```

`apps/api/src/places/places.controller.ts`:

```ts
import { Controller } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { toPlaceDto } from "./place.mapper.js";
import { PlacesRepository } from "./places.repository.js";

@Controller()
export class PlacesController {
  constructor(private readonly places: PlacesRepository) {}

  @TsRestHandler(contract.places)
  handler() {
    return tsRestHandler(contract.places, {
      list: async ({ query }) => {
        const rows = await this.places.listSettlements(query.status);
        return { status: 200, body: rows.map(toPlaceDto) };
      },
      get: async ({ params }) => {
        const place = await this.places.bySlug(params.slug);
        if (!place) return { status: 404, body: { message: `No place "${params.slug}"` } };
        const [ancestors, children] = await Promise.all([this.places.ancestors(place), this.places.children(place.id)]);
        return {
          status: 200,
          body: { ...toPlaceDto(place), ancestors: ancestors.map(toPlaceDto), children: children.map(toPlaceDto) },
        };
      },
      nearest: async ({ query }) => {
        const place = await this.places.nearestLive(query.lat, query.lng);
        if (!place) return { status: 404, body: { message: "No live place yet" } };
        return { status: 200, body: toPlaceDto(place) };
      },
    });
  }
}
```

`apps/api/src/places/places.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { PlacesController } from "./places.controller.js";
import { PlacesRepository } from "./places.repository.js";

@Module({ controllers: [PlacesController], providers: [PlacesRepository], exports: [PlacesRepository] })
export class PlacesModule {}
```

Add `PlacesModule` to `imports` in `apps/api/src/app.module.ts`.

- [ ] **Step 5: Run tests to verify they pass**

Run: `pnpm --filter @darb/api test`
Expected: all pass. (ts-rest validates path params and query with the contract's zod schemas
by default and answers 400 on failure; verified with `@ts-rest/nest` 3.52.1.)

- [ ] **Step 6: Commit**

```bash
git add apps/api pnpm-lock.yaml
git commit -m "feat(api): places endpoints with ancestry, children and nearest live place"
```

---

### Task 12: Taxonomy API

**Files:**
- Create: `apps/api/src/taxonomy/taxonomy.mapper.ts`, `apps/api/src/taxonomy/taxonomy.repository.ts`,
  `apps/api/src/taxonomy/taxonomy.controller.ts`, `apps/api/src/taxonomy/taxonomy.module.ts`,
  `apps/api/src/taxonomy/taxonomy.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Produces: `toSectorDto(row: Sector)`, `toKindDto(row: Kind)`; `TaxonomyRepository` with
  `activeKindBySlug(slug): Promise<Kind | null>`, `descendantKindIds(kindId): Promise<string[]>`
  (the kind plus all active sub-kinds, any depth), `tree(): Promise<TaxonomyDto>`.

- [ ] **Step 1: Write the failing test** — `apps/api/src/taxonomy/taxonomy.controller.test.ts`

```ts
import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import { TaxonomyRepository } from "./taxonomy.repository.js";

let app: INestApplication;
let fx: Fixtures;

beforeAll(async () => {
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  fx = await seedFixtures(created.prisma);
});
afterAll(() => app.close());

it("returns sectors in order with their active kinds in order", async () => {
  const res = await request(app.getHttpServer()).get("/taxonomy");
  expect(res.status).toBe(200);
  expect(res.body.sectors.map((s: { slug: string }) => s.slug)).toEqual(["food", "beauty"]);
  const beauty = res.body.sectors[1];
  expect(beauty.kinds.map((k: { slug: string }) => k.slug)).toEqual(["barbershops", "kids-haircuts"]);
  expect(res.body.sectors[0].kinds).toEqual([]); // hidden kinds never leave the API
});

it("expands a kind to itself and its sub-kinds", async () => {
  const ids = await app.get(TaxonomyRepository).descendantKindIds(fx.barbershops.id);
  expect(ids.sort()).toEqual([fx.barbershops.id, fx.kidsCuts.id].sort());
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/api test`
Expected: FAIL, cannot resolve `./taxonomy.repository.js`.

- [ ] **Step 3: Implement**

`apps/api/src/taxonomy/taxonomy.mapper.ts`:

```ts
import type { Localized } from "@darb/core";
import type { KindDto, SectorDto } from "@darb/contracts";
import type { Kind, Sector } from "../generated/prisma/client.js";

export const toSectorDto = (row: Sector): SectorDto => ({
  id: row.id,
  slug: row.slug,
  name: row.name as Localized,
  tagline: row.tagline as Localized,
  accent: row.accent,
  order: row.order,
});

export const toKindDto = (row: Kind): KindDto => ({
  id: row.id,
  slug: row.slug,
  sectorId: row.sectorId,
  parentKindId: row.parentKindId,
  name: row.name as Localized,
  template: row.template,
  attributes: row.attributes,
  icon: row.icon,
  order: row.order,
});
```

`apps/api/src/taxonomy/taxonomy.repository.ts`:

```ts
import { Injectable } from "@nestjs/common";
import type { TaxonomyDto } from "@darb/contracts";
import type { Kind } from "../generated/prisma/client.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { toKindDto, toSectorDto } from "./taxonomy.mapper.js";

@Injectable()
export class TaxonomyRepository {
  constructor(private readonly prisma: PrismaService) {}

  activeKindBySlug(slug: string): Promise<Kind | null> {
    return this.prisma.kind.findFirst({ where: { slug, status: "active" } });
  }

  async descendantKindIds(kindId: string): Promise<string[]> {
    const rows = await this.prisma.$queryRaw<{ id: string }[]>`
      WITH RECURSIVE tree AS (
        SELECT id FROM "Kind" WHERE id = ${kindId}::uuid AND status = 'active'
        UNION
        SELECT k.id FROM "Kind" k JOIN tree t ON k."parentKindId" = t.id WHERE k.status = 'active'
      )
      SELECT id FROM tree`;
    return rows.map((r) => r.id);
  }

  async tree(): Promise<TaxonomyDto> {
    const sectors = await this.prisma.sector.findMany({
      orderBy: { order: "asc" },
      include: { kinds: { where: { status: "active" }, orderBy: { order: "asc" } } },
    });
    return { sectors: sectors.map((s) => ({ ...toSectorDto(s), kinds: s.kinds.map(toKindDto) })) };
  }
}
```

`apps/api/src/taxonomy/taxonomy.controller.ts`:

```ts
import { Controller } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { TaxonomyRepository } from "./taxonomy.repository.js";

@Controller()
export class TaxonomyController {
  constructor(private readonly taxonomy: TaxonomyRepository) {}

  @TsRestHandler(contract.taxonomy)
  handler() {
    return tsRestHandler(contract.taxonomy, {
      get: async () => ({ status: 200, body: await this.taxonomy.tree() }),
    });
  }
}
```

`apps/api/src/taxonomy/taxonomy.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { TaxonomyController } from "./taxonomy.controller.js";
import { TaxonomyRepository } from "./taxonomy.repository.js";

@Module({ controllers: [TaxonomyController], providers: [TaxonomyRepository], exports: [TaxonomyRepository] })
export class TaxonomyModule {}
```

Add `TaxonomyModule` to `imports` in `app.module.ts`.

- [ ] **Step 4: Run tests to verify they pass, then commit**

Run: `pnpm --filter @darb/api test`
Expected: all pass.

```bash
git add apps/api
git commit -m "feat(api): taxonomy tree and sub-kind expansion"
```

---

### Task 13: Businesses API

**Files:**
- Create: `apps/api/src/businesses/business.mapper.ts`, `apps/api/src/businesses/businesses.controller.ts`,
  `apps/api/src/businesses/businesses.module.ts`, `apps/api/src/businesses/businesses.controller.test.ts`
- Modify: `apps/api/src/app.module.ts`

**Interfaces:**
- Consumes: `PlacesRepository.bySlug`, `PlacesRepository.subtreeIds` (Task 11);
  `TaxonomyRepository.activeKindBySlug`, `descendantKindIds` (Task 12); `isOpenAt`, `Hours`
  (Task 4).
- Produces: `toBusinessSummary(row, placeSlug, now): BusinessSummaryDto`,
  `toBusinessDetail(row, placeSlug, now): BusinessDetailDto`. A `CLOCK` provider
  (`() => Date`) so tests can fix "now".

- [ ] **Step 1: Write the failing test** — `apps/api/src/businesses/businesses.controller.test.ts`

The fixtures give Abu Salim Sunday and Monday 09:00–19:00. Little Cuts has empty hours.
`CLOCK` is fixed to Monday 2026-10-12 09:30 Israel time.

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

const slugs = (body: { slug: string }[]) => body.map((b) => b.slug).sort();

describe("GET /places/:placeSlug/businesses", () => {
  it("lists published businesses of the kind and its sub-kinds", async () => {
    const res = await request(app.getHttpServer()).get("/places/sakhnin/businesses?kind=barbershops");
    expect(res.status).toBe(200);
    expect(slugs(res.body)).toEqual(["abu-salim", "little-cuts"]); // draft excluded
  });
  it("includes businesses anywhere under a region", async () => {
    const res = await request(app.getHttpServer()).get("/places/northern-district/businesses?kind=barbershops");
    expect(slugs(res.body)).toEqual(["abu-salim", "little-cuts", "tamra-barber"]);
  });
  it("computes openNow, null when there are no hours", async () => {
    const res = await request(app.getHttpServer()).get("/places/sakhnin/businesses?kind=barbershops");
    const byslug = Object.fromEntries(res.body.map((b: { slug: string; openNow: boolean | null }) => [b.slug, b.openNow]));
    expect(byslug).toEqual({ "abu-salim": true, "little-cuts": null });
  });
  it("filters to open businesses", async () => {
    const res = await request(app.getHttpServer()).get("/places/sakhnin/businesses?kind=barbershops&openNow=true");
    expect(slugs(res.body)).toEqual(["abu-salim"]);
  });
  it("404s for an unknown place or kind, and for a hidden kind", async () => {
    expect((await request(app.getHttpServer()).get("/places/nowhere/businesses")).status).toBe(404);
    expect((await request(app.getHttpServer()).get("/places/sakhnin/businesses?kind=nope")).status).toBe(404);
    expect((await request(app.getHttpServer()).get("/places/sakhnin/businesses?kind=hidden-kind")).status).toBe(404);
  });
});

describe("GET /places/:placeSlug/businesses/:slug", () => {
  it("returns the full business with raw localized text", async () => {
    const res = await request(app.getHttpServer()).get("/places/sakhnin/businesses/abu-salim");
    expect(res.status).toBe(200);
    expect(res.body.name).toEqual({ ar: "أبو سليم" });
    expect(res.body.placeSlug).toBe("sakhnin");
    expect(res.body.experience).toEqual({ title: { en: "Book" } });
  });
  it("404s for a business that lives in another place", async () => {
    expect((await request(app.getHttpServer()).get("/places/sakhnin/businesses/tamra-barber")).status).toBe(404);
  });
  it("404s for a draft", async () => {
    expect((await request(app.getHttpServer()).get("/places/sakhnin/businesses/draft-barber")).status).toBe(404);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm --filter @darb/api test`
Expected: FAIL, cannot resolve `./businesses.controller.js`.

- [ ] **Step 3: Implement**

`apps/api/src/businesses/business.mapper.ts`:

```ts
import { isOpenAt, type Hours, type Localized } from "@darb/core";
import type { BusinessDetailDto, BusinessSummaryDto } from "@darb/contracts";
import type { Business } from "../generated/prisma/client.js";

type Photo = { key: string; alt: Localized };

function openNow(hours: Hours, now: Date): boolean | null {
  const hasAny = Object.values(hours.weekly).some((i) => i && i.length > 0) || hours.exceptions.length > 0;
  return hasAny ? isOpenAt(hours, now) : null;
}

export function toBusinessSummary(row: Business, placeSlug: string, now: Date): BusinessSummaryDto {
  const photos = row.photos as Photo[];
  return {
    id: row.id,
    slug: row.slug,
    name: row.name as Localized,
    tagline: row.tagline as Localized,
    tier: row.tier,
    primaryKindId: row.primaryKindId,
    placeId: row.placeId,
    placeSlug,
    lat: row.lat,
    lng: row.lng,
    photo: photos[0]?.key ?? null,
    openNow: openNow(row.hours as unknown as Hours, now),
  };
}

export function toBusinessDetail(
  row: Business & { kinds: { kindId: string }[] },
  placeSlug: string,
  now: Date,
): BusinessDetailDto {
  return {
    ...toBusinessSummary(row, placeSlug, now),
    kindIds: row.kinds.map((k) => k.kindId),
    address: row.address as Localized,
    phone: row.phone,
    whatsapp: row.whatsapp,
    website: row.website,
    photos: row.photos as Photo[],
    hours: row.hours as unknown as BusinessDetailDto["hours"],
    attributes: row.attributes as BusinessDetailDto["attributes"],
    experience: row.experience as BusinessDetailDto["experience"],
    apps: row.apps as BusinessDetailDto["apps"],
    brandId: row.brandId,
  };
}
```

`apps/api/src/businesses/businesses.controller.ts`:

```ts
import { Controller, Inject } from "@nestjs/common";
import { contract } from "@darb/contracts";
import { TsRestHandler, tsRestHandler } from "@ts-rest/nest";
import { PlacesRepository } from "../places/places.repository.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { TaxonomyRepository } from "../taxonomy/taxonomy.repository.js";
import { toBusinessDetail, toBusinessSummary } from "./business.mapper.js";

export const CLOCK = Symbol("CLOCK");
export type Clock = () => Date;

@Controller()
export class BusinessesController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly places: PlacesRepository,
    private readonly taxonomy: TaxonomyRepository,
    @Inject(CLOCK) private readonly clock: Clock,
  ) {}

  @TsRestHandler(contract.businesses)
  handler() {
    return tsRestHandler(contract.businesses, {
      list: async ({ params, query }) => {
        const place = await this.places.bySlug(params.placeSlug);
        if (!place) return { status: 404, body: { message: `No place "${params.placeSlug}"` } };
        let kindIds: string[] | undefined;
        if (query.kind) {
          const kind = await this.taxonomy.activeKindBySlug(query.kind);
          if (!kind) return { status: 404, body: { message: `No kind "${query.kind}"` } };
          kindIds = await this.taxonomy.descendantKindIds(kind.id);
        }
        const placeIds = await this.places.subtreeIds(place);
        const rows = await this.prisma.business.findMany({
          where: {
            status: "published",
            placeId: { in: placeIds },
            ...(kindIds ? { kinds: { some: { kindId: { in: kindIds } } } } : {}),
          },
          include: { place: { select: { slug: true } } },
          orderBy: [{ tier: "desc" }, { slug: "asc" }],
        });
        const now = this.clock();
        const summaries = rows.map((r) => toBusinessSummary(r, r.place.slug, now));
        return { status: 200, body: query.openNow ? summaries.filter((b) => b.openNow === true) : summaries };
      },
      get: async ({ params }) => {
        const row = await this.prisma.business.findFirst({
          where: { slug: params.slug, status: "published", place: { slug: params.placeSlug } },
          include: { kinds: { select: { kindId: true } } },
        });
        if (!row) return { status: 404, body: { message: `No business "${params.slug}" in "${params.placeSlug}"` } };
        return { status: 200, body: toBusinessDetail(row, params.placeSlug, this.clock()) };
      },
    });
  }
}
```

`orderBy tier desc` sorts by the Postgres enum order (`example < basic < verified < darb`), so
Darb clients come first. Ranking proper arrives with search in Plan 3.

`apps/api/src/businesses/businesses.module.ts`:

```ts
import { Module } from "@nestjs/common";
import { PlacesModule } from "../places/places.module.js";
import { TaxonomyModule } from "../taxonomy/taxonomy.module.js";
import { BusinessesController, CLOCK } from "./businesses.controller.js";

@Module({
  imports: [PlacesModule, TaxonomyModule],
  controllers: [BusinessesController],
  providers: [{ provide: CLOCK, useValue: () => new Date() }],
})
export class BusinessesModule {}
```

Add `BusinessesModule` to `imports` in `app.module.ts`.

- [ ] **Step 4: Run tests to verify they pass, then commit**

Run: `pnpm --filter @darb/api test && pnpm typecheck && pnpm lint`
Expected: all pass.

```bash
git add apps/api
git commit -m "feat(api): business lists by place subtree and kind, details, and open-now"
```

---

### Task 14: `@darb/seed` package, sectors and kinds from the Universe

**Files:**
- Create: `packages/seed/{package.json,tsconfig.json,tsconfig.build.json,vitest.config.ts}`,
  `packages/seed/src/types.ts`, `packages/seed/src/index.ts`, `packages/seed/src/screen-schema.ts`,
  `packages/seed/src/validate.test.ts`, `packages/seed/scripts/import-universe.ts`,
  `packages/seed/data/sectors.json`, `packages/seed/data/kinds.json`,
  `packages/seed/data/screens.json`, `packages/seed/data/extra-screens.json`

**Interfaces:**
- Produces:

```ts
// packages/seed/src/types.ts
import type { Hours, Localized, PlaceStatus, PlaceType, Template, Tier } from "@darb/core";

export interface SeedSector { slug: string; name: Localized; tagline: Localized; accent: string; order: number }
export interface SeedKind {
  slug: string; sector: string; parent: string | null; name: Localized;
  synonyms: { he: string[]; ar: string[]; en: string[] };
  template: Template; attributes: string[]; icon: string | null; order: number; status: "active" | "hidden";
}
export interface SeedScreen {
  brand: Localized; title: Localized; subtitle?: Localized; tags?: Localized[];
  items: { label: Localized; meta?: Localized }[]; cta: Localized;
  palette: { bg: string; surface: string; ink: string; accent: string }; font: string;
}
export interface SeedPlace {
  slug: string; cbsCode: string | null; type: PlaceType; parent: string | null; name: Localized;
  aliases: string[]; lat: number; lng: number; status: PlaceStatus;
}
export interface SeedBrand { slug: string; name: Localized }
export interface SeedBusiness {
  slug: string; place: string; brand: string | null; primaryKind: string; kinds: string[];
  name: Localized; tagline: Localized; address: Localized; lat: number; lng: number;
  hours: Hours; attributes: Record<string, boolean | string | number>;
  experience: SeedScreen; tier: Tier;
}
```

- `loadSectors(): SeedSector[]`, `loadKinds(): SeedKind[]`, `loadScreens(): Record<string, SeedScreen>`
  (kind slug → screen, merged from `screens.json` and `extra-screens.json`), `loadPlaces(): SeedPlace[]`,
  `loadBrands(): SeedBrand[]`, `loadBusinesses(): SeedBusiness[]`, `SCREEN_SCHEMA` (JSON schema object).

- [ ] **Step 1: Create the package**

Template from Task 2 with name `@darb/seed`, plus:

```json
"dependencies": { "@darb/core": "workspace:*" },
"devDependencies": { "@types/node": "catalog:", "ajv": "catalog:", "tsx": "catalog:", "typescript": "catalog:", "vitest": "catalog:" },
"files": ["dist", "data"]
```

and in `tsconfig.json` add `"types": ["node"]` and include `"scripts"` alongside `"src"`, with
`rootDir` set to `"."`; in `tsconfig.build.json` set `"compilerOptions": { "rootDir": "src" }`,
`"include": ["src"]`. `seed` is the one package allowed to use `node:` APIs; it is never imported by
web or mobile.

- [ ] **Step 2: Write `src/types.ts` (above) and `src/screen-schema.ts`**

```ts
const localized = {
  type: "object",
  properties: { he: { type: "string" }, ar: { type: "string" }, en: { type: "string" } },
  additionalProperties: false,
  minProperties: 1,
} as const;

/**
 * Experience content of a v1 showroom business. In v1 every template shares this shape (it is
 * the shape of the Universe screens); template-specific schemas arrive with the owner studio.
 */
export const SCREEN_SCHEMA = {
  type: "object",
  required: ["brand", "title", "items", "cta", "palette", "font"],
  properties: {
    brand: localized,
    title: localized,
    subtitle: localized,
    tags: { type: "array", items: localized },
    items: {
      type: "array",
      minItems: 1,
      items: { type: "object", required: ["label"], properties: { label: localized, meta: localized }, additionalProperties: false },
    },
    cta: localized,
    palette: {
      type: "object",
      required: ["bg", "surface", "ink", "accent"],
      properties: Object.fromEntries(["bg", "surface", "ink", "accent"].map((k) => [k, { type: "string", pattern: "^#[0-9a-fA-F]{6}$" }])),
      additionalProperties: false,
    },
    font: { type: "string", minLength: 1 },
  },
  additionalProperties: false,
} as const;
```

- [ ] **Step 3: Write `src/index.ts`**

```ts
import { readFileSync } from "node:fs";
import type { SeedBrand, SeedBusiness, SeedKind, SeedPlace, SeedScreen, SeedSector } from "./types.js";

export * from "./types.js";
export { SCREEN_SCHEMA } from "./screen-schema.js";

const read = <T>(file: string): T => JSON.parse(readFileSync(new URL(`../data/${file}`, import.meta.url), "utf8")) as T;

export const loadSectors = () => read<SeedSector[]>("sectors.json");
export const loadKinds = () => read<SeedKind[]>("kinds.json");
export const loadScreens = (): Record<string, SeedScreen> => ({
  ...read<Record<string, SeedScreen>>("screens.json"),
  ...read<Record<string, SeedScreen>>("extra-screens.json"),
});
export const loadPlaces = () => read<SeedPlace[]>("places.json");
export const loadBrands = () => read<SeedBrand[]>("brands.json");
export const loadBusinesses = () => read<SeedBusiness[]>("businesses.json");
```

- [ ] **Step 4: Write the importer** — `packages/seed/scripts/import-universe.ts`

It reads the Darb 2.0 data module directly (it only has type imports, so `tsx` can load it) and
writes Hebrew and English. Arabic and synonyms are filled in Task 15.

```ts
import { writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import type { SeedKind, SeedScreen, SeedSector } from "../src/types.js";

const source = process.argv[2];
if (!source) throw new Error("Usage: tsx scripts/import-universe.ts <Darb-2.0>/src/content/universe-data.ts");

type L = { he: string; en: string };
interface UDistrict { id: string; name: L; tagline: L; accent: string }
interface UTrade { id: string; district: string; name: L; category?: string; screen?: SeedScreen & { archetype: string } }

const { districts, trades } = (await import(pathToFileURL(source).href)) as { districts: UDistrict[]; trades: UTrade[] };

const CATEGORY_TEMPLATE: Record<string, SeedKind["template"]> = {
  restaurants: "menu",
  barbershops: "booking",
  salons: "booking",
  shops: "shop",
};
const DELIVERY_TEMPLATES = new Set(["menu", "shop"]);
const out = (file: string, data: unknown) =>
  writeFileSync(new URL(`../data/${file}`, import.meta.url), `${JSON.stringify(data, null, 2)}\n`);

const sectors: SeedSector[] = districts.map((d, i) => ({
  slug: d.id,
  name: { he: d.name.he, ar: "", en: d.name.en },
  tagline: { he: d.tagline.he, ar: "", en: d.tagline.en },
  accent: d.accent,
  order: i + 1,
}));

const orderInSector = new Map<string, number>();
const kinds: SeedKind[] = trades.map((t) => {
  const order = (orderInSector.get(t.district) ?? 0) + 1;
  orderInSector.set(t.district, order);
  const template = t.screen ? (t.screen.archetype as SeedKind["template"]) : CATEGORY_TEMPLATE[t.category ?? ""];
  if (!template) throw new Error(`No template for trade ${t.id}`);
  return {
    slug: t.id,
    sector: t.district,
    parent: null,
    name: { he: t.name.he, ar: "", en: t.name.en },
    synonyms: { he: [], ar: [], en: [] },
    template,
    attributes: DELIVERY_TEMPLATES.has(template) ? ["delivers"] : [],
    icon: null,
    order,
    status: "active",
  };
});

const screens: Record<string, SeedScreen> = {};
for (const t of trades) {
  if (!t.screen) continue;
  const { archetype: _archetype, ...screen } = t.screen;
  screens[t.id] = screen;
}

out("sectors.json", sectors);
out("kinds.json", kinds);
out("screens.json", screens);
console.log(`${sectors.length} sectors, ${kinds.length} kinds, ${Object.keys(screens).length} screens`);
```

- [ ] **Step 5: Run the importer**

Run:

```bash
pnpm --filter @darb/seed exec tsx scripts/import-universe.ts ~/Documents/GitHub/Darb-2.0/src/content/universe-data.ts
```

Expected: `18 sectors, 204 kinds, 200 screens`. (The four category trades, restaurants,
barbershops, salons and shops, have no generated screen.)

- [ ] **Step 6: Write `data/extra-screens.json`** for the four trades without screens

```json
{
  "restaurants": {
    "brand": { "he": "בית אל-זיתון", "ar": "بيت الزيتون", "en": "Beit al-Zaytoun" },
    "title": { "he": "התפריט של הערב", "ar": "قائمة الليلة", "en": "Tonight's menu" },
    "subtitle": { "he": "הזמנה לשולחן או משלוח", "ar": "اطلب إلى الطاولة أو توصيل", "en": "Order to the table or for delivery" },
    "tags": [{ "he": "ראשונות", "ar": "مقبلات", "en": "Starters" }, { "he": "עיקריות", "ar": "أطباق رئيسية", "en": "Mains" }, { "he": "קינוחים", "ar": "حلويات", "en": "Desserts" }],
    "items": [
      { "label": { "he": "מסחן", "ar": "مسخن", "en": "Musakhan" }, "meta": { "he": "₪68 · עוף, סומק, בצל", "ar": "₪68 · دجاج، سماق، بصل", "en": "₪68 · chicken, sumac, onion" } },
      { "label": { "he": "מקלובה", "ar": "مقلوبة", "en": "Maqluba" }, "meta": { "he": "₪74 · לשניים", "ar": "₪74 · لشخصين", "en": "₪74 · for two" } },
      { "label": { "he": "סלט פטוש", "ar": "سلطة فتوش", "en": "Fattoush" }, "meta": { "he": "₪32", "ar": "₪32", "en": "₪32" } }
    ],
    "cta": { "he": "הזמנה · 25 דק'", "ar": "اطلب · 25 دقيقة", "en": "Order · 25 min" },
    "palette": { "bg": "#1f2a1c", "surface": "#2c3a28", "ink": "#f4ecd8", "accent": "#c9a24b" },
    "font": "Amiri"
  },
  "barbershops": {
    "brand": { "he": "המספרה של סאמר", "ar": "صالون سامر", "en": "Samer's Barbershop" },
    "title": { "he": "תור בשתי לחיצות", "ar": "دور بنقرتين", "en": "A chair in two taps" },
    "subtitle": { "he": "היום · 3 ספרים פנויים", "ar": "اليوم · 3 حلاقين متاحين", "en": "Today · 3 barbers free" },
    "tags": [{ "he": "16:00", "ar": "16:00", "en": "16:00" }, { "he": "16:30", "ar": "16:30", "en": "16:30" }, { "he": "17:15", "ar": "17:15", "en": "17:15" }],
    "items": [
      { "label": { "he": "תספורת", "ar": "قص شعر", "en": "Haircut" }, "meta": { "he": "₪60 · 30 דק'", "ar": "₪60 · 30 دقيقة", "en": "₪60 · 30 min" } },
      { "label": { "he": "תספורת וזקן", "ar": "شعر ولحية", "en": "Cut and beard" }, "meta": { "he": "₪85 · 45 דק'", "ar": "₪85 · 45 دقيقة", "en": "₪85 · 45 min" } },
      { "label": { "he": "תספורת ילדים", "ar": "قص شعر أطفال", "en": "Kids' cut" }, "meta": { "he": "₪45 · 20 דק'", "ar": "₪45 · 20 دقيقة", "en": "₪45 · 20 min" } }
    ],
    "cta": { "he": "קביעת תור", "ar": "احجز دورك", "en": "Book a chair" },
    "palette": { "bg": "#111315", "surface": "#1c1f22", "ink": "#f1ede6", "accent": "#c8a15a" },
    "font": "Heebo"
  },
  "salons": {
    "brand": { "he": "סלון ליאן", "ar": "صالون ليان", "en": "Salon Layan" },
    "title": { "he": "הרגע שלך", "ar": "لحظتك", "en": "Your moment" },
    "subtitle": { "he": "צבע, פן וטיפולים · נשים בלבד", "ar": "صبغة، سشوار وعلاجات · للنساء فقط", "en": "Colour, blow-dry and treatments · women only" },
    "tags": [{ "he": "ראשון", "ar": "الأحد", "en": "Sun" }, { "he": "שני", "ar": "الاثنين", "en": "Mon" }, { "he": "שלישי", "ar": "الثلاثاء", "en": "Tue" }],
    "items": [
      { "label": { "he": "צבע שורשים", "ar": "صبغة جذور", "en": "Root colour" }, "meta": { "he": "₪180 · 90 דק'", "ar": "₪180 · 90 دقيقة", "en": "₪180 · 90 min" } },
      { "label": { "he": "פן", "ar": "سشوار", "en": "Blow-dry" }, "meta": { "he": "₪90 · 40 דק'", "ar": "₪90 · 40 دقيقة", "en": "₪90 · 40 min" } },
      { "label": { "he": "טיפול קרטין", "ar": "علاج كيراتين", "en": "Keratin treatment" }, "meta": { "he": "₪450 · 3 שע'", "ar": "₪450 · 3 ساعات", "en": "₪450 · 3 h" } }
    ],
    "cta": { "he": "קביעת תור עם מקדמה", "ar": "احجزي مع عربون", "en": "Book with a deposit" },
    "palette": { "bg": "#f6ece8", "surface": "#fffaf7", "ink": "#3a2522", "accent": "#b4655a" },
    "font": "Heebo"
  },
  "shops": {
    "brand": { "he": "בית הבד של נור", "ar": "بيت نور", "en": "Bayt Nour" },
    "title": { "he": "חנות הבית", "ar": "متجر البيت", "en": "The home shop" },
    "subtitle": { "he": "משלוח לכל הצפון", "ar": "توصيل لكل الشمال", "en": "Delivery across the north" },
    "tags": [{ "he": "שמן זית", "ar": "زيت زيتون", "en": "Olive oil" }, { "he": "זעתר", "ar": "زعتر", "en": "Za'atar" }, { "he": "סבון", "ar": "صابون", "en": "Soap" }],
    "items": [
      { "label": { "he": "שמן זית כתית 1 ל'", "ar": "زيت زيتون بكر 1 ل", "en": "Extra virgin olive oil 1L" }, "meta": { "he": "₪55", "ar": "₪55", "en": "₪55" } },
      { "label": { "he": "זעתר ביתי 250 ג'", "ar": "زعتر بلدي 250 غ", "en": "Home za'atar 250g" }, "meta": { "he": "₪28", "ar": "₪28", "en": "₪28" } },
      { "label": { "he": "סבון שמן זית", "ar": "صابون زيت زيتون", "en": "Olive oil soap" }, "meta": { "he": "₪18", "ar": "₪18", "en": "₪18" } }
    ],
    "cta": { "he": "לסל · משלוח מחר", "ar": "أضف للسلة · توصيل غداً", "en": "Add to cart · delivery tomorrow" },
    "palette": { "bg": "#eef0e4", "surface": "#fbfcf6", "ink": "#25301d", "accent": "#6c7d3a" },
    "font": "Heebo"
  }
}
```

- [ ] **Step 7: Write the validation test (sector and kind parts)** — `packages/seed/src/validate.test.ts`

```ts
import { hasText, isSlug, LOCALES, TEMPLATES, type Localized } from "@darb/core";
import { Ajv } from "ajv";
import { describe, expect, it } from "vitest";
import { loadKinds, loadScreens, loadSectors, SCREEN_SCHEMA } from "./index.js";

/** Halal gate: none of these may appear in any kind name or synonym. */
const BLOCKED = [
  "bar", "pub", "wine", "beer", "liquor", "alcohol", "casino", "gambling", "lottery", "pork",
  "nightclub", "night club", "tattoo", "strip",
  "בר", "יין", "בירה", "אלכוהול", "קזינו", "הימורים", "חזיר", "מועדון לילה", "קעקוע",
  "خمر", "نبيذ", "بيرة", "كحول", "كازينو", "قمار", "خنزير", "ملهى ليلي", "وشم",
];
const blockedIn = (text: string) =>
  BLOCKED.filter((w) => new RegExp(`(^|[^\\p{L}])${w}([^\\p{L}]|$)`, "iu").test(text));
const complete = (value: Localized) => LOCALES.every((l) => (value[l] ?? "").trim() !== "");

const sectors = loadSectors();
const kinds = loadKinds();

describe("sectors", () => {
  it("are the 18 sectors with unique slugs, accents and order", () => {
    expect(sectors).toHaveLength(18);
    expect(new Set(sectors.map((s) => s.slug)).size).toBe(18);
    for (const s of sectors) {
      expect(isSlug(s.slug), s.slug).toBe(true);
      expect(s.accent).toMatch(/^#[0-9a-f]{6}$/);
    }
  });
  it("have names and taglines in Hebrew, Arabic and English", () => {
    for (const s of sectors) {
      expect(complete(s.name), `${s.slug} name`).toBe(true);
      expect(complete(s.tagline), `${s.slug} tagline`).toBe(true);
    }
  });
});

describe("kinds", () => {
  const sectorSlugs = new Set(sectors.map((s) => s.slug));
  const kindSlugs = new Set(kinds.map((k) => k.slug));

  it("have unique valid slugs, a known sector, parent and template", () => {
    expect(kindSlugs.size).toBe(kinds.length);
    for (const k of kinds) {
      expect(isSlug(k.slug), k.slug).toBe(true);
      expect(sectorSlugs.has(k.sector), `${k.slug} sector`).toBe(true);
      if (k.parent) expect(kindSlugs.has(k.parent), `${k.slug} parent`).toBe(true);
      expect(TEMPLATES).toContain(k.template);
    }
  });
  it("have names in all three languages and at least one synonym per language", () => {
    for (const k of kinds) {
      expect(complete(k.name), `${k.slug} name`).toBe(true);
      for (const l of LOCALES) expect(k.synonyms[l].length, `${k.slug} synonyms.${l}`).toBeGreaterThan(0);
    }
  });
  it("contain nothing haram", () => {
    for (const k of kinds) {
      const texts = [...Object.values(k.name), ...k.synonyms.he, ...k.synonyms.ar, ...k.synonyms.en];
      for (const t of texts) expect(blockedIn(t), `${k.slug}: "${t}"`).toEqual([]);
    }
  });
  it("each have a valid experience screen", () => {
    const screens = loadScreens();
    const validate = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);
    for (const k of kinds) {
      const screen = screens[k.slug];
      expect(screen, `${k.slug} screen`).toBeDefined();
      expect(validate(screen), `${k.slug}: ${JSON.stringify(validate.errors)}`).toBe(true);
      expect(hasText(screen!.brand)).toBe(true);
    }
  });
});
```

- [ ] **Step 8: Run it to verify the right parts fail**

Run: `pnpm install && pnpm --filter @darb/seed test`
Expected: the structure, haram and screen tests PASS. "have names and taglines in Hebrew,
Arabic and English" and "at least one synonym per language" FAIL on Arabic. Task 15 fixes those.
If the haram test fails, list the offending kinds and **stop and ask the user** whether to remove
or rename each one. Do not decide alone.

- [ ] **Step 9: Commit**

```bash
git add packages/seed pnpm-lock.yaml
git commit -m "feat(seed): import sectors, kinds and screens from Darb Universe with validation"
```

---

### Task 15: Arabic names and synonyms for every sector and kind

**Files:**
- Modify: `packages/seed/data/sectors.json`, `packages/seed/data/kinds.json`

**Interfaces:**
- Consumes: the validation test from Task 14 (the definition of done).

This is a content task. The test from Task 14 is already failing, which makes it the TDD gate.

- [ ] **Step 1: Fill in Arabic sector names and taglines**

For each of the 18 sectors, set `name.ar` and `tagline.ar`. Write natural Palestinian/Levantine
Arabic as used by Arab citizens of Israel, not literal translations. Keep the same tone as the
Hebrew. Examples: `food` → `name.ar: "حي النكهات"`, `tagline.ar: "أطباق وقهوة وحلويات، مباشرة من الهاتف"`;
`beauty` → `"شارع الجمال"`, `"مواعيد وعلاجات ولحظات دلال صغيرة"`.

- [ ] **Step 2: Fill in Arabic names and synonyms for every kind**

For each of the 204 kinds:
- `name.ar`: the everyday Arabic name (`barbershops` → `"صالونات حلاقة"`, `hummus` → `"حمص وفلافل"`).
- `synonyms.he`, `synonyms.ar`, `synonyms.en`: 2–6 words people actually type, including
  colloquial forms, singulars and common misspellings. For example, `barbershops`:
  `he: ["ספר", "מספרה", "תספורת", "ברבר"]`, `ar: ["حلاق", "حلاقة", "صالون رجالي", "قص شعر"]`,
  `en: ["barber", "barber shop", "haircut", "fade"]`.
- Never add a synonym that names a haram product or activity, even as "not X".

Work sector by sector and run `pnpm --filter @darb/seed test` after each sector to watch the
failure list shrink.

- [ ] **Step 3: Flag halal questions for the user**

Review every kind against the halal rule. Two kinds need explicit confirmation:
`spas` ("Spas and massage", mixed-gender massage) and `escape-rooms`. Write the list of kinds you
are unsure about, with one line each, into the task report for the user. Change nothing on your own.

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @darb/seed test`
Expected: all sector and kind tests pass.

- [ ] **Step 5: Commit**

```bash
git add packages/seed/data
git commit -m "feat(seed): Arabic names and he/ar/en search synonyms for all sectors and kinds"
```

---

### Task 16: Places of Israel

**Files:**
- Create: `packages/seed/scripts/fetch-places.ts`, `packages/seed/data/places-overrides.json`,
  `packages/seed/data/places.json` (generated), `packages/seed/data/places-review.md` (generated)
- Modify: `packages/seed/src/validate.test.ts`

**Interfaces:**
- Produces: `places.json` (`SeedPlace[]`). The tree is `israel` (country) → one region per
  district → localities. `parent` is a slug, and parents come before children in the file.

Sources: the CBS localities list on data.gov.il (resource `5c78e9fa-c2e2-4771-93ff-7f400a12f7ba`:
Hebrew name, English name, CBS code, sub-district code), and OpenStreetMap Nominatim for
coordinates, Arabic and English names, and settlement type. Nominatim allows 1 request per second
with an identifying User-Agent. The script waits 1.1s between requests, so a full run takes about
25 minutes. It is run once and its output is committed.

- [ ] **Step 1: Write the overrides file** — `packages/seed/data/places-overrides.json`

Overrides win over fetched data and are keyed by CBS code. `extra` adds places that are not CBS
localities.

```json
{
  "byCbsCode": {
    "1292": { "slug": "judeida-makr", "name": { "en": "Judeida-Makr" } },
    "6800": { "slug": "kiryat-ata", "name": { "en": "Kiryat Ata" } },
    "9500": { "slug": "kiryat-bialik", "name": { "en": "Kiryat Bialik" } },
    "8200": { "slug": "kiryat-motzkin", "name": { "en": "Kiryat Motzkin" } },
    "9600": { "slug": "kiryat-yam", "name": { "en": "Kiryat Yam" } },
    "1063": { "slug": "maalot-tarshiha", "name": { "en": "Ma'alot-Tarshiha" } },
    "7600": { "slug": "akko", "name": { "en": "Akko (Acre)" }, "aliases": ["Acre", "Akka", "Acco"] },
    "8900": { "slug": "tamra" },
    "547": { "slug": "tamra-yizreel" }
  },
  "extra": [
    {
      "slug": "kiryat-haim", "cbsCode": null, "type": "neighbourhood", "parent": "haifa",
      "name": { "he": "קריית חיים", "ar": "كريات حاييم", "en": "Kiryat Haim" },
      "aliases": ["Qiryat Hayyim"], "lat": 32.8247, "lng": 35.0569, "status": "live"
    }
  ]
}
```

- [ ] **Step 2: Write the fetch script** — `packages/seed/scripts/fetch-places.ts`

```ts
import { readFileSync, writeFileSync } from "node:fs";
import { toSlug, type Localized, type PlaceType } from "@darb/core";
import type { SeedPlace } from "../src/types.js";

const DATA = (file: string) => new URL(`../data/${file}`, import.meta.url);
const UA = "DarbCitySeed/1.0 (+https://darb.co.il)";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** CBS sub-district code → region slug. Sub-districts 71–77 (Judea and Samaria) are excluded. */
const REGION_OF: Record<number, string> = {
  11: "jerusalem-district",
  21: "northern-district", 22: "northern-district", 23: "northern-district",
  24: "northern-district", 25: "northern-district", 29: "northern-district",
  31: "haifa-district", 32: "haifa-district",
  41: "central-district", 42: "central-district", 43: "central-district", 44: "central-district",
  51: "tel-aviv-district", 52: "tel-aviv-district", 53: "tel-aviv-district",
  61: "southern-district", 62: "southern-district",
};
const LIVE_REGIONS = new Set(["northern-district", "haifa-district"]);
const REGIONS: Record<string, { name: Localized; lat: number; lng: number }> = {
  "northern-district": { name: { he: "מחוז הצפון", ar: "اللواء الشمالي", en: "Northern District" }, lat: 32.88, lng: 35.38 },
  "haifa-district": { name: { he: "מחוז חיפה", ar: "لواء حيفا", en: "Haifa District" }, lat: 32.62, lng: 35.0 },
  "central-district": { name: { he: "מחוז המרכז", ar: "اللواء الأوسط", en: "Central District" }, lat: 32.1, lng: 34.9 },
  "tel-aviv-district": { name: { he: "מחוז תל אביב", ar: "لواء تل أبيب", en: "Tel Aviv District" }, lat: 32.07, lng: 34.79 },
  "jerusalem-district": { name: { he: "מחוז ירושלים", ar: "لواء القدس", en: "Jerusalem District" }, lat: 31.77, lng: 35.1 },
  "southern-district": { name: { he: "מחוז הדרום", ar: "اللواء الجنوبي", en: "Southern District" }, lat: 30.9, lng: 34.8 },
};

interface CbsRow { "סמל_ישוב": string; "שם_ישוב": string; "שם_ישוב_לועזי": string; "סמל_נפה": number }
interface OsmHit { lat: string; lon: string; addresstype: string; category: string; namedetails?: Record<string, string> }
interface Overrides { byCbsCode: Record<string, Partial<SeedPlace>>; extra: SeedPlace[] }

const res = await fetch(
  "https://data.gov.il/api/3/action/datastore_search?resource_id=5c78e9fa-c2e2-4771-93ff-7f400a12f7ba&limit=5000",
  { headers: { "User-Agent": UA } },
);
const cbs = ((await res.json()) as { result: { records: CbsRow[] } }).result.records
  .map((r) => ({ code: r["סמל_ישוב"].trim(), he: r["שם_ישוב"].trim(), en: r["שם_ישוב_לועזי"].trim(), sub: r["סמל_נפה"] }))
  .filter((r) => r.code !== "0" && REGION_OF[r.sub] !== undefined);

const overrides = JSON.parse(readFileSync(DATA("places-overrides.json"), "utf8")) as Overrides;
const titleCase = (s: string) => s.toLowerCase().replace(/(^|[\s\-'(])(\p{L})/gu, (_m, p: string, c: string) => p + c.toUpperCase());
const TYPE: Record<string, PlaceType> = { city: "city", town: "town", village: "village", hamlet: "village", isolated_dwelling: "village", suburb: "neighbourhood" };

async function geocode(he: string): Promise<OsmHit | null> {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(he)}&countrycodes=il&format=jsonv2&namedetails=1&limit=5`;
  const hits = (await (await fetch(url, { headers: { "User-Agent": UA } })).json()) as OsmHit[];
  return hits.find((h) => h.category === "place" || (h.category === "boundary" && h.addresstype in TYPE)) ?? null;
}

const places: SeedPlace[] = [
  { slug: "israel", cbsCode: null, type: "country", parent: null, name: { he: "ישראל", ar: "إسرائيل", en: "Israel" }, aliases: ["البلاد"], lat: 31.5, lng: 34.9, status: "live" },
  ...Object.entries(REGIONS).map(([slug, r]): SeedPlace => ({
    slug, cbsCode: null, type: "region", parent: "israel", name: r.name, aliases: [], lat: r.lat, lng: r.lng,
    status: LIVE_REGIONS.has(slug) ? "live" : "soon",
  })),
];
const review: string[] = [];
const used = new Set(places.map((p) => p.slug));

for (const [i, row] of cbs.entries()) {
  await sleep(1100);
  const hit = await geocode(row.he);
  const region = REGION_OF[row.sub]!;
  const o = overrides.byCbsCode[row.code] ?? {};
  const osmEn = hit?.namedetails?.["name:en"];
  const en = o.name?.en ?? osmEn ?? (row.en ? titleCase(row.en) : "");
  const ar = o.name?.ar ?? hit?.namedetails?.["name:ar"] ?? "";
  let slug = o.slug ?? (en ? toSlug(en) : `cbs-${row.code}`);
  if (used.has(slug)) slug = `${slug}-${row.code}`;
  used.add(slug);
  if (!hit) review.push(`- ${row.code} ${row.he}: no OpenStreetMap match (no coordinates)`);
  if (!ar) review.push(`- ${row.code} ${row.he}: no Arabic name`);
  if (!en) review.push(`- ${row.code} ${row.he}: no English name`);
  places.push({
    slug,
    cbsCode: row.code,
    type: o.type ?? TYPE[hit?.addresstype ?? ""] ?? "village",
    parent: region,
    name: { he: row.he, ar, en },
    aliases: [...new Set([row.en, osmEn, ...(o.aliases ?? [])].filter((a): a is string => !!a && a !== en))],
    lat: o.lat ?? (hit ? Number(hit.lat) : 0),
    lng: o.lng ?? (hit ? Number(hit.lon) : 0),
    status: LIVE_REGIONS.has(region) ? "live" : "soon",
  });
  if (i % 50 === 0) console.log(`${i}/${cbs.length}`);
}
places.push(...overrides.extra);

writeFileSync(DATA("places.json"), `${JSON.stringify(places, null, 2)}\n`);
writeFileSync(DATA("places-review.md"), `# Places needing review\n\n${review.join("\n") || "None."}\n`);
console.log(`${places.length} places, ${review.length} review notes`);
```

- [ ] **Step 3: Add the places validation tests** — append to `packages/seed/src/validate.test.ts`

```ts
import { loadPlaces } from "./index.js";

describe("places", () => {
  const places = loadPlaces();
  const bySlug = new Map(places.map((p) => [p.slug, p]));
  const byCbs = new Map(places.filter((p) => p.cbsCode).map((p) => [p.cbsCode, p]));
  const FLAGSHIPS = ["4000", "7600", "1292", "7500", "6800", "9500", "8200", "9600", "1063", "522", "8900"];

  it("have unique slugs and parents that come first", () => {
    expect(bySlug.size).toBe(places.length);
    const seen = new Set<string>();
    for (const p of places) {
      expect(isSlug(p.slug), p.slug).toBe(true);
      if (p.parent) expect(seen.has(p.parent), `${p.slug} parent ${p.parent}`).toBe(true);
      seen.add(p.slug);
    }
  });
  it("have names in three languages and coordinates inside Israel", () => {
    for (const p of places) {
      expect(complete(p.name), `${p.slug} name`).toBe(true);
      expect(p.lat, p.slug).toBeGreaterThan(29.4);
      expect(p.lat, p.slug).toBeLessThan(33.45);
      expect(p.lng, p.slug).toBeGreaterThan(34.2);
      expect(p.lng, p.slug).toBeLessThan(35.95);
    }
  });
  it("make every flagship live, with the right Tamra", () => {
    for (const code of FLAGSHIPS) expect(byCbs.get(code)?.status, code).toBe("live");
    expect(byCbs.get("8900")?.slug).toBe("tamra");
    expect(byCbs.get("547")?.slug).not.toBe("tamra");
    expect(bySlug.get("kiryat-haim")?.parent).toBe("haifa");
  });
  it("are live exactly in the Northern and Haifa districts", () => {
    for (const p of places.filter((x) => x.type !== "country" && x.type !== "region" && x.type !== "neighbourhood")) {
      const live = p.parent === "northern-district" || p.parent === "haifa-district";
      expect(p.status, p.slug).toBe(live ? "live" : "soon");
    }
  });
});
```

Run: `pnpm --filter @darb/seed test`
Expected: the places tests FAIL (`places.json` does not exist).

- [ ] **Step 4: Run the fetch**

Run: `pnpm --filter @darb/seed exec tsx scripts/fetch-places.ts` (about 25 minutes)
Expected: 1,146 places (1,316 CBS rows minus 178 in sub-districts 71–77 = 1,138 localities, plus
the country, 6 regions and Kiryat Haim), and a `places-review.md` listing the gaps.

- [ ] **Step 5: Resolve every review note through overrides**

For each line in `places-review.md`, add an entry under `byCbsCode` in `places-overrides.json` with
the missing `name.ar`, `name.en`, `lat`/`lng` (from the locality's Wikipedia or OpenStreetMap
page), or a corrected `slug`. Then re-run the script. To avoid another 25-minute fetch, the script
can be extended to reuse a cached `places.json` for rows that already have coordinates. Repeat
until `places-review.md` says "None." and the places tests pass.

- [ ] **Step 6: Commit**

```bash
git add packages/seed
git commit -m "feat(seed): every Israeli locality with he/ar/en names and coordinates; north is live"
```

---

### Task 17: Showroom businesses

**Files:**
- Create: `packages/seed/scripts/build-showroom.ts`, `packages/seed/data/brands.json` (generated),
  `packages/seed/data/businesses.json` (generated)
- Modify: `packages/seed/src/validate.test.ts`

**Interfaces:**
- Consumes: `loadKinds`, `loadScreens`, `loadPlaces` (Tasks 14–16).
- Produces: `brands.json` (one brand per kind, named after its screen brand) and
  `businesses.json`. Every flagship place gets one example business for every active kind. Every
  other live settlement gets one for each `COMMON_KINDS` entry. All are `tier: "example"`.

- [ ] **Step 1: Write the generator** — `packages/seed/scripts/build-showroom.ts`

```ts
import { writeFileSync } from "node:fs";
import { toSlug, type Hours, type Template } from "@darb/core";
import { loadKinds, loadPlaces, loadScreens, type SeedBrand, type SeedBusiness } from "../src/index.js";

const FLAGSHIP_CBS = new Set(["4000", "7600", "1292", "7500", "6800", "9500", "8200", "9600", "1063", "522", "8900"]);
export const COMMON_KINDS = [
  "restaurants", "cafes", "grill", "bakeries", "hummus", "sweets", "barbershops", "salons",
  "pharmacies", "dental", "gyms", "garages", "technicians", "device-repair", "butchers", "mosques",
];

const h = (open: string, close: string) => [{ open, close }];
const week = (days: number[], open: string, close: string) => Object.fromEntries(days.map((d) => [d, h(open, close)]));
const HOURS: Partial<Record<Template, Hours>> = {
  menu: { weekly: { ...week([0, 1, 2, 3, 4], "11:00", "23:00"), ...week([5, 6], "12:00", "01:00") }, exceptions: [] },
  booking: { weekly: { ...week([0, 1, 2, 3, 4], "09:00", "19:00"), 5: h("09:00", "14:00") }, exceptions: [] },
  shop: { weekly: { ...week([0, 1, 2, 3, 4], "09:00", "20:00"), 5: h("09:00", "15:00") }, exceptions: [] },
};
const DEFAULT_HOURS: Hours = { weekly: week([0, 1, 2, 3, 4], "08:00", "17:00"), exceptions: [] };
const MOSQUE_HOURS: Hours = { weekly: week([0, 1, 2, 3, 4, 5, 6], "04:00", "23:00"), exceptions: [] };

/** Deterministic offset of up to ~600 m so example businesses do not stack on the place centre. */
function jitter(seed: string): [number, number] {
  let x = 0;
  for (const ch of seed) x = (x * 31 + ch.charCodeAt(0)) >>> 0;
  const angle = (x % 360) * (Math.PI / 180);
  const r = 0.0015 + ((x >>> 9) % 40) / 10000;
  return [Math.sin(angle) * r, Math.cos(angle) * r];
}

const kinds = loadKinds().filter((k) => k.status === "active");
const screens = loadScreens();
const places = loadPlaces().filter((p) => p.status === "live" && ["city", "town", "village"].includes(p.type));

const usedBrandSlugs = new Set<string>();
const brands: SeedBrand[] = kinds.map((k) => {
  let slug = toSlug(screens[k.slug]!.brand.en ?? k.slug);
  if (usedBrandSlugs.has(slug)) slug = `${slug}-${k.slug}`;
  usedBrandSlugs.add(slug);
  return { slug, name: screens[k.slug]!.brand };
});
const brandOf = new Map(kinds.map((k, i) => [k.slug, brands[i]!.slug]));

const businesses: SeedBusiness[] = [];
for (const place of places) {
  const kindSlugs = FLAGSHIP_CBS.has(place.cbsCode ?? "") ? kinds.map((k) => k.slug) : COMMON_KINDS;
  for (const slug of kindSlugs) {
    const kind = kinds.find((k) => k.slug === slug);
    if (!kind) throw new Error(`COMMON_KINDS has unknown kind ${slug}`);
    const screen = screens[slug]!;
    const [dLat, dLng] = jitter(`${place.slug}/${slug}`);
    businesses.push({
      slug: brandOf.get(slug)!,
      place: place.slug,
      brand: brandOf.get(slug)!,
      primaryKind: slug,
      kinds: [slug],
      name: screen.brand,
      tagline: screen.subtitle ?? screen.title,
      address: place.name,
      lat: Number((place.lat + dLat).toFixed(6)),
      lng: Number((place.lng + dLng).toFixed(6)),
      hours: slug === "mosques" ? MOSQUE_HOURS : (HOURS[kind.template] ?? DEFAULT_HOURS),
      attributes: kind.attributes.includes("delivers") ? { delivers: true } : {},
      experience: screen,
      tier: "example",
    });
  }
}

const out = (file: string, data: unknown) =>
  writeFileSync(new URL(`../data/${file}`, import.meta.url), `${JSON.stringify(data, null, 2)}\n`);
out("brands.json", brands);
out("businesses.json", businesses);
console.log(`${brands.length} brands, ${businesses.length} businesses in ${places.length} places`);
```

- [ ] **Step 2: Add the business validation tests** — append to `validate.test.ts`

```ts
import { loadBrands, loadBusinesses } from "./index.js";

describe("showroom businesses", () => {
  const businesses = loadBusinesses();
  const places = new Map(loadPlaces().map((p) => [p.slug, p]));
  const kindSlugs = new Set(loadKinds().map((k) => k.slug));
  const brandSlugs = new Set(loadBrands().map((b) => b.slug));
  const validate = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);

  it("are examples in live places, with known kinds and brands", () => {
    for (const b of businesses) {
      expect(b.tier).toBe("example");
      expect(places.get(b.place)?.status, `${b.place}/${b.slug}`).toBe("live");
      for (const k of b.kinds) expect(kindSlugs.has(k), k).toBe(true);
      if (b.brand) expect(brandSlugs.has(b.brand), b.brand).toBe(true);
      expect(validate(b.experience), `${b.place}/${b.slug}`).toBe(true);
    }
  });
  it("have slugs unique within their place", () => {
    const keys = businesses.map((b) => `${b.place}/${b.slug}`);
    expect(new Set(keys).size).toBe(keys.length);
  });
  it("give every flagship one business per kind", () => {
    const sakhnin = businesses.filter((b) => b.place === "sakhnin");
    expect(new Set(sakhnin.map((b) => b.primaryKind)).size).toBe(kindSlugs.size);
  });
});
```

Run: `pnpm --filter @darb/seed test` → FAIL (`businesses.json` missing).

- [ ] **Step 3: Generate and verify**

Run: `pnpm --filter @darb/seed exec tsx scripts/build-showroom.ts && pnpm --filter @darb/seed test`
Expected: 204 brands; about 10,400 businesses (11 flagships × 204 kinds = 2,244, plus about 510
other live settlements × 16 common kinds ≈ 8,160); all seed tests pass.

- [ ] **Step 4: Commit**

```bash
git add packages/seed
git commit -m "feat(seed): showroom example businesses across the north"
```

---

### Task 18: Seed loader and `pnpm dev`

**Files:**
- Create: `apps/api/src/seed/load.ts`, `apps/api/src/seed/load.test.ts`, `apps/api/src/seed/run.ts`
- Modify: `apps/api/package.json` (add `"@darb/seed": "workspace:*"` to devDependencies),
  `apps/api/src/app.module.ts` (none if unchanged), `README.md`

**Interfaces:**
- Consumes: the `Seed*` types and loaders (Task 14); `SCREEN_SCHEMA`; `PrismaService`.
- Produces: `loadSeed(prisma: PrismaService, data: SeedData): Promise<SeedCounts>` where
  `SeedData = { places; sectors; kinds; brands; businesses }` (arrays of the `Seed*` types) and
  `SeedCounts = { places: number; sectors: number; kinds: number; brands: number; businesses: number }`.
  It is idempotent: upserts by slug (`placeId + slug` for businesses), and businesses get
  `source: "seed"`, `status: "published"`.

- [ ] **Step 1: Write the failing test** — `apps/api/src/seed/load.test.ts`

```ts
import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { loadSeed, type SeedData } from "./load.js";

const prisma = testPrisma();
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const screen = {
  brand: { en: "Samer" }, title: { en: "Book" }, items: [{ label: { en: "Cut" } }], cta: { en: "Go" },
  palette: { bg: "#000000", surface: "#111111", ink: "#ffffff", accent: "#d9a54c" }, font: "Heebo",
};
const data: SeedData = {
  places: [
    { slug: "israel", cbsCode: null, type: "country", parent: null, name: { en: "Israel" }, aliases: [], lat: 31.5, lng: 34.9, status: "live" },
    { slug: "northern-district", cbsCode: null, type: "region", parent: "israel", name: { en: "North" }, aliases: [], lat: 32.9, lng: 35.4, status: "live" },
    { slug: "sakhnin", cbsCode: "7500", type: "city", parent: "northern-district", name: { en: "Sakhnin" }, aliases: [], lat: 32.86, lng: 35.3, status: "live" },
  ],
  sectors: [{ slug: "beauty", name: { en: "Beauty" }, tagline: { en: "x" }, accent: "#d9aaa2", order: 1 }],
  kinds: [
    { slug: "barbershops", sector: "beauty", parent: null, name: { en: "Barbershops" }, synonyms: { he: ["ספר"], ar: ["حلاق"], en: ["barber"] }, template: "booking", attributes: [], icon: null, order: 1, status: "active" },
    { slug: "kids-haircuts", sector: "beauty", parent: "barbershops", name: { en: "Kids" }, synonyms: { he: ["x"], ar: ["x"], en: ["x"] }, template: "booking", attributes: [], icon: null, order: 2, status: "active" },
  ],
  brands: [{ slug: "samer", name: { en: "Samer" } }],
  businesses: [
    { slug: "samer", place: "sakhnin", brand: "samer", primaryKind: "barbershops", kinds: ["barbershops"], name: { en: "Samer" }, tagline: { en: "x" }, address: { en: "Sakhnin" }, lat: 32.861, lng: 35.301, hours: { weekly: {}, exceptions: [] }, attributes: {}, experience: screen, tier: "example" },
  ],
};

it("loads a full tree with paths, sub-kinds and published businesses", async () => {
  const counts = await loadSeed(prisma, data);
  expect(counts).toEqual({ places: 3, sectors: 1, kinds: 2, brands: 1, businesses: 1 });
  const sakhnin = await prisma.place.findUniqueOrThrow({ where: { slug: "sakhnin" } });
  expect(sakhnin.path).toBe("/israel/northern-district/sakhnin/");
  const kids = await prisma.kind.findUniqueOrThrow({ where: { slug: "kids-haircuts" }, include: { parent: true } });
  expect(kids.parent?.slug).toBe("barbershops");
  const b = await prisma.business.findFirstOrThrow({ include: { kinds: true, brand: true } });
  expect([b.status, b.source, b.brand?.slug, b.kinds.length]).toEqual(["published", "seed", "samer", 1]);
});

it("is idempotent", async () => {
  await loadSeed(prisma, data);
  await loadSeed(prisma, data);
  expect(await prisma.place.count()).toBe(3);
  expect(await prisma.business.count()).toBe(1);
  expect(await prisma.businessKind.count()).toBe(1);
});

it("refuses experience content that breaks the screen schema", async () => {
  const bad = { ...data, businesses: [{ ...data.businesses[0]!, experience: { ...screen, items: [] } }] };
  await expect(loadSeed(prisma, bad)).rejects.toThrow(/samer/);
});
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm install && pnpm --filter @darb/api test`
Expected: FAIL, cannot resolve `./load.js`.

- [ ] **Step 3: Implement** — `apps/api/src/seed/load.ts`

```ts
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
export interface SeedCounts { places: number; sectors: number; kinds: number; brands: number; businesses: number }

const validateScreen = new Ajv({ allErrors: true }).compile(SCREEN_SCHEMA);

export async function loadSeed(prisma: PrismaService, data: SeedData): Promise<SeedCounts> {
  for (const b of data.businesses) {
    if (!validateScreen(b.experience)) {
      throw new Error(`Invalid experience for ${b.place}/${b.slug}: ${JSON.stringify(validateScreen.errors)}`);
    }
  }

  const placeIds = new Map<string, string>();
  const paths = new Map<string, string>();
  for (const p of data.places) {
    const parentId = p.parent ? placeIds.get(p.parent) : null;
    if (p.parent && !parentId) throw new Error(`Place ${p.slug} comes before its parent ${p.parent}`);
    const path = `${p.parent ? paths.get(p.parent)! : "/"}${p.slug}/`;
    const fields = {
      type: p.type, parentId: parentId ?? null, path, name: json(p.name), aliases: p.aliases,
      lat: p.lat, lng: p.lng, cbsCode: p.cbsCode, status: p.status,
    };
    const row = await prisma.place.upsert({ where: { slug: p.slug }, create: { slug: p.slug, ...fields }, update: fields });
    placeIds.set(p.slug, row.id);
    paths.set(p.slug, path);
  }

  const sectorIds = new Map<string, string>();
  for (const s of data.sectors) {
    const fields = { name: json(s.name), tagline: json(s.tagline), accent: s.accent, order: s.order };
    const row = await prisma.sector.upsert({ where: { slug: s.slug }, create: { slug: s.slug, ...fields }, update: fields });
    sectorIds.set(s.slug, row.id);
  }

  const kindIds = new Map<string, string>();
  const pending = [...data.kinds];
  while (pending.length > 0) {
    const index = pending.findIndex((k) => !k.parent || kindIds.has(k.parent));
    if (index === -1) throw new Error(`Kind parents form a cycle or are missing: ${pending.map((k) => k.slug).join(", ")}`);
    const k = pending.splice(index, 1)[0]!;
    const fields = {
      sectorId: sectorIds.get(k.sector)!, parentKindId: k.parent ? kindIds.get(k.parent)! : null,
      name: json(k.name), synonyms: json(k.synonyms), template: k.template, contentSchema: json(SCREEN_SCHEMA),
      attributes: k.attributes, icon: k.icon, order: k.order, status: k.status,
    };
    const row = await prisma.kind.upsert({ where: { slug: k.slug }, create: { slug: k.slug, ...fields }, update: fields });
    kindIds.set(k.slug, row.id);
  }

  const brandIds = new Map<string, string>();
  for (const b of data.brands) {
    const row = await prisma.brand.upsert({ where: { slug: b.slug }, create: { slug: b.slug, name: json(b.name) }, update: { name: json(b.name) } });
    brandIds.set(b.slug, row.id);
  }

  for (const b of data.businesses) {
    const placeId = placeIds.get(b.place);
    if (!placeId) throw new Error(`Business ${b.slug} is in unknown place ${b.place}`);
    const fields = {
      name: json(b.name), tagline: json(b.tagline), primaryKindId: kindIds.get(b.primaryKind)!, lat: b.lat, lng: b.lng,
      address: json(b.address), hours: json(b.hours), attributes: json(b.attributes), experience: json(b.experience),
      tier: b.tier, source: "seed" as const, status: "published" as const,
      brandId: b.brand ? brandIds.get(b.brand)! : null,
    };
    const row = await prisma.business.upsert({
      where: { placeId_slug: { placeId, slug: b.slug } },
      create: { slug: b.slug, placeId, ...fields },
      update: fields,
    });
    await prisma.businessKind.deleteMany({ where: { businessId: row.id } });
    await prisma.businessKind.createMany({ data: b.kinds.map((k) => ({ businessId: row.id, kindId: kindIds.get(k)! })) });
  }

  return {
    places: data.places.length, sectors: data.sectors.length, kinds: data.kinds.length,
    brands: data.brands.length, businesses: data.businesses.length,
  };
}
```

Add `"ajv": "catalog:"` to `apps/api` dependencies.

`apps/api/src/seed/run.ts`:

```ts
import "dotenv/config";
import { loadBrands, loadBusinesses, loadKinds, loadPlaces, loadSectors } from "@darb/seed";
import { loadConfig } from "../config.js";
import { PrismaService } from "../prisma/prisma.service.js";
import { loadSeed } from "./load.js";

const prisma = new PrismaService(loadConfig(process.env));
const started = Date.now();
const counts = await loadSeed(prisma, {
  places: loadPlaces(), sectors: loadSectors(), kinds: loadKinds(), brands: loadBrands(), businesses: loadBusinesses(),
});
await prisma.$disconnect();
console.log(`Seeded ${JSON.stringify(counts)} in ${((Date.now() - started) / 1000).toFixed(1)}s`);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `pnpm --filter @darb/api test`
Expected: all pass.

- [ ] **Step 5: Run the whole stack end to end**

Run: `pnpm build && pnpm dev` (in a second terminal, once "Nest application successfully started"
appears):

```bash
curl -s localhost:4000/health
curl -s "localhost:4000/places/sakhnin" | head -c 300; echo
curl -s "localhost:4000/places/sakhnin/businesses?kind=barbershops" | head -c 300; echo
curl -s "localhost:4000/nearest-place?lat=32.92&lng=35.08" | head -c 200; echo
curl -s localhost:4000/taxonomy | head -c 200; echo
```

Expected: `{"ok":true}`; Sakhnin with `ancestors` `israel`, `northern-district`; at least one
`example` barbershop; nearest place is Akko or one of its neighbours; taxonomy starting with the
`food` sector. If seeding ~10,000 businesses takes longer than 3 minutes, wrap each business
upsert and its `BusinessKind` writes in `prisma.$transaction` batches of 200 and re-measure.

- [ ] **Step 6: Commit**

```bash
git add apps/api README.md pnpm-workspace.yaml pnpm-lock.yaml
git commit -m "feat(api): idempotent seed loader; pnpm dev runs the full seeded stack"
```

---

### Task 19: Final verification

- [ ] **Step 1: Run every gate from a clean checkout**

```bash
git clean -xdf -e apps/api/.env -e .superpowers
pnpm install
pnpm infra:up
pnpm build && pnpm typecheck && pnpm lint && pnpm format:check && pnpm test
```

Expected: all green. Note the test counts per package in the task report.

- [ ] **Step 2: Push the branch and open a pull request** (only after the user confirms)

```bash
git push -u origin feat/plan-1-foundation
gh pr create --title "Plan 1: foundation and data API" --body "Implements docs/superpowers/plans/2026-10-12-plan-1-foundation-and-data.md"
```
