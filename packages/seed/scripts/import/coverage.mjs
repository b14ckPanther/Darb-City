// Coverage audit: how many real businesses each Darb kind has in the north, where, how complete
// their cards are and which source they came from; and which kinds are still thin, and why.
// Writes .superpowers/coverage-north.md at the repo root and prints a summary.
// Run: node packages/seed/scripts/import/coverage.mjs
import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { pathToFileURL } from "node:url";
import { KIND_INFO, OWNED_ELSEWHERE, sourcesByKind } from "./kind-map.mjs";
import { LISTINGS_DIR } from "./emit.mjs";

const DATA = new URL("../../data/", import.meta.url);
const read = (file) => JSON.parse(readFileSync(new URL(file, DATA), "utf8"));
export const THIN = 5;

/** Every real business with the file it came from. */
export function loadAll() {
  const out = [];
  for (const file of readdirSync(LISTINGS_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort())
    for (const b of JSON.parse(readFileSync(new URL(file, LISTINGS_DIR), "utf8")).businesses)
      out.push({ ...b, _file: file.replace(/\.json$/, "") });
  for (const b of read("clients.json").businesses) out.push({ ...b, _file: "clients" });
  return out;
}

/** Why a kind has fewer than THIN businesses. */
export function whyThin(kind, count) {
  if (kind.sector === "food") return "food sector: the food importer's (other branch)";
  if (OWNED_ELSEWHERE.kinds.has(kind.slug)) return "official list imported by another importer";
  const note = KIND_INFO[kind.slug]?.note;
  if (note) return note;
  const src = sourcesByKind()[kind.slug];
  if (!src) return "no OSM tag and no name rule";
  if (!src.tags.size)
    return "no OSM tag: found only by words in names; needs sign-ups or a directory source";
  return count === 0
    ? "OSM has the tag but no named one in the north"
    : "genuinely rare on OSM in the north; needs sign-ups or another source";
}

export function audit({ businesses, kinds, sectors, places, stats }) {
  const placeName = new Map(places.map((p) => [p.slug, p.name.en]));
  const rows = [];
  for (const k of kinds.filter((x) => x.status === "active")) {
    const list = businesses.filter((b) => b.kinds.includes(k.slug));
    const towns = {};
    const files = {};
    for (const b of list) {
      towns[b.place] = (towns[b.place] ?? 0) + 1;
      files[b._file] = (files[b._file] ?? 0) + 1;
    }
    const top = Object.entries(towns)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([p, n]) => `${placeName.get(p) ?? p} ${n}`);
    rows.push({
      kind: k,
      count: list.length,
      primary: list.filter((b) => b.primaryKind === k.slug).length,
      towns: Object.keys(towns).length,
      top,
      phone: list.filter((b) => b.phone).length,
      hours: list.filter((b) => Object.keys(b.hours?.weekly ?? {}).length).length,
      website: list.filter((b) => b.website).length,
      sources: Object.entries(files)
        .sort((a, b) => b[1] - a[1])
        .map(([f, n]) => `${f} ${n}`),
    });
  }
  const bySector = sectors.map((s) => ({
    sector: s,
    businesses: businesses.filter(
      (b) => kinds.find((k) => k.slug === b.primaryKind)?.sector === s.slug,
    ).length,
    kinds: rows.filter((r) => r.kind.sector === s.slug),
  }));
  const thin = rows
    .filter((r) => r.count < THIN)
    .map((r) => ({ ...r, why: whyThin(r.kind, r.count) }));
  return { rows, bySector, thin, stats, total: businesses.length };
}

const pct = (n, of) => (of ? `${Math.round((100 * n) / of)}%` : "-");

export function toMarkdown(a, date) {
  const lines = [];
  lines.push(`# Coverage in the north (${date})`, "");
  lines.push(
    `${a.total} real businesses in the Northern and Haifa districts, in ${a.rows.filter((r) => r.count > 0).length} of ${a.rows.length} active kinds. ` +
      `${a.thin.length} kinds have fewer than ${THIN}.`,
    "",
  );
  lines.push(
    "## By sector",
    "",
    "| Sector | Businesses (primary kind) | Kinds with 5+ | Kinds under 5 |",
  );
  lines.push("| --- | ---: | ---: | ---: |");
  for (const s of a.bySector)
    lines.push(
      `| ${s.sector.name.en} | ${s.businesses} | ${s.kinds.filter((r) => r.count >= THIN).length} | ${s.kinds.filter((r) => r.count < THIN).length} |`,
    );
  lines.push("", "## By kind", "");
  lines.push(
    "Count is every business carrying the kind (primary in brackets). Phone, hours and website are shares of the count.",
    "",
  );
  for (const s of a.bySector) {
    lines.push(`### ${s.sector.name.en}`, "");
    lines.push("| Kind | Count | Towns | Top towns | Phone | Hours | Website | Sources |");
    lines.push("| --- | ---: | ---: | --- | ---: | ---: | ---: | --- |");
    for (const r of s.kinds.sort((x, y) => y.count - x.count))
      lines.push(
        `| ${r.kind.name.en} (\`${r.kind.slug}\`) | ${r.count} (${r.primary}) | ${r.towns} | ${r.top.join(", ")} | ${pct(r.phone, r.count)} | ${pct(r.hours, r.count)} | ${pct(r.website, r.count)} | ${r.sources.join(", ")} |`,
      );
    lines.push("");
  }
  lines.push(
    `## Kinds with fewer than ${THIN}`,
    "",
    "| Kind | Sector | Count | Why |",
    "| --- | --- | ---: | --- |",
  );
  for (const r of a.thin.sort((x, y) => x.kind.sector.localeCompare(y.kind.sector)))
    lines.push(
      `| ${r.kind.name.en} (\`${r.kind.slug}\`) | ${r.kind.sector} | ${r.count} | ${r.why} |`,
    );
  if (a.stats) {
    lines.push("", "## OpenStreetMap features with no Darb kind", "");
    lines.push(
      "Named features in the import's bbox (the north and its edges, before the place check) that no kind takes; food, garages, fuel and banks are other importers'. The big ones are candidates for new kinds.",
      "",
      "| OSM tag | Named features |",
      "| --- | ---: |",
    );
    for (const [tag, n] of Object.entries(a.stats.unmapped)
      .sort((x, y) => y[1] - x[1])
      .slice(0, 30))
      lines.push(`| \`${tag}\` | ${n} |`);
    lines.push("", "Left out on purpose:", "");
    for (const [why, n] of Object.entries(a.stats.excludedWhy).sort((x, y) => y[1] - x[1]))
      lines.push(`- ${why}: ${n}`);
  }
  return `${lines.join("\n")}\n`;
}

async function main() {
  const kinds = read("kinds.json");
  const sectors = read("sectors.json");
  const places = read("places.json");
  const statsFile = new URL("./.cache/allkinds-stats.json", import.meta.url);
  const stats = existsSync(statsFile) ? JSON.parse(readFileSync(statsFile, "utf8")) : null;
  const a = audit({ businesses: loadAll(), kinds, sectors, places, stats });
  const out = new URL("../../../../.superpowers/", import.meta.url);
  mkdirSync(out, { recursive: true });
  writeFileSync(
    new URL("coverage-north.md", out),
    toMarkdown(a, new Date().toISOString().slice(0, 10)),
  );
  console.log(`${a.total} businesses; ${a.thin.length} kinds under ${THIN}`);
  for (const s of a.bySector) console.log(`  ${s.sector.slug.padEnd(12)} ${s.businesses}`);
  console.log(`Thin: ${a.thin.map((r) => `${r.kind.slug} ${r.count}`).join(", ")}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) await main();
