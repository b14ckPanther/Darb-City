import { beforeEach, describe, expect, it, vi } from "vitest";
import type { NominatimHit } from "../../join/geocoder.js";
import { Locator, boxAround, distinctParts, type LocatorDeps } from "./locator.js";
import type { KnownNumber } from "./numbers.js";

const road = (lat: number, lng: number, extra: Partial<NominatimHit> = {}): NominatimHit => ({
  point: { lat, lng },
  house: false,
  houseNumber: null,
  road: "שדרות המגינים",
  town: "חיפה",
  area: "עיר תחתית",
  label: "שדרות המגינים, חיפה",
  box: [lat - 0.0007, lng - 0.0015, lat + 0.0007, lng + 0.0015],
  ...extra,
});
const house = (n: string, lat: number, lng: number): NominatimHit =>
  road(lat, lng, { house: true, houseNumber: n, label: `שדרות המגינים ${n}, חיפה` });
const known = (n: number, lat: number, lng: number): KnownNumber => ({
  n,
  suffix: "",
  point: { lat, lng },
});

/** The two parts of שדרות המגינים, as Nominatim answers them (about 350 m apart). */
const PART_A = road(32.820585, 34.992912);
const PART_B = road(32.822154, 34.989556);
/** House numbers OpenStreetMap knows there: 78 by part A, 100 by part B, 27 and 93 far apart. */
const KNOWN = [
  known(78, 32.820958, 34.993502),
  known(100, 32.822116, 34.989936),
  known(27, 32.817908, 34.998488),
  known(93, 32.821144, 34.99096),
];

let deps: LocatorDeps & {
  geocoder: { find: ReturnType<typeof vi.fn> };
  overpass: { numbers: ReturnType<typeof vi.fn> };
  resolveShort: ReturnType<typeof vi.fn>;
};
const locator = () => new Locator(deps);

beforeEach(() => {
  deps = {
    geocoder: { enabled: true, find: vi.fn(async () => []) },
    overpass: { enabled: true, numbers: vi.fn(async () => []) },
    resolveShort: vi.fn(async () => null),
  };
});

