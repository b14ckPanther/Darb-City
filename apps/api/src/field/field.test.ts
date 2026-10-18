import type { INestApplication } from "@nestjs/common";
import type Anthropic from "@anthropic-ai/sdk";
import type { Redis } from "ioredis";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { ADMIN, STRANGER, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import { loadConfig } from "../config.js";
import { MediaStore } from "../media/media.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { phoneKey, similarNames } from "./similar.js";
import {
  AnthropicSignReader,
  FakeSignReader,
  READ_TOOL,
  SIGN_READER,
  parseReading,
  readSystemPrompt,
  signReaderFor,
  type SignReading,
} from "./sign-reader.js";

let app: INestApplication;
let prisma: PrismaService;
let f: Fixtures;
let jpeg: Buffer;
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
const reader = { name: "fake", read: vi.fn<(...a: unknown[]) => Promise<SignReading | null>>() };

const ENV = {
  R2_ACCOUNT_ID: "acct",
  R2_ACCESS_KEY_ID: "key",
  R2_SECRET_ACCESS_KEY: "secret",
  FIELD_READS_PER_DAY: "3",
};

beforeAll(async () => {
  Object.assign(process.env, ENV);
  ({ app, prisma } = await createAdminTestApp((b) =>
    b.overrideProvider(SIGN_READER).useValue(reader),
  ));
  for (const k of Object.keys(ENV)) delete process.env[k];
  app.get(MediaStore).fetchImpl = r2 as unknown as typeof fetch;
  jpeg = await sharp({
    create: { width: 40, height: 30, channels: 3, background: { r: 200, g: 120, b: 40 } },
  })
    .jpeg()
    .toBuffer();
});
beforeEach(async () => {
  await resetDatabase(prisma);
  f = await seedFixtures(prisma);
  const redis = app.get<Redis>(REDIS);
  const keys = [...(await redis.keys("darb:field:*")), ...(await redis.keys("darb:model:*"))];
  if (keys.length) await redis.del(...keys);
  bucket.clear();
  r2.mockClear();
  reader.read.mockReset();
  reader.read.mockResolvedValue(null);
  reader.name = "fake";
});
afterAll(() => app.close());

const http = () => request(app.getHttpServer());
const image = (path: string, auth = ADMIN) =>
  http()
    .post(path)
    .set("authorization", auth)
    .set("content-type", "application/octet-stream")
    .send(jpeg);

const reading = (patch: Partial<SignReading> = {}): SignReading => ({
  sign: true,
  excluded: false,
  category: "barbershop",
  name: { he: null, ar: "صالون أبو سمير", en: "Abu Samir Salon" },
  phone: "04-674-1234",
  kind: "barbershops",
  confidence: 0.8,
  ...patch,
});

const capture = (patch: Record<string, unknown> = {}) => ({
  clientId: "0190a000-0000-7000-8000-000000000001",
  name: { ar: "صالون أبو سمير", en: "Abu Samir Salon" },
  phone: "04-674-1234",
  kindSlug: "barbershops",
  lat: 32.8641,
  lng: 35.3031,
  accuracy: 12,
  locale: "en",
  ...patch,
});

describe("guards", () => {
  it.each(["/admin/field/photo", "/admin/field/read"])("%s needs an admin", async (path) => {
    expect((await http().post(path).send(jpeg)).status).toBe(401);
    expect((await image(path, STRANGER)).status).toBe(403);
  });
});

describe("parseReading", () => {
  it("drops a bad field, never the reading", () => {
    const out = parseReading({
      ...reading(),
      phone: 12345,
      confidence: 7,
      name: { he: "  ", ar: 3, en: "Abu Samir" },
      kind: "x".repeat(200),
    });
    expect(out).toEqual({
      sign: true,
      excluded: false,
      category: "barbershop",
      name: { he: null, ar: null, en: "Abu Samir" },
      phone: null,
      kind: "x".repeat(60),
      confidence: null,
    });
    expect(parseReading("nope")).toBeNull();
    expect(parseReading({})).toMatchObject({ sign: false, excluded: false, name: { en: null } });
  });
});

describe("AnthropicSignReader", () => {
  const client = (content: unknown[]) => {
    const create = vi.fn(async () => ({
      content,
      stop_reason: "tool_use",
      usage: { input_tokens: 10, output_tokens: 5, cache_read_input_tokens: 0 },
    }));
    return { create, client: { messages: { create } } as unknown as Pick<Anthropic, "messages"> };
  };

  it("sends the image with the kinds as a cached system prefix and validates the answer", async () => {
    const fake = client([
      { type: "tool_use", id: "t1", name: READ_TOOL.name, input: { ...reading(), phone: null } },
    ]);
    const ai = new AnthropicSignReader(fake.client, "claude-sonnet-5-5");
    const kinds = ["barbershops: Barbershops"];
    const out = await ai.read({ image: Buffer.from("img"), kinds }, AbortSignal.timeout(1000));
    expect(out).toMatchObject({ sign: true, phone: null, kind: "barbershops" });
    const [body] = fake.create.mock.calls[0] as unknown as [Anthropic.MessageCreateParams];
    expect(body.model).toBe("claude-sonnet-5-5");
    expect(body.tool_choice).toEqual({ type: "auto", disable_parallel_tool_use: true });
    expect(body.system).toEqual([
      { type: "text", text: readSystemPrompt(kinds), cache_control: { type: "ephemeral" } },
    ]);
    const content = (body.messages[0]!.content as Anthropic.ContentBlockParam[])[0];
    expect(content).toEqual({
      type: "image",
      source: {
        type: "base64",
        media_type: "image/webp",
        data: Buffer.from("img").toString("base64"),
      },
    });
    // The same kinds give the very same system blocks: the cached prefix never changes.
    await ai.read({ image: Buffer.from("x"), kinds: [...kinds] }, AbortSignal.timeout(1000));
    const [again] = fake.create.mock.calls[1] as unknown as [Anthropic.MessageCreateParams];
    expect(again.system).toBe(body.system);
  });

  it("answers null when the model calls no tool", async () => {
    const ai = new AnthropicSignReader(client([{ type: "text", text: "hi" }]).client, "m");
    expect(
      await ai.read({ image: Buffer.from(""), kinds: [] }, AbortSignal.timeout(1000)),
    ).toBeNull();
  });

  it("is off without a key, and fake only when asked", () => {
    expect(signReaderFor({ ai: "anthropic", model: "m", timeoutMs: 1000, apiKey: null }).name).toBe(
      "off",
    );
    expect(signReaderFor({ ai: "fake", model: "m", timeoutMs: 1000, apiKey: null })).toBeInstanceOf(
      FakeSignReader,
    );
    expect(() =>
      loadConfig({
        DATABASE_URL: "postgres://x/y",
        NODE_ENV: "production",
        FIELD_AI: "fake",
        SEARCH_PROXY_KEY: "k".repeat(40),
        IP_HASH_SALT: "s".repeat(40),
      }),
    ).toThrow(/FIELD_AI=fake/);
    expect(loadConfig({ DATABASE_URL: "postgres://x/y" }).field).toMatchObject({
      ai: "off",
      model: "claude-sonnet-5-5",
      readsPerDay: 200,
    });
  });
});

describe("POST /admin/field/read", () => {
  it("reads the sign; an unknown kind and a bad phone are dropped", async () => {
    reader.read.mockResolvedValueOnce(reading({ kind: "spaceships", phone: "call us" }));
    const res = await image("/admin/field/read");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      reading: {
        name: { he: null, ar: "صالون أبو سمير", en: "Abu Samir Salon" },
        phone: null,
        kindSlug: null,
        confidence: 0.8,
      },
    });
    const [req] = reader.read.mock.calls[0] as [{ image: Buffer; kinds: string[] }];
    expect(req.kinds).toContain("barbershops: Barbershops");
    expect(req.kinds.some((k) => k.startsWith("hidden-kind"))).toBe(false);
    // The model gets the metadata-free WebP, never the original upload.
    expect((await sharp(req.image).metadata()).format).toBe("webp");
  });

  it("says why there is no reading: off, unreadable, excluded, then the day's budget", async () => {
    reader.name = "off";
    expect((await image("/admin/field/read")).body).toEqual({ reading: null, reason: "off" });
    reader.name = "fake";
    reader.read.mockRejectedValueOnce(new Error("timeout"));
    expect((await image("/admin/field/read")).body).toEqual({
      reading: null,
      reason: "unreadable",
    });
    reader.read.mockResolvedValueOnce(reading({ category: "liquor store" }));
    expect((await image("/admin/field/read")).body).toEqual({ reading: null, reason: "excluded" });
    reader.read.mockResolvedValueOnce(reading({ sign: false }));
    expect((await image("/admin/field/read")).body).toEqual({
      reading: null,
      reason: "unreadable",
    });
    // FIELD_READS_PER_DAY=3: the fourth read of the day never reaches the model.
    expect((await image("/admin/field/read")).body).toEqual({ reading: null, reason: "budget" });
    expect(reader.read).toHaveBeenCalledTimes(3);
  });

  it("refuses what is not an image", async () => {
    const res = await http()
      .post("/admin/field/read")
      .set("authorization", ADMIN)
      .set("content-type", "application/octet-stream")
      .send(Buffer.from("not an image"));
    expect(res.status).toBe(400);
  });
});

