import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import { dir, messages } from "./index.js";

it("has the same non-empty keys in every locale", () => {
  const keys = Object.keys(messages.en).sort();
  for (const locale of LOCALES) {
    expect(Object.keys(messages[locale]).sort()).toEqual(keys);
    for (const key of keys)
      expect(messages[locale][key as keyof typeof messages.en].trim()).not.toBe("");
  }
});

it("reads Hebrew and Arabic right to left", () => {
  expect(dir("he")).toBe("rtl");
  expect(dir("ar")).toBe("rtl");
  expect(dir("en")).toBe("ltr");
});
