import { expect, it } from "vitest";
import { adminHref, adminRoute } from "./routes";

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
