// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const getBusinesses = vi.fn();
const getPlace = vi.fn();
const getTaxonomy = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiUnavailableError: class extends Error {},
  getBusinesses,
  getPlace,
  getTaxonomy,
}));
const api = await import("@/lib/api");
const { GET } = await import("./route");

afterEach(() => vi.resetAllMocks());

const get = (query: string) => GET(new Request(`http://web.test/api/pins?${query}`));
const query = "locale=en&place=haifa&kind=garages";

const taxonomy = {
  sectors: [
    {
      id: "s1",
      slug: "auto",
      name: { en: "Auto" },
      tagline: { en: "" },
      accent: "#8fb3c4",
      order: 1,
      kinds: [
        {
          id: "k1",
          slug: "garages",
          sectorId: "s1",
          parentKindId: null,
          name: { en: "Garages" },
          template: "booking",
          attributes: [],
          icon: null,
          order: 1,
        },
      ],
    },
  ],
};
const haifa = {
  slug: "haifa",
  name: { en: "Haifa" },
  lat: 32.79,
  lng: 34.99,
  children: [{ slug: "kiryat-haim", name: { en: "Kiryat Haim" } }],
};
const business = (i: number, placeSlug = "haifa") => ({
  id: `b${i}`,
  slug: `garage-${i}`,
  name: { en: `Garage ${i}` },
  tagline: { en: "" },
  tier: "basic",
  primaryKindId: "k1",
  placeId: placeSlug,
  placeSlug,
  lat: 32.8,
  lng: 35,
  photo: null,
  openNow: true,
  hours: { weekly: { sun: [["08:00", "17:00"]] }, exceptions: [] },
  dietary: [],
});

function serve(total: number) {
  getTaxonomy.mockResolvedValue(taxonomy);
  getPlace.mockResolvedValue(haifa);
  getBusinesses.mockImplementation(async (_place: string, o: { cursor?: string }) => {
    const from = Number(o.cursor ?? 0);
    const items = Array.from({ length: Math.min(100, total - from) }, (_, i) => business(from + i));
    return { items, nextCursor: from + 100 < total ? String(from + 100) : null };
  });
}

it("turns one kind's businesses in a place into pins with their row's href and card", async () => {
  getTaxonomy.mockResolvedValue(taxonomy);
  getPlace.mockResolvedValue(haifa);
  getBusinesses.mockResolvedValue({
    items: [business(1), business(2, "kiryat-haim")],
    nextCursor: null,
  });
  const res = await get(query);
  expect(res.status).toBe(200);
  expect(res.headers.get("cache-control")).toBe("public, max-age=300");
  expect(getBusinesses).toHaveBeenCalledWith("haifa", { kind: "garages", limit: 100 });
  const body = (await res.json()) as { pins: unknown[]; more: boolean };
  expect(body.more).toBe(false);
  expect(body.pins).toEqual([
    {
      key: "haifa/garage-1",
      href: "/en/haifa/auto/garages/garage-1",
      name: "Garage 1",
      lat: 32.8,
      lng: 35,
      card: {
        tagline: "",
        openNow: true,
        hours: { weekly: { sun: [["08:00", "17:00"]] }, exceptions: [] },
        byAppointment: false,
        placeName: null,
        accent: "#8fb3c4",
      },
    },
    expect.objectContaining({
      key: "kiryat-haim/garage-2",
      href: "/en/haifa/auto/garages/kiryat-haim/garage-2",
      card: expect.objectContaining({ placeName: "Kiryat Haim" }),
    }),
  ]);
});

it("follows the pages up to 200 pins and says there were more", async () => {
  serve(340);
  const body = (await (await get(query)).json()) as { pins: unknown[]; more: boolean };
  expect(body.pins).toHaveLength(200);
  expect(body.more).toBe(true);
  expect(getBusinesses).toHaveBeenCalledTimes(2);
});

it("stops at the last page", async () => {
  serve(150);
  const body = (await (await get(query)).json()) as { pins: unknown[]; more: boolean };
  expect(body.pins).toHaveLength(150);
  expect(body.more).toBe(false);
});

it("answers 400 for a bad query, before any API call", async () => {
  for (const q of [
    "locale=fr&place=haifa&kind=garages",
    "locale=he&place=../x&kind=garages",
    "locale=he&place=haifa",
  ])
    expect((await get(q)).status).toBe(400);
  expect(getBusinesses).not.toHaveBeenCalled();
});

it("answers 404 for an unknown place or kind", async () => {
  getTaxonomy.mockResolvedValue(taxonomy);
  getPlace.mockResolvedValue(null);
  expect((await get(query)).status).toBe(404);
  getPlace.mockResolvedValue(haifa);
  getBusinesses.mockResolvedValue(null);
  expect((await get(query)).status).toBe(404);
});

it("answers 503 when the API is down", async () => {
  getTaxonomy.mockRejectedValue(new api.ApiUnavailableError("down"));
  getPlace.mockResolvedValue(haifa);
  expect((await get(query)).status).toBe(503);
});
