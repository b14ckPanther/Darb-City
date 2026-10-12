// First-load JavaScript per level route, gzip-compressed, from the Next build output.
// Fails (exit 1) when a route exceeds the budget: spec §9.1 as amended by the controller ruling of
// 2026-10-12 (the Next 16 + React 19 runtime alone is ~130 KB gzip, so 150 KB cannot hold):
// total first-load JS <= 180 KB, and route-specific JS (beyond the shared root chunks) <= 40 KB.
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { gzipSync } from "node:zlib";

const LIMIT = 180 * 1024;
const ROUTE_LIMIT = 40 * 1024;
const NEXT = new URL("../.next/", import.meta.url);
const ROUTES = [
  "/[locale]/page",
  "/[locale]/[place]/page",
  "/[locale]/[place]/[sector]/page",
  "/[locale]/[place]/[sector]/[kind]/page",
  "/[locale]/[place]/[sector]/[kind]/[business]/page",
  "/[locale]/[place]/[sector]/[kind]/[business]/[...rest]/page",
  "/[locale]/k/[kind]/page",
];

const build = JSON.parse(readFileSync(new URL("build-manifest.json", NEXT), "utf8"));
const sizes = new Map();
const gz = (file) => {
  if (!sizes.has(file)) sizes.set(file, gzipSync(readFileSync(new URL(file, NEXT))).length);
  return sizes.get(file);
};

function entryFiles(route) {
  const sandbox = {};
  const source = readFileSync(
    new URL(`server/app${route}_client-reference-manifest.js`, NEXT),
    "utf8",
  );
  vm.runInNewContext(source, sandbox);
  const manifest = sandbox.__RSC_MANIFEST?.[route];
  if (!manifest) throw new Error(`No client manifest for ${route}`);
  return Object.values(manifest.entryJSFiles ?? {}).flat();
}

const strip = (f) => f.replace(/^\/?_next\//, "");
const shared = new Set(build.rootMainFiles.map(strip));
const sum = (files) => [...files].reduce((total, file) => total + gz(file), 0);
const kb = (bytes) => `${(bytes / 1024).toFixed(1).padStart(6)} KB`;

let failed = false;
console.log(`shared root chunks ${kb(sum(shared))}`);
for (const route of ROUTES) {
  const own = new Set(
    entryFiles(route)
      .map(strip)
      .filter((f) => !shared.has(f)),
  );
  const total = sum(shared) + sum(own);
  const ok = total <= LIMIT && sum(own) <= ROUTE_LIMIT;
  failed ||= !ok;
  console.log(`${ok ? "ok  " : "FAIL"} ${kb(total)} total ${kb(sum(own))} route  ${route}`);
}
if (failed) {
  console.error(
    `First-load JS must stay under ${LIMIT / 1024} KB gzip in total and ${ROUTE_LIMIT / 1024} KB ` +
      "route-specific per level route (spec §9.1, controller ruling 2026-10-12).",
  );
  process.exit(1);
}
