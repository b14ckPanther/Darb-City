import { describe, expect, it } from "vitest";
import { cubicBezier, easeOut, parseCubicBezier } from "./easing.js";

describe("easing", () => {
  it("parses a CSS cubic-bezier", () => {
    expect(parseCubicBezier("cubic-bezier(0.22, 1, 0.36, 1)")).toEqual([0.22, 1, 0.36, 1]);
    expect(() => parseCubicBezier("ease")).toThrow();
  });
  it("is the identity for a linear curve", () => {
    const linear = cubicBezier(0, 0, 1, 1);
    for (const t of [0, 0.3, 0.5, 0.9, 1]) expect(linear(t)).toBeCloseTo(t, 5);
  });
  it("follows the Darb ease-out: fast start, gentle landing", () => {
    expect(easeOut(0)).toBe(0);
    expect(easeOut(1)).toBe(1);
    expect(easeOut(0.25)).toBeCloseTo(0.7649, 3);
    expect(easeOut(0.5)).toBeCloseTo(0.9614, 3);
    let last = 0;
    for (let t = 0; t <= 1; t += 0.05) {
      expect(easeOut(t)).toBeGreaterThanOrEqual(last);
      last = easeOut(t);
    }
  });
});
