// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const getNearestPlace = vi.fn();
const getNearestPlacesWithKind = vi.fn();
const getTaxonomy = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiUnavailableError: class extends Error {},
  getNearestPlace,
  getNearestPlacesWithKind,
  getTaxonomy,
}));
const route = await import("./route");
const { POST } = route;

afterEach(() => vi.resetAllMocks());

const near = (body: unknown) =>
  POST(
    new Request("http://web.test/api/near", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

it("sends a person to the nearest live place, uncached", async () => {
  getNearestPlace.mockResolvedValue({ slug: "arraba" });
  const res = await near({ locale: "ar", lat: 32.85, lng: 35.34 });
  expect(await res.json()).toEqual({ href: "/ar/arraba" });
  expect(getNearestPlace).toHaveBeenCalledWith(32.85, 35.34, "no-store");
});

it("sends them to the nearest place with the kind on a national kind page", async () => {
  getTaxonomy.mockResolvedValue({
    sectors: [
      {
        id: "s1",
        slug: "beauty",
        name: { en: "B" },
        tagline: { en: "t" },
        accent: "#aa7744",
        order: 1,
        kinds: [
          {
            id: "k1",
            slug: "nails",
            sectorId: "s1",
            parentKindId: null,
            name: { en: "Nails" },
            template: "booking",
            attributes: [],
            icon: null,
            order: 1,
          },
        ],
      },
    ],
  });
  getNearestPlacesWithKind.mockResolvedValue([{ slug: "sakhnin" }]);
  const res = await near({ locale: "he", lat: 32.85, lng: 35.34, kind: "nails" });
  expect(await res.json()).toEqual({ href: "/sakhnin/beauty/nails" });
  expect(getNearestPlacesWithKind).toHaveBeenCalledWith("nails", 32.85, 35.34, 1, "no-store");
});

it("rejects bad coordinates and reports nothing found", async () => {
  expect((await near({ locale: "he", lat: "", lng: 35 })).status).toBe(400);
  expect((await near({ locale: "he", lat: 91, lng: 35 })).status).toBe(400);
  expect((await near(null)).status).toBe(400);
  expect(
    (await POST(new Request("http://web.test/api/near", { method: "POST", body: "{" }))).status,
  ).toBe(400);
  getNearestPlace.mockResolvedValue(null);
  expect((await near({ locale: "he", lat: 29.5, lng: 34.9 })).status).toBe(404);
});

it("rounds the position before it reaches the API", async () => {
  getNearestPlace.mockResolvedValue({ slug: "sakhnin" });
  await near({ locale: "en", lat: 32.8486259, lng: 35.3358268 });
  expect(getNearestPlace).toHaveBeenCalledWith(32.849, 35.336, "no-store");
});

it("has no GET, so a position never sits in a URL", () => {
  expect("GET" in route).toBe(false);
});
