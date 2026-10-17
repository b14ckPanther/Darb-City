import { EMPTY_INTENT } from "@darb/contracts";
import type { InstantResult } from "@darb/search-text";
import { expect, it } from "vitest";
import type { IntentProvider, RawIntentInput } from "./intent.js";
import type { RecordedCase } from "./recorded-intent.provider.js";
import { FAILED_SOURCE, recordCases } from "./record-cases.js";

const { place, nearMe, openNow, attributes, freeText } = EMPTY_INTENT;
const intent = (kind: string): RawIntentInput => ({
  kinds: [kind],
  place,
  nearMe,
  openNow,
  attributes,
  freeText,
});
const kase = (query: string, recorded: RawIntentInput, blocked = false): RecordedCase => ({
  query,
  locale: "en",
  expect: { kind: blocked ? null : "barbershops", place: null, ...(blocked ? { blocked } : {}) },
  recorded,
  source: "authored",
});
const lane1 = async (q: string) =>
  ({
    normalized: q,
    blocked: false,
    cues: { openNow: false, delivers: false, nearMe: false, glutenFree: false },
    sentence: false,
    places: [],
    kinds: [],
    unmatched: [],
    content: [],
    typed: [],
  }) as InstantResult;

it("records answers, marks failures loudly and never touches blocked cases", async () => {
  const provider: IntentProvider = {
    name: "fake",
    extract: async ({ query }) => {
      if (query === "throws") throw new Error("boom");
      if (query === "silent") return null;
      return intent("barbershops");
    },
  };
  const cases = [
    kase("barber", intent("barbershops")),
    kase("barbr", intent("hummus")),
    kase("silent", intent("barbershops")),
    kase("throws", intent("barbershops")),
    kase("bars", intent("bars"), true),
  ];
  const out = await recordCases(cases, provider, lane1, "model-x", []);
  expect(out).toEqual({ changed: 1, failed: ['en "silent"', 'en "throws"'] });
  expect(cases.map((c) => c.source)).toEqual([
    "model-x",
    "model-x",
    FAILED_SOURCE,
    FAILED_SOURCE,
    "authored",
  ]);
  expect(cases[1]!.recorded.kinds).toEqual(["barbershops"]);
});
