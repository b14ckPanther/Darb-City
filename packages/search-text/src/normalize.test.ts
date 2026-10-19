import { describe, expect, it } from "vitest";
import { arabicSkeleton, arabiziKey, arabiziKeys, normalize, phonetic } from "./normalize.js";

describe("normalize: Hebrew", () => {
  it("strips niqqud and cantillation", () => {
    expect(normalize("מִסְפָּרָה")).toBe("מספרה");
    expect(normalize("בְּרֵאשִׁ֖ית")).toBe("בראשית");
  });
  it("folds final letters", () => {
    expect(normalize("ךםןףץ")).toBe("כמנפצ");
    expect(normalize("סכנין")).toBe("סכנינ");
  });
  it("treats maqaf, paseq and sof pasuq as word separators", () => {
    expect(normalize("בית־שמש")).toBe(normalize("בית שמש"));
    expect(normalize("א׀ב׃ג")).toBe("א ב ג");
  });
  it("strips geresh and gershayim, Hebrew and ASCII", () => {
    expect(normalize("סח'נין")).toBe("סחנינ");
    expect(normalize("סח׳נין")).toBe("סחנינ");
    expect(normalize('צה"ל')).toBe("צהל");
    expect(normalize("צה״ל")).toBe("צהל");
  });
});

describe("normalize: Arabic", () => {
  it("strips tashkeel and tatweel", () => {
    expect(normalize("حَلَّاق")).toBe("حلاق");
    expect(normalize("حـــلاق")).toBe("حلاق");
  });
  it("folds alef forms, teh marbuta, alef maksura, hamza seats", () => {
    expect(normalize("أإآٱ")).toBe("اااا");
    expect(normalize("كنافة")).toBe("كنافه");
    expect(normalize("ملهى")).toBe("ملهي");
    expect(normalize("مؤسسة")).toBe("موسسه");
    expect(normalize("مسائي")).toBe("مسايي");
  });
});

describe("normalize: Latin and the rest", () => {
  it("lowercases and strips diacritics", () => {
    expect(normalize("Café CRÈME")).toBe("cafe creme");
    expect(normalize("Ma'alot-Tarshiha")).toBe("maalot tarshiha");
  });
  it("removes punctuation and collapses whitespace", () => {
    expect(normalize("  barber,   shop!! ")).toBe("barber shop");
    expect(normalize("knafeh_in?haifa")).toBe("knafeh in haifa");
  });
  it("keeps digits", () => {
    expect(normalize("7allaq 24/7")).toBe("7allaq 24 7");
  });
  it("is idempotent", () => {
    for (const s of ["סח'נין", "كنافة", "Café", "ملهى ليلي"])
      expect(normalize(normalize(s))).toBe(normalize(s));
  });
});

describe("Arabizi", () => {
  it("maps the digits and consonants to an Arabic skeleton", () => {
    expect(arabiziKey("7allaq")).toBe("حلق");
    expect(arabiziKey("5obz")).toBe("خبز");
    expect(arabiziKey("3asir")).toBe("عسر");
    expect(arabiziKey("ma9ha")).toBe("مقه");
    expect(arabiziKey("ma63am")).toBe("مطعم");
  });
  it("leaves tokens without an Arabizi digit alone", () => {
    expect(arabiziKey("hallaq")).toBeNull();
    expect(arabiziKey("24")).toBeNull();
    expect(arabiziKey("حلاق")).toBeNull();
  });
  it("meets the Arabic skeleton of the same word", () => {
    expect(arabicSkeleton(normalize("حلاق"))).toBe(arabiziKey("7allaq"));
    expect(arabicSkeleton(normalize("خبز"))).toBe(arabiziKey("5obz"));
    expect(arabicSkeleton(normalize("كعك"))).toBe(arabiziKey("ka3k"));
  });
});

describe("arabiziKeys and phonetic", () => {
  it("reads 2 as hamza or ق, and drops a glued preposition", () => {
    expect(arabiziKeys("7ala2")).toEqual(["حلء", "حلق"]);
    expect(arabiziKeys("b3akka")).toContain("عك");
    expect(arabiziKeys("haifa")).toEqual([]);
  });
  it("folds letters people confuse by ear", () => {
    expect(phonetic("burgr")).toBe(phonetic("burger"));
    expect(phonetic("shawerma")).toBe(phonetic("shawarma"));
    expect(phonetic(normalize("שוורמה"))).not.toBe(phonetic(normalize("ספר")));
    expect(phonetic(normalize("טיפולים"))).toBe(phonetic(normalize("תיפולים")));
    expect(phonetic(normalize("صالون"))).toBe(phonetic(normalize("سالون")));
    expect(phonetic(normalize("مطعم"))).not.toBe(phonetic(normalize("مطبخ")));
  });
});
