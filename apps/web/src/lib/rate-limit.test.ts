import { expect, it } from "vitest";
import { createLimiter } from "./rate-limit";

it("allows up to the limit per key per window", () => {
  const allow = createLimiter(2, 60_000);
  expect([allow("a", 0), allow("a", 1), allow("a", 2), allow("b", 3)]).toEqual([
    true,
    true,
    false,
    true,
  ]);
  expect(allow("a", 60_000)).toBe(true);
});

it("drops finished windows before clearing current counts", () => {
  const allow = createLimiter(1, 60_000);
  for (let i = 0; i < 50_000; i++) allow(`old${i}`, 0);
  allow("busy", 60_000);
  // The map is now over 50,000 keys: the next new key drops window 0, and "busy" keeps its count.
  allow("next", 60_000);
  expect(allow("busy", 60_001)).toBe(false);
});
