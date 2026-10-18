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

const get = () => GET();
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

it("returns live places as points with their business count, and nothing to read aloud", async () => {
  getPlaces.mockResolvedValue([sakhnin, { ...sakhnin, slug: "tamra", name: { he: "טמרה" } }]);
  getDensity.mockResolvedValue({ sakhnin: 7 });
  const res = await get();
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  expect(getPlaces).toHaveBeenCalledWith("live");
  expect(await res.json()).toEqual({
    dots: [
      { slug: "sakhnin", lat: 32.86, lng: 35.3, count: 7 },
      { slug: "tamra", lat: 32.86, lng: 35.3, count: 0 },
    ],
  });
});

it("answers 503 when the API is down", async () => {
  getPlaces.mockRejectedValue(new api.ApiUnavailableError("down"));
  getDensity.mockResolvedValue({});
  expect((await get()).status).toBe(503);
});

it("puts only settlements on the map: no country, region or neighbourhood dots", async () => {
  getPlaces.mockResolvedValue([
    { ...sakhnin, slug: "israel", type: "country", parentId: null },
    { ...sakhnin, slug: "north", type: "region" },
    sakhnin,
    { ...sakhnin, slug: "kfar-manda", type: "town" },
    { ...sakhnin, slug: "zarzir", type: "village" },
    { ...sakhnin, slug: "old-city", type: "neighbourhood" },
  ]);
  getDensity.mockResolvedValue({});
  const { dots } = (await (await get()).json()) as { dots: { slug: string }[] };
  expect(dots.map((d) => d.slug)).toEqual(["sakhnin", "kfar-manda", "zarzir"]);
});
