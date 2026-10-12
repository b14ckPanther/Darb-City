import { describe, expect, it } from "vitest";
import { buildInstantIndex, type IndexKind, type IndexPlace } from "./instant-index.js";
import { matchInstant, prepare, tokenScore } from "./match.js";

const places: IndexPlace[] = [
  {
    slug: "sakhnin",
    type: "city",
    status: "live",
    parent: null,
    name: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" },
    aliases: ["Sachnin"],
  },
  {
    slug: "kiryat-yam",
    type: "city",
    status: "live",
    parent: null,
    name: { he: "קרית ים", ar: "كريات يام", en: "Kiryat Yam" },
    aliases: ["QIRYAT YAM"],
  },
  {
    slug: "haifa",
    type: "city",
    status: "live",
    parent: null,
    name: { he: "חיפה", ar: "حيفا", en: "Haifa" },
    aliases: [],
  },
];
const kinds: IndexKind[] = [
  {
    slug: "barbershops",
    sector: "beauty",
    parent: null,
    status: "active",
    name: { he: "מספרות", ar: "صالونات حلاقة", en: "Barbershops" },
    synonyms: { he: ["ספר", "מספרה"], ar: ["حلاق"], en: ["barber", "barber shop"] },
  },
  {
    slug: "sweets",
    sector: "food",
    parent: null,
    status: "active",
    name: { he: "כנאפה ומתוקים", ar: "حلويات", en: "Knafeh and Arabic sweets" },
    synonyms: { he: ["כנאפה"], ar: ["كنافة"], en: ["knafeh", "kunafa"] },
  },
];
const prepared = prepare(buildInstantIndex({ places, kinds }));
const top = (q: string) => {
  const r = matchInstant(prepared, q);
  return { kind: r.kinds[0]?.entry.s ?? null, place: r.places[0]?.entry.s ?? null, r };
};

describe("tokenScore", () => {
  it("ranks exact over prefix over typo", () => {
    expect(tokenScore("barber", "barber")).toBe(1);
    expect(tokenScore("barb", "barber")).toBeGreaterThan(0.6);
    expect(tokenScore("barbr", "barber")).toBe(0.7);
    expect(tokenScore("b", "barber")).toBe(0);
    expect(tokenScore("cat", "dog")).toBe(0);
  });
});

describe("matchInstant", () => {
  it("finds kind and place in each script", () => {
    expect(top("barber in haifa")).toMatchObject({ kind: "barbershops", place: "haifa" });
    expect(top("מספרה בחיפה")).toMatchObject({ kind: "barbershops", place: "haifa" });
    expect(top("حلاق في حيفا")).toMatchObject({ kind: "barbershops", place: "haifa" });
  });
  it("survives typos, spellings and attached prefixes", () => {
    expect(top("barbr sakhnin")).toMatchObject({ kind: "barbershops", place: "sakhnin" });
    expect(top("ספר בסחנין").place).toBe("sakhnin");
    expect(top("סכנין").place).toBe("sakhnin");
    expect(top("بسخنين").place).toBe("sakhnin");
    expect(top("קריית ים").place).toBe("kiryat-yam");
    expect(top("kunafa").kind).toBe("sweets");
  });
  it("reads Arabizi", () => {
    expect(top("7allaq").kind).toBe("barbershops");
  });
  it("matches while typing (prefix of the last word)", () => {
    expect(top("hai").place).toBe("haifa");
    expect(top("knaf").kind).toBe("sweets");
  });
  it("records cues, blocked and leftovers", () => {
    const { r } = top("knafeh near me open now with pistachio");
    expect(r.cues).toEqual({ openNow: true, delivers: false, nearMe: true });
    expect(r.unmatched).toEqual(["pistachio"]);
    expect(r.sentence).toBe(true);
    expect(matchInstant(prepared, "bars in haifa").blocked).toBe(true);
  });
  it("gives nothing for nothing", () => {
    const r = matchInstant(prepared, "   ");
    expect(r.kinds).toEqual([]);
    expect(r.places).toEqual([]);
  });
  it("matches a 1,100-place index in under 50 ms", () => {
    const many: IndexPlace[] = Array.from({ length: 1100 }, (_, i) => ({
      slug: `p${i}`,
      type: "village",
      status: "live",
      parent: null,
      name: { he: `כפר ${i}`, ar: `قرية ${i}`, en: `Village ${i}` },
      aliases: [],
    }));
    const big = prepare(buildInstantIndex({ places: [...places, ...many], kinds }));
    const start = Date.now();
    for (let i = 0; i < 10; i++) matchInstant(big, "barbr in sakhnin");
    expect((Date.now() - start) / 10).toBeLessThan(50);
  });
});
