import { expect, it } from "vitest";
import { filterStatic, fold, step, type PaletteHit } from "./palette";

const hit = (label: string, sub?: string): PaletteHit => ({
  id: label,
  group: "palettePages",
  label,
  sub,
  href: `/admin/${label}`,
  icon: "store",
});

it("folds case, Hebrew points and Arabic marks", () => {
  expect(fold("  Kafé ")).toBe("kafe");
  expect(fold("מַקוֹם")).toBe("מקום");
  expect(fold("مَقهى")).toBe("مقهى");
});

it("keeps every screen for an empty query and ranks a word start first", () => {
  const all = [hit("New place"), hit("Places"), hit("Businesses", "places nearby")];
  expect(filterStatic(all, "")).toEqual(all);
  expect(filterStatic(all, "plac").map((h) => h.label)).toEqual([
    "Places",
    "New place",
    "Businesses",
  ]);
  expect(filterStatic(all, "zzz")).toEqual([]);
});

it("wraps around with the arrow keys", () => {
  expect(step(0, 3, 1)).toBe(1);
  expect(step(2, 3, 1)).toBe(0);
  expect(step(0, 3, -1)).toBe(2);
  expect(step(0, 0, 1)).toBe(-1);
});
