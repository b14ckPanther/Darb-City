import { describe, expect, it } from "vitest";
import { distance, isPinchOut, zoomedOut } from "./gesture.js";

describe("gestures", () => {
  it("measures the distance between two fingers", () => {
    expect(distance([0, 0], [3, 4])).toBe(5);
  });
  it("calls fingers moving together by 30% a pinch-out (up one level)", () => {
    expect(isPinchOut(200, 150)).toBe(false);
    expect(isPinchOut(200, 140)).toBe(true);
    expect(isPinchOut(0, 0)).toBe(false);
  });
  it("calls a user zoom of 1.5 levels below the camera a step up", () => {
    expect(zoomedOut(14, 13)).toBe(false);
    expect(zoomedOut(14, 12.5)).toBe(true);
  });
});
