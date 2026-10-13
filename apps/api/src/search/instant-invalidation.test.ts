import "reflect-metadata";
import { EventEmitter } from "node:events";
import type { Redis } from "ioredis";
import { afterAll, expect, it, vi } from "vitest";
import { testDatabaseUrl } from "../../test/db.js";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";
import { SearchEvents } from "./index-queue.js";
import { InstantInvalidation, instantChannel } from "./instant-invalidation.js";
import type { InstantService } from "./instant.service.js";

testDatabaseUrl();
const config = loadConfig(process.env);
const fakeInstant = () =>
  ({ invalidate: vi.fn() }) as unknown as InstantService & {
    invalidate: ReturnType<typeof vi.fn>;
  };
const opened: InstantInvalidation[] = [];
afterAll(async () => {
  for (const o of opened) await o.onModuleDestroy();
});

it("invalidates every replica through Redis", async () => {
  const [ra, rb] = [
    await createRedis(config.search.redisUrl),
    await createRedis(config.search.redisUrl),
  ];
  const [ia, ib] = [fakeInstant(), fakeInstant()];
  const a = new InstantInvalidation(ra, config, ia);
  const b = new InstantInvalidation(rb, config, ib);
  opened.push(a, b);
  a.onModuleInit();
  b.onModuleInit();
  a.publish();
  expect(ia.invalidate).toHaveBeenCalled();
  // b subscribes once its own connection is ready, in the background; publish until it hears.
  await vi.waitFor(
    () => {
      a.publish();
      expect(ib.invalidate).toHaveBeenCalled();
    },
    { timeout: 2000 },
  );
  await ra.quit();
  await rb.quit();
});

it("notify hands off at once even when Redis is unreachable", async () => {
  const down = { ...config, search: { ...config.search, redisUrl: "redis://127.0.0.1:1" } };
  const publish = vi.fn();
  const events = new SearchEvents(down, { publish });
  const started = performance.now();
  events.notify("kind", ["00000000-0000-7000-8000-000000000000"]);
  expect(performance.now() - started).toBeLessThan(50);
  expect(publish).toHaveBeenCalled();
  await events.onModuleDestroy();
});

it("subscribes once Redis becomes ready after boot, without stalling boot", async () => {
  // A subscriber whose connect() never settles, as with Redis down (or blackholed) at boot.
  const sub = Object.assign(new EventEmitter(), {
    connect: vi.fn(() => new Promise<void>(() => undefined)),
    subscribe: vi.fn(async () => 1),
    quit: vi.fn(async () => "OK"),
    disconnect: vi.fn(),
  });
  const duplicate = vi.fn(() => sub);
  const instant = fakeInstant();
  const inv = new InstantInvalidation({ duplicate } as unknown as Redis, config, instant);
  inv.onModuleInit(); // returns although connect() is still pending
  expect(duplicate).toHaveBeenCalledWith(expect.objectContaining({ maxRetriesPerRequest: null }));
  expect(sub.connect).toHaveBeenCalled();
  expect(sub.subscribe).not.toHaveBeenCalled();
  sub.emit("ready"); // Redis came back
  expect(sub.subscribe).toHaveBeenCalledWith(instantChannel(config.databaseUrl));
  sub.emit("ready"); // and after every later reconnect
  expect(sub.subscribe).toHaveBeenCalledTimes(2);
  sub.emit("message", instantChannel(config.databaseUrl), "1");
  expect(instant.invalidate).toHaveBeenCalledTimes(1);
  await inv.onModuleDestroy();
});
