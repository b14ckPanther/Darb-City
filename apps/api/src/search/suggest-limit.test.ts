import type { INestApplication } from "@nestjs/common";
import request from "supertest";
import { afterAll, beforeAll, expect, it } from "vitest";
import { createTestApp } from "../../test/app.js";
import { resetDatabase } from "../../test/db.js";
import { seedFixtures } from "../../test/fixtures.js";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";

let app: INestApplication;
beforeAll(async () => {
  process.env["SUGGEST_RATE_LIMIT"] = "2";
  process.env["SEARCH_PROXY_KEY"] = "k".repeat(32);
  const redis = await createRedis(loadConfig(process.env).search.redisUrl);
  const keys = await redis.keys("darb:rl:suggest:*");
  if (keys.length) await redis.del(...keys);
  await redis.quit();
  const created = await createTestApp();
  app = created.app;
  await resetDatabase(created.prisma);
  await seedFixtures(created.prisma);
});
afterAll(async () => {
  delete process.env["SUGGEST_RATE_LIMIT"];
  delete process.env["SEARCH_PROXY_KEY"];
  await app.close();
});

it("limits direct suggest callers and never the web server", async () => {
  const http = request(app.getHttpServer());
  // The test app trusts no proxy, so every direct call counts against the loopback address.
  const direct = () => http.get("/search/suggest?q=abu");
  expect((await direct()).status).toBe(200);
  expect((await direct()).status).toBe(200);
  expect((await direct()).status).toBe(429);
  const viaWeb = await http.get("/search/suggest?q=abu").set("x-darb-proxy-key", "k".repeat(32));
  expect(viaWeb.status).toBe(200);
});
