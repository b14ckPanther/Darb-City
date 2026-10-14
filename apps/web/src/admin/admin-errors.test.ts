import { expect, it } from "vitest";
import { apiError } from "./admin-errors";

it("turns the API's stable codes into the admin's language", () => {
  expect(
    apiError("en", { status: 409, body: { message: "x", code: "kind_has_sub_kinds" } }),
  ).toEqual({
    ok: false,
    message:
      "This kind has sub-kinds, so it cannot move to another sector. Move its sub-kinds first.",
    errors: [],
  });
  expect(
    apiError("ar", { status: 400, body: { message: "x", code: "example_tier_fixed" } }).message,
  ).toBe("أمثلة العرض والمصالح الحقيقية تبقى منفصلة: لا يمكن تغيير فئة المثال.");
  expect(
    apiError("he", { status: 400, body: { message: "x", code: "kind_tree_too_deep" } }).message,
  ).toMatch(/עמוקים מדי/);
  expect(
    apiError("en", { status: 409, body: { message: "Unique", code: "already_exists" } }).message,
  ).toMatch(/already taken/);
});

it("names a taken address on create, and keeps the API's reasons otherwise", () => {
  expect(
    apiError(
      "en",
      { status: 409, body: { message: 'The address "x" is already used' } },
      { conflict: "errAlreadyExists" },
    ).message,
  ).toMatch(/already taken/);
  expect(
    apiError("en", {
      status: 400,
      body: { message: "The experience content does not fit", errors: ["/items: required"] },
    }),
  ).toEqual({
    ok: false,
    message: "The experience content does not fit",
    errors: ["/items: required"],
  });
  expect(apiError("en", { status: 500, body: "boom" })).toEqual({
    ok: false,
    message: "Something went wrong. Nothing was saved.",
    errors: [],
  });
});
