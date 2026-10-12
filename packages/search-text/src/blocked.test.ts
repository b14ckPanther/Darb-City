import { describe, expect, it } from "vitest";
import { isBlocked } from "./blocked.js";

/** The seed gate's list (packages/seed/src/validate.test.ts), minus "strip" (decision 10). */
const SEED_GATE = [
  "bar",
  "pub",
  "wine",
  "beer",
  "liquor",
  "alcohol",
  "casino",
  "gambling",
  "lottery",
  "pork",
  "nightclub",
  "night club",
  "tattoo",
  "בר",
  "יין",
  "בירה",
  "אלכוהול",
  "קזינו",
  "הימורים",
  "חזיר",
  "מועדון לילה",
  "קעקוע",
  "خمر",
  "نبيذ",
  "بيرة",
  "كحول",
  "كازينو",
  "قمار",
  "خنزير",
  "ملهى ليلي",
  "وشم",
];

describe("blocked terms", () => {
  it("cover the seed gate", () => {
    for (const term of SEED_GATE) expect(isBlocked(term), term).toBe(true);
  });
  it("catch plurals, sentences and attached prefixes", () => {
    for (const q of [
      "bars in haifa",
      "best pubs",
      "Wine shop",
      "הבר",
      "לבר בחיפה",
      "ובירה",
      "والخمور",
      "بالكازينو",
      "pork",
      "strip club",
    ])
      expect(isBlocked(q), q).toBe(true);
  });
  it("leave look-alikes and allowed phrases alone", () => {
    for (const q of [
      "barbershop",
      "barber",
      "ברבר",
      "בריכה",
      "ברכה",
      "כבר פתוח",
      "bar mitzvah hall",
      "בר מצווה",
      "juice bar",
      "salad bar",
      "كازية",
      "LED strip",
      "Stripe",
      "baraka sweets",
      "بار",
    ])
      expect(isBlocked(q), q).toBe(q === "بار");
  });
});