describe("POST /admin/field/photo", () => {
  it("stores the photo under pending/", async () => {
    const res = await image("/admin/field/photo");
    expect(res.status).toBe(201);
    expect(res.body.key).toMatch(/^pending\/[0-9a-f-]{36}\.webp$/);
    expect(bucket.has(res.body.key)).toBe(true);
  });
});

describe("duplicates", () => {
  const check = (body: object) =>
    http().post("/admin/field/duplicates").set("authorization", ADMIN).send(body);

  it("finds the same phone anywhere and a similar name within 50 m", async () => {
    await prisma.business.update({
      where: { id: f.tamraBarber.id },
      data: { phone: "+972 4-674-1234" },
    });
    const res = await check({
      lat: 32.8641,
      lng: 35.3031,
      name: { ar: "ابو سليم" },
      phone: "046741234",
    });
    expect(res.status).toBe(200);
    expect(res.body.matches).toEqual([
      expect.objectContaining({ id: f.tamraBarber.id, reason: "phone", placeSlug: "tamra" }),
      expect.objectContaining({ id: f.abuSalim.id, reason: "name", status: "published" }),
    ]);
    expect(res.body.matches[1].metres).toBeLessThanOrEqual(50);
  });

  it("ignores a similar name farther than 50 m and a different name close by", async () => {
    const far = await check({ lat: 32.867, lng: 35.306, name: { ar: "أبو سليم" } });
    expect(far.body.matches).toEqual([]);
    const other = await check({ lat: 32.864, lng: 35.303, name: { en: "Green Grocer" } });
    expect(other.body.matches).toEqual([]);
  });

  it("matches names the way the import dedupe does", () => {
    expect(similarNames({ he: "מספרת אבו סמיר" }, { he: "אבו סמיר" })).toBe(true);
    expect(similarNames({ en: "Abu Samir Salon" }, { en: "Abu Sameer" })).toBe(true);
    expect(similarNames({ en: "Abu Samir" }, { en: "Abu Khalil" })).toBe(false);
    expect(phoneKey("+972 54-533-0829")).toBe(phoneKey("054 5330829"));
    expect(phoneKey("123")).toBeNull();
  });
});

