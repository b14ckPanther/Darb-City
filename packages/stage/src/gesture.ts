export const PINCH_OUT_RATIO = 0.7;

export function distance(a: [number, number], b: [number, number]): number {
  return Math.hypot(a[0] - b[0], a[1] - b[1]);
}

/** Two fingers moving together (zooming out) by 30% or more: go up one level (spec §3.3). */
export function isPinchOut(start: number, now: number): boolean {
  return start > 0 && now <= start * PINCH_OUT_RATIO;
}

/** The person zoomed the map out 1.5 levels or more below where the camera put it. */
export function zoomedOut(target: number, zoom: number): boolean {
  return zoom <= target - 1.5;
}
