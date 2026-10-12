import { describe, expect, it } from "vitest";
import { isStageLevel } from "./types.js";

const place = { slug: "sakhnin", name: "Sakhnin", lat: 32.86, lng: 35.3 };
const door = {
  slug: "beauty",
  href: "/sakhnin/beauty",
  label: "Beauty",
  count: 3,
  accent: "#d9aaa2",
};

describe("isStageLevel", () => {
  it("accepts each depth", () => {
    expect(isStageLevel({ depth: 0 })).toBe(true);
    expect(isStageLevel({ depth: 1, place, doors: [door] })).toBe(true);
    expect(
      isStageLevel({
        depth: 2,
        place,
        sector: { slug: "beauty", name: "B", accent: "#d9aaa2" },
        doors: [],
      }),
    ).toBe(true);
    expect(isStageLevel({ depth: 3, place, pins: [] })).toBe(true);
  });
  it("rejects anything else", () => {
    for (const value of [null, {}, { depth: 4 }, { depth: 1, place }, { depth: 3, pins: [] }, "x"])
      expect(isStageLevel(value), JSON.stringify(value)).toBe(false);
  });
});
