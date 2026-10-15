import type { INestApplication } from "@nestjs/common";
import type { Redis } from "ioredis";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import { loadConfig } from "../config.js";
import type { Inquiry } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";
import { inquiryEmail, Mailer } from "./mailer.js";

let app: INestApplication;
let prisma: PrismaService;
let send: Mock;
let mailer: Mailer;
let ipCount = 0;

beforeAll(async () => {
  process.env["SEARCH_PROXY_KEY"] = "proxy-key";
  process.env["RESEND_API_KEY"] = "re_test";
  process.env["INQUIRY_RATE_LIMIT"] = "2";
  ({ app, prisma } = await createAdminTestApp());
  delete process.env["RESEND_API_KEY"];
  delete process.env["INQUIRY_RATE_LIMIT"];
  mailer = app.get(Mailer);
  const redis = app.get<Redis>(REDIS);
  const keys = await redis.keys("darb:rl:inquiry:*");
  if (keys.length) await redis.del(...keys);
});
beforeEach(async () => {
  await resetDatabase(prisma);
  send = vi.fn(async () => new Response("{}", { status: 200 }));
  mailer.fetchImpl = send as unknown as typeof fetch;
});
afterAll(() => app.close());

const form = {
  name: "Samir",
  contact: "samir@example.com",
  businessName: "Samir Sweets",
  topic: "plan",
  plan: "spotlight",
  message: "I run a bakery in Sakhnin and want more people to find it.",
  locale: "ar",
};

/** Each call is a new visitor unless `ip` is given, so the limit only bites where a test wants it. */
const post = (body: object, ip = `10.9.0.${++ipCount}`) =>
  request(app.getHttpServer())
    .post("/inquiries")
    .set("x-darb-proxy-key", "proxy-key")
    .set("x-darb-client-ip", ip)
    .send(body);

describe("POST /inquiries", () => {
  it("stores the message, mails it to the founder and notes when", async () => {
    const res = await post(form);
    expect(res.status).toBe(201);
    expect(res.body).toEqual({ ok: true });
    const row = await prisma.inquiry.findFirstOrThrow();
    expect(row).toMatchObject({
      name: "Samir",
      contact: "samir@example.com",
      businessName: "Samir Sweets",
      topic: "plan",
      plan: "spotlight",
      locale: "ar",
      status: "new",
    });
    expect(row.ipHash).toMatch(/^[0-9a-f]{32}$/);
    expect(row.ipHash).not.toContain("10.9.0");
    expect(row.emailedAt).not.toBeNull();
    expect(send).toHaveBeenCalledTimes(1);
    const [url, init] = send.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.resend.com/emails");
    expect((init.headers as Record<string, string>)["authorization"]).toBe("Bearer re_test");
    const mail = JSON.parse(String(init.body));
    expect(mail).toMatchObject({
      from: "Darb <hello@darb.co.il>",
      to: ["founder@darb.co.il"],
      reply_to: "samir@example.com",
      subject: "Darb · plan · Samir",
    });
    expect(mail.text).toContain("Business: Samir Sweets");
    expect(mail.text).toContain("bakery in Sakhnin");
  });

  it("keeps the message when the mail fails, and never fails the request", async () => {
    send.mockResolvedValueOnce(new Response("no", { status: 500 }));
    expect((await post(form)).status).toBe(201);
    send.mockRejectedValueOnce(new Error("down"));
    expect((await post({ ...form, contact: "050-123-4567" })).status).toBe(201);
    const rows = await prisma.inquiry.findMany();
    expect(rows).toHaveLength(2);
    expect(rows.every((r) => r.emailedAt === null)).toBe(true);
  });

  it("drops a plan on another topic and an empty business name", async () => {
    await post({ ...form, topic: "join", businessName: "" });
    const row = await prisma.inquiry.findFirstOrThrow();
    expect([row.topic, row.plan, row.businessName]).toEqual(["join", null, null]);
  });

  it("answers a filled honeypot like anyone else, and keeps and sends nothing", async () => {
    const res = await post({ ...form, website: "https://spam.example" });
    expect(res.status).toBe(201);
    expect(await prisma.inquiry.count()).toBe(0);
    expect(send).not.toHaveBeenCalled();
  });

  it("refuses a form that does not parse", async () => {
    expect((await post({ ...form, message: "short" })).status).toBe(400);
    expect((await post({ ...form, contact: "nope nope" })).status).toBe(400);
    expect(await prisma.inquiry.count()).toBe(0);
  });

  it("limits one visitor to the configured number per window", async () => {
    expect((await post(form, "10.8.0.1")).status).toBe(201);
    expect((await post(form, "10.8.0.1")).status).toBe(201);
    const refused = await post(form, "10.8.0.1");
    expect(refused.status).toBe(429);
    expect(refused.body.retryAfter).toBeGreaterThan(0);
    expect((await post(form, "10.8.0.2")).status).toBe(201);
    expect(await prisma.inquiry.count()).toBe(3);
  });
});

describe("the admin inbox", () => {
  const http = () => request(app.getHttpServer());

  it("lists newest first with the new count, filters, and marks handled", async () => {
    await post({ ...form, name: "First" });
    await post({ ...form, name: "Second" });
    const list = await http().get("/admin/inquiries").set("authorization", ADMIN);
    expect(list.status).toBe(200);
    expect(list.headers["cache-control"]).toBe("no-store");
    expect(list.body.items.map((i: { name: string }) => i.name)).toEqual(["Second", "First"]);
    expect(list.body.newCount).toBe(2);
    expect(list.body.items[0]).not.toHaveProperty("ipHash");

    const id = list.body.items[0].id;
    const done = await http()
      .patch(`/admin/inquiries/${id}`)
      .set("authorization", ADMIN)
      .send({ status: "handled" });
    expect([done.status, done.body.status]).toEqual([200, "handled"]);
    const open = await http()
      .get("/admin/inquiries?status=new")
      .set("authorization", ADMIN);
    expect(open.body.items.map((i: { name: string }) => i.name)).toEqual(["First"]);
    expect(open.body.newCount).toBe(1);

    const paged = await http().get("/admin/inquiries?limit=1").set("authorization", ADMIN);
    expect(paged.body.nextCursor).not.toBeNull();
    const missing = await http()
      .patch("/admin/inquiries/0190a000-0000-7000-8000-00000000abcd")
      .set("authorization", ADMIN)
      .send({ status: "new" });
    expect(missing.status).toBe(404);
  });
});

describe("the mailer", () => {
  const row: Inquiry = {
    id: "0190a000-0000-7000-8000-000000000001",
    name: "Lina <b>",
    contact: "050-123-4567",
    businessName: null,
    topic: "general",
    plan: null,
    message: "Hello\nthere",
    locale: "he",
    ipHash: null,
    status: "new",
    emailedAt: null,
    createdAt: new Date("2026-10-15T09:00:00Z"),
  };

  it("sends nothing without a key", async () => {
    const off = new Mailer(loadConfig({ DATABASE_URL: "postgresql://a/b" }));
    const fetchImpl = vi.fn();
    off.fetchImpl = fetchImpl;
    expect(await off.sendInquiry(row)).toBe(false);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("escapes the HTML and replies only to an email address", () => {
    const mail = inquiryEmail(row, "Darb <hello@darb.co.il>", "founder@darb.co.il");
    expect(mail).not.toHaveProperty("reply_to");
    expect(mail.html).toContain("Lina &#60;b&#62;");
    expect(mail.html).toContain("Hello<br>there");
    expect(mail.text).not.toContain("Business:");
  });
});
