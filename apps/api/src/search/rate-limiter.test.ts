import type { Redis } from "ioredis";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { loadConfig } from "../config.js";
import { createRedis } from "../redis/redis.module.js";
import { clientIp } from "./client-ip.js";
import { RateLimiter, ipHash } from "./rate-limiter.js";

const config = loadConfig({ ...process.env, IP_HASH_SALT: "salt" });
let redis: Redis;
beforeAll(async () => {
  redis = await createRedis(config.search.redisUrl);
  const keys = await redis.keys("darb:rl:*");
  if (keys.length) await redis.del(...keys);
});
afterAll(() => redis.quit());

describe("rate limiter", () => {
  it("allows the limit per minute, then refuses with a retry time", async () => {
    const limiter = new RateLimiter(redis, config);
    for (let i = 0; i < 3; i++) expect((await limiter.hit("search", "10.0.0.1", 3)).ok).toBe(true);
    const refused = await limiter.hit("search", "10.0.0.1", 3);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfter).toBeGreaterThan(0);
    expect((await limiter.hit("search", "10.0.0.2", 3)).ok).toBe(true);
    expect((await limiter.hit("results", "10.0.0.1", 3)).ok).toBe(true);
  });
  it("peeks at a count without adding to it", async () => {
    const limiter = new RateLimiter(redis, config);
    expect(await limiter.within("report", "10.0.0.3", 1)).toBe(true);
    await limiter.hit("report", "10.0.0.3", 1);
    expect(await limiter.within("report", "10.0.0.3", 1)).toBe(true);
    await limiter.hit("report", "10.0.0.3", 1);
    expect(await limiter.within("report", "10.0.0.3", 1)).toBe(false);
  });
  it("stores only a salted hash of the IP, for 60 seconds", async () => {
    const keys = await redis.keys("darb:rl:*");
    expect(keys.join(" ")).not.toContain("10.0.0.1");
    expect(keys.some((k) => k.includes(ipHash("salt", "10.0.0.1")))).toBe(true);
    expect(await redis.ttl(keys[0]!)).toBeLessThanOrEqual(60);
  });
  it("counts a longer window when asked, and keeps its key that long", async () => {
    const limiter = new RateLimiter(redis, config);
    for (let i = 0; i < 2; i++)
      expect((await limiter.hit("inquiry", "10.0.0.4", 2, 600)).ok).toBe(true);
    const refused = await limiter.hit("inquiry", "10.0.0.4", 2, 600);
    expect(refused.ok).toBe(false);
    expect(refused.retryAfter).toBeGreaterThan(0);
    expect(refused.retryAfter).toBeLessThanOrEqual(600);
    const [key] = await redis.keys("darb:rl:inquiry:*");
    expect(await redis.ttl(key!)).toBeGreaterThan(60);
  });
  it("fails open without Redis", async () => {
    const down = await createRedis("redis://127.0.0.1:9");
    expect((await new RateLimiter(down, config).hit("search", "x", 1)).ok).toBe(true);
    down.disconnect();
  });
});

describe("client IP", () => {
  const req = (headers: Record<string, string>) => ({ ip: "1.1.1.1", headers });
  it("trusts the forwarded IP only with the proxy key", () => {
    expect(clientIp(req({ "x-darb-client-ip": "9.9.9.9", "x-darb-proxy-key": "k" }), "k")).toBe(
      "9.9.9.9",
    );
    expect(clientIp(req({ "x-darb-client-ip": "9.9.9.9", "x-darb-proxy-key": "nope" }), "k")).toBe(
      "1.1.1.1",
    );
    expect(clientIp(req({ "x-darb-client-ip": "9.9.9.9" }), "k")).toBe("1.1.1.1");
    expect(clientIp(req({ "x-darb-client-ip": "9.9.9.9", "x-darb-proxy-key": "k" }), null)).toBe(
      "1.1.1.1",
    );
  });
});

describe("client IP edge cases", () => {
  it("ignores keys of another length and empty keys without throwing", () => {
    const req = (key: string) => ({
      ip: "1.1.1.1",
      headers: { "x-darb-client-ip": "9.9.9.9", "x-darb-proxy-key": key },
    });
    expect(clientIp(req("a-much-longer-key-than-the-real-one"), "k")).toBe("1.1.1.1");
    expect(clientIp(req(""), "k")).toBe("1.1.1.1");
    expect(clientIp({ headers: {} }, "k")).toBe("unknown");
  });
  it("takes the first value of a repeated header", () => {
    const req = {
      ip: "1.1.1.1",
      headers: { "x-darb-client-ip": ["9.9.9.9", "8.8.8.8"], "x-darb-proxy-key": ["k"] },
    };
    expect(clientIp(req, "k")).toBe("9.9.9.9");
  });
});
