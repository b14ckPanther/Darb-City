import type { INestApplication } from "@nestjs/common";
import { BURST_PER_HOUR, HELPER_DAILY_DEFAULT } from "@darb/contracts";
import type { Redis } from "ioredis";
import sharp from "sharp";
import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi, type Mock } from "vitest";
import { ADMIN, createAdminTestApp } from "../../test/admin.js";
import { OverviewAdmin, OVERVIEW_TTL_MS } from "../admin/overview.admin.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures, type Fixtures } from "../../test/fixtures.js";
import { SIGN_READER, type SignReading } from "../field/sign-reader.js";
import type { HelperStatus } from "../generated/prisma/enums.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import { REDIS } from "../redis/redis.module.js";

let app: INestApplication;
let prisma: PrismaService;
let revalidate: Mock;
let f: Fixtures;
let jpeg: Buffer;
const reader = { name: "fake", read: vi.fn<(...a: unknown[]) => Promise<SignReading | null>>() };

/** A signed-in person nobody has seen yet: their User row is made by the first request. */
const NEWCOMER = "Bearer fake.user_newcomer.newcomer@darb.test";

/** A signed-in person in a helper state (`who` tells two of the same state apart). */
async function as(status: HelperStatus, who: string = status) {
  const clerkUserId = `user_${who}`;
  const user = await prisma.user.upsert({
    where: { clerkUserId },
    create: { clerkUserId, helperStatus: status, helperName: `${who} name` },
    update: { helperStatus: status },
  });
  return { id: user.id, auth: `Bearer fake.${clerkUserId}.${who}@darb.test` };
}

beforeAll(async () => {
  Object.assign(process.env, { FIELD_READS_PER_DAY: "1000" });
  ({ app, prisma, revalidate } = await createAdminTestApp((b) =>
    b.overrideProvider(SIGN_READER).useValue(reader),
  ));
  delete process.env["FIELD_READS_PER_DAY"];
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
  reader.read.mockReset();
  reader.read.mockResolvedValue(null);
  revalidate.mockClear();
});
afterAll(() => app.close());

const http = () => request(app.getHttpServer());

let n = 0;
const clientId = () => `0190a000-0000-7000-8000-${String(++n).padStart(12, "0")}`;
const capture = (patch: Record<string, unknown> = {}) => ({
  clientId: clientId(),
  name: { en: `Corner shop ${n}` },
  kindSlug: "barbershops",
  // Open ground in Sakhnin north of the fixtures' businesses, each capture 66 m from the last.
  lat: 32.87 + (n % 40) * 0.0006,
  lng: 35.3026,
  locale: "en",
  ...patch,
});

type Call = { method: "get" | "post" | "patch"; path: string; body?: object; image?: boolean };
const call = (c: Call, auth?: string) => {
  const r = http()[c.method](c.path);
  if (auth) r.set("authorization", auth);
  if (c.image) return r.set("content-type", "application/octet-stream").send(jpeg);
  return c.method === "get" ? r : r.send(c.body ?? {});
};

/** Every helper capture route, each with a body that would succeed. */
const CAPTURE: Call[] = [
  { method: "get", path: "/helpers/field/status" },
  { method: "post", path: "/helpers/field/duplicates", body: { lat: 32.8, lng: 35.3 } },
  { method: "post", path: "/helpers/field/captures", body: {} },
  { method: "post", path: "/helpers/field/locate", body: { query: "x", locale: "en" } },
  { method: "post", path: "/helpers/field/photo", image: true },
  { method: "post", path: "/helpers/field/read", image: true },
];
const MINE: Call = { method: "get", path: "/helpers/field/captures" };
const PROFILE: Call[] = [
  { method: "get", path: "/helpers/me" },
  { method: "patch", path: "/helpers/me", body: { credit: true } },
];
const ADMIN_ROUTES: Call[] = [
  { method: "get", path: "/admin/helpers" },
  { method: "post", path: "/admin/helpers/0190a000-0000-7000-8000-00000000abcd/approve" },
];

