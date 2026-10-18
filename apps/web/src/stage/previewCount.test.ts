import { expect, it } from "vitest";
import { previewCount } from "./StageFocus";

const numbers = new Intl.NumberFormat("he-IL");

it("says how many of the category the map shows when the preview is capped", () => {
  expect(previewCount(200, 448, "{shown} מתוך {count}", numbers)).toBe("200 מתוך 448");
});

it("gives the plain count when every business is on the map, or while pins load", () => {
  expect(previewCount(140, 140, "{shown} מתוך {count}", numbers)).toBe("140");
  expect(previewCount(null, 448, "{shown} מתוך {count}", numbers)).toBe("448");
});
