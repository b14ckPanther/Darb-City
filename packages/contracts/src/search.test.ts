import { describe, expect, it } from "vitest";
import { contract } from "./contract.js";
import {
  ClickRequestSchema,
  conditionsOf,
  EMPTY_INTENT,
  IntentSchema,
  SearchRequestSchema,
  SearchResponseSchema,
  SuggestQuerySchema,
} from "./search.js";

describe("search schemas", () => {
  it("accept a query with an optional point", () => {
    expect(SearchRequestSchema.parse({ q: "  barber  ", locale: "he" })).toEqual({
      q: "barber",
      locale: "he",
    });
    expect(
      SearchRequestSchema.parse({ q: "x", locale: "en", near: { lat: 32.8, lng: 35.3 } }).near,
    ).toEqual({ lat: 32.8, lng: 35.3 });
    expect(() => SearchRequestSchema.parse({ q: " ", locale: "he" })).toThrow();
    expect(() => SearchRequestSchema.parse({ q: "x".repeat(201), locale: "he" })).toThrow();
    expect(() => SearchRequestSchema.parse({ q: "x", locale: "fr" })).toThrow();
  });
  it("only accept slugs in an intent", () => {
    expect(IntentSchema.parse(EMPTY_INTENT)).toEqual(EMPTY_INTENT);
    expect(() => IntentSchema.parse({ ...EMPTY_INTENT, kinds: ["../admin"] })).toThrow();
    expect(() => IntentSchema.parse({ ...EMPTY_INTENT, place: "Haifa City" })).toThrow();
  });
  it("read an intent without items or conditions (older caches and links) as empty ones", () => {
    const { items: _i, mustHave: _m, niceToHave: _n, ...old } = EMPTY_INTENT;
    expect(IntentSchema.parse(old)).toEqual(EMPTY_INTENT);
    expect(IntentSchema.parse({ ...EMPTY_INTENT, items: [" shawarma "] }).items).toEqual([
      "shawarma",
    ]);
    expect(() => IntentSchema.parse({ ...EMPTY_INTENT, items: ["x".repeat(61)] })).toThrow();
    expect(() =>
      IntentSchema.parse({ ...EMPTY_INTENT, items: ["a", "b", "c", "d", "e", "f"] }),
    ).toThrow();
    expect(() => IntentSchema.parse({ ...EMPTY_INTENT, mustHave: ["halal"] })).toThrow();
  });
  it("make every stated condition a must, unless said as a wish; gluten free is always a must", () => {
    const intent = {
      ...EMPTY_INTENT,
      openNow: true,
      attributes: { delivers: true },
      dietary: ["gluten_free" as const],
      niceToHave: ["openNow" as const, "gluten_free" as const],
    };
    expect(conditionsOf(intent)).toEqual({
      mustHave: ["delivers", "gluten_free"],
      niceToHave: ["openNow"],
    });
    expect(conditionsOf(EMPTY_INTENT)).toEqual({ mustHave: [], niceToHave: [] });
  });
  it("carry the matched thing per item and an honest fallback", () => {
    const base = {
      status: "ok",
      lane: "smart",
      queryId: null,
      intent: EMPTY_INTENT,
      needsLocation: false,
      items: [],
      nearest: [],
    };
    expect(SearchResponseSchema.parse(base).fallback).toBeNull();
    expect(SearchResponseSchema.parse({ ...base, fallback: "wider" }).fallback).toBe("wider");
    expect(() => SearchResponseSchema.parse({ ...base, fallback: "anything" })).toThrow();
  });
  it("give a query id that POST /search/click accepts, or null", () => {
    const response = {
      status: "ok",
      lane: "smart",
      queryId: "019a0000-0000-7000-8000-000000000001",
      intent: EMPTY_INTENT,
      needsLocation: false,
      items: [],
      nearest: [],
    };
    expect(SearchResponseSchema.parse(response).queryId).toBe(response.queryId);
    expect(SearchResponseSchema.parse({ ...response, queryId: null }).queryId).toBeNull();
    expect(() => SearchResponseSchema.parse({ ...response, queryId: "q1" })).toThrow();
  });
  it("only accept a click key of the form place/slug", () => {
    const queryId = "019a0000-0000-7000-8000-000000000001";
    expect(ClickRequestSchema.parse({ queryId, key: "sakhnin/abu-salim" }).key).toBe(
      "sakhnin/abu-salim",
    );
    for (const key of ["abu-salim", "sakhnin/abu-salim/x", "../admin", "Sakhnin/Abu", "sakhnin/"])
      expect(() => ClickRequestSchema.parse({ queryId, key })).toThrow();
  });
  it("rate-limit clicks like searches", () => {
    expect(Object.keys(contract.search.click.responses)).toContain("429");
  });
  it("default the suggestion limit", () => {
    expect(SuggestQuerySchema.parse({ q: "hu" })).toEqual({ q: "hu", limit: 6 });
    expect(() => SuggestQuerySchema.parse({ q: "h" })).toThrow();
  });
  it("route every search endpoint", () => {
    expect(contract.search.suggest.path).toBe("/search/suggest");
    expect(contract.search.search.method).toBe("POST");
    expect(contract.search.results.path).toBe("/search/results");
    expect(contract.search.click.path).toBe("/search/click");
    expect(contract.search.report.path).toBe("/search/report");
  });
});

describe("intent dietary (Task 27b)", () => {
  it("has no dietary filter by default, and an older cached intent without it still parses", () => {
    expect(EMPTY_INTENT.dietary).toEqual([]);
    const { dietary: _d, ...older } = EMPTY_INTENT;
    expect(IntentSchema.parse(older).dietary).toEqual([]);
    expect(IntentSchema.parse({ ...EMPTY_INTENT, dietary: ["gluten_free"] }).dietary).toEqual([
      "gluten_free",
    ]);
    expect(() => IntentSchema.parse({ ...EMPTY_INTENT, dietary: ["x"] })).toThrow();
  });
});
