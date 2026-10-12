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
