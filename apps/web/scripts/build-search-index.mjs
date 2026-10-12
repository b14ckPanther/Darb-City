// Spec §5.2: the instant index of every place and active kind, built from @darb/seed at build time
// (decision 9) so lane 1 works when the API is down and `next build` never calls it.
import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { gzipSync } from "node:zlib";
import { buildInstantIndex } from "@darb/search-text";
import { loadKinds, loadPlaces } from "@darb/seed";

export const INDEX_LIMIT = 120 * 1024;

export function writeSearchIndex(publicDir) {
  const index = buildInstantIndex({
    places: loadPlaces().map((p) => ({
      slug: p.slug,
      type: p.type,
      status: p.status,
      parent: p.parent,
      name: p.name,
      aliases: p.aliases,
    })),
    kinds: loadKinds().map((k) => ({
      slug: k.slug,
      sector: k.sector,
      parent: k.parent,
      status: k.status,
      name: k.name,
      synonyms: k.synonyms,
    })),
  });
  const body = Buffer.from(JSON.stringify(index));
  const hash = createHash("sha256").update(body).digest("hex").slice(0, 12);
  const dir = join(publicDir, "search-index");
  mkdirSync(dir, { recursive: true });
  const name = `instant.${hash}.json`;
  for (const old of readdirSync(dir))
    if (old.startsWith("instant.") && old !== name) rmSync(join(dir, old));
  writeFileSync(join(dir, name), body);
  const gzipBytes = gzipSync(body).length;
  if (gzipBytes > INDEX_LIMIT)
    throw new Error(
      `Instant index is ${gzipBytes} bytes gzip, over the ${INDEX_LIMIT} budget (spec §5.2)`,
    );
  return { url: `/search-index/${name}`, bytes: body.length, gzipBytes };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const out = writeSearchIndex(new URL("../public/", import.meta.url).pathname);
  console.log(`instant index ${out.url}: ${(out.gzipBytes / 1024).toFixed(1)} KB gzip`);
}
