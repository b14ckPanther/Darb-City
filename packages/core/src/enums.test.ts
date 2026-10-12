import { expect, it } from "vitest";
import { PLACE_STATUSES, PLACE_TYPES, TEMPLATES, TIERS } from "./enums.js";

it("lists the eleven experience templates from the spec", () => {
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
  ]);
});

it("lists place types, statuses and tiers", () => {
  expect(PLACE_TYPES).toEqual(["country", "region", "city", "town", "village", "neighbourhood"]);
  expect(PLACE_STATUSES).toEqual(["live", "soon"]);
  expect(TIERS).toEqual(["example", "basic", "verified", "darb"]);
});