describe("links and coordinates come first", () => {
  it("reads a typed lat, lng pair without asking anyone", async () => {
    const r = await locator().locate({ query: "32.8206, 34.9929", locale: "he" });
    expect(r.found).toMatchObject({ precision: "link", point: { lat: 32.8206, lng: 34.9929 } });
    expect(deps.geocoder.find).not.toHaveBeenCalled();
  });

  it("takes a Google Maps place link's own pin and keeps the link", async () => {
    const link =
      "https://www.google.com/maps/place/Falafel/@32.81,34.99,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d32.8207!4d34.9931";
    const r = await locator().locate({ query: link, locale: "he" });
    expect(r.found).toMatchObject({
      precision: "link",
      point: { lat: 32.8207, lng: 34.9931 },
      label: "Falafel",
    });
    expect(r.googleLink).toBe(link);
    expect(deps.geocoder.find).not.toHaveBeenCalled();
  });

  it("follows a short link and keeps the long one", async () => {
    const long = "https://www.google.com/maps/place/Shop/data=!3d32.82!4d34.99";
    deps.resolveShort.mockResolvedValueOnce(long);
    const r = await locator().locate({ query: "https://maps.app.goo.gl/abc123", locale: "ar" });
    expect(deps.resolveShort).toHaveBeenCalledWith("https://maps.app.goo.gl/abc123");
    expect(r.found).toMatchObject({ precision: "link", point: { lat: 32.82, lng: 34.99 } });
    expect(r.googleLink).toBe(long);
  });

  it("keeps the short link when it cannot be followed", async () => {
    const r = await locator().locate({ query: "https://maps.app.goo.gl/abc123", locale: "he" });
    expect(r.found).toBeNull();
    expect(r.reason).toBe("not-found");
    expect(r.googleLink).toBe("https://maps.app.goo.gl/abc123");
  });

  it("reads a Waze link's point", async () => {
    const r = await locator().locate({
      query: "https://waze.com/ul?ll=32.8206,34.9929&navigate=yes",
      locale: "en",
    });
    expect(r.found).toMatchObject({ precision: "link", point: { lat: 32.8206, lng: 34.9929 } });
    expect(r.googleLink).toBeNull();
  });

  it("looks up the name in a Google link that has no point", async () => {
    deps.geocoder.find.mockResolvedValueOnce([PART_A]);
    const r = await locator().locate({
      query: "https://www.google.com/maps/place/שדרות+המגינים+חיפה",
      locale: "he",
    });
    expect(deps.geocoder.find).toHaveBeenCalled();
    expect(r.found?.precision).toBe("street");
    expect(r.googleLink).toMatch(/^https:\/\/www\.google\.com\/maps\/place\//);
  });
});

describe("addresses", () => {
  it("is exact when Nominatim knows the house and its number", async () => {
    deps.geocoder.find.mockResolvedValueOnce([house("68", 32.8209, 34.9934)]);
    const r = await locator().locate({ query: "שדרות המגינים 68, חיפה", locale: "he" });
    expect(r.found).toMatchObject({ precision: "exact", point: { lat: 32.8209, lng: 34.9934 } });
    expect(r.address).toBe("שדרות המגינים 68");
    expect(deps.geocoder.find).toHaveBeenCalledWith(
      { street: "68 שדרות המגינים", city: "חיפה" },
      "he",
      undefined,
    );
    expect(deps.overpass.numbers).not.toHaveBeenCalled();
  });

  it("never calls a house with another number exact", async () => {
    deps.geocoder.find.mockResolvedValueOnce([house("6", 32.8209, 34.9934), PART_A]);
    const r = await locator().locate({ query: "שדרות המגינים 68 חיפה", locale: "he" });
    expect(r.found?.precision).toBe("street");
  });

  it("is exact when OpenStreetMap has the number on the street", async () => {
    deps.geocoder.find.mockResolvedValueOnce([PART_A]);
    deps.overpass.numbers.mockResolvedValueOnce([...KNOWN, known(68, 32.8208, 34.9939)]);
    const r = await locator().locate({ query: "שדרות המגינים 68 חיפה", locale: "he" });
    expect(r.found).toMatchObject({
      precision: "exact",
      point: { lat: 32.8208, lng: 34.9939 },
      label: "שדרות המגינים 68, חיפה",
    });
    expect(deps.overpass.numbers).toHaveBeenCalledWith("שדרות המגינים", expect.any(Array));
  });

  it("places the number between two known ones on its side", async () => {
    deps.geocoder.find.mockResolvedValueOnce([PART_A]);
    deps.overpass.numbers.mockResolvedValueOnce([
      known(64, 32.8205, 34.9925),
      known(72, 32.8207, 34.9933),
      known(67, 32.8203, 34.993),
    ]);
    const r = await locator().locate({ query: "שד' המגינים 68 חיפה", locale: "he" });
    expect(r.found).toMatchObject({ precision: "between", between: ["64", "72"] });
    expect(r.found!.point.lat).toBeCloseTo(32.8206, 6);
    expect(r.found!.point.lng).toBeCloseTo(34.9929, 6);
  });

  it("falls back to the street, nearest part first, with the other part as a choice", async () => {
    // The real case: OpenStreetMap knows 78 and 100 on this side but nothing below 68.
    deps.geocoder.find.mockResolvedValueOnce([PART_B, PART_A, road(32.821588, 34.990708)]);
    deps.overpass.numbers.mockResolvedValueOnce(KNOWN);
    const r = await locator().locate({ query: "שדרות המגינים 68 חיפה", locale: "he" });
    expect(r.found).toMatchObject({
      precision: "street",
      point: PART_A.point,
      near: "78",
    });
    expect(r.alternatives).toHaveLength(1);
    expect(r.alternatives[0]).toMatchObject({
      precision: "street",
      point: PART_B.point,
      near: "100",
    });
  });

  it("uses the business's town when the query names none, and stays near it", async () => {
    const far = road(31.25, 34.79, { town: "באר שבע" });
    deps.geocoder.find.mockResolvedValue([far, road(32.8193, 34.9942, { road: "עין דור" })]);
    const r = await locator().locate({
      query: "עין דור 11",
      locale: "he",
      town: "חיפה",
      near: { lat: 32.794, lng: 34.9896 },
    });
    expect(deps.geocoder.find).toHaveBeenCalledWith({ street: "11 עין דור", city: "חיפה" }, "he", {
      lat: 32.794,
      lng: 34.9896,
    });
    expect(r.found).toMatchObject({ precision: "street", point: { lat: 32.8193, lng: 34.9942 } });
    expect(r.alternatives).toEqual([]);
  });

  it("tries the next spelling, then a free search, before giving up", async () => {
    const r = await locator().locate({ query: "شارع الجبل 5 الناصرة", locale: "ar" });
    expect(deps.geocoder.find.mock.calls.map((c) => c[0])).toEqual([
      { street: "5 شارع الجبل", city: "الناصرة" },
      { street: "5 الجبل", city: "الناصرة" },
      { q: "شارع الجبل 5, الناصرة" },
    ]);
    expect(r).toMatchObject({ found: null, reason: "not-found", address: "شارع الجبل 5" });
  });

  it("is soft when the services fail", async () => {
    deps.geocoder.find.mockResolvedValue(null);
    expect((await locator().locate({ query: "עין דור 11", locale: "he" })).reason).toBe(
      "not-found",
    );
    deps.geocoder.find.mockResolvedValue([PART_A]);
    deps.overpass.numbers.mockRejectedValue(new Error("down"));
    expect(
      (await locator().locate({ query: "שדרות המגינים 68", locale: "he" })).found?.precision,
    ).toBe("street");
  });

  it("says off when there is no geocoder, but still reads links", async () => {
    deps.geocoder.enabled = false;
    expect((await locator().locate({ query: "עין דור 11", locale: "he" })).reason).toBe("off");
    expect((await locator().locate({ query: "32.8, 35.0", locale: "he" })).found?.precision).toBe(
      "link",
    );
  });
});

describe("street parts", () => {
  it("merges pieces closer than 250 m and pads the box", () => {
    expect(distinctParts([PART_A, road(32.8207, 34.993), PART_B])).toHaveLength(2);
    const box = boxAround([PART_A, PART_B])!;
    expect(box[0]).toBeLessThan(PART_A.point.lat);
    expect(box[3]).toBeGreaterThan(PART_A.point.lng);
  });
});
