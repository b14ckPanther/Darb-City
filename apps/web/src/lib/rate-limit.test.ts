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
