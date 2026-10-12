// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const getPlaces = vi.fn();
const getDensity = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiUnavailableError: class ApiUnavailableError extends Error {},
  getPlaces,
  getDensity,
}));
const api = await import("@/lib/api");
const { GET } = await import("./route");

afterEach(() => vi.resetAllMocks());

const get = (query: string) => GET(new Request(`http://web.test/api/city?${query}`));
const sakhnin = {
  id: "p1",
  slug: "sakhnin",
  type: "city",
  name: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" },
  status: "live",
  lat: 32.86,
  lng: 35.3,
  parentId: "r1",
};

it("returns live places as localized dots with their density and level-1 href", async () => {
  getPlaces.mockResolvedValue([sakhnin, { ...sakhnin, slug: "tamra", name: { he: "טמרה" } }]);
  getDensity.mockResolvedValue({ sakhnin: 7 });
  const res = await get("locale=ar");
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  expect(getPlaces).toHaveBeenCalledWith("live");
  expect(await res.json()).toEqual({
    dots: [
      { slug: "sakhnin", name: "سخنين", lat: 32.86, lng: 35.3, count: 7, href: "/ar/sakhnin" },
      { slug: "tamra", name: "טמרה", lat: 32.86, lng: 35.3, count: 0, href: "/ar/tamra" },
    ],
  });
});

it("answers 400 for an unknown locale", async () => {
  expect((await get("locale=fr")).status).toBe(400);
});

it("answers 503 when the API is down", async () => {
  getPlaces.mockRejectedValue(new api.ApiUnavailableError("down"));
  getDensity.mockResolvedValue({});
  expect((await get("locale=he")).status).toBe(503);
});
