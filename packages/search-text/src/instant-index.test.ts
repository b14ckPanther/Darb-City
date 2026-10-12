import { expect, it } from "vitest";
import { buildInstantIndex, type IndexKind, type IndexPlace } from "./instant-index.js";

const places: IndexPlace[] = [
  {
    slug: "israel",
    type: "country",
    status: "live",
    parent: null,
    name: { en: "Israel" },
    aliases: [],
  },
  {
    slug: "sakhnin",
    type: "city",
    status: "live",
    parent: "northern-district",
    name: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" },
    aliases: ["SAKHNIN", "Sachnin"],
  },
  { slug: "eilat", type: "city", status: "soon", parent: null, name: { en: "Eilat" }, aliases: [] },
];
const kinds: IndexKind[] = [
  {
    slug: "barbershops",
    sector: "beauty",
    parent: null,
    status: "active",
    name: { he: "מספרות", ar: "صالونات حلاقة", en: "Barbershops" },
    synonyms: { he: ["ספר"], ar: ["حلاق"], en: ["barber", "Barber"] },
  },
  {
    slug: "hidden",
    sector: "beauty",
    parent: null,
    status: "hidden",
    name: { en: "Hidden" },
    synonyms: { he: [], ar: [], en: [] },
  },
];

it("indexes places and active kinds with normalized, deduplicated terms", () => {
  const index = buildInstantIndex({ places, kinds });
  expect(index.v).toBe(1);
  expect(index.kinds.map((k) => k.s)).toEqual(["barbershops"]);
  const barber = index.kinds[0]!;
  expect(barber.n).toEqual(["מספרות", "صالونات حلاقة", "Barbershops"]);
  expect(barber.t).toEqual(["מספרות", "صالونات حلاقه", "barbershops", "ספר", "حلاق", "barber"]);
  expect(barber.k).toEqual(["صلونت حلقه", "حلق"]);
  expect(barber.p).toBe("beauty");
});

it("weights live settlements above soon ones and the country", () => {
  const index = buildInstantIndex({ places, kinds });
  const w = Object.fromEntries(index.places.map((p) => [p.s, p.w]));
  expect(w).toEqual({ israel: 1, sakhnin: 3, eilat: 1 });
  expect(index.places.find((p) => p.s === "sakhnin")?.t).toEqual([
    "סחנינ",
    "سخنين",
    "sakhnin",
    "sachnin",
  ]);
});
it("adds unique short forms of compound place names, never shared prefixes", () => {
  const index = buildInstantIndex({
    places: [
      {
        slug: "maalot-tarshiha",
        type: "city",
        status: "live",
        parent: null,
        name: { he: "מעלות-תרשיחא", ar: "معالوت ترشيحا", en: "Ma'alot-Tarshiha" },
        aliases: [],
      },
      {
        slug: "kiryat-yam",
        type: "city",
        status: "live",
        parent: null,
        name: { he: "קרית ים", en: "Kiryat Yam" },
        aliases: [],
      },
      {
        slug: "kiryat-haim",
        type: "neighbourhood",
        status: "live",
        parent: null,
        name: { he: "קריית חיים", en: "Kiryat Haim" },
        aliases: [],
      },
    ],
    kinds: [],
  });
  const terms = Object.fromEntries(index.places.map((p) => [p.s, p.t]));
  expect(terms["maalot-tarshiha"]).toEqual(
    expect.arrayContaining(["maalot", "tarshiha", "מעלות", "תרשיחא", "معالوت"]),
  );
  expect(terms["kiryat-haim"]).not.toContain("קריית");
  expect(terms["kiryat-yam"]).not.toContain("kiryat");
});
