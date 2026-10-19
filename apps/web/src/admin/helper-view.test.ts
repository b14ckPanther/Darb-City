import { expect, it } from "vitest";
import { acceptance } from "./helper-view";

it("is the accepted share of decided additions, null before any decision", () => {
  expect(acceptance({ approved: 0, rejected: 0 })).toBeNull();
  expect(acceptance({ approved: 3, rejected: 1 })).toEqual({ percent: 75, low: false });
});

it("marks a helper whose additions are mostly turned down, once there are enough", () => {
  expect(acceptance({ approved: 1, rejected: 3 })).toEqual({ percent: 25, low: true });
  expect(acceptance({ approved: 0, rejected: 2 })).toEqual({ percent: 0, low: false });
});
