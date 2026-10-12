import "reflect-metadata";
import { Test } from "@nestjs/testing";
import type { Redis } from "ioredis";
import { afterAll, expect, it } from "vitest";
import { PrismaModule } from "../prisma/prisma.module.js";
import { REDIS, RedisModule } from "./redis.module.js";

const moduleRef = await Test.createTestingModule({
  imports: [PrismaModule, RedisModule],
}).compile();
afterAll(() => moduleRef.close());

it("connects to the dev Redis", async () => {
  const redis = moduleRef.get<Redis>(REDIS);
  expect(await redis.ping()).toBe("PONG");
});
