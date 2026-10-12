import { describe, expect, it } from "vitest";
import { buildPlaza, PLAZA, type Box } from "./plaza.js";
import type { StageDoor } from "./types.js";

const doors = (n: number, count = 1): StageDoor[] =>
  Array.from({ length: n }, (_, i) => ({
    slug: `d${i}`,
    href: `/p/d${i}`,
    label: `Door ${i}`,
    count: i === 1 ? 0 : count,
    accent: "#d9aaa2",
  }));
const overlaps = (a: Box, b: Box) =>
  a.x < b.x + b.w - 1e-6 &&
  b.x < a.x + a.w - 1e-6 &&
  a.y < b.y + b.h - 1e-6 &&
  b.y < a.y + a.h - 1e-6;
const inside = (b: Box, w: number, h: number) =>
  b.x >= -1e-6 && b.y >= -1e-6 && b.x + b.w <= w + 1e-6 && b.y + b.h <= h + 1e-6;

const SIZES = [
  [320, 568],
  [390, 780],
  [768, 900],
  [840, 900],
  [1024, 700],
] as const;
const COUNTS = [1, 5, 12, 18, 30];

describe("buildPlaza", () => {
  for (const [width, height] of SIZES)
    for (const n of COUNTS)
      it(`${n} doors at ${width}×${height}: 44 px targets, no overlap, inside the scene`, () => {
        const scene = buildPlaza(doors(n), { width, height, dir: "ltr" });
        expect(scene.doors).toHaveLength(n);
        for (const d of scene.doors) {
          expect(d.hit.w).toBeGreaterThanOrEqual(PLAZA.minTarget);
          expect(d.hit.h).toBeGreaterThanOrEqual(PLAZA.minTarget);
          expect(d.frame.w).toBeGreaterThanOrEqual(PLAZA.minTarget);
          expect(d.frame.h / d.frame.w).toBeCloseTo(1.5, 6);
          expect(inside(d.hit, scene.width, scene.height)).toBe(true);
          expect(inside(d.frame, scene.width, scene.height)).toBe(true);
        }
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++)
            expect(overlaps(scene.doors[i]!.hit, scene.doors[j]!.hit), `${i}/${j}`).toBe(false);
        expect(scene.height).toBeGreaterThanOrEqual(height);
        expect(scene.gate.y).toBeGreaterThanOrEqual(PLAZA.top - 1e-6);
      });

  it("keeps list order, so links come in the same order as the list's doors", () => {
    const scene = buildPlaza(doors(18), { width: 840, height: 900, dir: "ltr" });
    expect(scene.doors.map((d) => d.slug)).toEqual(doors(18).map((d) => d.slug));
    expect(scene.doors.map((d) => d.href)).toEqual(doors(18).map((d) => d.href));
  });

  it("puts the first doors in the front row, nearest and largest", () => {
    const scene = buildPlaza(doors(18), { width: 840, height: 900, dir: "ltr" });
    const front = scene.doors[0]!;
    const back = scene.doors[17]!;
    expect(front.row).toBe(0);
    expect(front.frame.y).toBeGreaterThan(back.frame.y);
    expect(front.frame.w).toBeGreaterThanOrEqual(back.frame.w);
    expect(scene.rows[0]!.parallax).toBeGreaterThan(scene.rows[scene.rows.length - 1]!.parallax);
  });

  it("mirrors right to left: the first door stands at the right", () => {
    const ltr = buildPlaza(doors(5), { width: 390, height: 780, dir: "ltr" });
    const rtl = buildPlaza(doors(5), { width: 390, height: 780, dir: "rtl" });
    expect(rtl.doors[0]!.frame.x).toBeGreaterThan(rtl.doors[1]!.frame.x);
    for (let i = 0; i < 5; i++) {
      expect(rtl.doors[i]!.hit.x).toBeCloseTo(390 - ltr.doors[i]!.hit.x - ltr.doors[i]!.hit.w, 6);
      expect(rtl.doors[i]!.frame.y).toBe(ltr.doors[i]!.frame.y);
    }
  });

  it("centres the gate and runs one lit street from it to each door", () => {
    const scene = buildPlaza(doors(6), { width: 840, height: 900, dir: "ltr" });
    expect(scene.gate.x + scene.gate.w / 2).toBeCloseTo(420, 6);
    expect(scene.streets).toHaveLength(6);
    for (const s of scene.streets) {
      expect(s.from).toEqual([420, scene.gate.y + scene.gate.h]);
      const door = scene.doors[s.door]!;
      expect(s.to).toEqual([door.frame.x + door.frame.w / 2, door.frame.y + door.frame.h]);
      expect(s.color).toBe("#d9aaa2");
    }
  });

  it("dims empty doors but keeps them", () => {
    const scene = buildPlaza(doors(3), { width: 390, height: 780, dir: "ltr" });
    expect(scene.doors.map((d) => d.lit)).toEqual([true, false, true]);
  });

  it("is an empty plaza (gate only) with no doors", () => {
    const scene = buildPlaza([], { width: 390, height: 780, dir: "ltr" });
    expect(scene.doors).toEqual([]);
    expect(scene.height).toBe(780);
  });
});
