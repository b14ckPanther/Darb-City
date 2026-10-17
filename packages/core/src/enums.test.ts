import { expect, it } from "vitest";
import { DIETARY, PLACE_STATUSES, PLACE_TYPES, TEMPLATES, TIERS } from "./enums.js";

it("lists the experience templates: the spec's eleven and the fuel station's own", () => {
  expect(TEMPLATES).toEqual([
    "menu",
    "booking",
    "shop",
    "portfolio",
    "listing",
    "schedule",
    "quote",
    "donate",
    "tracker",
    "pass",
    "builder",
    "station",
  ]);
});

it("lists place types, statuses and tiers", () => {
  expect(PLACE_TYPES).toEqual(["country", "region", "city", "town", "village", "neighbourhood"]);
  expect(PLACE_STATUSES).toEqual(["live", "soon"]);
  expect(TIERS).toEqual(["example", "basic", "verified", "darb"]);
});

it("lists dietary attributes, starting with a fully gluten-free kitchen", () => {
  expect(DIETARY).toEqual(["gluten_free"]);
});
