import { expect, it } from "vitest";
import { inIsrael, ISRAEL_BOX } from "./geo.js";

it("keeps points inside the Israel box, edges included", () => {
  expect(inIsrael({ lat: 32.858, lng: 35.181 })).toBe(true);
  expect(inIsrael({ lat: ISRAEL_BOX.lat[1], lng: ISRAEL_BOX.lng[0] })).toBe(true);
  expect(inIsrael({ lat: 33.7, lng: 35 })).toBe(false);
  expect(inIsrael({ lat: 32, lng: 36.1 })).toBe(false);
  expect(inIsrael({ lat: Number.NaN, lng: 35 })).toBe(false);
});