describe("guard matrix", () => {
  const allowed = (status: number) => status !== 401 && status !== 403;

  it("401s every helper and admin route without a token", async () => {
    for (const c of [...CAPTURE, MINE, ...PROFILE, ...ADMIN_ROUTES])
      expect((await call(c)).status, c.path).toBe(401);
    expect((await call({ method: "post", path: "/helpers/apply" })).status).toBe(401);
  });

  it.each([
    ["none", false, false],
    ["pending", false, false],
    ["approved", true, true],
    ["paused", false, true],
  ] as const)("%s: adds %s, reads own list %s, never the admin", async (status, adds, reads) => {
    const { auth } = await as(status);
    for (const c of CAPTURE) {
      const res = await call(c, auth);
      expect(allowed(res.status), `${c.path} ${res.status}`).toBe(adds);
    }
    expect(allowed((await call(MINE, auth)).status)).toBe(reads);
    for (const c of PROFILE) expect(allowed((await call(c, auth)).status), c.path).toBe(true);
    for (const c of ADMIN_ROUTES) expect((await call(c, auth)).status, c.path).toBe(403);
  });

  it("admin: everything, without applying", async () => {
    for (const c of [...CAPTURE, MINE, ...PROFILE, ...ADMIN_ROUTES]) {
      const res = await call(c, ADMIN);
      expect(allowed(res.status), `${c.path} ${res.status}`).toBe(true);
    }
  });

  it("answers no-store on helper routes", async () => {
    const { auth } = await as("approved");
    for (const c of [MINE, ...PROFILE, CAPTURE[0]!])
      expect((await call(c, auth)).headers["cache-control"], c.path).toBe("no-store");
  });
});

describe("apply and profile", () => {
  const form = () => ({
    name: "Rami",
    phone: "050-123-4567",
    placeId: f.sakhnin.id,
    note: "I walk Sakhnin every day",
  });

  it("makes a User at first sight, then waits; applying again only updates the form", async () => {
    const auth = NEWCOMER;
    const me = await http().get("/helpers/me").set("authorization", auth);
    expect(me.body).toMatchObject({ status: "none", credit: false, isAdmin: false });

    const first = await http().post("/helpers/apply").set("authorization", auth).send(form());
    expect(first.status).toBe(200);
    expect(first.body).toMatchObject({
      status: "pending",
      name: "Rami",
      placeName: { en: expect.any(String) },
    });
    const again = await http()
      .post("/helpers/apply")
      .set("authorization", auth)
      .send({ ...form(), name: "Rami K" });
    expect(again.body).toMatchObject({ status: "pending", name: "Rami K" });
    expect(again.body.appliedAt).toBe(first.body.appliedAt);
    expect(await prisma.user.count({ where: { clerkUserId: "user_newcomer" } })).toBe(1);
  });

  it("refuses an unknown town, and changes nothing once decided", async () => {
    const bad = await http()
      .post("/helpers/apply")
      .set("authorization", NEWCOMER)
      .send({ ...form(), placeId: "0190a000-0000-7000-8000-00000000abcd" });
    expect(bad.status).toBe(404);
    const { auth } = await as("paused");
    const res = await http().post("/helpers/apply").set("authorization", auth).send(form());
    expect(res.body.status).toBe("paused");
  });

  it("toggles the credit and renames; refreshes their published cards", async () => {
    const { auth } = await as("approved");
    await http().post("/helpers/field/captures").set("authorization", auth).send(capture());
    const req = await prisma.joinRequest.findFirstOrThrow({ where: { source: "field" } });
    await http()
      .post(`/admin/join-requests/${req.id}/approve`)
      .set("authorization", ADMIN)
      .send({});
    revalidate.mockClear();
    const on = await http().patch("/helpers/me").set("authorization", auth).send({ credit: true });
    expect(on.body).toMatchObject({ credit: true, name: "approved name" });
    await vi.waitFor(() => expect(revalidate).toHaveBeenCalled());
    expect(revalidate.mock.calls[0]![0]).toEqual(expect.arrayContaining(["businesses"]));
    const none = await http()
      .patch("/helpers/me")
      .set("authorization", NEWCOMER)
      .send({ credit: true });
    expect(none.status).toBe(409);
  });
});

