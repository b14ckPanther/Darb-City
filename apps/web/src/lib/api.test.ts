// @vitest-environment node
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ApiBadRequestError,
  ApiUnavailableError,
  getBusinesses,
  getNearestPlace,
  getPlace,
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
      revalidate: 300,
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
  it("can skip the cache for live lookups", async () => {
    fetchMock.mockResolvedValue(
      Response.json({ ...place, ancestors: undefined, children: undefined }),
    );
    await getNearestPlace(32.85, 35.33, "no-store");
    const [url, init] = fetchMock.mock.calls[0]!;
    expect(String(url)).toBe("http://api.test/nearest-place?lat=32.85&lng=35.33");
    expect((init as RequestInit).cache).toBe("no-store");
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
});
