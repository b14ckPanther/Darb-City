// @vitest-environment node
import type { BusinessSummaryDto, TaxonomyDto } from "@darb/contracts";
import { afterEach, expect, it, vi } from "vitest";

const getBusinesses = vi.fn();
const getNearestPlace = vi.fn();
const getPlaces = vi.fn();
const getTaxonomy = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiBadRequestError: class ApiBadRequestError extends Error {},
  ApiUnavailableError: class ApiUnavailableError extends Error {},
  getBusinesses,
  getNearestPlace,
  getPlaces,
  getTaxonomy,
}));
const api = await import("@/lib/api");
const route = await import("./route");
const { POST } = route;

afterEach(() => vi.resetAllMocks());

const taxonomy = {
  sectors: [
    {
      id: "s1",
      slug: "beauty",
      name: { en: "Beauty" },
      tagline: { en: "t" },
      accent: "#aa7744",
      order: 1,
      kinds: [
        {
          id: "k1",
          slug: "barbershops",
          sectorId: "s1",
          parentKindId: null,
          name: { en: "Barbers" },
          template: "booking",
          attributes: [],
          icon: null,
          order: 1,
        },
      ],
    },
  ],
} satisfies TaxonomyDto;

const samers: BusinessSummaryDto = {
  id: "b1",
  slug: "samers",
  name: { en: "Samer's", ar: "سمير" },
  tagline: { en: "Fades" },
  tier: "basic",
  primaryKindId: "k1",
  placeId: "p1",
  placeSlug: "sakhnin",
  lat: 32.86,
  lng: 35.3,
  photo: null,
  openNow: true,
  hours: { weekly: { "0": [{ open: "09:00", close: "17:00" }] }, exceptions: [] },
  dietary: [],
  distanceKm: 1.26,
};

const near = (body: unknown) =>
  POST(
    new Request("http://web.test/api/near/businesses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );

function live() {
  getTaxonomy.mockResolvedValue(taxonomy);
  getPlaces.mockResolvedValue([{ slug: "sakhnin", name: { en: "Sakhnin", ar: "سخنين" } }]);
}

it("lists the businesses closest to a rounded point, names the place, never caches", async () => {
  live();
  getBusinesses.mockResolvedValue({ items: [samers], nextCursor: "next" });
  getNearestPlace.mockResolvedValue({ slug: "sakhnin", name: { en: "Sakhnin", ar: "سخنين" } });
  const res = await near({ locale: "en", lat: 32.8486259, lng: 35.3358268 });
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("no-store");
  const body = await res.json();
  expect(body.place).toBe("Sakhnin");
  expect(body.nextCursor).toBe("next");
  expect(body.rows).toHaveLength(1);
  expect(body.rows[0]).toMatchObject({
    key: "sakhnin/samers",
    href: "/en/sakhnin/beauty/barbershops/samers",
    placeName: "Sakhnin",
    distance: "1.3 km",
  });
  // About 110 m: enough to sort by distance, too coarse to point at a home.
  expect(getBusinesses).toHaveBeenCalledWith("israel", {
    near: { lat: 32.849, lng: 35.336 },
    cursor: undefined,
  });
  expect(getNearestPlace).toHaveBeenCalledWith(32.849, 35.336, "no-store");
});

it("pages on with the cursor without looking the place up again", async () => {
  live();
  getBusinesses.mockResolvedValue({ items: [], nextCursor: null });
  const res = await near({ locale: "ar", lat: 32.85, lng: 35.34, cursor: "abc" });
  expect(await res.json()).toEqual({ rows: [], nextCursor: null });
  expect(getBusinesses).toHaveBeenCalledWith("israel", {
    near: { lat: 32.85, lng: 35.34 },
    cursor: "abc",
  });
  expect(getNearestPlace).not.toHaveBeenCalled();
});

it("rejects bad bodies", async () => {
  expect((await near({ locale: "he", lat: "", lng: 35 })).status).toBe(400);
  expect((await near({ locale: "he", lat: 91, lng: 35 })).status).toBe(400);
  expect((await near({ locale: "fr", lat: 32, lng: 35 })).status).toBe(400);
  expect((await near({ locale: "he", lat: 32, lng: 35, cursor: "" })).status).toBe(400);
  expect((await near(null)).status).toBe(400);
  expect(
    (await POST(new Request("http://web.test/api/near/businesses", { method: "POST", body: "{" })))
      .status,
  ).toBe(400);
  expect(getBusinesses).not.toHaveBeenCalled();
});

it("answers 400 for a stale cursor and 503 when the API is down", async () => {
  live();
  getBusinesses.mockRejectedValue(new api.ApiBadRequestError("bad cursor"));
  expect((await near({ locale: "he", lat: 32, lng: 35, cursor: "x" })).status).toBe(400);
  getBusinesses.mockRejectedValue(new api.ApiUnavailableError("down"));
  expect((await near({ locale: "he", lat: 32, lng: 35 })).status).toBe(503);
});

it("has no GET, so a position never sits in a URL", () => {
  expect("GET" in route).toBe(false);
});
