import { describe, expect, it } from "vitest";
import { blockedNames, isBlocked } from "./blocked.js";
import { buildInstantIndex } from "./instant-index.js";

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

describe("blocked words inside place names", () => {
  const index = buildInstantIndex({
    places: [
      ["beer-sheva", "Be'er Sheva", "באר שבע", "بئر السبع"],
      ["beer-yaakov", "Beer Yaakov", "באר יעקב", "بئير يعكوف"],
      ["beer-tuvya", "Beer Tuvya", "באר טוביה", "بئير طوفيا"],
      ["beit-shemesh", "Bet Shemesh", "בית שמש", "بيت شيمش"],
      ["beit-dagan", "Bet Dagan", "בית דגן", "بيت دجان"],
      ["bet-jan", "Bet Jan", "בית ג'ן", "بيت جن"],
    ].map(([slug, en, he, ar]) => ({
      slug: slug!,
      type: "city" as const,
      status: "live" as const,
      parent: null,
      name: { he, ar, en },
      aliases: [],
    })),
    kinds: [],
  });
  const names = blockedNames([...index.places, ...index.kinds].flatMap((e) => e.t));

  it("never block a search for the place", () => {
    for (const q of [
      "Be'er Sheva",
      "Beer Yaakov",
      "Beer Tuvya",
      "Bet Shemesh",
      "Bet Dagan",
      "Bet Jan",
      "barber in beer sheva",
      "בבית שמש",
      "beer sh",
    ])
      expect(isBlocked(q, names), q).toBe(false);
  });
  it("still block the business, also next to a place", () => {
    for (const q of [
      "beer bar",
      "bar near me",
      "בירה",
      "beer",
      "bet",
      "beer in beer sheva",
      "bars in bet shemesh",
    ])
      expect(isBlocked(q, names), q).toBe(true);
  });
});

describe("arak", () => {
  it("blocks the drink, not licorice juice", () => {
    expect(isBlocked("عرق")).toBe(true);
    expect(isBlocked("عرق وبيرة")).toBe(true);
    expect(isBlocked("بار عرق")).toBe(true);
    expect(isBlocked("عرق سوس")).toBe(false);
    expect(isBlocked("عصير عرق سوس في الناصرة")).toBe(false);
  });
});
