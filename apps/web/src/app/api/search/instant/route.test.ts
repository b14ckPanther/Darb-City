// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const getInstantIndex = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  getInstantIndex,
}));
const { GET } = await import("./route");
const { ApiUnavailableError } = await import("@/lib/api");

afterEach(() => {
  getInstantIndex.mockReset();
  vi.unstubAllEnvs();
});

it("serves the API's index with an edge cache header", async () => {
  getInstantIndex.mockResolvedValue({ v: 1, places: [], kinds: [] });
  const res = await GET(new Request("http://web.test/api/search/instant"));
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe(
    "public, s-maxage=300, stale-while-revalidate=86400",
  );
  expect(await res.json()).toEqual({ v: 1, places: [], kinds: [] });
});

it("redirects to the build-time index when the API is down", async () => {
  vi.stubEnv("NEXT_PUBLIC_SEARCH_INDEX_URL", "/search-index/instant.abc.json");
  getInstantIndex.mockRejectedValue(new ApiUnavailableError(new Error("down")));
  const res = await GET(new Request("http://web.test/api/search/instant"));
  expect(res.status).toBe(307);
  expect(res.headers.get("location")).toBe("http://web.test/search-index/instant.abc.json");
});
