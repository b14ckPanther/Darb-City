import { expect, it } from "vitest";
import { TEST_REDIS_DB } from "../../test/redis-db.js";
import { loadConfig } from "../config.js";
import { createRedis } from "./redis.module.js";

it("runs tests against their own Redis database, never the dev API's", async () => {
  const url = new URL(loadConfig(process.env).search.redisUrl);
  expect(url.pathname).toBe(`/${TEST_REDIS_DB}`);
  const redis = await createRedis(url.toString());
  try {
    const info = await redis.client("INFO");
    expect(String(info)).toMatch(new RegExp(`\\bdb=${TEST_REDIS_DB}\\b`));
  } finally {
    await redis.quit();
  }
});
