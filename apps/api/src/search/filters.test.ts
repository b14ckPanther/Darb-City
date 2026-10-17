import { buildInstantIndex, matchInstant, prepare } from "@darb/search-text";
import { describe, expect, it } from "vitest";
import {
  explainedByInstant,
  intentCandidates,
  intentFromInstant,
  searchedWords,
  validateIntent,
} from "./filters.js";

const prepared = prepare(
  buildInstantIndex({
    places: [
      {
        slug: "haifa",
        type: "city",
        status: "live",
        parent: null,
        name: { he: "חיפה", ar: "حيفا", en: "Haifa" },
        aliases: [],
      },
    ],
    kinds: [
      {
        slug: "sweets",
        sector: "food",
        parent: null,
        status: "active",
        name: { en: "Knafeh and Arabic sweets" },
        synonyms: { he: [], ar: ["كنافة"], en: ["knafeh"] },
      },
      {
        slug: "barbershops",
        sector: "beauty",
        parent: null,
        status: "active",
        name: { en: "Barbershops" },
        synonyms: { he: [], ar: [], en: ["barber"] },
      },
      {
        slug: "daycare",
        sector: "kids",
        parent: null,
        status: "active",
        name: { en: "Daycare" },
        synonyms: { he: [], ar: ["روضة"], en: [] },
      },
      {
        slug: "kindergartens",
        sector: "kids",
        parent: null,
        status: "active",
        name: { en: "Kindergartens" },
        synonyms: { he: [], ar: ["روضة"], en: [] },
      },
    ],
  }),
);
const m = (q: string) => matchInstant(prepared, q);

describe("intent from lane 1", () => {
  it("takes the strong kind, place and cues, and leaves the rest as free text", () => {
    expect(intentFromInstant(m("knafeh in haifa open now with pistachio"))).toEqual({
      kinds: ["sweets"],
      place: "haifa",
      nearMe: false,
      openNow: true,
      attributes: { delivers: false },
      dietary: [],
      freeText: "pistachio",
      items: [],
      mustHave: ["openNow"],
      niceToHave: [],
    });
  });
  it("searches inside the cards for the words that named the kind, as typed, or every word but the place", () => {
    expect(searchedWords(m("Knafeh, in Haifa!"))).toEqual({ words: ["Knafeh"], kind: "sweets" });
    expect(searchedWords(m("knafeh in haifa open now with pistachio")).words).toEqual(["knafeh"]);
    expect(searchedWords(m("keratin treatment haifa"))).toEqual({
      words: ["keratin treatment"],
      kind: null,
    });
    expect(searchedWords(m("haifa")).words).toEqual([]);
    expect(searchedWords(m("gluten free")).words).toEqual([]);
    // Lane 1 never puts them in the intent: the kind chip already says them.
    expect(intentFromInstant(m("gluten free knafeh"))).toMatchObject({
      items: [],
      mustHave: ["gluten_free"],
    });
  });
  it("turns gluten-free words into the dietary filter, explained without the model (Task 27b)", () => {
    expect(intentFromInstant(m("gluten free knafeh in haifa"))).toMatchObject({
      kinds: ["sweets"],
      place: "haifa",
      dietary: ["gluten_free"],
      freeText: "",
    });
    expect(explainedByInstant(m("ללא גלוטן"))).toBe(true);
    expect(explainedByInstant(m("خالٍ من الغلوتين في حيفا"))).toBe(true);
    expect(explainedByInstant(m("celiac somewhere to fix my bike chain"))).toBe(false);
  });
  it("keeps every kind tied on the same word", () => {
    expect(intentFromInstant(m("روضة في حيفا")).kinds).toEqual(["daycare", "kindergartens"]);
  });
  it("knows when lane 1 explains the whole query", () => {
    expect(explainedByInstant(m("barber in haifa"))).toBe(true);
    expect(explainedByInstant(m("knafeh near me"))).toBe(true);
    expect(explainedByInstant(m("somewhere to fix my bike chain"))).toBe(false);
    expect(explainedByInstant(m("haifa"))).toBe(false); // a place alone: let the model try
  });
  it("offers the model lane-1 candidates in the query's language", () => {
    expect(intentCandidates(m("knafeh haifa"), "en")).toEqual({
      kinds: [{ slug: "sweets", name: "Knafeh and Arabic sweets" }],
      places: [{ slug: "haifa", name: "Haifa" }],
    });
  });
});

describe("validating the model's answer", () => {
  const allowed = { kinds: new Set(["sweets", "cafes"]), places: new Set(["haifa"]) };
  const cues = { openNow: false, delivers: false, nearMe: false, glutenFree: false };
  it("drops slugs outside the candidates and active kinds", () => {
    expect(
      validateIntent(
        {
          kinds: ["sweets", "bars", "Sweets", "cafes"],
          place: "tel-aviv",
          nearMe: false,
          openNow: false,
          attributes: { delivers: true },
          freeText: "  pistachio  ",
        },
        allowed,
        cues,
      ),
    ).toEqual({
      kinds: ["sweets", "cafes"],
      place: null,
      nearMe: false,
      openNow: false,
      attributes: { delivers: true },
      dietary: [],
      freeText: "pistachio",
      items: [],
      mustHave: ["delivers"],
      niceToHave: [],
    });
  });
  it("cleans the model's items: no diet words, each once, at most five", () => {
    const out = validateIntent(
      {
        kinds: [],
        place: null,
        nearMe: false,
        openNow: true,
        attributes: { delivers: false },
        freeText: "",
        items: ["gluten free shawarma", "Shawarma", " ", "kebab", "a", "b", "c", "d"],
        niceToHave: ["openNow"],
      },
      allowed,
      cues,
    );
    expect(out.items).toEqual(["shawarma", "kebab", "a", "b", "c"]);
    // Said as a wish, open now lifts results instead of filtering them.
    expect(out).toMatchObject({ openNow: true, mustHave: [], niceToHave: ["openNow"] });
  });
  it("reads an answer recorded before deep search (no items, no wishes) as none", () => {
    const out = validateIntent(
      {
        kinds: ["sweets"],
        place: null,
        nearMe: false,
        openNow: false,
        attributes: { delivers: false },
        freeText: "",
      },
      allowed,
      cues,
    );
    expect(out).toMatchObject({ items: [], niceToHave: [], mustHave: [] });
  });
  it("keeps lane-1 cues the model missed and caps kinds at three", () => {
    const out = validateIntent(
      {
        kinds: ["sweets", "cafes", "sweets"],
        place: "haifa",
        nearMe: false,
        openNow: false,
        attributes: { delivers: false },
        freeText: "",
      },
      { kinds: new Set(["sweets", "cafes"]), places: allowed.places },
      { openNow: true, delivers: false, nearMe: true, glutenFree: true },
    );
    expect(out).toMatchObject({
      kinds: ["sweets", "cafes"],
      place: "haifa",
      openNow: true,
      nearMe: true,
      dietary: ["gluten_free"],
    });
  });
});