describe("captures", () => {
  it("lands a helper's capture in the join queue, marked with their name", async () => {
    const { id, auth } = await as("approved");
    const res = await http()
      .post("/helpers/field/captures")
      .set("authorization", auth)
      .send(capture({ name: { en: "Helper's bakery" } }));
    expect(res.status).toBe(201);
    const queue = await http()
      .get("/admin/join-requests?status=pending")
      .set("authorization", ADMIN);
    expect(queue.body.items[0]).toMatchObject({
      source: "field",
      helper: { id, name: "approved name" },
    });
    const byHelper = await http()
      .get(`/admin/join-requests?helper=${id}`)
      .set("authorization", ADMIN);
    expect(byHelper.body.items).toHaveLength(1);
    // An admin's own capture is still "from the street", not a helper's.
    await http().post("/admin/field/captures").set("authorization", ADMIN).send(capture());
    const all = await http().get("/admin/join-requests").set("authorization", ADMIN);
    expect(all.body.items.filter((i: { helper: unknown }) => i.helper === null)).toHaveLength(1);
  });

  it("shows a helper only their own additions, with totals and the live link", async () => {
    const a = await as("approved");
    const b = await as("approved", "other");
    const mineA = capture({ name: { en: "Mine" } });
    await http().post("/helpers/field/captures").set("authorization", a.auth).send(mineA);
    await http()
      .post("/helpers/field/captures")
      .set("authorization", b.auth)
      .send(capture({ name: { en: "Theirs" } }));
    const req = await prisma.joinRequest.findFirstOrThrow({ where: { createdById: a.id } });
    await http()
      .post(`/admin/join-requests/${req.id}/approve`)
      .set("authorization", ADMIN)
      .send({});

    const res = await http().get("/helpers/field/captures").set("authorization", a.auth);
    expect(res.body).toMatchObject({ today: 1, total: 1, live: 1 });
    expect(res.body.items).toEqual([
      expect.objectContaining({
        businessName: { en: "Mine" },
        status: "approved",
        live: expect.objectContaining({ place: "sakhnin", kind: "barbershops" }),
      }),
    ]);
    // Another helper's clientId never answers with their capture.
    const theirs = await http()
      .post("/helpers/field/captures")
      .set("authorization", b.auth)
      .send({ ...mineA, name: { en: "Peek" } });
    expect(theirs.status).toBe(409);
    expect(JSON.stringify(theirs.body)).not.toContain("Mine");
  });

  it("needs a note to save past a strong duplicate; an admin does not", async () => {
    const { auth } = await as("approved");
    await prisma.business.update({
      where: { id: f.tamraBarber.id },
      data: { phone: "+972 4-674-1234" },
    });
    const same = capture({ phone: "04-674-1234" });
    const refused = await http()
      .post("/helpers/field/captures")
      .set("authorization", auth)
      .send(same);
    expect(refused.status).toBe(400);
    expect(refused.body.code).toBe("duplicate_note_needed");
    const ok = await http()
      .post("/helpers/field/captures")
      .set("authorization", auth)
      .send({ ...same, distinct: "The other branch, across the road" });
    expect(ok.status).toBe(201);
    const row = await prisma.joinRequest.findUniqueOrThrow({ where: { id: ok.body.id } });
    expect(row.note).toContain("The other branch, across the road");
    const admin = await http()
      .post("/admin/field/captures")
      .set("authorization", ADMIN)
      .send(capture({ phone: "04-674-1234" }));
    expect(admin.status).toBe(201);
  });

  /** `count` of their street additions made now (no drafts: only the day's count matters). */
  const madeToday = (createdById: string, count: number) =>
    madeTodayAt(createdById, count, new Date());
  const add = (auth: string) =>
    http().post("/helpers/field/captures").set("authorization", auth).send(capture());

  it(`stops a helper at ${HELPER_DAILY_DEFAULT} additions a day by default, never an admin`, async () => {
    const { id, auth } = await as("approved");
    expect((await http().get("/helpers/me").set("authorization", auth)).body.dailyLimit).toBe(
      HELPER_DAILY_DEFAULT,
    );
    await madeToday(id, HELPER_DAILY_DEFAULT - 1);
    expect((await add(auth)).status).toBe(201);
    const res = await add(auth);
    expect(res.status).toBe(429);
    expect(res.body.code).toBe("daily_limit");
    await prisma.user.update({ where: { id }, data: { isAdmin: true } });
    expect((await add(auth)).status).toBe(201);
    expect((await http().get("/helpers/me").set("authorization", auth)).body.dailyLimit).toBeNull();
  });

  it("raises one helper to 500 a day, or lifts the cap, from the admin", async () => {
    const { id, auth } = await as("approved");
    const limit = (value: number | null) =>
      http().post(`/admin/helpers/${id}/limit`).set("authorization", ADMIN).send({ limit: value });
    expect((await limit(500)).body).toMatchObject({ id, dailyLimit: 500 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).helperDailyLimit).toBe(500);
    await madeToday(id, 499);
    expect((await add(auth)).status).toBe(201);
    expect((await add(auth)).status).toBe(429);
    expect((await limit(null)).body.dailyLimit).toBeNull();
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).helperDailyLimit).toBe(0);
    expect((await add(auth)).status).toBe(201);
    expect((await http().get("/helpers/me").set("authorization", auth)).body.dailyLimit).toBeNull();
    // Back to the default: stored as null, so a later change of the default reaches them.
    expect((await limit(150)).body.dailyLimit).toBe(150);
    expect((await prisma.user.findUniqueOrThrow({ where: { id } })).helperDailyLimit).toBeNull();
    const audit = await prisma.auditLog.findMany({ where: { entityType: "helper", entityId: id } });
    expect(audit).toHaveLength(3);
    expect(audit.every((a) => a.action === "update" && a.fields[0] === "helperDailyLimit")).toBe(
      true,
    );
  });

  it("offers only 150, 500 or no cap, to admins only, for a helper only", async () => {
    const { id, auth } = await as("approved");
    const set = (body: object, who = ADMIN, target = id) =>
      http().post(`/admin/helpers/${target}/limit`).set("authorization", who).send(body);
    expect((await set({ limit: 40 })).status).toBe(400);
    expect((await set({ limit: 0 })).status).toBe(400);
    expect((await set({})).status).toBe(400);
    expect((await set({ limit: 500 }, auth)).status).toBe(403);
    expect((await http().post(`/admin/helpers/${id}/limit`).send({ limit: 500 })).status).toBe(401);
    const { id: nobody } = await as("none");
    expect((await set({ limit: 500 }, ADMIN, nobody)).status).toBe(404);
  });

  /** Their readings so far today, as the API counts them. */
  const usedReads = async (userId: string, n: number) =>
    app
      .get<Redis>(REDIS)
      .set(`darb:field:reads:${new Date().toISOString().slice(0, 10)}:${userId}`, n);
  const read = (auth: string) =>
    http()
      .post("/helpers/field/read")
      .set("authorization", auth)
      .set("content-type", "application/octet-stream")
      .send(jpeg);

  it(`gives a helper ${HELPER_DAILY_DEFAULT} sign readings a day, 500 or none when raised`, async () => {
    const { id, auth } = await as("approved");
    await usedReads(id, HELPER_DAILY_DEFAULT - 1);
    expect((await read(auth)).body.reason).toBe("unreadable");
    expect((await read(auth)).body).toEqual({ reading: null, reason: "budget" });
    await prisma.user.update({ where: { id }, data: { helperDailyLimit: 500 } });
    await usedReads(id, 499);
    expect((await read(auth)).body.reason).toBe("unreadable");
    expect((await read(auth)).body.reason).toBe("budget");
    await prisma.user.update({ where: { id }, data: { helperDailyLimit: 0 } });
    expect((await read(auth)).body.reason).toBe("unreadable");
    const admin = await http()
      .post("/admin/field/read")
      .set("authorization", ADMIN)
      .set("content-type", "application/octet-stream")
      .send(jpeg);
    expect(admin.body.reason).toBe("unreadable");
  });
});

