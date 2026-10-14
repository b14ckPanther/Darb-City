import type { Redis } from "ioredis";
import { afterAll, beforeAll, beforeEach, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";
import { ModelBudget } from "./model-budget.js";

const config = (perMinute: number, perDay: number) =>
  loadConfig({
    ...process.env,
    MODEL_CALLS_PER_MINUTE: String(perMinute),
    MODEL_CALLS_PER_DAY: String(perDay),
  });
let redis: Redis;
let down: Redis;
beforeAll(async () => {
  redis = await createRedis(loadConfig(process.env).search.redisUrl);
  down = await createRedis("redis://127.0.0.1:1");
});
beforeEach(async () => {
  const keys = await redis.keys("darb:model:calls:*");
  if (keys.length) await redis.del(...keys);
});
afterAll(async () => {
  await redis.quit();
  down.disconnect();
});

// Far from today, so a dev API sharing this Redis never counts into the same windows.
const at = new Date("2031-10-13T10:00:30Z");

it("allows calls up to the per-minute limit, shared through Redis", async () => {
  const a = new ModelBudget(redis, config(2, 100));
  const b = new ModelBudget(redis, config(2, 100));
  expect(await a.take(at)).toBe(true);
  expect(await b.take(at)).toBe(true);
  expect(await a.take(at)).toBe(false);
  expect(await a.take(new Date("2031-10-13T10:01:00Z"))).toBe(true);
});

it("enforces the daily limit", async () => {
  const budget = new ModelBudget(redis, config(100, 1));
  expect(await budget.take(at)).toBe(true);
  expect(await budget.take(new Date("2031-10-13T18:00:00Z"))).toBe(false);
  expect(await budget.take(new Date("2031-10-14T00:00:01Z"))).toBe(true);
});

it("fails closed with an in-memory budget when Redis is down", async () => {
  const budget = new ModelBudget(down, config(1, 100));
  expect(await budget.take(at)).toBe(true);
  expect(await budget.take(at)).toBe(false);
});

it("a zero limit never calls the model", async () => {
  expect(await new ModelBudget(redis, config(0, 100)).take(at)).toBe(false);
});
