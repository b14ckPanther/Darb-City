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
      ["bet-jan", "Bet Jan", "בית ג'ן", "بيت جن", "BEIT JANN"],
      ["bar-giyyora", "Bar Giyyora", "בר גיורא", "بار جيورا", "BAR GIYYORA"],
    ].map(([slug, en, he, ar, alias]) => ({
      slug: slug!,
      type: "city" as const,
      status: "live" as const,
      parent: null,
      name: { he, ar, en },
      aliases: alias ? [alias] : [],
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
      "Bar Giyyora",
      "בר גיורא",
      "بار جيورا",
      "bar giora",
      "bet jann",
      "Beit Jann",
      "barber in bar giora",
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
      "bar in bar giora",
      "bar near me",
      "bar jazz",
    ])
      expect(isBlocked(q, names), q).toBe(true);
  });
});

describe("kibar", () => {
  it("allows كبار (elders, big) on its own and keeps بار blocked", () => {
    expect(isBlocked("كبار")).toBe(false);
    expect(isBlocked("كبار السن")).toBe(false);
    expect(isBlocked("بار")).toBe(true);
    expect(isBlocked("بار عرق")).toBe(true);
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
  it("blocks عرق alone or beside a drink word, and nowhere else (owner's ruling)", () => {
    for (const q of [
      "عرق",
      "العرق",
      "عرق زحلاوي",
      "عرق بلدي",
      "كاس عرق",
      "كأس عرق",
      "مشروب عرق",
      "بار عرق",
      "وين في عرق",
    ])
      expect(isBlocked(q), q).toBe(true);
    for (const q of [
      "عرق النسا",
      "علاج عرق النسا",
      "علاج عرق النسا في حيفا",
      "عرق سوس",
      "عصير عرق سوس",
    ])
      expect(isBlocked(q), q).toBe(false);
  });
});

describe("bar look-alikes", () => {
  it("allow Bar-Ilan, the university, in every spelling", () => {
    for (const q of [
      "בר אילן",
      "אוניברסיטת בר אילן",
      "בר-אילן",
      "bar ilan",
      "Bar-Ilan",
      "bar ilan university",
      "بار ايلان",
      "جامعة بار إيلان",
    ])
      expect(isBlocked(q), q).toBe(false);
  });
  it("allow a mini bar fridge, the appliance", () => {
    for (const q of ["mini bar fridge", "minibar fridge", "minibar", "מקרר מיני בר"])
      expect(isBlocked(q), q).toBe(false);
  });
  it("still block bars", () => {
    for (const q of ["sports bar", "bar ilan bar", "wine bar", "mini bar", "cocktail bar"])
      expect(isBlocked(q), q).toBe(true);
  });
});
