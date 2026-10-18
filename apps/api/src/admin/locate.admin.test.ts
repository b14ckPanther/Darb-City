import type { INestApplication } from "@nestjs/common";
import type { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN, STRANGER, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import { Geocoder, NOMINATIM_USER_AGENT } from "../join/geocoder.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { BusinessesAdmin } from "./businesses.admin.js";
import { LOCATE_PER_MINUTE, LocateAdmin } from "./locate.admin.js";
import { Overpass } from "./locate/overpass.js";

let app: INestApplication;
let prisma: PrismaService;
let f: Fixtures;
/** Nominatim, Overpass and Google's short links, all fakes: no test reaches the network. */
const nominatim = vi.fn();
const overpass = vi.fn();
const shortLinks = vi.fn();

const ENV = {
  JOIN_GEOCODER: "nominatim",
  NOMINATIM_URL: "https://nominatim.test",
  OVERPASS_URL: "https://overpass.test/api/interpreter",
};

beforeAll(async () => {
  Object.assign(process.env, ENV);
  ({ app, prisma } = await createAdminTestApp());
  for (const k of Object.keys(ENV)) delete process.env[k];
  const geocoder = app.get(Geocoder);
  geocoder.fetchImpl = nominatim as unknown as typeof fetch;
  geocoder.sleep = async () => undefined;
  const osm = app.get(Overpass);
  osm.fetchImpl = overpass as unknown as typeof fetch;
  osm.sleep = async () => undefined;
  app.get(LocateAdmin).fetchImpl = shortLinks as unknown as typeof fetch;
  app.get(BusinessesAdmin).fetchImpl = shortLinks as unknown as typeof fetch;
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  const redis = app.get<Redis>(REDIS);
  const keys = [...(await redis.keys("darb:rl:*")), ...(await redis.keys("darb:locate:*"))];
  if (keys.length) await redis.del(...keys);
  for (const m of [nominatim, overpass, shortLinks]) m.mockReset();
  nominatim.mockResolvedValue(Response.json([]));
  overpass.mockResolvedValue(Response.json({ elements: [] }));
  shortLinks.mockResolvedValue(new Response(null, { status: 404 }));
});
afterAll(() => app.close());

const http = () => request(app.getHttpServer());
const locate = (body: object, auth = ADMIN) =>
  http().post("/admin/locate").set("authorization", auth).send(body);

/** One of Nominatim's jsonv2 answers. */
const place = (o: {
  lat: number;
  lon: number;
  type?: string;
  road?: string;
  house?: string;
  box?: [number, number, number, number];
}) => ({
  lat: String(o.lat),
  lon: String(o.lon),
  addresstype: o.type ?? "road",
  category: o.type === "house" ? "place" : "highway",
  type: o.type ?? "tertiary",
  display_name: "x",
  address: {
    road: o.road ?? "שדרות המגינים",
    ...(o.house ? { house_number: o.house } : {}),
    neighbourhood: "עיר תחתית",
    city: "סח'נין",
  },
  boundingbox: (o.box ?? [o.lat - 0.001, o.lat + 0.001, o.lon - 0.002, o.lon + 0.002]).map(String),
});

describe("POST /admin/locate is for admins", () => {
  it("401 without a token, 403 for a non-admin", async () => {
    expect((await http().post("/admin/locate").send({ query: "x", locale: "he" })).status).toBe(
      401,
    );
    expect((await locate({ query: "x", locale: "he" }, STRANGER)).status).toBe(403);
    expect(nominatim).not.toHaveBeenCalled();
  });

  it("400 for a body that does not parse", async () => {
    expect((await locate({ query: "", locale: "he" })).status).toBe(400);
    expect((await locate({ query: "x", locale: "fr" })).status).toBe(400);
  });
});

describe("finding the place", () => {
  it("asks Nominatim politely, near the business's town, and answers exact for the house", async () => {
    nominatim.mockResolvedValueOnce(
      Response.json([place({ lat: 32.8641, lon: 35.3031, type: "house", house: "68" })]),
    );
    const res = await locate({ query: "שדרות המגינים 68", placeSlug: "sakhnin", locale: "he" });
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body).toMatchObject({
      found: { precision: "exact", point: { lat: 32.8641, lng: 35.3031 } },
      address: "שדרות המגינים 68",
      googleLink: null,
    });
    const [url, init] = nominatim.mock.calls[0] as [string, RequestInit];
    const u = new URL(url);
    expect(u.origin + u.pathname).toBe("https://nominatim.test/search");
    expect(u.searchParams.get("street")).toBe("68 שדרות המגינים");
    expect(u.searchParams.get("city")).toBe("סח'נין");
    expect(u.searchParams.get("countrycodes")).toBe("il");
    expect(u.searchParams.get("viewbox")).toBeTruthy();
    expect((init.headers as Record<string, string>)["user-agent"]).toBe(NOMINATIM_USER_AGENT);
  });

  it("places a number between known ones from Overpass, and caches Overpass for a day", async () => {
    const street = place({ lat: 32.8638, lon: 35.3023 });
    nominatim.mockResolvedValue(Response.json([street]));
    overpass.mockResolvedValue(
      Response.json({
        elements: [
          {
            type: "node",
            lat: 32.8637,
            lon: 35.302,
            tags: { "addr:street": "שדרות המגינים", "addr:housenumber": "64" },
          },
          {
            type: "way",
            center: { lat: 32.8639, lon: 35.3028 },
            tags: { "addr:street": "שד' המגינים", "addr:housenumber": "70,72" },
          },
          {
            type: "node",
            lat: 32.8638,
            lon: 35.3023,
            tags: { "addr:street": "הרצל", "addr:housenumber": "68" },
          },
        ],
      }),
    );
    const first = await locate({ query: "שדרות המגינים 68", placeSlug: "sakhnin", locale: "he" });
    expect(first.body.found).toMatchObject({ precision: "between", between: ["64", "70"] });
    expect(overpass).toHaveBeenCalledTimes(1);
    const [url, init] = overpass.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://overpass.test/api/interpreter");
    expect(decodeURIComponent(String(init.body))).toMatch(/nwr\["addr:housenumber"\]\(32\.86/);
    const ttl = await app
      .get<Redis>(REDIS)
      .ttl((await app.get<Redis>(REDIS).keys("darb:locate:osm:*"))[0]!);
    expect(ttl).toBeGreaterThan(86_000);
    await locate({ query: "שדרות המגינים 68", placeSlug: "sakhnin", locale: "he" });
    expect(overpass).toHaveBeenCalledTimes(1);
  });

  it("answers the street with its other parts when nothing closer is known", async () => {
    nominatim.mockResolvedValueOnce(
      Response.json([place({ lat: 32.8638, lon: 35.3023 }), place({ lat: 32.8668, lon: 35.3053 })]),
    );
    const res = await locate({ query: "שדרות המגינים 68", placeSlug: "sakhnin", locale: "he" });
    expect(res.body.found).toMatchObject({ precision: "street" });
    expect(res.body.alternatives).toHaveLength(1);
  });

  it("never fails loudly: Nominatim and Overpass down is not-found or the street", async () => {
    nominatim.mockRejectedValue(new Error("down"));
    const res = await locate({ query: "עין דור 11", town: "חיפה", locale: "he" });
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ found: null, reason: "not-found" });
    nominatim.mockResolvedValue(
      Response.json([place({ lat: 32.8194, lon: 34.9943, road: "עין דור" })]),
    );
    overpass.mockResolvedValue(new Response("busy", { status: 429 }));
    const street = await locate({ query: "עין דור 11", town: "חיפה", locale: "he" });
    expect(street.body.found).toMatchObject({ precision: "street" });
  });

  it("follows a short Google Maps link to its pin", async () => {
    shortLinks.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://www.google.com/maps/place/Shop/data=!3d32.8641!4d35.3031" },
      }),
    );
    const res = await locate({ query: "https://maps.app.goo.gl/abc", locale: "en" });
    expect(res.body).toMatchObject({
      found: { precision: "link", point: { lat: 32.8641, lng: 35.3031 } },
      googleLink: "https://www.google.com/maps/place/Shop/data=!3d32.8641!4d35.3031",
    });
    expect(nominatim).not.toHaveBeenCalled();
  });

  it(`stops one admin after ${LOCATE_PER_MINUTE} searches a minute, softly`, async () => {
    for (let i = 0; i < LOCATE_PER_MINUTE; i++)
      expect((await locate({ query: "32.8, 35.0", locale: "he" })).body.reason).toBeUndefined();
    const res = await locate({ query: "32.8, 35.0", locale: "he" });
    expect([res.status, res.body.reason, res.body.found]).toEqual([200, "busy", null]);
  });
});