describe("captures", () => {
  const create = (body: object) =>
    http().post("/admin/field/captures").set("authorization", ADMIN).send(body);

  it("makes a draft with its photo and a street request in the queue, once per clientId", async () => {
    const photo = (await image("/admin/field/photo")).body.key as string;
    const body = capture({
      photo,
      note: "Hours: 9 to 7",
      reading: {
        name: { he: null, ar: "صالون أبو سمير", en: null },
        phone: null,
        kindSlug: "barbershops",
        confidence: 0.7,
      },
    });
    const res = await create(body);
    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({ status: "pending", clientId: body.clientId });
    const again = await create(body);
    expect(again.status).toBe(200);
    expect(again.body.id).toBe(res.body.id);
    expect(await prisma.joinRequest.count({ where: { source: "field" } })).toBe(1);

    const b = await prisma.business.findUniqueOrThrow({ where: { id: res.body.businessId } });
    expect(b).toMatchObject({
      status: "draft",
      source: "admin",
      placeId: f.sakhnin.id,
      phone: "04-674-1234",
      photos: [{ key: photo, alt: { ar: "صالون أبو سمير", en: "Abu Samir Salon" } }],
    });
    const audit = await prisma.auditLog.findFirst({ where: { entityId: b.id } });
    expect(audit?.action).toBe("create");

    // It sits in the existing queue, marked as from the street, with what the sign said.
    const queue = await http()
      .get("/admin/join-requests?status=pending")
      .set("authorization", ADMIN);
    expect(queue.body.items[0]).toMatchObject({
      source: "field",
      note: "Hours: 9 to 7",
      lookup: { kindSlug: "barbershops", name: { ar: "صالون أبو سمير" } },
    });
    // Approving publishes it with the storefront as its first photo.
    const ok = await http()
      .post(`/admin/join-requests/${res.body.id}/approve`)
      .set("authorization", ADMIN)
      .send({});
    expect(ok.status).toBe(200);
    expect(
      await prisma.business.findUniqueOrThrow({ where: { id: b.id }, select: { status: true } }),
    ).toEqual({ status: "published" });
  });

  it("drops a photo key the bucket never held, and refuses an unknown kind", async () => {
    const res = await create(
      capture({ photo: "pending/0190a000-0000-7000-8000-000000000999.webp" }),
    );
    expect(res.status).toBe(201);
    const b = await prisma.business.findUniqueOrThrow({ where: { id: res.body.businessId } });
    expect(b.photos).toEqual([]);
    const bad = await create(
      capture({ clientId: "0190a000-0000-7000-8000-000000000002", kindSlug: "hidden-kind" }),
    );
    expect(bad.status).toBe(400);
  });

  it("needs a name and a point in Israel", async () => {
    expect((await create(capture({ name: { he: " " } }))).status).toBe(400);
    expect((await create(capture({ lat: 10 }))).status).toBe(400);
  });

  it("lists the admin's own captures and counts today's", async () => {
    await create(capture());
    await create(
      capture({
        clientId: "0190a000-0000-7000-8000-000000000003",
        name: { en: "Yesterday's shop" },
        capturedAt: new Date(Date.now() - 2 * 86_400_000).toISOString(),
      }),
    );
    const res = await http().get("/admin/field/captures").set("authorization", ADMIN);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.today).toBe(1);
    expect(res.body.items.map((i: { businessName: { en: string } }) => i.businessName.en)).toEqual([
      "Abu Samir Salon",
      "Yesterday's shop",
    ]);
    const status = await http().get("/admin/field/status").set("authorization", ADMIN);
    expect(status.body).toEqual({ reading: true, uploads: true });
  });
});
