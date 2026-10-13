import { expect, it } from "vitest";
import {
  changedOnly,
  kindFields,
  lines,
  localized,
  placeFields,
  sectorFields,
  zodErrors,
} from "./form-data";

const fd = (entries: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(entries)) f.append(k, v);
  return f;
};

it("reads localized text, dropping blank languages", () => {
  expect(
    localized(fd({ "name.he": " סח'נין ", "name.ar": "", "name.en": "Sakhnin" }), "name"),
  ).toEqual({ he: "סח'נין", en: "Sakhnin" });
});

it("reads lines and place fields", () => {
  expect(lines(fd({ a: "x\r\n\n y \n" }), "a")).toEqual(["x", "y"]);
  expect(
    placeFields(
      fd({
        "name.en": "Tamra",
        aliases: "Tamra\nTamrah",
        lat: "32.853",
        lng: "35.198",
        population: "",
        status: "live",
      }),
    ),
  ).toEqual({
    name: { en: "Tamra" },
    aliases: ["Tamra", "Tamrah"],
    lat: 32.853,
    lng: 35.198,
    population: null,
    status: "live",
  });
});

it("reads sector and kind fields", () => {
  expect(
    sectorFields(fd({ "name.en": "Food", "tagline.en": "Eat", accent: "#D9A54C", order: "3" })),
  ).toEqual({
    name: { en: "Food" },
    tagline: { en: "Eat" },
    accent: "#d9a54c",
    order: 3,
  });
  const k = kindFields(
    fd({
      sectorId: "s",
      parentKindId: "",
      "name.en": "Cafes",
      "synonyms.he": "קפה\nבית קפה",
      "synonyms.ar": "",
      "synonyms.en": "coffee",
      template: "menu",
      attributes: "delivers",
      icon: "",
      order: "2",
      status: "hidden",
    }),
  );
  expect(k).toMatchObject({
    parentKindId: null,
    icon: null,
    synonyms: { he: ["קפה", "בית קפה"], ar: [], en: ["coffee"] },
    attributes: ["delivers"],
  });
});

it("flattens zod issues", () => {
  expect(
    zodErrors({ issues: [{ path: ["name"], message: "At least one language must have text" }] }),
  ).toEqual(["name: At least one language must have text"]);
});

it("keeps only the fields that differ from the saved row, whatever the key order", () => {
  const current = {
    name: { en: "Tamra", he: "טמרה" },
    aliases: ["Tamrah"],
    lat: 32.853,
    population: null,
    editedAt: "2026-10-13T10:00:00.000Z",
  };
  expect(
    changedOnly(
      { name: { he: "טמרה", en: "Tamra" }, aliases: ["Tamrah"], lat: 32.9, population: null },
      current,
    ),
  ).toEqual({ lat: 32.9 });
  expect(changedOnly({ name: { en: "Tamra" }, aliases: [] }, current)).toEqual({
    name: { en: "Tamra" },
    aliases: [],
  });
  expect(changedOnly({ lat: 32.853 }, current)).toEqual({});
});
