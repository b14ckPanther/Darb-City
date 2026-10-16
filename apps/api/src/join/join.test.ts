import type { INestApplication } from "@nestjs/common";
import type { Redis } from "ioredis";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import { loadConfig } from "../config.js";
import { MediaStore, toWebp } from "../media/media.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { Geocoder, NOMINATIM_USER_AGENT } from "./geocoder.js";
import { JoinService, slugBase } from "./join.service.js";
import { LOOKUP_AI, parseFindings, type AiFindings } from "./lookup-ai.js";

let app: INestApplication;
let prisma: PrismaService;
let revalidate: Mock;
let notify: Mock;
let f: Fixtures;
let ipCount = 0;
/** R2 as a map of key to bytes; every signed request lands here. */
const bucket = new Map<string, number>();
const r2 = vi.fn(async (req: Request) => {
  const key = new URL(req.url).pathname.replace(/^\/darb-media\//, "");
  if (req.method === "PUT") {
    bucket.set(key, (await req.arrayBuffer()).byteLength);
    return new Response(null, { status: 200 });
  }
  if (req.method === "HEAD") return new Response(null, { status: bucket.has(key) ? 200 : 404 });
  if (req.method === "DELETE") {
    bucket.delete(key);
    return new Response(null, { status: 204 });
  }
  return new Response(null, { status: 400 });
});
const nominatim = vi.fn();
const shortLinks = vi.fn();
const ai = { name: "fake", find: vi.fn<(...a: unknown[]) => Promise<AiFindings | null>>() };

const ENV = {
  SEARCH_PROXY_KEY: "proxy-key",
  JOIN_GEOCODER: "nominatim",
  NOMINATIM_URL: "https://nominatim.test",
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  JOIN_LOOKUPS_PER_DAY: "4",
};

beforeAll(async () => {
  Object.assign(process.env, ENV);
  ({ app, prisma, revalidate, notify } = await createAdminTestApp((b) =>
    b.overrideProvider(LOOKUP_AI).useValue(ai),
  ));
  for (const k of Object.keys(ENV)) delete process.env[k];
  app.get(MediaStore).fetchImpl = r2 as unknown as typeof fetch;
  const geocoder = app.get(Geocoder);
  geocoder.fetchImpl = nominatim as unknown as typeof fetch;
  geocoder.sleep = async () => undefined;
  app.get(JoinService).fetchImpl = shortLinks as unknown as typeof fetch;
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  const redis = app.get<Redis>(REDIS);
  const keys = [...(await redis.keys("darb:rl:*")), ...(await redis.keys("darb:join:*"))];
  if (keys.length) await redis.del(...keys);
  bucket.clear();
  for (const m of [r2, nominatim, shortLinks, ai.find, revalidate, notify]) m.mockClear();
  nominatim.mockReset();
  nominatim.mockResolvedValue(Response.json([]));
  ai.find.mockReset();
  ai.find.mockResolvedValue(null);
  ai.name = "fake";
});
afterAll(() => app.close());

const http = () => request(app.getHttpServer());
const visitor = (ip = `10.7.0.${++ipCount}`) => ({
  "x-darb-proxy-key": "proxy-key",
  "x-darb-client-ip": ip,
});
const lookup = (body: object, ip?: string) =>
  http().post("/join/lookup").set(visitor(ip)).send(body);

const findings = (patch: Partial<AiFindings> = {}): AiFindings => ({
  found: true,
  excluded: false,
  category: "barbershop",
  name: { he: null, ar: "صالون أبو سمير", en: "Abu Samir Salon" },
  kind: "barbershops",
  town: "Sakhnin",
  address: "Main St 10",
  phone: "04-674-1234",
  whatsapp: "not a phone",
  website: "abusamir.co.il",
  instagram: "@abusamir",
  facebook: null,
  tiktok: null,
  hours: { "0": [{ open: "09:00", close: "19:00" }] },
  description: { he: null, ar: "صالون حلاقة بسخنين.", en: null },
  sources: ["https://www.instagram.com/abusamir/", "http://insecure.example/"],
  ...patch,
});

const reverse = {
  lat: "32.8638",
  lon: "35.3023",
  display_name: "x",
  address: { road: "Main St", house_number: "10", city: "Sakhnin" },
};

describe("POST /join/lookup", () => {
  it("reads a map link, asks OpenStreetMap for the address and the model for the rest", async () => {
    nominatim.mockResolvedValueOnce(Response.json(reverse));
    ai.find.mockResolvedValueOnce(findings());
    const res = await lookup({
      url: "https://www.google.com/maps/place/Abu+Samir/@32.86,35.30,17z/data=!3d32.8638!4d35.3023",
      locale: "ar",
    });
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      found: true,
      point: { lat: 32.8638, lng: 35.3023 },
      address: "Main St 10, Sakhnin",
      placeSlug: "sakhnin",
      kindSlug: "barbershops",
      name: { ar: "صالون أبو سمير", en: "Abu Samir Salon" },
      phone: "04-674-1234",
      website: "https://abusamir.co.il/",
      links: { instagram: "https://www.instagram.com/abusamir/" },
      hours: { weekly: { "0": [{ open: "09:00", close: "19:00" }] }, exceptions: [] },
      description: { ar: "صالون حلاقة بسخنين." },
      sources: ["https://www.instagram.com/abusamir/"],
      osm: true,
    });
    const [url, init] = nominatim.mock.calls[0] as [string, RequestInit];
    expect(url).toMatch(/^https:\/\/nominatim\.test\/reverse\?/);
    expect(url).toContain("accept-language=ar");
    expect((init.headers as Record<string, string>)["user-agent"]).toBe(NOMINATIM_USER_AGENT);
    const asked = ai.find.mock.calls[0]![0] as { query: string; town: string; kinds: string[] };
    expect([asked.query, asked.town]).toEqual(["Abu Samir", "Sakhnin"]);
    expect(asked.kinds).toContain("barbershops: Barbershops");
    expect(asked.kinds.join()).not.toContain("hidden-kind");
  });

  it("follows a short link and finds the point from a name with the model off", async () => {
    ai.name = "off";
    shortLinks.mockResolvedValueOnce(
      new Response(null, {
        status: 302,
        headers: { location: "https://www.google.com/maps?q=32.8638,35.3023" },
      }),
    );
    nominatim.mockResolvedValueOnce(Response.json({ error: "Unable to geocode" }));
    const res = await lookup({ url: "https://maps.app.goo.gl/xyz", locale: "he" });
    expect(res.body).toMatchObject({ found: true, placeSlug: "sakhnin", osm: false });
    expect(ai.find).not.toHaveBeenCalled();

    nominatim.mockResolvedValueOnce(Response.json([reverse]));
    const named = await lookup({ query: "Abu Samir Sakhnin", locale: "en" });
    expect(named.body).toMatchObject({
      found: true,
      point: { lat: 32.8638, lng: 35.3023 },
      placeSlug: "sakhnin",
      osm: true,
    });
    expect(nominatim.mock.calls.at(-1)![0]).toContain("countrycodes=il");
  });

  it("answers off when nothing is found without the model, none when the model found nothing", async () => {
    ai.name = "off";
    expect((await lookup({ query: "Nowhere", locale: "he" })).body).toEqual({
      found: false,
      reason: "off",
      sources: [],
      osm: false,
    });
    ai.name = "fake";
    ai.find.mockResolvedValueOnce(findings({ found: false }));
    expect((await lookup({ query: "Nowhere", locale: "he" })).body.reason).toBe("none");
  });

  it("stops at the day's model budget", async () => {
    for (let i = 0; i < 4; i++) await lookup({ query: "Somewhere", locale: "he" });
    expect(ai.find).toHaveBeenCalledTimes(4);
    const fifth = await lookup({ query: "Somewhere", locale: "he" });
    expect(fifth.body.reason).toBe("off");
    expect(ai.find).toHaveBeenCalledTimes(4);
  });

  it("refuses kinds of business Darb does not list", async () => {
    ai.find.mockResolvedValueOnce(findings({ excluded: true }));
    expect((await lookup({ query: "x", locale: "en" })).body).toMatchObject({
      found: false,
      reason: "excluded",
    });
    ai.find.mockResolvedValueOnce(findings({ category: "wine bar" }));
    expect((await lookup({ query: "x", locale: "en" })).body.reason).toBe("excluded");
  });

  it("survives a failing model and drops an unknown kind", async () => {
    ai.find.mockRejectedValueOnce(new Error("timeout"));
    nominatim.mockResolvedValueOnce(Response.json([reverse]));
    expect((await lookup({ query: "x", locale: "en" })).body.found).toBe(true);
    ai.find.mockResolvedValueOnce(findings({ kind: "space-travel" }));
    expect((await lookup({ query: "x", locale: "en" })).body).not.toHaveProperty("kindSlug");
  });

  it("limits each visitor per hour and refuses an empty lookup", async () => {
    for (let i = 0; i < 6; i++)
      expect((await lookup({ query: "x", locale: "he" }, "10.6.0.1")).status).toBe(200);
    expect((await lookup({ query: "x", locale: "he" }, "10.6.0.1")).status).toBe(429);
    expect((await lookup({ locale: "he" })).status).toBe(400);
  });
});

