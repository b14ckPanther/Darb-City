import { expect, it } from "vitest";
import { one, withParams } from "./params";

it("reads one value and builds query strings without empties", () => {
  expect(one(["a", "b"])).toBe("a");
  expect(one("")).toBeUndefined();
  expect(withParams("/ar/admin/places", { q: "سخ", status: "", cursor: "x" })).toBe(
    `/ar/admin/places?q=${encodeURIComponent("سخ")}&cursor=x`,
  );
  expect(withParams("/admin", {})).toBe("/admin");
});