describe("approve all from one helper", () => {
  const bulk = (helper: string, who = ADMIN) =>
    http().post("/admin/join-requests/approve-helper").set("authorization", who).send({ helper });

  it("publishes only that helper's waiting additions, each one audited", async () => {
    const a = await as("approved", "a");
    const b = await as("approved", "b");
    for (let i = 0; i < 3; i++)
      await http().post("/helpers/field/captures").set("authorization", a.auth).send(capture());
    const other = await http()
      .post("/helpers/field/captures")
      .set("authorization", b.auth)
      .send(capture());
    const own = await http()
      .post("/admin/field/captures")
      .set("authorization", ADMIN)
      .send(capture());
    // One of theirs was already rejected: it stays rejected.
    const [first] = await prisma.joinRequest.findMany({
      where: { createdById: a.id },
      orderBy: { createdAt: "asc" },
    });
    await http()
      .post(`/admin/join-requests/${first!.id}/reject`)
      .set("authorization", ADMIN)
      .send({ reason: "Already on Darb" });

    const list = await http()
      .get(`/admin/join-requests?helper=${a.id}&status=pending`)
      .set("authorization", ADMIN);
    expect(list.body.helperPending).toBe(2);
    expect(
      (await http().get("/admin/join-requests").set("authorization", ADMIN)).body.helperPending,
    ).toBeUndefined();

    const res = await bulk(a.id);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ approved: 2, failed: 0, remaining: 0 });
    const theirs = await prisma.joinRequest.findMany({
      where: { createdById: a.id },
      include: { business: true },
    });
    expect(theirs.map((r) => r.status).sort()).toEqual(["approved", "approved", "rejected"]);
    const published = theirs.filter((r) => r.status === "approved");
    expect(published.every((r) => r.business?.status === "published")).toBe(true);
    const audit = await prisma.auditLog.findMany({
      where: { action: "status", entityId: { in: published.map((r) => r.businessId!) } },
    });
    expect(audit).toHaveLength(2);
    expect(
      (await prisma.joinRequest.findUniqueOrThrow({ where: { id: other.body.id } })).status,
    ).toBe("pending");
    expect(
      (await prisma.joinRequest.findUniqueOrThrow({ where: { id: own.body.id } })).status,
    ).toBe("pending");
    // Nothing left: a second press changes nothing.
    expect((await bulk(a.id)).body).toEqual({ approved: 0, failed: 0, remaining: 0 });
  });

  it("is for admins only, and needs a helper id", async () => {
    const a = await as("approved", "a");
    expect(
      (await http().post("/admin/join-requests/approve-helper").send({ helper: a.id })).status,
    ).toBe(401);
    expect((await bulk(a.id, a.auth)).status).toBe(403);
    expect(
      (
        await http()
          .post("/admin/join-requests/approve-helper")
          .set("authorization", ADMIN)
          .send({ helper: "nope" })
      ).status,
    ).toBe(400);
  });
});

