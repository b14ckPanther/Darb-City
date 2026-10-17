// @vitest-environment node
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  mkdirSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { gunzipSync, gzipSync } from "node:zlib";
import { expect, it } from "vitest";
import { writeSearchIndex } from "../../scripts/build-search-index.mjs";

it("writes a content-hashed index under 120 KB gzip and removes stale ones", () => {
  const pub = mkdtempSync(join(tmpdir(), "darb-public-"));
  mkdirSync(join(pub, "search-index"));
  writeFileSync(join(pub, "search-index", "instant.000000000000.json"), "{}");
  const first = writeSearchIndex(pub);
  expect(first.url).toMatch(/^\/search-index\/instant\.[0-9a-f]{12}\.json$/);
  expect(first.gzipBytes).toBeLessThanOrEqual(120 * 1024);
  expect(readdirSync(join(pub, "search-index"))).toEqual([first.url.split("/").pop()]);
  const body = readFileSync(join(pub, first.url));
  expect(gunzipSync(gzipSync(body)).length).toBe(first.bytes);
  const index = JSON.parse(body.toString("utf8"));
  expect(index.v).toBe(1);
  expect(index.kinds.length).toBe(210);
  expect(index.places.some((p: { s: string }) => p.s === "sakhnin")).toBe(true);
  // Same seed, same file.
  expect(writeSearchIndex(pub).url).toBe(first.url);
  expect(existsSync(join(pub, first.url))).toBe(true);
});
