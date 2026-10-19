// @vitest-environment node
import { readFileSync } from "node:fs";
import { expect, it } from "vitest";
import { SPLASH_MS } from "./boot";

const css = readFileSync(new URL("./reveal.css", import.meta.url), "utf8").replace(
  /\/\*[\s\S]*?\*\//g,
  "",
);

/** Every `animation` declaration's runs, as [name, duration ms, delay ms]. */
function runs(block: string): [string, number, number][] {
  return [...block.matchAll(/animation:\s*([^;]+);/g)].flatMap(([, value]) =>
    value!
      .split(/,(?![^(]*\))/)
      .map((run) => run.trim())
      .filter((run) => run !== "none" && !run.startsWith("none"))
      .map((run) => {
        const times = [...run.matchAll(/(\d+)ms/g)].map((m) => Number(m[1]));
        return [run.split(/\s+/)[0]!, times[0] ?? 0, times[1] ?? 0] as [string, number, number];
      }),
  );
}

const reduced = css.slice(css.indexOf("@media (prefers-reduced-motion: reduce)"));
const reducedBlock = reduced.slice(0, reduced.indexOf("@keyframes"));
const motion = css.replace(reducedBlock, "");

it("finishes every run within 900 ms", () => {
  const all = runs(motion);
  expect(all.length).toBeGreaterThan(10);
  for (const [name, duration, delay] of all)
    expect(delay + duration, `${name} ends at ${delay + duration} ms`).toBeLessThanOrEqual(
      SPLASH_MS,
    );
  // The overlay itself is the last thing to go, and goes by 900 ms.
  expect(Math.max(...all.map(([, d, l]) => d + l))).toBe(SPLASH_MS);
});

it("under reduced motion, stops every movement and only fades the still first frame, quickly", () => {
  expect(reducedBlock).toMatch(/\.dsp \*,\s*\.dsp \*::before\s*\{\s*animation:\s*none !important;/);
  // The road, the badge and the name are motion: they never show.
  expect(reducedBlock).toMatch(
    /\.dsp-name,\s*\.dsp-badge,\s*\.dsp-ring,\s*\.dsp-road\s*\{\s*display:\s*none;/,
  );
  const fades = runs(reducedBlock);
  expect(fades.map(([name]) => name)).toEqual(["dsp-out"]);
  const [[, duration, delay]] = fades as [[string, number, number]];
  expect(duration + delay).toBeLessThanOrEqual(300);
});

it("only animates what the compositor can carry, plus a few small paints", () => {
  const props = [...css.matchAll(/@keyframes [\w-]+\s*\{([\s\S]*?)\n\}/g)].flatMap(([, body]) =>
    [...body!.matchAll(/([a-z-]+):/g)].map((m) => m[1]),
  );
  const allowed = ["opacity", "transform", "stroke-dashoffset"];
  expect(props.filter((p) => !allowed.includes(p!))).toEqual([]);
});

it("hides until its stylesheet has loaded, and covers everything but never takes layout", () => {
  expect(css).toMatch(/display: block !important;/);
  expect(css).toMatch(/position: fixed;\s*inset: 0;/);
});