describe("the model's answer", () => {
  it("keeps the good fields when one is bad", () => {
    const parsed = parseFindings({ ...findings(), hours: { "9": "always" }, sources: ["nope"] });
    expect(parsed).toMatchObject({ found: true, kind: "barbershops", hours: null, sources: [] });
    expect(parseFindings("text")).toBeNull();
  });
});

const png = () =>
  sharp({ create: { width: 2400, height: 1200, channels: 3, background: "#d9a54c" } })
    .withMetadata({ exif: { IFD0: { Copyright: "secret" } } })
    .jpeg()
    .toBuffer();

const upload = (body: Buffer, variant?: string, ip?: string) =>
  http()
    .post(`/join/photos${variant ? `?variant=${variant}` : ""}`)
    .set(visitor(ip))
    .set("content-type", "application/octet-stream")
    .send(body);

describe("POST /join/photos", () => {
  it("stores a resized WebP under pending/ and answers its key and URL", async () => {
    const res = await upload(await png());
    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^pending\/[0-9a-f-]{36}\.webp$/);
    expect(res.body.url).toBe(`https://media.darb.co.il/${res.body.key}`);
    expect(bucket.has(res.body.key)).toBe(true);
    const put = r2.mock.calls[0]![0] as Request;
    expect(put.url).toBe(`https://acct.r2.cloudflarestorage.com/darb-media/${res.body.key}`);
    expect(put.headers.get("authorization")).toMatch(/^AWS4-HMAC-SHA256/);
  });

  it("shrinks, strips metadata, and makes logos smaller", async () => {
    const photo = sharp((await toWebp(await png(), "photo"))!);
    const meta = await photo.metadata();
    expect([meta.format, meta.width, meta.height, meta.exif]).toEqual([
      "webp",
      1600,
      800,
      undefined,
    ]);
    const logo = await sharp((await toWebp(await png(), "logo"))!).metadata();
    expect(logo.width).toBe(512);
  });

  it("refuses what is not an image, and anything over 8 MB", async () => {
    expect((await upload(Buffer.from("<svg onload=alert(1)>"))).status).toBe(400);
    expect((await upload(Buffer.from("%PDF-1.7 ..."))).status).toBe(400);
    expect((await upload(Buffer.alloc(8 * 1024 * 1024 + 1))).status).toBe(413);
    expect(bucket.size).toBe(0);
  });

  it("is off without R2", () => {
    expect(new MediaStore(loadConfig({ DATABASE_URL: "postgresql://a/b" })).enabled).toBe(false);
  });

  it("says what the form can offer", async () => {
    expect((await http().get("/join/status")).body).toEqual({ uploads: true, lookup: true });
  });
});

