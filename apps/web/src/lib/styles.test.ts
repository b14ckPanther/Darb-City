// @vitest-environment node
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = fileURLToPath(new URL("..", import.meta.url));

function cssFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return cssFiles(path);
    return entry.name.endsWith(".css") ? [path] : [];
  });
}

const PHYSICAL = [
  /\b(?:margin|padding|border)-(?:left|right)\b/,
  /(?:^|[\s;{])(?:left|right)\s*:/m,
  /text-align\s*:\s*(?:left|right)/,
  /\bfloat\s*:\s*(?:left|right)/,
  /border-(?:top|bottom)-(?:left|right)-radius/,
];
const MOTION_PROPS = new Set(["opacity", "transform"]);
/**
 * The landing hero is drawn once on arrival: SVG strokes draw in (stroke-dashoffset) and the mark is
 * painted in (clip-path). Both run once, for about a second, on a few small elements.
 */
const ONE_TIME_DRAWING = new Set(["stroke-dashoffset", "clip-path"]);
const drawsOnce = (file: string) => file.endsWith(join("landing", "Landing.module.css"));

describe.each(cssFiles(SRC))("%s", (file) => {
  const css = readFileSync(file, "utf8");

  it("uses logical properties only", () => {
    for (const re of PHYSICAL) expect(css, String(re)).not.toMatch(re);
  });

  it("transitions only transform and opacity", () => {
    for (const [, value] of css.matchAll(/transition(?:-property)?\s*:\s*([^;]+);/g)) {
      for (const part of value!.split(",")) {
        const property = part.trim().split(/\s+/)[0]!;
        if (property === "none") continue;
        expect(MOTION_PROPS.has(property), `${property} in "${value}"`).toBe(true);
      }
    }
  });

  it("animates only transform and opacity in keyframes", () => {
    for (const [, body] of css.matchAll(/@keyframes[^{]+\{([\s\S]*?\})\s*\}/g)) {
      for (const [, property] of body!.matchAll(/([a-z-]+)\s*:/g)) {
        const allowed =
          MOTION_PROPS.has(property!) || (drawsOnce(file) && ONE_TIME_DRAWING.has(property!));
        expect(allowed, property).toBe(true);
      }
    }
  });

  it("keeps literal durations between 400 and 700 ms (1 ms only for reduced motion)", () => {
    for (const [, ms] of css.matchAll(/(\d+)ms/g)) {
      const n = Number(ms);
      expect(n === 1 || (n >= 400 && n <= 700), `${n}ms`).toBe(true);
    }
  });
});
