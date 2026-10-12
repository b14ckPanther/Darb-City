import { describe, expect, it } from "vitest";
import { contract } from "./contract.js";
import {
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
