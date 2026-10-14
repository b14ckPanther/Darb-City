// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiBadRequestError,
  ApiUnavailableError,
  getBusiness,
  getBusinesses,
  getDensity,
  getKindCounts,
  getNearestPlace,
  getNearestPlacesWithKind,
  getPlace,
  getSuggestions,
  postSearch,
} from "./api";

const fetchMock = vi.fn<typeof fetch>();

beforeEach(() => {
  vi.stubEnv("API_URL", "http://api.test/");
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
  fetchMock.mockReset();
});

const place = {
  id: "p1",
  slug: "haifa",
  type: "city",
  name: { he: "חיפה" },
  status: "live",
  lat: 32.8,
  lng: 35,
  parentId: null,
  ancestors: [],
  children: [],
};

describe("api client", () => {
  it("fetches with an ISR lifetime and cache tags", async () => {
    fetchMock.mockResolvedValue(Response.json(place));
    expect(await getPlace("haifa")).toEqual(place);
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/places/haifa");
    expect((init as RequestInit & { next?: unknown }).next).toEqual({
      revalidate: 86400,
      tags: ["places", "place:haifa"],
    });
  });
  it("turns a 404 into null", async () => {
    fetchMock.mockResolvedValue(Response.json({ message: "nope" }, { status: 404 }));
    expect(await getPlace("nowhere")).toBeNull();
  });
  it("sends only the query it is given", async () => {
    fetchMock.mockResolvedValue(Response.json({ items: [], nextCursor: null }));
    await getBusinesses("sakhnin", { kind: "barbershops" });
    expect(String(fetchMock.mock.calls[0]![0])).toBe(
      "http://api.test/places/sakhnin/businesses?kind=barbershops",
    );
  });
  it("can skip the cache for live lookups, with the point in a POST body", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ ...place, ancestors: undefined, children: undefined }),
    );
    await getNearestPlace(32.85, 35.33, "no-store");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/nearest-place");
    expect((init as RequestInit).method).toBe("POST");
    expect(JSON.parse(String((init as RequestInit).body))).toEqual({ lat: 32.85, lng: 35.33 });
    expect((init as RequestInit).cache).toBe("no-store");
  });
  it("never puts a point in a URL, cached or not (spec §5.4)", async () => {
    fetchMock.mockImplementation(async () => Response.json([]));
    await getNearestPlacesWithKind("barbershops", 32.8, 35.3, 5);
    await getNearestPlacesWithKind("barbershops", 32.81, 35.31, 1, "no-store");
    fetchMock.mockImplementation(async () => Response.json({ items: [], nextCursor: null }));
    await getBusinesses("sakhnin", { kind: "barbershops", near: { lat: 32.864, lng: 35.301 } });
    const calls = fetchMock.mock.calls.map(([url, init]) => ({
      url: String(url),
      method: (init as RequestInit).method,
      body: JSON.parse(String((init as RequestInit).body)),
      cache: (init as RequestInit).cache,
      next: (init as RequestInit & { next?: unknown }).next,
    }));
    for (const call of calls) {
      expect(call.url).not.toMatch(/lat|lng|32\.8|35\.3/);
      expect(call.method).toBe("POST");
    }
    expect(calls[0]).toMatchObject({
      url: "http://api.test/kinds/barbershops/nearest-places",
      body: { lat: 32.8, lng: 35.3, limit: 5 },
      next: { revalidate: 86400, tags: ["businesses"] },
    });
    expect(calls[1]).toMatchObject({
      body: { lat: 32.81, lng: 35.31, limit: 1 },
      cache: "no-store",
    });
    expect(calls[2]).toMatchObject({
      url: "http://api.test/places/sakhnin/businesses/near?kind=barbershops",
      body: { lat: 32.864, lng: 35.301 },
      cache: "no-store",
    });
    expect(calls[2]!.next).toBeUndefined();
  });
  it("reports an unreachable or failing API as ApiUnavailableError", async () => {
    fetchMock.mockRejectedValue(new TypeError("fetch failed"));
    await expect(getPlace("haifa")).rejects.toBeInstanceOf(ApiUnavailableError);
    fetchMock.mockResolvedValue(Response.json({ message: "boom" }, { status: 500 }));
    await expect(getPlace("haifa")).rejects.toBeInstanceOf(ApiUnavailableError);
  });
  it("reports a rejected business-list query (a bad cursor) as ApiBadRequestError", async () => {
    fetchMock.mockResolvedValue(Response.json({ message: "Bad cursor" }, { status: 400 }));
    await expect(
      getBusinesses("sakhnin", { kind: "nails", cursor: "junk" }),
    ).rejects.toBeInstanceOf(ApiBadRequestError);
    fetchMock.mockResolvedValue(Response.json({ message: "nope" }, { status: 404 }));
    expect(await getBusinesses("nowhere")).toBeNull();
  });

  it("fetches density with the businesses and places tags", async () => {
    fetchMock.mockResolvedValue(Response.json({ sakhnin: 4 }));
    expect(await getDensity()).toEqual({ sakhnin: 4 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/density");
    expect((init as RequestInit & { next?: unknown }).next).toEqual({
      revalidate: 86400,
      tags: ["businesses", "places"],
    });
  });
});