describe("the Google Maps link on a business", () => {
  const draft = (google: string) => ({
    slug: "fade-lab",
    placeId: f.sakhnin.id,
    name: { ar: "فيد لاب" },
    tagline: { ar: "قص شعر" },
    address: { ar: "سخنين" },
    primaryKindId: f.barbershops.id,
    kindIds: [],
    lat: 32.864,
    lng: 35.302,
    phone: null,
    whatsapp: null,
    website: null,
    hours: { weekly: {}, exceptions: [] },
    attributes: {},
    experience: {},
    tier: "basic",
    apps: {},
    links: { google },
  });

  it("keeps a short link as the long one it opens", async () => {
    shortLinks.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://www.google.com/maps/place/Fade+Lab/data=!3d32.864!4d35.302" },
      }),
    );
    const res = await http()
      .post("/admin/businesses")
      .set("authorization", ADMIN)
      .send(draft("https://maps.app.goo.gl/xyz"));
    expect(res.status).toBe(201);
    expect(res.body.links.google).toBe(
      "https://www.google.com/maps/place/Fade+Lab/data=!3d32.864!4d35.302",
    );
    const got = await http().get(`/admin/businesses/${res.body.id}`).set("authorization", ADMIN);
    expect(got.body.links.google).toBe(res.body.links.google);
  });

  it("keeps the short link when it does not resolve, clears it, and refuses other hosts", async () => {
    const res = await http()
      .post("/admin/businesses")
      .set("authorization", ADMIN)
      .send(draft("https://maps.app.goo.gl/xyz"));
    expect(res.body.links.google).toBe("https://maps.app.goo.gl/xyz");
    const cleared = await http()
      .patch(`/admin/businesses/${res.body.id}`)
      .set("authorization", ADMIN)
      .send({ links: {} });
    expect(cleared.body.links.google).toBeUndefined();
    const bad = await http()
      .patch(`/admin/businesses/${res.body.id}`)
      .set("authorization", ADMIN)
      .send({ links: { google: "https://evil.example/maps/place/x" } });
    expect(bad.status).toBe(400);
  });
});
