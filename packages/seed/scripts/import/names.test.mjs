import { describe, expect, it } from "vitest";
import { arabicWord, createNamer, latinWord, plainDashes } from "./names.mjs";
import { createPlaceMatcher } from "./places.mjs";

const { name } = createNamer();
const { bySlug } = createPlaceMatcher();

describe("names", () => {
  it("use a place's own names", () => {
    expect(name("צפת")).toMatchObject({ ar: "صفد", en: "Safed" });
    expect(name("קריית שמונה")).toMatchObject({ ar: "كريات شمونة", en: "Kiryat Shmona" });
    expect(name("ק. ביאליק")).toMatchObject({ en: "Kiryat Bialik" });
  });
  it("prefer the record's own place when two places share a name", () => {
    expect(name("תמרה", bySlug.get("tamra"))).toMatchObject({ ar: "طمرة", en: "Tamra" });
  });
  it("translate known words around place names, in each language's order", () => {
    expect(name("עכו צפון")).toMatchObject({ ar: "عكا الشمالية", en: "Akko North" });
    expect(name("טבריה עילית")).toMatchObject({ ar: "طبريا العليا", en: "Upper Tiberias" });
    expect(name("צומת הנשרים").en).toMatch(/ Junction$/);
    expect(name("צומת הנשרים").ar).toMatch(/^مفرق /);
    expect(name("מבואות נצרת")).toMatchObject({ ar: "مداخل الناصرة", en: "Nazareth Gateway" });
    expect(name("חיפה מרכז")).toMatchObject({ ar: "حيفا مركز", en: "Haifa Centre" });
  });
  it("transliterate the rest, letter by letter", () => {
    expect(latinWord("אורלי")).toBe("Orli");
    expect(latinWord("כרכור")).toMatch(/^K/);
    expect(arabicWord("סטלה")).toBe("سطلا");
    expect(arabicWord("ג'מאל")).toBe("جمال");
  });
  it("never write a long dash or a maqaf", () => {
    expect(plainDashes("אפק – חדשה")).toBe("אפק - חדשה");
    expect(plainDashes("בנימינה־גבעת עדה")).toBe("בנימינה-גבעת עדה");
    const n = name("אפק — חדשה");
    for (const v of Object.values(n)) expect(v).not.toMatch(/[־–—]/);
  });
});
