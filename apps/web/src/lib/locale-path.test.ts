import { describe, expect, it } from "vitest";
import { routeLocale } from "./locale-path";

describe("routeLocale", () => {
  it("rewrites unprefixed paths to Hebrew", () => {
    expect(routeLocale("/")).toEqual({ action: "rewrite", pathname: "/he" });
    expect(routeLocale("/haifa/beauty")).toEqual({
      action: "rewrite",
      pathname: "/he/haifa/beauty",
    });
  });
  it("passes Arabic and English through", () => {
    expect(routeLocale("/ar")).toEqual({ action: "next" });
    expect(routeLocale("/en/haifa")).toEqual({ action: "next" });
  });
  it("redirects explicit Hebrew to the unprefixed URL", () => {
    expect(routeLocale("/he")).toEqual({ action: "redirect", pathname: "/" });
    expect(routeLocale("/he/haifa")).toEqual({ action: "redirect", pathname: "/haifa" });
  });
  it("does not mistake a slug that starts like a locale", () => {
    expect(routeLocale("/hebron")).toEqual({ action: "rewrite", pathname: "/he/hebron" });
    expect(routeLocale("/arraba")).toEqual({ action: "rewrite", pathname: "/he/arraba" });
  });
});
