import { describe, expect, it } from "vitest";
import { closestPath, closestSlug, levenshtein } from "./fuzzy";

describe("levenshtein", () => {
  it("counts edits", () => {
    expect(levenshtein("sakhnim", "sakhnin")).toBe(1);
    expect(levenshtein("", "abc")).toBe(3);
    expect(levenshtein("same", "same")).toBe(0);
  });
});

describe("closestSlug", () => {
  const places = ["haifa", "sakhnin", "tamra", "tamra-yizreel", "arraba"];
  it("finds near misses", () => {
    expect(closestSlug("sakhnim", places)).toBe("sakhnin");
    expect(closestSlug("hifa", places)).toBe("haifa");
    expect(closestSlug("arabba", places)).toBe("arraba");
  });
  it("gives up on nonsense", () => {
    expect(closestSlug("qqqqqqqqqq", places)).toBeNull();
    expect(closestSlug("x", places)).toBeNull();
  });
});

describe("closestPath", () => {
  const world = {
    places: ["sakhnin", "haifa"],
    sectors: ["beauty", "food"],
    kinds: new Map([
      ["barbershops", "beauty"],
      ["restaurants", "food"],
    ]),
  };
  it("corrects a place", () => {
    expect(closestPath(["sakhnim"], world)).toEqual(["sakhnin"]);
  });
  it("corrects a kind and puts it under its own sector", () => {
    expect(closestPath(["sakhnin", "beauty", "barbershop"], world)).toEqual([
      "sakhnin",
      "beauty",
      "barbershops",
    ]);
    expect(closestPath(["sakhnin", "food", "barbershop"], world)).toEqual([
      "sakhnin",
      "beauty",
      "barbershops",
    ]);
    expect(closestPath(["k", "resturants"], world)).toEqual(["k", "restaurants"]);
    expect(closestPath(["sakhnin", "k", "barbrshops"], world)).toEqual([
      "sakhnin",
      "beauty",
      "barbershops",
    ]);
  });
  it("drops an unknown business back to its kind", () => {
    expect(closestPath(["sakhnin", "beauty", "barbershops", "nobody"], world)).toEqual([
      "sakhnin",
      "beauty",
      "barbershops",
    ]);
  });
  it("offers nothing when nothing is close or the path is already right", () => {
    expect(closestPath(["qqqqqqqqqq"], world)).toBeNull();
    expect(closestPath(["sakhnin", "beauty"], world)).toBeNull();
  });
});
