// JavaScript budgets, gzip-compressed, from the Next build output. Fails (exit 1) when exceeded:
// - level routes, spec §9.1 as amended by the controller ruling of 2026-10-12 (the Next 16 +
//   React 19 runtime alone is ~130 KB gzip): first-load JS <= 180 KB in total and <= 40 KB
//   route-specific (beyond the shared root chunks);
// - lazy groups (next/dynamic), each measured from its own react-loadable-manifest entries, found by
//   the marker string its code carries (scripts/lazy-budget.mjs). The stage (Plan 2B decision 1):
//   main-thread JS <= 340 KB with MapLibre's two main-thread modules (~297 KB for 6.11.2); the
//   worker module is reported, not budgeted. The search popup (Plan 3): <= 30 KB. A marker must
//   never appear in a first-load chunk.
import { readdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import vm from "node:vm";
import { gzipSync } from "node:zlib";
import { groupFiles, loadableEntries } from "./lazy-budget.mjs";

const LIMIT = 180 * 1024;
const ROUTE_LIMIT = 40 * 1024;
const NEXT = fileURLToPath(new URL("../.next/", import.meta.url));
const require = createRequire(import.meta.url);
const MAPLIBRE = JSON.parse(
  readFileSync(require.resolve("maplibre-gl/package.json"), "utf8"),
).version;
const VENDOR = fileURLToPath(
  new URL(`../public/map/vendor/maplibre-gl@${MAPLIBRE}/`, import.meta.url),
);
const ROUTES = [
  "/[locale]/page",
  "/[locale]/[place]/page",
  "/[locale]/[place]/[sector]/page",
  "/[locale]/[place]/[sector]/[kind]/page",
  "/[locale]/[place]/[sector]/[kind]/[business]/page",
  "/[locale]/[place]/[sector]/[kind]/[business]/[...rest]/page",
  "/[locale]/k/[kind]/page",
  // Keeps the stage since Plan 3 (M7), so it is held to the level budget too.
  "/[locale]/search/page",
  // The join form is a phone's first Darb page for many owners: the card form loads after it.
  "/[locale]/join/page",
  // The header's near me lands here; its map loads only once there is a point.
  "/[locale]/near/page",
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
    entries.set(
      route,
      Object.values(manifest.entryJSFiles ?? {})
        .flat()
        .map(strip),
    );
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
  // Clerk is for /admin only (spec §6.4): it must never ship to a public level route.
  for (const file of new Set([...shared, ...own])) {
    if (readFileSync(join(NEXT, file), "utf8").includes("@clerk/")) {
      console.error(`FAIL ${route}: ${file} contains Clerk code`);
      failed = true;
    }
  }
}

const initial = new Set(shared);
for (const files of entries.values()) for (const f of files) initial.add(f);
const code = (file) => readFileSync(join(NEXT, file), "utf8");
const loadable = loadableEntries(NEXT);
const maplibre = gz(join(VENDOR, "maplibre-gl.mjs")) + gz(join(VENDOR, "maplibre-gl-shared.mjs"));
const worker = gz(join(VENDOR, "maplibre-gl-worker.mjs"));

/** Each group must be found: a missing marker means its chunk went unmeasured. */
const LAZY = [
  { name: "stage", marker: "darb:stage-chunk", limit: 340 * 1024, extra: maplibre, required: true },
  { name: "search", marker: "darb:search-chunk", limit: 30 * 1024, extra: 0, required: true },
];

for (const group of LAZY) {
  const files = groupFiles(loadable, group.marker, code);
  const leaked = [...initial].filter((f) => code(f).includes(group.marker));
  const own = sum(files);
  const total = own + group.extra;
  const missing = files.size === 0;
  const ok = total <= group.limit && leaked.length === 0 && !(missing && group.required);
  failed ||= !ok;
  const extra = group.extra ? ` + MapLibre ${MAPLIBRE} ${kb(group.extra).trim()}` : "";
  const note = group.name === "stage" ? `, worker ${kb(worker).trim()}` : "";
  console.log(
    `${ok ? "ok  " : "FAIL"} ${kb(total)} ${group.name} (lazy chunks ${kb(own).trim()}${extra})${note}` +
      (missing ? " [not built]" : ""),
  );
  if (leaked.length > 0)
    console.error(`${group.name} code in first-load chunks: ${leaked.join(", ")}`);
  if (missing && group.required)
    console.error(
      `No lazy chunk carries ${group.marker}: is it still loaded through next/dynamic?`,
    );
}

if (failed) {
  console.error(
    `Budgets: first-load JS <= ${LIMIT / 1024} KB total and ${ROUTE_LIMIT / 1024} KB per route ` +
      `(spec §9.1, ruling 2026-10-12); ${LAZY.map((g) => `${g.name} <= ${g.limit / 1024} KB`).join(", ")}.`,
  );
  process.exit(1);
}
