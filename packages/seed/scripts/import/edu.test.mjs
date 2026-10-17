import { describe, expect, it } from "vitest";
import { buildEdu } from "./edu.mjs";

const row = (over) => ({
  SEMEL_MOSAD: 100,
  SHEM_MOSAD: "גן רימון",
  ISV_SHEM_ISHUV: "כרמיאל",
  TEUR_TAT_SUG_MISGERET: "גן ילדים",
  TEUR_MIGZAR: "יהודי",
  TEUR_PIKOH1: "ממלכתי",
  TEUR_SUG_CHINUCH: "רגיל",
  RAMAT_DIYUK_MIKUM: "גבוהה מאוד",
  // Karmiel on the Israeli grid.
  X: 228300,
  Y: 758600,
  ...over,
});

describe("education ministry importer over a fixture", () => {
  const rows = [
    row({}),
    row({ SEMEL_MOSAD: 101, SHEM_MOSAD: "שקד", TEUR_SUG_CHINUCH: "מיוחד", X: 228500 }),
    row({ SEMEL_MOSAD: 102, SHEM_MOSAD: "אבירים", TEUR_TAT_SUG_MISGERET: "מעון יום", X: 228900 }),
    row({ SEMEL_MOSAD: 103, SHEM_MOSAD: "המשפחתון של לאה", TEUR_TAT_SUG_MISGERET: "מעון יום" }),
    row({ SEMEL_MOSAD: 104, RAMAT_DIYUK_MIKUM: "נמוכה" }),
    row({ SEMEL_MOSAD: 105, TEUR_TAT_SUG_MISGERET: "בית ספר", SHEM_MOSAD: "אורט" }),
    row({ SEMEL_MOSAD: 106, ISV_SHEM_ISHUV: "תל אביב - יפו", X: 180725, Y: 661643 }),
  ];
  const { businesses, counts } = buildEdu({ rows });

  it("keeps kindergartens and daycare centres placed by address in the north", () => {
    expect(counts).toMatchObject({
      fetched: 7,
      otherTypes: 1,
      familyDaycare: 1,
      imprecise: 1,
      outsideNorth: 1,
      emitted: 3,
    });
    expect(businesses.every((b) => b.place === "karmiel")).toBe(true);
    expect(businesses.map((b) => b.primaryKind).sort()).toEqual([
      "daycare",
      "kindergartens",
      "kindergartens",
    ]);
  });
  it("names a bare name for what it is and says the ministry's facts", () => {
    const names = businesses.map((b) => b.name.he).sort();
    expect(names).toEqual(["גן רימון", "גן שקד", "מעון אבירים"]);
    const shaked = businesses.find((b) => b.name.he === "גן שקד");
    expect(shaked.attributes.eduSymbol).toBe(101);
    expect(shaked.name.en).toMatch(/Kindergarten$/);
    expect(shaked.experience.items.map((i) => i.label.en)).toEqual([
      "Kindergarten",
      "Ministry symbol",
      "Supervision",
      "Special education",
    ]);
  });
});