/** `count` street additions by one person, all made at `at`. */
const madeTodayAt = (createdById: string, count: number, at: Date) =>
  prisma.joinRequest.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      businessName: { en: `Burst ${i}` },
      ownerName: "",
      ownerPhone: "",
      locale: "en",
      source: "field" as const,
      createdById,
      createdAt: at,
    })),
  });

describe("burst alert", () => {
  it(`flags a helper with more than ${BURST_PER_HOUR} additions in the last hour, never an admin`, async () => {
    const fast = await as("approved", "fast");
    const steady = await as("approved", "steady");
    const admin = await as("approved", "boss");
    await prisma.user.update({ where: { id: admin.id }, data: { isAdmin: true } });
    const now = new Date();
    const minutesAgo = (m: number) => new Date(now.getTime() - m * 60_000);
    await madeTodayAt(fast.id, BURST_PER_HOUR + 1, minutesAgo(20));
    // Exactly the threshold, or older than an hour, is not a burst.
    await madeTodayAt(steady.id, BURST_PER_HOUR, minutesAgo(10));
    await madeTodayAt(steady.id, 50, minutesAgo(70));
    await madeTodayAt(admin.id, 300, minutesAgo(5));
    const overview = app.get(OverviewAdmin);
    expect(await overview.bursts(now)).toEqual([
      { id: fast.id, name: "fast name", count: BURST_PER_HOUR + 1, status: "approved" },
    ]);
    // Read (and cached) as of long ago, so the next test's overview reads afresh.
    overview.now = () => Date.now() - 10 * OVERVIEW_TTL_MS;
    try {
      const res = await http().get("/admin/overview").set("authorization", ADMIN);
      expect(res.body.bursts.map((b: { id: string }) => b.id)).toEqual([fast.id]);
    } finally {
      overview.now = () => Date.now();
    }
  });
});

