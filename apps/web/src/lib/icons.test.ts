// @vitest-environment node
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { expect, it } from "vitest";
import { ICON_DIR, renderIcons } from "../../scripts/make-icons.mjs";

// sharp's prebuilt libvips differs a little between macOS and Linux (resize and SVG
// antialiasing), so bytes can't match across machines. Same size and near-identical pixels
// still proves the committed icons are the script's output and not a stale or hand-edited file.
const MAX_MEAN_DIFF = 2; // average per channel, out of 255

// favicon.ico holds one PNG per size; read them out so they compare like the other icons.
function icoFrames(ico: Buffer): Buffer[] {
  return Array.from({ length: ico.readUInt16LE(4) }, (_, i) => {
    const entry = 6 + i * 16;
    const offset = ico.readUInt32LE(entry + 12);
    return ico.subarray(offset, offset + ico.readUInt32LE(entry + 8));
  });
}

async function pixels(input: Buffer) {
  const { data, info } = await sharp(input)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });
  return { data, size: `${info.width}x${info.height}` };
}

async function differs(committed: Buffer, drawn: Buffer): Promise<string | null> {
  const [a, b] = await Promise.all([pixels(committed), pixels(drawn)]);
  let diff = 0;
  for (let i = 0; i < a.data.length; i++) diff += Math.abs(a.data[i]! - (b.data[i] ?? 0));
  const mean = diff / a.data.length;
  return a.size !== b.size || mean > MAX_MEAN_DIFF
    ? `${a.size} vs ${b.size}, mean ${mean.toFixed(2)}`
    : null;
}

it("commits the icons scripts/make-icons.mjs draws", async () => {
  const files = await renderIcons();
  const stale: string[] = [];
  for (const [name, drawn] of Object.entries(files)) {
    const committed = readFileSync(join(ICON_DIR, name));
    if (committed.equals(drawn)) continue;
    const pairs = name.endsWith(".ico")
      ? icoFrames(committed).map((frame, i) => [frame, icoFrames(drawn)[i]] as const)
      : [[committed, drawn] as const];
    for (const [a, b] of pairs) {
      const why = b ? await differs(a, b) : "missing frame";
      if (why) stale.push(`${name} (${why})`);
    }
  }
  expect(stale).toEqual([]);
}, 60_000);
