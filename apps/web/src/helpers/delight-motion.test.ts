import { readFileSync } from "node:fs";
import { expect, it } from "vitest";

/**
 * Every moving moment holds still with reduced motion: each class that animates in these files is
 * switched off under prefers-reduced-motion (its final state, no motion).
 */
const FILES = [
  "src/helpers/delight.module.css",
  "src/admin/street/street.module.css",
  "src/admin/shell.module.css",
];
const ANIMATED = [
  [
    "src/helpers/delight.module.css",
    [".count", ".note", ".milestone", ".milestoneCard", ".milestoneSeal", ".shine::after"],
  ],
  ["src/admin/street/street.module.css", [".stampCard", ".stampSeal"]],
  ["src/admin/shell.module.css", [".toast .toastSeal"]],
] as const;

const reduced = (css: string) =>
  [...css.matchAll(/@media \(prefers-reduced-motion: reduce\) \{([\s\S]*?)\n\}/g)]
    .map((m) => m[1])
    .join("\n");

it("stills every delight animation under prefers-reduced-motion", () => {
  for (const [file, selectors] of ANIMATED) {
    const css = readFileSync(file, "utf8");
    const still = reduced(css);
    for (const selector of selectors) expect(still, `${file} ${selector}`).toContain(selector);
  }
  for (const file of FILES)
    expect(reduced(readFileSync(file, "utf8"))).toMatch(/animation: none|display: none/);
});

it("keeps every moment short: the send stamp within 700 ms, counting within 600 ms", () => {
  const street = readFileSync("src/admin/street/street.module.css", "utf8");
  for (const m of street.matchAll(/animation: stamp-(?:card|seal) (\d+)ms/g))
    expect(Number(m[1])).toBeLessThanOrEqual(700);
  const delight = readFileSync("src/helpers/delight.module.css", "utf8");
  expect(Number(/animation: count (\d+)ms/.exec(delight)![1])).toBeLessThanOrEqual(600);
});