describe("admin decisions", () => {
  const decide = (id: string, move: string) =>
    http().post(`/admin/helpers/${id}/${move}`).set("authorization", ADMIN).send({});

  it("approves, pauses and resumes, audited; a wrong move is a conflict", async () => {
    const { id, auth } = await as("pending");
    const list = await http().get("/admin/helpers?status=pending").set("authorization", ADMIN);
    expect(list.body.counts).toEqual({ pending: 1, approved: 0, paused: 0 });
    expect(list.body.items[0]).toMatchObject({ id, name: "pending name", added: 0 });
    const overview = await http().get("/admin/overview").set("authorization", ADMIN);
    expect(overview.body.counts.helpersWaiting).toBe(1);

    expect((await decide(id, "pause")).status).toBe(409);
    expect((await decide(id, "approve")).body.status).toBe("approved");
    expect((await http().get("/helpers/field/status").set("authorization", auth)).status).toBe(200);
    expect((await decide(id, "pause")).body.status).toBe("paused");
    expect((await http().get("/helpers/field/status").set("authorization", auth)).status).toBe(403);
    expect((await decide(id, "resume")).body.status).toBe("approved");
    const audit = await prisma.auditLog.findMany({ where: { entityType: "helper", entityId: id } });
    expect(audit).toHaveLength(3);
    expect(audit.every((a) => a.action === "status")).toBe(true);
    // Helper decisions stay off the overview's content activity.
    const after = await http().get("/admin/overview").set("authorization", ADMIN);
    expect(after.body.activity.some((a: { entityId: string }) => a.entityId === id)).toBe(false);
    expect((await decide("0190a000-0000-7000-8000-00000000abcd", "approve")).status).toBe(404);
  });

  it("counts each helper's additions by outcome", async () => {
    const { id, auth } = await as("approved");
    for (let i = 0; i < 3; i++)
      await http().post("/helpers/field/captures").set("authorization", auth).send(capture());
    const [one, two] = await prisma.joinRequest.findMany({ where: { createdById: id } });
    await http()
      .post(`/admin/join-requests/${one!.id}/approve`)
      .set("authorization", ADMIN)
      .send({});
    await http()
      .post(`/admin/join-requests/${two!.id}/reject`)
      .set("authorization", ADMIN)
      .send({ reason: "Already on Darb" });
    const list = await http().get("/admin/helpers?status=approved").set("authorization", ADMIN);
    expect(list.body.items[0]).toMatchObject({ added: 3, approved: 1, rejected: 1 });
    const mine = await http().get("/helpers/field/captures").set("authorization", auth);
    expect(mine.body.items.find((i: { status: string }) => i.status === "rejected")).toMatchObject({
      rejectReason: "Already on Darb",
    });
  });
});

