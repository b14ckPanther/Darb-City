import { describe, expect, it } from "vitest";
import { buildEdu, schoolName } from "./edu.mjs";

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
    row({ SEMEL_MOSAD: 105, TEUR_TAT_SUG_MISGERET: "מרכז חינוך", SHEM_MOSAD: "מרכז" }),
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
  it("never says which community a kindergarten serves", () => {
    expect(JSON.stringify(businesses)).not.toMatch(
      /ערבי|דרוזי|בדואי|عربي|درزي|بدوي|\bArab\b|Druze|Bedouin/,
    );
  });
});

describe("schools from the ministry's list", () => {
  const school = (over) =>
    row({
      TEUR_TAT_SUG_MISGERET: "בית ספר",
      TEUR_SHLAV_HINUH: "יסודי בלבד",
      TEUR_HERKEV_UCHLOSIYA: "מעורב",
      ...over,
    });
  const rows = [
    school({ SEMEL_MOSAD: 200, SHEM_MOSAD: "רימון" }),
    school({
      SEMEL_MOSAD: 201,
      SHEM_MOSAD: "מקיף אלחכמה",
      TEUR_SHLAV_HINUH: 'חט"ב + עליונה',
      TEUR_MIGZAR: "ערבי",
      X: 228700,
    }),
    school({
      SEMEL_MOSAD: 202,
      SHEM_MOSAD: 'ת"ת אור',
      TEUR_TAT_SUG_MISGERET: "תלמוד תורה",
      TEUR_HERKEV_UCHLOSIYA: "בנים",
      TEUR_PIKOH1: "חרדי",
      X: 229100,
    }),
    school({ SEMEL_MOSAD: 203, SHEM_MOSAD: 'בי"ס רפואי', TEUR_TAT_SUG_MISGERET: 'בי"ס רפואי' }),
  ];
  // The OSM school at 201's door gives its Arabic and English names.
  const osmSchools = [
    {
      lat: 0,
      lng: 0,
      tags: { amenity: "school", name: "מקיף אלחכמה", "name:ar": "مدرسة الحكمة الشاملة" },
    },
  ];
  const first = buildEdu({ rows: [rows[1]] }).businesses[0];
  osmSchools[0].lat = first.lat;
  osmSchools[0].lng = first.lng;
  const { businesses, counts } = buildEdu({ rows, osmSchools });
  const bySymbol = (n) => businesses.find((b) => b.attributes.eduSymbol === n);

  it("lists every school type but hospital classes, as the schools kind", () => {
    expect(counts).toMatchObject({ otherTypes: 1, emitted: 3, osmNames: 1 });
    expect(businesses.every((b) => b.primaryKind === "schools")).toBe(true);
  });
  it("names a bare name a school, writes short forms out, and takes OSM's Arabic name", () => {
    expect(bySymbol(200).name.he).toBe("בית ספר רימון");
    expect(bySymbol(200).name.en).toMatch(/School$/);
    expect(bySymbol(202).name.he).toBe("תלמוד תורה אור");
    expect(bySymbol(201).name).toMatchObject({ he: "מקיף אלחכמה", ar: "مدرسة الحكمة الشاملة" });
  });
  it("says the levels, type and pupils, but never the community", () => {
    expect(bySymbol(200).tagline.en).toBe("Primary school in Karmiel");
    expect(bySymbol(201).experience.items.map((i) => i.label.en)).toEqual([
      "Middle school",
      "High school",
      "Supervision",
      "Ministry symbol",
    ]);
    expect(bySymbol(202).experience.items.map((i) => i.label.en)).toEqual([
      "Primary",
      "Talmud Torah",
      "Boys",
      "Supervision",
      "Ministry symbol",
    ]);
    expect(JSON.stringify(businesses)).not.toMatch(/ערבי|عربي|Arab/);
  });
  it("drops the town at the end of a name", () => {
    const karmiel = { name: { he: "כרמיאל" } };
    expect(schoolName("רימון-כרמיאל", "בית ספר", karmiel)).toBe("בית ספר רימון");
    expect(schoolName("חטב יהונתן", "בית ספר", karmiel)).toBe("חטיבת ביניים יהונתן");
    expect(schoolName("ממד נועם כרמיאל", "בית ספר", karmiel)).toBe('בית ספר ממ"ד נועם');
  });
});