describe("slug path params", () => {
  // Next decodes route params and ts-rest inserts them raw into the path, so `a/../b` would
  // reach `API/b` and `a?b` would inject a query. None of them is a slug: not found, no call.
  const bad = ["a/../b", "a?b", "A", "%2F", "", "x/../../taxonomy"];
  it.each(bad)("never sends %j to the API", async (slug) => {
    fetchMock.mockResolvedValue(Response.json({}));
    expect(await getPlace(slug)).toBeNull();
    expect(await getKindCounts(slug)).toBeNull();
    expect(await getBusinesses(slug)).toBeNull();
    expect(await getBusinesses("sakhnin", { kind: slug || "A" })).toBeNull();
    expect(await getBusiness(slug, "abu-salim")).toBeNull();
    expect(await getBusiness("sakhnin", slug)).toBeNull();
    expect(await getNearestPlacesWithKind(slug, 32.8, 35.3, 5)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("search calls", () => {
  it("vouch for the visitor, never cache, and never log the point", async () => {
    vi.stubEnv("SEARCH_PROXY_KEY", "k");
    const log = vi.spyOn(console, "log");
    const info = vi.spyOn(console, "info");
    fetchMock.mockResolvedValue(
      Response.json({ message: "slow down", retryAfter: 7 }, { status: 429 }),
    );
    const out = await postSearch(
      { q: "barber", locale: "en", near: { lat: 32.864, lng: 35.304 } },
      "5.6.7.8",
    );
    expect(out).toEqual({ status: 429, retryAfter: 7 });
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/search");
    expect(init?.cache).toBe("no-store");
    const headers = new Headers(init?.headers);
    expect(headers.get("x-darb-proxy-key")).toBe("k");
    expect(headers.get("x-darb-client-ip")).toBe("5.6.7.8");
    expect(log).not.toHaveBeenCalled();
    expect(info).not.toHaveBeenCalled();
  });
});

describe("suggestions", () => {
  it("vouch with the proxy key, and say so when the API limits this server", async () => {
    vi.stubEnv("SEARCH_PROXY_KEY", "k");
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    fetchMock.mockResolvedValue(Response.json([], { status: 200 }));
    await getSuggestions("ba");
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).get("x-darb-proxy-key")).toBe("k");
    fetchMock.mockResolvedValue(Response.json({ message: "slow", retryAfter: 9 }, { status: 429 }));
    expect(await getSuggestions("ba")).toEqual([]);
    expect(warn).toHaveBeenCalledWith(expect.stringMatching(/SEARCH_PROXY_KEY/));
    warn.mockRestore();
  });
  it("send no empty proxy header when the key is unset (development)", async () => {
    vi.stubEnv("SEARCH_PROXY_KEY", "");
    fetchMock.mockResolvedValue(Response.json([], { status: 200 }));
    await getSuggestions("ba");
    expect(new Headers(fetchMock.mock.calls[0]![1]?.headers).has("x-darb-proxy-key")).toBe(false);
  });
});
