import "reflect-metadata";
import { afterAll, expect, it, vi } from "vitest";
import { testDatabaseUrl } from "../../test/db.js";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";
import { SearchEvents } from "./index-queue.js";
import { InstantInvalidation } from "./instant-invalidation.js";
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
  await a.onModuleInit();
  await b.onModuleInit();
  a.publish();
  expect(ia.invalidate).toHaveBeenCalled();
  await vi.waitFor(() => expect(ib.invalidate).toHaveBeenCalled(), { timeout: 2000 });
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
