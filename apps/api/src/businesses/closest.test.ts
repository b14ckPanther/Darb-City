import { describe, expect, it } from "vitest";
import { closestInSubtree } from "./businesses.repository.js";

const at = (id: string, path: string) => ({ id, place: { path } });

describe("closestInSubtree", () => {
  const listed = "/israel/haifa/";
  it("prefers the business in the listed place itself", () => {
    const rows = [at("child", "/israel/haifa/kiryat-haim/"), at("own", "/israel/haifa/")];
    expect(closestInSubtree(rows, listed)?.id).toBe("own");
  });
  it("then the nearest by path depth", () => {
    const rows = [
      at("deep", "/israel/haifa/kiryat-haim/street/"),
      at("near", "/israel/haifa/kiryat-haim/"),
    ];
    expect(closestInSubtree(rows, listed)?.id).toBe("near");
  });
  it("breaks a depth tie by place path, whatever the input order", () => {
    const a = at("a", "/israel/haifa/bat-galim/");
    const b = at("b", "/israel/haifa/kiryat-haim/");
    expect(closestInSubtree([a, b], listed)?.id).toBe("a");
    expect(closestInSubtree([b, a], listed)?.id).toBe("a");
  });
  it("is null when nothing matches", () => {
    expect(closestInSubtree([], listed)).toBeNull();
  });
});
