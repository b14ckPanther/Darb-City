import { expect, it } from "vitest";
import { contrastRatio, readableOn } from "./contrast";

it("measures WCAG contrast", () => {
  expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 0);
  expect(contrastRatio("#fbf7ec", "#03110c")).toBeGreaterThan(17);
});

it("picks black or white text for an accent", () => {
  expect(readableOn("#ffd25a")).toBe("#000000");
  expect(readableOn("#1d5a43")).toBe("#ffffff");
});
