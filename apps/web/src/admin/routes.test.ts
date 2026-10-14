import { expect, it } from "vitest";
import { adminHref, adminRoute, takedownHref } from "./routes";

it("maps public admin URLs to their locale and rest", () => {
  expect(adminRoute("/admin")).toEqual({ locale: "he", rest: "" });
  expect(adminRoute("/admin/places/123")).toEqual({ locale: "he", rest: "/places/123" });
  expect(adminRoute("/ar/admin/kinds")).toEqual({ locale: "ar", rest: "/kinds" });
  expect(adminRoute("/en/admin")).toEqual({ locale: "en", rest: "" });
  expect(adminRoute("/administration")).toBeNull();
  expect(adminRoute("/sakhnin/admin")).toBeNull();
  expect(adminRoute("/he/admin")).toBeNull(); // the locale proxy redirects /he/… to /…
});

it("builds public admin URLs", () => {
  expect(adminHref("he")).toBe("/admin");
  expect(adminHref("ar", "/places")).toBe("/ar/admin/places");
});

it("builds where a takedown's outcome shows, with or without the stale flag", () => {
  expect(takedownHref("he", "business", "b1", "page", true)).toBe("/admin/businesses/b1?stale=1");
  expect(takedownHref("ar", "kind", "k1", "page", false)).toBe("/ar/admin/kinds/k1");
  expect(takedownHref("en", "place", "p1", "page", true)).toBe("/en/admin/places/p1?stale=1");
  expect(takedownHref("en", "business", "b1", "list", true)).toBe("/en/admin/businesses?stale=b1");
  expect(takedownHref("en", "business", "b1", "list", false)).toBe("/en/admin/businesses");
  expect(takedownHref("he", "business", "a/../b", "page", true)).toBe(
    "/admin/businesses/a%2F..%2Fb?stale=1",
  );
});
