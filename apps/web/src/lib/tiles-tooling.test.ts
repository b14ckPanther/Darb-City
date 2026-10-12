// @vitest-environment node
import { readFileSync } from "node:fs";
import { PMTiles, zxyToTileId as referenceTileId, type Source } from "pmtiles";
import { describe, expect, it } from "vitest";
import {
  assetFor,
  CLI_ASSETS,
  extractArgs,
  ISRAEL_BBOX,
  latestBuild,
  MAX_ZOOM,
} from "../../scripts/tiles/extract-israel.mjs";
import { FIXTURE, FIXTURE_OPTIONS } from "../../scripts/tiles/make-test-tiles.mjs";
import { buildArchive, testTile, zxyToTileId } from "../../scripts/tiles/pmtiles-writer.mjs";

const source = (buf: Buffer): Source => ({
  getKey: () => "fixture",
  getBytes: async (offset: number, length: number) => ({
    data: buf.buffer.slice(
      buf.byteOffset + offset,
      buf.byteOffset + Math.min(offset + length, buf.length),
    ) as ArrayBuffer,
  }),
});

describe("PMTiles writer", () => {
  it("numbers tiles along the Hilbert curve like the pmtiles library", () => {
    for (const [z, x, y] of [
      [0, 0, 0],
      [1, 1, 0],
      [5, 17, 11],
      [12, 2449, 1655],
    ] as const)
      expect(zxyToTileId(z, x, y)).toBe(referenceTileId(z, x, y));
  });
  it("writes an archive the pmtiles library reads back", async () => {
    const archive = new PMTiles(source(buildArchive(FIXTURE_OPTIONS)));
    const header = await archive.getHeader();
    expect([header.minZoom, header.maxZoom, header.tileType]).toEqual([0, 12, 1]);
    // Sakhnin at zoom 12 is inside the fixture; the Atlantic is not.
    const tile = await archive.getZxy(12, 2449, 1655);
    expect(Buffer.from(tile!.data).equals(testTile())).toBe(true);
    expect(await archive.getZxy(12, 0, 0)).toBeUndefined();
    const metadata = (await archive.getMetadata()) as { vector_layers: { id: string }[] };
    expect(metadata.vector_layers.map((l) => l.id)).toEqual(["earth", "roads"]);
  });
  it("keeps the committed e2e fixture tiny and reproducible", () => {
    const committed = readFileSync(FIXTURE);
    expect(committed.length).toBeLessThan(2048);
    expect(committed.equals(buildArchive(FIXTURE_OPTIONS))).toBe(true);
  });
});

describe("Israel extract", () => {
  it("pins a checksum for every supported platform", () => {
    expect(assetFor("darwin", "arm64")).toEqual(CLI_ASSETS["darwin-arm64"]);
    expect(assetFor("linux", "x64").file).toBe("go-pmtiles_1.31.2_Linux_x86_64.tar.gz");
    for (const asset of Object.values(CLI_ASSETS)) expect(asset.sha256).toMatch(/^[0-9a-f]{64}$/);
    expect(() => assetFor("win32", "x64")).toThrow(/Unsupported platform/);
  });
  it("takes the newest daily build", () => {
    expect(
      latestBuild([
        { key: "20261010.pmtiles", version: "4.15.2" },
        { key: "20261012.pmtiles", version: "4.15.2" },
        { key: "20261011.pmtiles", version: "4.15.2" },
      ]),
    ).toBe("20261012.pmtiles");
    expect(() => latestBuild([])).toThrow();
  });
  it("extracts Israel to zoom 14", () => {
    expect(ISRAEL_BBOX).toBe("34.2,29.45,35.95,33.35");
    expect(MAX_ZOOM).toBe(14);
    expect(extractArgs("20261012.pmtiles", "/tmp/x.pmtiles")).toEqual([
      "extract",
      "https://build.protomaps.com/20261012.pmtiles",
      "/tmp/x.pmtiles",
      "--bbox=34.2,29.45,35.95,33.35",
      "--maxzoom=14",
    ]);
  });
});
