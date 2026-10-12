// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";

const postSearch = vi.fn();
const getSuggestions = vi.fn();
const postClick = vi.fn();
vi.mock("@/lib/api", async (orig) => ({
  ...(await orig<typeof import("@/lib/api")>()),
  postSearch,
  getSuggestions,
  postClick,
}));
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
