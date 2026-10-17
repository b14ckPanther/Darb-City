import { describe, expect, it } from "vitest";
import { matchKey, splitList, wordySegments } from "./offering-text.js";

describe("offering text", () => {
  it("splits a meta line into its heading and listed things", () => {
    expect(splitList("כריכי חלה ולאפה: שניצל, קבב, שווארמה")).toEqual([
      { head: "כריכי חלה ולאפה", parts: ["שניצל", "קבב", "שווארמה"] },
    ]);
    expect(splitList("سندويشات: شنيتسل، كباب")).toEqual([
      { head: "سندويشات", parts: ["شنيتسل", "كباب"] },
    ]);
  });
  it("drops prices, times and lead-in words", () => {
    expect(splitList("₪68 · chicken, sumac")).toEqual([
      { head: null, parts: [] },
      { head: null, parts: ["chicken", "sumac"] },
    ]);
    expect(splitList("Including gluten-free knafeh")[0]!.parts).toEqual(["gluten-free knafeh"]);
    expect(splitList("כולל כנאפה ללא גלוטן")[0]!.parts).toEqual(["כנאפה ללא גלוטן"]);
    expect(wordySegments("₪45 · inside and out · 20:05")).toBe("inside and out");
  });
  it("keys a matched thing the same way in every place", () => {
    expect(matchKey("Car Wash")).toBe("car-wash");
    expect(matchKey("שטיפת רכב")).toBe("שטיפת-רכב");
    expect(matchKey("gluten-free knafeh")).toBe("gluten-free-knafeh");
  });
});
