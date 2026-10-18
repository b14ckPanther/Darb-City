import { expect, it } from "vitest";
import { contrastRatio, mix, readableAccent, readableOn } from "./contrast";

it("measures WCAG contrast", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  expect(contrastRatio("#fbf7ec", "#03110c")).toBeGreaterThan(17);
});

it("picks black or white text for an accent", () => {
  expect(readableOn("#ffd25a")).toBe("#000000");
  expect(readableOn("#1d5a43")).toBe("#ffffff");
});

it("mixes two colours in sRGB", () => {
  expect(mix("#000000", "#ffffff", 0.5)).toBe("#808080");
  expect(mix("#d9a54c", "#d9a54c", 0.3)).toBe("#d9a54c");
});

it("keeps an accent that reads, and deepens one that does not, toward the ink", () => {
  expect(readableAccent("#d9a54c", "#0e1b15", "#f6efe0")).toBe("#d9a54c");
  const onPaper = readableAccent("#d9a54c", "#f5eddc", "#14281f");
  expect(contrastRatio(onPaper, "#f5eddc")).toBeGreaterThanOrEqual(4.5);
  expect(onPaper).not.toBe("#14281f");
});
