import { expect, it } from "vitest";
import { helperHref, helperManifestHref, helperRoute } from "./routes";

it("maps public helper URLs to their locale and rest", () => {
  expect(helperRoute("/helpers")).toEqual({ locale: "he", rest: "" });
  expect(helperRoute("/helpers/mine")).toEqual({ locale: "he", rest: "/mine" });
  expect(helperRoute("/ar/helpers/profile")).toEqual({ locale: "ar", rest: "/profile" });
  expect(helperRoute("/en/helpers")).toEqual({ locale: "en", rest: "" });
  expect(helperRoute("/helpersx")).toBeNull();
  expect(helperRoute("/sakhnin/helpers")).toBeNull();
  expect(helperRoute("/he/helpers")).toBeNull();
});

it("builds the app's URLs and its manifest's", () => {
  expect(helperHref("he")).toBe("/helpers");
  expect(helperHref("ar", "/mine")).toBe("/ar/helpers/mine");
  expect(helperManifestHref("en")).toBe("/api/helpers/manifest/en");
});
