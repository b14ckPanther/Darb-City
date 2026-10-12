// @vitest-environment node
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { GET, HEAD } from "./route";

const dir = mkdtempSync(join(tmpdir(), "darb-tiles-"));
const bytes = Uint8Array.from({ length: 256 }, (_, i) => i);
writeFileSync(join(dir, "israel.pmtiles"), bytes);

beforeEach(() => vi.stubEnv("MAP_TILES_DIR", dir));
afterEach(() => vi.unstubAllEnvs());

const context = (name: string) => ({ params: Promise.resolve({ name }) });
const request = (name: string, range?: string) =>
  new Request(`http://web.test/api/tiles/${name}`, { headers: range ? { range } : {} });
const body = async (res: Response) => [...new Uint8Array(await res.arrayBuffer())];

it("serves a byte range as 206 with Content-Range", async () => {
  const res = await GET(request("israel.pmtiles", "bytes=10-19"), context("israel.pmtiles"));
  expect(res.status).toBe(206);
  expect(res.headers.get("content-range")).toBe("bytes 10-19/256");
  expect(res.headers.get("content-length")).toBe("10");
  expect(res.headers.get("accept-ranges")).toBe("bytes");
  expect(await body(res)).toEqual([10, 11, 12, 13, 14, 15, 16, 17, 18, 19]);
});

it("clamps a range that runs past the end (PMTiles asks for 16 KB headers)", async () => {
  const res = await GET(request("israel.pmtiles", "bytes=0-16383"), context("israel.pmtiles"));
  expect(res.status).toBe(206);
  expect(res.headers.get("content-range")).toBe("bytes 0-255/256");
  expect((await body(res)).length).toBe(256);
});

it("serves the whole file without a Range header, with a strong ETag", async () => {
  const res = await GET(request("israel.pmtiles"), context("israel.pmtiles"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-length")).toBe("256");
  expect(res.headers.get("etag")).toMatch(/^"[0-9a-f]+-[0-9a-f]+"$/);
  expect((await body(res)).length).toBe(256);
});

it("answers 416 for a range past the end", async () => {
  const res = await GET(request("israel.pmtiles", "bytes=300-"), context("israel.pmtiles"));
  expect(res.status).toBe(416);
  expect(res.headers.get("content-range")).toBe("bytes */256");
});

it("answers 404 for anything that is not an archive in the tiles folder", async () => {
  for (const name of ["../israel.pmtiles", "israel.mbtiles", "Israel.pmtiles", "missing.pmtiles"])
    expect((await GET(request(name), context(name))).status, name).toBe(404);
});

it("answers HEAD with the headers and no body", async () => {
  const res = await HEAD(request("israel.pmtiles"), context("israel.pmtiles"));
  expect(res.status).toBe(200);
  expect(res.headers.get("content-length")).toBe("256");
  expect(res.body).toBeNull();
});

it("never reads outside the tiles folder (path traversal)", async () => {
  // A secret archive beside the tiles folder, one level up.
  const outer = mkdtempSync(join(tmpdir(), "darb-tiles-outer-"));
  mkdirSync(join(outer, "tiles"));
  writeFileSync(join(outer, "secret.pmtiles"), bytes);
  mkdirSync(join(outer, "tiles", "folder.pmtiles"));
  vi.stubEnv("MAP_TILES_DIR", join(outer, "tiles"));
  for (const name of [
    "../secret.pmtiles",
    "..%2Fsecret.pmtiles",
    "%2e%2e%2fsecret.pmtiles",
    "..\\secret.pmtiles",
    "tiles/../../secret.pmtiles",
    join(outer, "secret.pmtiles"),
    "/etc/passwd",
    "secret.pmtiles\0",
    "israel.pmtiles/",
    ".pmtiles",
    "",
    "folder.pmtiles",
  ]) {
    expect((await GET(request("x.pmtiles"), context(name))).status, name).toBe(404);
    expect((await HEAD(request("x.pmtiles"), context(name))).status, name).toBe(404);
  }
});

it("ignores a malformed Range and refuses a backwards one", async () => {
  const whole = await GET(request("israel.pmtiles", "bytes=abc-"), context("israel.pmtiles"));
  expect(whole.status).toBe(200);
  expect((await body(whole)).length).toBe(256);
  const backwards = await GET(request("israel.pmtiles", "bytes=9-3"), context("israel.pmtiles"));
  expect(backwards.status).toBe(416);
});
