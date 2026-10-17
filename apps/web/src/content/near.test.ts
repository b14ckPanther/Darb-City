import { LOCALES } from "@darb/core";
import { expect, it } from "vitest";
import { near } from "./near";

it("says every line of /near in every locale, the place in the title", () => {
  for (const locale of LOCALES) {
    for (const [key, text] of Object.entries(near[locale]))
      expect(text.trim(), `${locale}.${key}`).not.toBe("");
    expect(near[locale].titleAt).toContain("{place}");
    expect(near[locale].titleAt.startsWith(near[locale].title)).toBe(true);
  }
});

it("keeps to plain words: no dashes, no maqaf, no Modern Standard Arabic 'now'", () => {
  for (const locale of LOCALES)
    for (const text of Object.values(near[locale])) expect(text).not.toMatch(/[–—־]/);
  const arabic = Object.values(near.ar).join(" ");
  for (const word of ["هلأ", "هلقيت", "حلال"]) expect(arabic).not.toContain(word);
  expect(Object.values(near.en).join(" ").toLowerCase()).not.toContain("halal");
});
