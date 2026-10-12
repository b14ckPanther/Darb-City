import { motion } from "@darb/tokens";

export function parseCubicBezier(css: string): [number, number, number, number] {
  const match = /^cubic-bezier\(([^)]+)\)$/.exec(css.trim());
  const values = match?.[1]?.split(",").map((v) => Number(v.trim())) ?? [];
  if (values.length !== 4 || values.some((v) => Number.isNaN(v)))
    throw new Error(`Not a cubic-bezier: ${css}`);
  return values as [number, number, number, number];
}

/** The CSS timing function as t → progress (Newton's method, then bisection). */
export function cubicBezier(x1: number, y1: number, x2: number, y2: number): (t: number) => number {
  const cx = 3 * x1;
  const bx = 3 * (x2 - x1) - cx;
  const ax = 1 - cx - bx;
  const cy = 3 * y1;
  const by = 3 * (y2 - y1) - cy;
  const ay = 1 - cy - by;
  const sampleX = (t: number) => ((ax * t + bx) * t + cx) * t;
  const sampleY = (t: number) => ((ay * t + by) * t + cy) * t;
  const slopeX = (t: number) => (3 * ax * t + 2 * bx) * t + cx;
  const solve = (x: number) => {
    let t = x;
    for (let i = 0; i < 8; i++) {
      const error = sampleX(t) - x;
      if (Math.abs(error) < 1e-7) return t;
      const slope = slopeX(t);
      if (Math.abs(slope) < 1e-7) break;
      t -= error / slope;
    }
    let lo = 0;
    let hi = 1;
    t = x;
    while (hi - lo > 1e-7) {
      if (sampleX(t) < x) lo = t;
      else hi = t;
      t = (lo + hi) / 2;
    }
    return t;
  };
  return (x) => (x <= 0 ? 0 : x >= 1 ? 1 : sampleY(solve(x)));
}

/** The Darb ease-out, for camera moves (MapLibre takes an easing function). */
export const easeOut = cubicBezier(...parseCubicBezier(motion.easeOut));