const form = (patch: object = {}) => ({
  name: { ar: "صالون أبو سمير" },
  kindSlug: "barbershops",
  placeSlug: "sakhnin",
  lat: 32.8638,
  lng: 35.3023,
  phone: "04-674-1234",
  whatsapp: "050-123-4567",
  website: "abusamir.co.il",
  links: { instagram: "@abusamir" },
  hours: { weekly: { "0": [{ open: "09:00", close: "19:00" }] }, exceptions: [] },
  cardStyle: { accent: "#5fb3a8", icons: "solid" },
  owner: { name: "Samir", phone: "050-123-4567", email: "samir@example.com" },
  note: "Call after 5",
  source: "lookup",
  lookup: { found: true, kindSlug: "barbershops", sources: [], osm: false },
  locale: "ar",
  ...patch,
});
const submit = (body: object, ip?: string) => http().post("/join").set(visitor(ip)).send(body);

describe("POST /join", () => {
  it("keeps a draft business and a pending request, with only real photo keys", async () => {
    const photo = (await upload(await png())).body.key as string;
    const logo = (await upload(await png(), "logo")).body.key as string;
    const ghost = "pending/0190a000-0000-4000-8000-000000000009.webp";
    const res = await submit(form({ photos: [photo, ghost], logo }));
    expect([res.status, res.body]).toEqual([201, { ok: true }]);
    const b = await prisma.business.findFirstOrThrow({
      where: { source: "self" },
      include: { kinds: true },
    });
    expect(b).toMatchObject({
      slug: "salwn-abw-smyr",
      status: "draft",
      tier: "basic",
      placeId: f.sakhnin.id,
      primaryKindId: f.barbershops.id,
      website: "https://abusamir.co.il/",
      links: { instagram: "https://www.instagram.com/abusamir/" },
      logo: { key: logo },
      photos: [{ key: photo, alt: { ar: "صالون أبو سمير" } }],
      cardStyle: { accent: "#5fb3a8", icons: "solid" },
      tagline: { en: "Barbershops" },
      address: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" },
    });
    expect(b.kinds.map((k) => k.kindId)).toEqual([f.barbershops.id]);
    const r = await prisma.joinRequest.findFirstOrThrow();
    expect(r).toMatchObject({
      businessId: b.id,
      ownerName: "Samir",
      ownerEmail: "samir@example.com",
      note: "Call after 5",
      source: "lookup",
      status: "pending",
      locale: "ar",
    });
    expect(r.ipHash).toMatch(/^[0-9a-f]{32}$/);
    // A draft is nowhere public.
    expect((await http().get(`/places/sakhnin/businesses/${b.slug}`)).status).toBe(404);
    const list = await http().get("/places/sakhnin/businesses");
    expect(list.body.items.map((i: { slug: string }) => i.slug)).not.toContain(b.slug);
  });

  it("gives a second business with the same name its own address", async () => {
    await submit(form());
    await submit(form({ name: { ar: "صالون أبو سمير", en: "  " } }));
    const slugs = (await prisma.business.findMany({ where: { source: "self" } })).map(
      (b) => b.slug,
    );
    expect(slugs.sort()).toEqual(["salwn-abw-smyr", "salwn-abw-smyr-2"]);
  });

  it("answers a filled honeypot like anyone else and keeps nothing", async () => {
    expect((await submit(form({ website2: "https://spam.example" }))).status).toBe(201);
    expect(await prisma.joinRequest.count()).toBe(0);
  });

  it("refuses unknown towns and kinds, hidden kinds and bad forms", async () => {
    expect((await submit(form({ placeSlug: "atlantis" }))).status).toBe(400);
    expect((await submit(form({ kindSlug: "hidden-kind" }))).status).toBe(400);
    expect((await submit(form({ placeSlug: "israel" }))).status).toBe(400);
    expect((await submit(form({ owner: { name: "Samir" } }))).status).toBe(400);
    expect(await prisma.business.count({ where: { source: "self" } })).toBe(0);
  });

  it("limits each visitor to three forms an hour", async () => {
    for (let i = 0; i < 3; i++) expect((await submit(form(), "10.5.0.1")).status).toBe(201);
    expect((await submit(form(), "10.5.0.1")).status).toBe(429);
  });
});

