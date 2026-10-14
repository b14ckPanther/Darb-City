import { expect, it } from "vitest";
import { seedSource } from "./seed-source.js";

it("matches seed rows the way the seed loader does", () => {
  expect(seedSource.place({ slug: "sakhnin", cbsCode: "7500" })).toBe(true);
  // Matched by CBS code even under another slug, and by slug without one.
  expect(seedSource.place({ slug: "renamed", cbsCode: "7500" })).toBe(true);
  expect(seedSource.place({ slug: "tamra", cbsCode: null })).toBe(true);
  expect(seedSource.place({ slug: "new-town", cbsCode: null })).toBe(false);
  expect(seedSource.sector("beauty")).toBe(true);
  expect(seedSource.sector("made-up")).toBe(false);
  expect(seedSource.kind("barbershops")).toBe(true);
  expect(seedSource.kind("kids-haircuts")).toBe(false);
  expect(seedSource.business("sakhnin", "samers-barbershop")).toBe(true);
  expect(seedSource.business("eilat", "abu-salim")).toBe(false);
  expect(seedSource.business("sakhnin", "fade-lab")).toBe(false);
});
