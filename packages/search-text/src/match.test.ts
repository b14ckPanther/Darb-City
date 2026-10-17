import { describe, expect, it } from "vitest";
import { buildInstantIndex, type IndexKind, type IndexPlace } from "./instant-index.js";
import { matchInstant, prepare, STRONG, tokenScore } from "./match.js";

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
  it("returns the content words, normalized and as typed, without cues or stopwords", () => {
    const r = matchInstant(prepared, "שווארמה ללא גלוטן בחיפה!");
    expect(r.cues.glutenFree).toBe(true);
    expect(r.content).toEqual(["שווארמה", "בחיפה"]);
    expect(r.typed).toEqual(["שווארמה", "בחיפה"]);
    const en = matchInstant(prepared, "Car Wash, in Haifa");
    expect(en.content).toEqual(["car", "wash", "haifa"]);
    expect(en.typed).toEqual(["Car", "Wash", "Haifa"]);
  });
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
  it("matches a maqaf-joined name to its spaced spelling", () => {
    const withMaqaf = prepare(
      buildInstantIndex({
        places: [
          {
            slug: "beit-shemesh",
            type: "city",
            status: "live",
            parent: null,
            name: { he: "בית־שמש", en: "Beit Shemesh" },
            aliases: ["Bet Shemesh"],
          },
        ],
        kinds: [],
      }),
    );
    const r = matchInstant(withMaqaf, "בית שמש");
    expect(r.places[0]?.entry.s).toBe("beit-shemesh");
    expect(r.places[0]?.score).toBeGreaterThanOrEqual(1);
    expect(matchInstant(withMaqaf, "bet shemesh").blocked).toBe(false);
    expect(matchInstant(withMaqaf, "beer in bet shemesh").blocked).toBe(true);
  });
  it("reads Arabizi", () => {
    expect(top("7allaq").kind).toBe("barbershops");
  });
  it("reads 7 for خ in Arabizi (the dot of 7' is dropped with the apostrophe)", () => {
    expect(top("7allaq sa7nin")).toMatchObject({ kind: "barbershops", place: "sakhnin" });
    expect(top("sa7'nin").place).toBe("sakhnin");
  });
  it("reads Arabizi vowels as vowels, whether or not the Arabic spells them with ي or و", () => {
    // "7aifa" is حيفا: the i is the ي that a vowel-free skeleton would otherwise demand.
    const withAchva = prepare(
      buildInstantIndex({
        places: [
          ...places,
          {
            // أحفا: its vowel-free skeleton, حف, is exactly what "7aifa" spells without the i.
            slug: "achva",
            type: "village",
            status: "soon",
            parent: null,
            name: { he: "אחווה", ar: "أحفا", en: "Achva" },
            aliases: ["AHAWA"],
          },
        ],
        kinds,
      }),
    );
    const r = matchInstant(withAchva, "ma63am 7aifa");
    expect(r.places[0]?.entry.s).toBe("haifa");
    expect(r.places[0]?.score).toBeGreaterThanOrEqual(STRONG);
  });
  it("forgives a Hebrew word written without its yod or vav", () => {
    expect(top("מספרה בחפה")).toMatchObject({ kind: "barbershops", place: "haifa" });
    expect(top("חפה").r.places[0]?.score).toBeGreaterThanOrEqual(0.7);
    expect(tokenScore("חפה", "חיפה")).toBe(0.7);
    expect(tokenScore("ספר", "סיפור")).toBe(0); // two letters short is another word
  });
  it("never lets a weak place hide a strong kind on the same word", () => {
    const withLookalike = prepare(
      buildInstantIndex({
        places: [
          ...places,
          {
            // "كنافه" without "ك" (read as the prefix "like") is one letter from "يافه".
            slug: "ifat",
            type: "village",
            status: "live",
            parent: null,
            name: { he: "יפעת", ar: "يافة", en: "Ifat" },
            aliases: [],
          },
        ],
        kinds,
      }),
    );
    const alone = matchInstant(withLookalike, "كنافه");
    expect(alone.places[0]?.entry.s).toBe("ifat");
    expect(alone.places[0]?.score).toBeLessThan(STRONG);
    expect(alone.kinds[0]?.entry.s).toBe("sweets");
    expect(alone.unmatched).toEqual([]);
    expect(matchInstant(withLookalike, "كنافه في حيفا").unmatched).toEqual([]);
  });
  it("matches while typing (prefix of the last word)", () => {
    expect(top("hai").place).toBe("haifa");
    expect(top("knaf").kind).toBe("sweets");
  });
  it("records cues, blocked and leftovers", () => {
    const { r } = top("knafeh near me open now with pistachio");
    expect(r.cues).toEqual({ openNow: true, delivers: false, nearMe: true, glutenFree: false });
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

describe("gluten-free queries (Task 27b)", () => {
  it.each(["ללא גלוטן בעכו", "مطعم خالٍ من الغلوتين", "gluten-free restaurant", "celiac"])(
    "%s is a dietary filter in lane 1, not leftover text",
    (q) => {
      const r = matchInstant(prepared, q);
      expect(r.cues.glutenFree).toBe(true);
      expect(r.unmatched.join(" ")).not.toMatch(/gluten|גלוטנ|غلوتين|celiac/);
    },
  );
});
