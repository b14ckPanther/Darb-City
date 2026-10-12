// @vitest-environment node
import { afterEach, expect, it, vi } from "vitest";

const getBusinesses = vi.fn();
const getPlace = vi.fn();
const getPlaces = vi.fn();
const getTaxonomy = vi.fn();
vi.mock("@/lib/api", () => ({
  ApiUnavailableError: class extends Error {},
  ApiBadRequestError: class ApiBadRequestError extends Error {},
  getBusinesses,
  getPlace,
  getPlaces,
  getTaxonomy,
}));
const api = await import("@/lib/api");
const { GET } = await import("./route");

afterEach(() => vi.resetAllMocks());

const get = (query: string) => GET(new Request(`http://web.test/api/businesses?${query}`));
const query = "locale=en&place=sakhnin&kind=nails&cursor=abc";

it("answers 400 when the API rejects the cursor", async () => {
  getBusinesses.mockRejectedValue(new api.ApiBadRequestError("bad cursor"));
  getTaxonomy.mockResolvedValue({ sectors: [] });
  getPlace.mockResolvedValue({ slug: "sakhnin", name: { he: "x" }, ancestors: [] });
  expect((await get(query)).status).toBe(400);
});

it("answers 404 when the place or kind is unknown", async () => {
  getBusinesses.mockResolvedValue(null);
  getTaxonomy.mockResolvedValue({ sectors: [] });
  getPlace.mockResolvedValue(null);
  expect((await get(query)).status).toBe(404);
});

it("answers 503 when the API is down", async () => {
  getBusinesses.mockRejectedValue(new api.ApiUnavailableError("down"));
  getTaxonomy.mockResolvedValue({ sectors: [] });
  getPlace.mockResolvedValue(null);
  expect((await get(query)).status).toBe(503);
});
