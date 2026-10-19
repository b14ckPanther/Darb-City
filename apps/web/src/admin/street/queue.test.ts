import { describe, expect, it, vi } from "vitest";
import { fitWithin } from "./photo";
import { flushQueue, memoryStore, openQueue, sendCapture, type QueuedCapture } from "./queue";

const item = (patch: Partial<QueuedCapture> = {}): QueuedCapture => ({
  clientId: "0190a000-0000-7000-8000-000000000001",
  createdAt: "2026-10-18T09:00:00.000Z",
  label: "Abu Samir",
  photo: new Blob(["jpeg"], { type: "image/jpeg" }),
  photoKey: null,
  state: "waiting",
  body: {
    clientId: "0190a000-0000-7000-8000-000000000001",
    name: { en: "Abu Samir" },
    kindSlug: "barbershops",
    lat: 32.86,
    lng: 35.3,
    locale: "en",
  },
  ...patch,
});

const reply = (status: number, body: object = {}) => Response.json(body, { status });
const KEY = "pending/0190a000-0000-7000-8000-0000000000aa.webp";

describe("sendCapture", () => {
  it("uploads the photo, then the capture with its key, and forgets the item", async () => {
    const store = memoryStore();
    await store.put(item());
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(201, { key: KEY }))
      .mockResolvedValueOnce(reply(201, { id: "x" }));
    expect(await sendCapture(item(), { fetch, base: "/admin/field-api", store })).toEqual({
      kind: "sent",
    });
    expect(fetch.mock.calls[0]![0]).toBe("/admin/field-api/photo");
    expect(fetch.mock.calls[1]![0]).toBe("/admin/field-api/captures");
    expect(JSON.parse(fetch.mock.calls[1]![1].body)).toMatchObject({
      clientId: item().clientId,
      photo: KEY,
    });
    expect(await store.all()).toEqual([]);
  });

  it("keeps the photo key when the capture fails, so a retry never uploads twice", async () => {
    const store = memoryStore();
    await store.put(item());
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(201, { key: KEY }))
      .mockRejectedValueOnce(new TypeError("Failed to fetch"));
    expect(await sendCapture(item(), { fetch, base: "", store })).toEqual({ kind: "offline" });
    const [kept] = await store.all();
    expect(kept!.photoKey).toBe(KEY);

    const retry = vi.fn().mockResolvedValueOnce(reply(200, { id: "x" }));
    expect(await sendCapture(kept!, { fetch: retry, base: "", store })).toEqual({ kind: "sent" });
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("sends the shop without a photo when this server keeps none", async () => {
    const store = memoryStore();
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(201, { key: null }))
      .mockResolvedValueOnce(reply(201, {}));
    await sendCapture(item(), { fetch, base: "", store });
    expect(JSON.parse(fetch.mock.calls[1]![1].body).photo).toBeNull();
  });

  it("marks a capture the API refuses, with its reason", async () => {
    const store = memoryStore();
    const fetch = vi.fn().mockResolvedValueOnce(reply(400, { message: "No such kind" }));
    const out = await sendCapture(item({ photo: null }), { fetch, base: "", store });
    expect(out).toEqual({ kind: "refused", message: "No such kind" });
    expect((await store.all())[0]).toMatchObject({ state: "refused", error: "No such kind" });
  });
});

describe("flushQueue", () => {
  it("sends oldest first and stops at the first sign of no connection", async () => {
    const store = memoryStore();
    await store.put(item({ photo: null }));
    await store.put(
      item({ clientId: "b", createdAt: "2026-10-18T09:05:00.000Z", photo: null, label: "B" }),
    );
    await store.put(
      item({ clientId: "c", createdAt: "2026-10-18T09:10:00.000Z", photo: null, label: "C" }),
    );
    const fetch = vi
      .fn()
      .mockResolvedValueOnce(reply(201))
      .mockRejectedValueOnce(new TypeError("offline"));
    const seen: string[][] = [];
    const out = await flushQueue({ fetch, base: "", store }, (items) =>
      seen.push(items.map((i) => `${i.label}:${i.state}`)),
    );
    expect(out).toEqual({ sent: 1, offline: true });
    expect(fetch).toHaveBeenCalledTimes(2);
    expect((await store.all()).map((i) => [i.label, i.state])).toEqual([
      ["B", "waiting"],
      ["C", "waiting"],
    ]);
    expect(seen.flat()).toContain("B:sending");
  });

  it("keeps a helper's capture past the day's limit for a later day, and stops there", async () => {
    const store = memoryStore();
    await store.put(item({ photo: null }));
    await store.put(
      item({ clientId: "b", createdAt: "2026-10-18T09:05:00.000Z", photo: null, label: "B" }),
    );
    const fetch = vi.fn().mockResolvedValue(reply(429, { code: "daily_limit" }));
    const out = await flushQueue({ fetch, base: "/helpers/field-api", store });
    expect(out).toEqual({ sent: 0, offline: false });
    expect(fetch).toHaveBeenCalledTimes(1);
    expect((await store.all()).map((i) => [i.label, i.state])).toEqual([
      ["Abu Samir", "limited"],
      ["B", "waiting"],
    ]);
    // The next day it goes: a limited item is sent again, never dropped.
    const later = vi.fn().mockResolvedValue(reply(201));
    expect(await flushQueue({ fetch: later, base: "", store })).toEqual({
      sent: 2,
      offline: false,
    });
  });
});

describe("storage", () => {
  it("falls back to memory when IndexedDB is missing or refuses to open", async () => {
    expect((await openQueue(undefined)).persistent).toBe(false);
    const broken = {
      open: () => {
        throw new Error("SecurityError");
      },
    } as unknown as IDBFactory;
    const store = await openQueue(broken);
    expect(store.persistent).toBe(false);
    await store.put(item());
    expect(await store.all()).toHaveLength(1);
  });
});

it("downscales to 1600 px on the long side, never up", () => {
  expect(fitWithin(4000, 3000)).toEqual({ width: 1600, height: 1200 });
  expect(fitWithin(3000, 4000)).toEqual({ width: 1200, height: 1600 });
  expect(fitWithin(800, 600)).toEqual({ width: 800, height: 600 });
});
