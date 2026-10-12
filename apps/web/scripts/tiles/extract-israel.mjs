// Extracts Israel from the newest Protomaps daily build into apps/web/.tiles/israel.pmtiles for
// /api/tiles. Downloads the pinned go-pmtiles CLI (BSD-3-Clause) on first use and checks its
// SHA-256. Map data: © OpenStreetMap contributors (ODbL), tiles by Protomaps.
// Usage: pnpm --filter @darb/web tiles:israel [-- --build=20261012.pmtiles]
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { arch, platform } from "node:os";
import { join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { parseArgs } from "node:util";

export const CLI_VERSION = "1.31.2";
const RELEASE = `https://github.com/protomaps/go-pmtiles/releases/download/v${CLI_VERSION}`;
/** SHA-256 digests published with the v1.31.2 release assets on GitHub. */
export const CLI_ASSETS = {
  "darwin-arm64": {
    file: "go-pmtiles-1.31.2_Darwin_arm64.zip",
    sha256: "40528f7f616fcbf91207cd48c8fc023d213f6d86c0cbf1f748732803d1880f3d",
  },
  "darwin-x64": {
    file: "go-pmtiles-1.31.2_Darwin_x86_64.zip",
    sha256: "1f0dc02eee6c58312dd6c509faee1b5c32f0596568af1bf51f1b034e7a88a65b",
  },
  "linux-arm64": {
    file: "go-pmtiles_1.31.2_Linux_arm64.tar.gz",
    sha256: "f8bd47e7ea866863489cad588fbaf2f31f42e5821f7a03f009b3769f05801cb1",
  },
  "linux-x64": {
    file: "go-pmtiles_1.31.2_Linux_x86_64.tar.gz",
    sha256: "3ed7dbf4ec2e6dfe5e25b6f70d1ffc932729f93c86db353bf514dd71010a312f",
  },
};
/** All of Israel, Eilat to the Hermon (west, south, east, north). */
export const ISRAEL_BBOX = "34.2,29.45,35.95,33.35";
/** 92 MB for build 20261010 (zoom 13 would be 46 MB); MapLibre overzooms beyond it. */
export const MAX_ZOOM = 14;
const BUILDS = "https://build-metadata.protomaps.dev/builds.json";

export function assetFor(os, cpu) {
  const asset = CLI_ASSETS[`${os}-${cpu}`];
  if (!asset) throw new Error(`Unsupported platform ${os}-${cpu}: install go-pmtiles by hand`);
  return asset;
}

/** builds.json lists { key: "YYYYMMDD.pmtiles", … }; the newest key sorts last. */
export function latestBuild(builds) {
  const keys = builds
    .map((b) => b.key)
    .filter((k) => /^\d{8}\.pmtiles$/.test(k))
    .sort();
  if (keys.length === 0) throw new Error("No Protomaps daily builds listed");
  return keys[keys.length - 1];
}

export function extractArgs(build, output) {
  return [
    "extract",
    `https://build.protomaps.com/${build}`,
    output,
    `--bbox=${ISRAEL_BBOX}`,
    `--maxzoom=${MAX_ZOOM}`,
  ];
}

async function ensureCli(dir) {
  const bin = join(dir, "pmtiles");
  if (existsSync(bin)) return bin;
  const asset = assetFor(platform(), arch());
  const res = await fetch(`${RELEASE}/${asset.file}`);
  if (!res.ok) throw new Error(`Download failed: ${res.status} ${asset.file}`);
  const archive = Buffer.from(await res.arrayBuffer());
  const digest = createHash("sha256").update(archive).digest("hex");
  if (digest !== asset.sha256) throw new Error(`Checksum mismatch for ${asset.file}: ${digest}`);
  const download = join(dir, asset.file);
  writeFileSync(download, archive);
  if (asset.file.endsWith(".zip")) execFileSync("unzip", ["-o", download, "pmtiles", "-d", dir]);
  else execFileSync("tar", ["-xzf", download, "-C", dir, "pmtiles"]);
  rmSync(download);
  return bin;
}

async function main() {
  const { values } = parseArgs({ options: { build: { type: "string" } } });
  const dir = fileURLToPath(new URL("../../.tiles/", import.meta.url));
  mkdirSync(join(dir, "bin"), { recursive: true });
  const cli = await ensureCli(join(dir, "bin"));
  const build = values.build ?? latestBuild(await (await fetch(BUILDS)).json());
  const partial = join(dir, "israel.partial.pmtiles");
  const output = join(dir, "israel.pmtiles");
  console.log(`tiles: extracting Israel from ${build} (maxzoom ${MAX_ZOOM})…`);
  execFileSync(cli, extractArgs(build, partial), { stdio: "inherit" });
  execFileSync(cli, ["verify", partial], { stdio: "inherit" });
  renameSync(partial, output);
  const bytes = statSync(output).size;
  writeFileSync(
    join(dir, "israel.json"),
    JSON.stringify(
      { build, bbox: ISRAEL_BBOX, maxzoom: MAX_ZOOM, bytes, extractedAt: new Date().toISOString() },
      null,
      2,
    ),
  );
  console.log(`tiles: ${(bytes / 1e6).toFixed(1)} MB -> ${output}`);
  console.log(JSON.parse(readFileSync(join(dir, "israel.json"), "utf8")));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) await main();
