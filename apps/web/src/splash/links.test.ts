// @vitest-environment node
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";
import { describe, expect, it } from "vitest";
import { themeColor } from "@darb/tokens";
import { adminManifest } from "@/admin/manifest";
import { helperManifest } from "@/helpers/manifest";
import { appMetadata, manifest } from "@/lib/pwa";
import {
  SPLASH_DIR,
  STYLESHEET_JSON,
  renderSplashes,
  renderStylesheet,
} from "../../scripts/make-splash.mjs";
import { SPLASH_DEVICES } from "./devices.mjs";
import { GROUND } from "./geometry.mjs";
import { startupImages } from "./links";

const SCRIPT = fileURLToPath(new URL("../../scripts/make-splash.mjs", import.meta.url));
// Same tolerance as the icons (src/lib/icons.test.ts): libvips differs a little between macOS and
// Linux, so committed bytes can't match across machines; near-identical pixels still prove it.
const MAX_MEAN_DIFF = 2;

async function pixels(input: Buffer) {
  const { data, info } = await sharp(input).raw().toBuffer({ resolveWithObject: true });
  return { data, size: `${info.width}x${info.height}` };
}

describe("startup image links", () => {
  const links = startupImages();

  it("links one image per current iPhone and iPad screen, by day and by night", () => {
    expect(links).toHaveLength(SPLASH_DEVICES.length * 2);
    expect(new Set(links.map((l) => l.media)).size).toBe(links.length);
    expect(links).toContainEqual({
      url: "/brand/splash/launch-light-1170x2532.png",
      media:
        "(device-width: 390px) and (device-height: 844px) and (-webkit-device-pixel-ratio: 3) and (orientation: portrait) and (prefers-color-scheme: light)",
    });
    expect(links).toContainEqual({
      url: "/brand/splash/launch-dark-2064x2752.png",
      media:
        "(device-width: 1032px) and (device-height: 1376px) and (-webkit-device-pixel-ratio: 2) and (orientation: portrait) and (prefers-color-scheme: dark)",
    });
  });

  it("links files that exist, each exactly its screen's size in device pixels", async () => {
    for (const { url, media } of links) {
      const file = join(SPLASH_DIR, url.replace("/brand/splash/", ""));
      const meta = await sharp(readFileSync(file)).metadata();
      const [, w, h, dpr] = media.match(
        /device-width: (\d+)px.*device-height: (\d+)px.*ratio: (\d)/,
      )!;
      expect(`${meta.width}x${meta.height}`).toBe(
        `${Number(w) * Number(dpr)}x${Number(h) * Number(dpr)}`,
      );
    }
  });

  it("puts the links in the site's head (the helper and admin layouts pass the same set)", () => {
    const apple = appMetadata("he").appleWebApp;
    expect(apple && typeof apple === "object" && apple.startupImage).toEqual(links);
  });
});

it("gives Android a clean system splash: every app's ground is the launch frame's paper", () => {
  for (const m of [manifest("he"), helperManifest("ar"), adminManifest("en")]) {
    expect(m.background_color).toBe(GROUND.light);
    expect(m.theme_color).toBe(themeColor.day);
    expect(m.icons.some((i) => i.sizes === "512x512" && i.purpose === "any")).toBe(true);
  }
  expect(GROUND).toEqual({ light: themeColor.day, dark: themeColor.night });
});

describe("scripts/make-splash.mjs", () => {
  it("commits the launch images and the reveal stylesheet it draws", async () => {
    const files = await renderSplashes();
    const stale: string[] = [];
    for (const [name, drawn] of Object.entries(files)) {
      let committed: Buffer;
      try {
        committed = readFileSync(join(SPLASH_DIR, name));
      } catch {
        stale.push(`${name} (missing)`);
        continue;
      }
      if (committed.equals(drawn)) continue;
      if (name.endsWith(".css")) {
        stale.push(name);
        continue;
      }
      const [a, b] = await Promise.all([pixels(committed), pixels(drawn)]);
      let diff = 0;
      for (let i = 0; i < a.data.length; i++) diff += Math.abs(a.data[i]! - (b.data[i] ?? 0));
      const mean = diff / a.data.length;
      if (a.size !== b.size || mean > MAX_MEAN_DIFF)
        stale.push(`${name} (mean ${mean.toFixed(2)})`);
    }
    expect(stale).toEqual([]);
    expect(readFileSync(STYLESHEET_JSON, "utf8")).toBe(renderStylesheet().json);
  }, 120_000);

  it("--check fails on missing or stale output, and passes on its own", () => {
    const dir = mkdtempSync(join(tmpdir(), "splash-"));
    const env = { ...process.env, SPLASH_OUT: join(dir, "out"), SPLASH_JSON: join(dir, "s.json") };
    const run = (...args: string[]) =>
      execFileSync(process.execPath, [SCRIPT, ...args], { env, stdio: "pipe" }).toString();
    try {
      expect(() => run("--check")).toThrow(/launch images out of date/);
      expect(run()).toMatch(/splash: \d+ files/);
      expect(run("--check")).toMatch(/match/);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