describe("public credit", () => {
  it("shows Added by <name> on the published card only while the toggle is on", async () => {
    const { auth } = await as("approved");
    await http().patch("/helpers/me").set("authorization", auth).send({ name: "Rami" });
    const made = await http()
      .post("/helpers/field/captures")
      .set("authorization", auth)
      .send(capture({ name: { en: "Rami's find" } }));
    await http()
      .post(`/admin/join-requests/${made.body.id}/approve`)
      .set("authorization", ADMIN)
      .send({});
    const b = await prisma.business.findUniqueOrThrow({ where: { id: made.body.businessId } });
    const card = () => http().get(`/places/sakhnin/businesses/${b.slug}`);
    expect((await card()).body.addedBy).toBeNull();
    await http().patch("/helpers/me").set("authorization", auth).send({ credit: true });
    expect((await card()).body.addedBy).toBe("Rami");
    await http().patch("/helpers/me").set("authorization", auth).send({ credit: false });
    expect((await card()).body.addedBy).toBeNull();
  });
});

describe("moments: milestones and what went live", () => {
  const moments = (auth: string) => http().get("/helpers/moments").set("authorization", auth);
  const seen = (auth: string, body: object) =>
    http().post("/helpers/moments/seen").set("authorization", auth).send(body);
  const add = (auth: string, count: number) =>
    Array.from({ length: count }).reduce<Promise<unknown>>(
      (p) =>
        p.then(() =>
          http().post("/helpers/field/captures").set("authorization", auth).send(capture()),
        ),
      Promise.resolve(),
    );
  const approve = async (id: string) =>
    http().post(`/admin/join-requests/${id}/approve`).set("authorization", ADMIN).send({});

  it("celebrates 10 additions once, with the busiest town and how many are live", async () => {
    const a = await as("approved");
    await add(a.auth, 9);
    expect((await moments(a.auth)).body.milestone).toBeNull();
    await add(a.auth, 1);
    const first = await prisma.joinRequest.findFirstOrThrow({ where: { createdById: a.id } });
    await approve(first.id);

    const res = await moments(a.auth);
    expect(res.status).toBe(200);
    expect(res.headers["cache-control"]).toBe("no-store");
    expect(res.body.milestone).toEqual({
      count: 10,
      live: 1,
      placeName: { he: "סח'נין", ar: "سخنين", en: "Sakhnin" },
    });
    // Asking again before it was shown says it again; once seen, never.
    expect((await moments(a.auth)).body.milestone).toMatchObject({ count: 10 });
    expect((await seen(a.auth, { asOf: res.body.asOf, milestone: 10 })).status).toBe(204);
    expect((await moments(a.auth)).body.milestone).toBeNull();
    await add(a.auth, 1);
    expect((await moments(a.auth)).body.milestone).toBeNull();
  });

  it("counts only the helper's own additions, and never takes a milestone not reached", async () => {
    const a = await as("approved");
    const b = await as("approved", "other");
    await add(b.auth, 10);
    expect((await moments(a.auth)).body.milestone).toBeNull();
    await add(a.auth, 3);
    const asOf = new Date().toISOString();
    // Marking 10 seen with only 3 additions changes nothing: it is still celebrated at 10.
    expect((await seen(a.auth, { asOf, milestone: 10 })).status).toBe(204);
    await add(a.auth, 7);
    expect((await moments(a.auth)).body.milestone).toMatchObject({ count: 10, live: 0 });
    // Only the milestones exist.
    expect((await seen(a.auth, { asOf, milestone: 11 })).status).toBe(400);
  });

  it("jumping past two milestones celebrates the highest, once", async () => {
    const a = await as("approved");
    const user = await prisma.user.findUniqueOrThrow({ where: { id: a.id } });
    const business = await prisma.business.findFirstOrThrow();
    await prisma.joinRequest.createMany({
      data: Array.from({ length: 52 }, (_, i) => ({
        businessId: i === 0 ? business.id : null,
        businessName: { en: `Shop ${i}` },
        ownerName: "",
        ownerPhone: "",
        locale: "en",
        source: "field" as const,
        createdById: user.id,
      })),
    });
    const res = await moments(a.auth);
    expect(res.body.milestone).toMatchObject({ count: 50 });
    await seen(a.auth, { asOf: res.body.asOf, milestone: 50 });
    expect((await moments(a.auth)).body.milestone).toBeNull();
    // A lower one is never said after a higher one was.
    await seen(a.auth, { asOf: res.body.asOf, milestone: 10 });
    expect((await prisma.user.findUniqueOrThrow({ where: { id: a.id } })).helperMilestone).toBe(50);
  });

  it("says what went live since the last visit: only their own, once, never on the first", async () => {
    const a = await as("approved");
    const b = await as("approved", "other");
    await add(a.auth, 3);
    await add(b.auth, 1);
    // The very first visit says nothing, even with approvals before it.
    const [one, two, three] = await prisma.joinRequest.findMany({
      where: { createdById: a.id },
      orderBy: { createdAt: "asc" },
    });
    await approve(one!.id);
    const first = await moments(a.auth);
    expect(first.body.wentLive).toBeNull();
    await seen(a.auth, { asOf: first.body.asOf });

    await approve(two!.id);
    await approve(three!.id);
    const theirs = await prisma.joinRequest.findFirstOrThrow({ where: { createdById: b.id } });
    await approve(theirs.id);
    const next = await moments(a.auth);
    expect(next.body.wentLive).toEqual({ count: 2, since: expect.any(String) });
    expect(Date.parse(next.body.wentLive.since)).toBe(Date.parse(first.body.asOf));
    await seen(a.auth, { asOf: next.body.asOf });
    expect((await moments(a.auth)).body.wentLive).toBeNull();
  });

  it("an approval after the count is still told next time; a rejection never is", async () => {
    const a = await as("approved");
    await add(a.auth, 2);
    const first = await moments(a.auth);
    await seen(a.auth, { asOf: first.body.asOf });
    const counted = await moments(a.auth);
    const [x, y] = await prisma.joinRequest.findMany({ where: { createdById: a.id } });
    await approve(x!.id);
    await http()
      .post(`/admin/join-requests/${y!.id}/reject`)
      .set("authorization", ADMIN)
      .send({ reason: "Closed" });
    // Seen up to the earlier count only (and a time in the future is held to now).
    await seen(a.auth, { asOf: counted.body.asOf });
    expect((await moments(a.auth)).body.wentLive).toMatchObject({ count: 1 });
    await seen(a.auth, { asOf: new Date(Date.now() + 86_400_000).toISOString() });
    const after = await prisma.user.findUniqueOrThrow({ where: { id: a.id } });
    expect(after.helperSeenAt!.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it("is for approved helpers only; admins get neither", async () => {
    for (const status of ["none", "pending", "paused"] as const) {
      const { auth } = await as(status);
      expect((await moments(auth)).status, status).toBe(403);
      expect((await seen(auth, { asOf: new Date().toISOString() })).status, status).toBe(403);
    }
    expect((await http().get("/helpers/moments")).status).toBe(401);
    for (let i = 0; i < 10; i++)
      await http().post("/admin/field/captures").set("authorization", ADMIN).send(capture());
    expect((await moments(ADMIN)).body).toMatchObject({ milestone: null, wentLive: null });
  });
});
