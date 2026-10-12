import { expect, it } from "vitest";
import { levenshtein } from "./distance.js";

it("counts edits", () => {
  expect(levenshtein("barbr", "barber")).toBe(1);
  expect(levenshtein("kitten", "sitting")).toBe(3);
  expect(levenshtein("", "abc")).toBe(3);
  expect(levenshtein("סכנינ", "סחנינ")).toBe(1);
});
it("stops early above max", () => {
  expect(levenshtein("abcdef", "uvwxyz", 2)).toBeGreaterThan(2);
  expect(levenshtein("abc", "abcdefgh", 1)).toBeGreaterThan(1);
});
