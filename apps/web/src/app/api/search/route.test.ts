// @vitest-environment node
import { EMPTY_INTENT, type SearchResponseDto } from "@darb/contracts";
import { afterEach, describe, expect, it, vi } from "vitest";
import { indexTaxonomy } from "@/lib/taxonomy";
import type { ViewContext } from "@/lib/search-view";

const postSearch = vi.fn();
const getSuggestions = vi.fn();
const postClick = vi.fn();
const postResults = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  postSearch,
  postResults,
  getSuggestions,
  postClick,
}));
const ctx: ViewContext = {
  locale: "en",
  index: indexTaxonomy({
    sectors: [
      {
        id: "s1",
        slug: "food",
        name: { en: "Food" },
        tagline: {},
        accent: "#d6a473",
        order: 1,
        kinds: [
          {
            id: "k1",
            slug: "sweets",
            sectorId: "s1",
            parentKindId: null,
            name: { en: "Sweets" },
            template: "menu",
            attributes: ["delivers"],
            icon: null,
            order: 1,
          },
        ],
      },
    ],
  }),
  names: new Map([["akko", { en: "Akko" }]]),
  place: { slug: "akko", name: "Akko", lat: 32.92, lng: 35.07 },
  labels: {
    openNow: "Open now",
    delivers: "Delivers",
    nearMe: "Near me",
    kindInPlace: "{kind} in {place}",
    kindNationwide: "{kind} across Israel",
  },
  kmLabel: (km) => `${km.toFixed(1)} km`,
};
const viewContext = vi.fn(async () => ctx);
vi.mock("@/lib/search-context", () => ({ viewContext }));
const intent = { ...EMPTY_INTENT, kinds: ["sweets"], place: "akko", openNow: true };
const ok: SearchResponseDto = {
  status: "ok",
  lane: "smart",
  queryId: "8f2d0c4e-1b7a-4c2e-9f61-3d5a7b9c0e12",
  intent,
  needsLocation: false,
  items: [
    {
      id: "b1",
      slug: "abu-salem",
      name: { en: "Abu Salem" },
      tagline: {},
      tier: "example",
      primaryKindId: "k1",
      placeId: "p1",
      placeSlug: "akko",
      lat: 32.921,
      lng: 35.071,
      photo: null,
      openNow: true,
      hours: { weekly: {}, exceptions: [] },
    },
  ],
  nearest: [],
};
const search = await import("./route");
const suggest = await import("./suggest/route");
const click = await import("./click/route");

afterEach(() => vi.clearAllMocks());

const req = (body: unknown, headers: Record<string, string> = {}) =>
  new Request("http://localhost/api/search", {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });

describe("POST /api/search", () => {
  it("forwards the visitor IP and a rounded point, never more", async () => {
    postSearch.mockResolvedValue({ status: 429, retryAfter: 12 });
    const res = await search.POST(
      req(
        { q: "barber", locale: "en", near: { lat: 32.864123, lng: 35.303987 } },
        { "x-forwarded-for": "5.6.7.8, 10.0.0.1" },
      ),
    );
    expect(postSearch).toHaveBeenCalledWith(
      { q: "barber", locale: "en", near: { lat: 32.864, lng: 35.304 } },
      "5.6.7.8",
    );
    expect(res.status).toBe(429);
    expect(res.headers.get("retry-after")).toBe("12");
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("answers with the view: chips, rows and pins, ready to draw", async () => {
    postSearch.mockResolvedValue({ status: 200, body: ok });
    const res = await search.POST(req({ q: "sweets akko", locale: "en" }));
    expect(viewContext).toHaveBeenCalledWith("en", intent);
    const view = await res.json();
    expect(view.chips.map((c: { id: string }) => c.id)).toEqual([
      "place:akko",
      "kind:sweets",
      "openNow",
    ]);
    expect(view.rows[0].href).toBe("/en/akko/food/sweets/abu-salem");
    expect(view.stage.pins).toHaveLength(1);
    expect(view.queryId).toBe(ok.queryId);
    expect(res.headers.get("cache-control")).toBe("no-store");
  });
  it("rejects a malformed body", async () => {
    expect((await search.POST(req({ q: "", locale: "xx" }))).status).toBe(400);
    expect(postSearch).not.toHaveBeenCalled();
  });
});

describe("GET /api/search/suggest", () => {
  it("caches at the edge and ignores one-letter queries", async () => {
    getSuggestions.mockResolvedValue([]);
    const res = await suggest.GET(new Request("http://localhost/api/search/suggest?q=h&locale=en"));
    expect(await res.json()).toEqual({ options: [] });
    expect(getSuggestions).not.toHaveBeenCalled();
    const ok = await suggest.GET(
      new Request("http://localhost/api/search/suggest?q=hum&locale=en"),
    );
    expect(ok.headers.get("cache-control")).toBe(
      "public, s-maxage=300, stale-while-revalidate=600",
    );
  });
});

describe("POST /api/search/click", () => {
  it("vouches for the visitor (clicks are rate-limited per IP) and never fails the page", async () => {
    postClick.mockRejectedValue(new Error("down"));
    const queryId = "8f2d0c4e-1b7a-4c2e-9f61-3d5a7b9c0e12";
    const res = await click.POST(
      req({ queryId, key: "akko/abu-salem" }, { "x-forwarded-for": "5.6.7.8" }),
    );
    expect(postClick).toHaveBeenCalledWith(queryId, "akko/abu-salem", "5.6.7.8");
    expect(res.status).toBe(204);
    expect((await click.POST(req({ queryId: "nope", key: "x" }))).status).toBe(204);
    expect(postClick).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/search/results", () => {
  it("re-runs an edited intent with a rounded point and answers with the view", async () => {
    const results = await import("./results/route");
    postResults.mockResolvedValue({
      status: 200,
      body: { ...ok, queryId: null, intent: { ...intent, openNow: false } },
    });
    const edited = {
      q: "sweets akko",
      locale: "en",
      intent: { ...intent, openNow: false },
      near: { lat: 32.92049, lng: 35.07151 },
    };
    const res = await results.POST(req(edited, { "x-real-ip": "9.9.9.9" }));
    expect(postResults).toHaveBeenCalledWith(
      { ...edited, near: { lat: 32.92, lng: 35.072 } },
      "9.9.9.9",
    );
    const view = await res.json();
    expect(view.chips.map((c: { id: string }) => c.id)).toEqual(["place:akko", "kind:sweets"]);
    expect(view.queryId).toBeNull();
  });
});