describe("the admin queue", () => {
  const as = <T extends request.Test>(t: T) => t.set("authorization", ADMIN);

  it("lists pending first with the count, approves (publishes) and rejects (deletes)", async () => {
    const photo = (await upload(await png())).body.key as string;
    await submit(form({ name: { en: "First" } }));
    await submit(form({ name: { en: "Second" }, photos: [photo] }));
    const list = await as(http().get("/admin/join-requests"));
    expect(list.status).toBe(200);
    expect(list.headers["cache-control"]).toBe("no-store");
    expect(list.body.newCount).toBe(2);
    const [second, first] = list.body.items;
    expect([second.businessName, first.businessName]).toEqual([{ en: "Second" }, { en: "First" }]);
    expect(second).not.toHaveProperty("ipHash");
    expect(second.placeSlug).toBe("sakhnin");

    const approved = await as(http().post(`/admin/join-requests/${first.id}/approve`).send({}));
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe("approved");
    const live = await prisma.business.findUniqueOrThrow({ where: { id: first.businessId } });
    expect(live.status).toBe("published");
    expect(notify).toHaveBeenCalledWith("business", [first.businessId]);
    expect(revalidate).toHaveBeenCalled();
    expect((await http().get(`/places/sakhnin/businesses/${live.slug}`)).status).toBe(200);
    expect(
      (await as(http().post(`/admin/join-requests/${first.id}/approve`).send({}))).status,
    ).toBe(409);

    const rejected = await as(
      http().post(`/admin/join-requests/${second.id}/reject`).send({ reason: "Not a business" }),
    );
    expect(rejected.body).toMatchObject({
      status: "rejected",
      rejectReason: "Not a business",
      businessId: null,
      businessName: { en: "Second" },
    });
    expect(await prisma.business.count({ where: { id: second.businessId } })).toBe(0);
    expect(bucket.has(photo)).toBe(false);
    const audit = await prisma.auditLog.findMany({ where: { entityId: second.businessId } });
    expect(audit.map((a) => a.action)).toEqual(["delete"]);

    const pending = await as(http().get("/admin/join-requests?status=pending"));
    expect([pending.body.items.length, pending.body.newCount]).toEqual([0, 0]);
    expect((await as(http().get(`/admin/join-requests/${second.id}`))).body.status).toBe(
      "rejected",
    );
    expect((await http().get("/admin/join-requests")).status).toBe(401);
  });
});

describe("slugs", () => {
  it("prefer English, then the owner's letters, and never a reserved word", () => {
    expect(slugBase({ en: "Abu Samir", ar: "أبو سمير" })).toBe("abu-samir");
    expect(slugBase({ he: "מספרת שלום" })).toBe("msprt-shlvm");
    expect(slugBase({ en: "Contact" })).toBe("contact-biz");
    expect(slugBase({ en: "!!!" })).toBe("business");
  });
});
