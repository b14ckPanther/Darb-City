import "reflect-metadata";
import { createServer, type AddressInfo, type Socket } from "node:net";
import { Test } from "@nestjs/testing";
import type { Redis } from "ioredis";
import { afterAll, expect, it } from "vitest";
import { PrismaModule } from "../prisma/prisma.module.js";
import { REDIS, REDIS_COMMAND_TIMEOUT_MS, RedisModule, createRedis } from "./redis.module.js";

const moduleRef = await Test.createTestingModule({
  imports: [PrismaModule, RedisModule],
}).compile();
afterAll(() => moduleRef.close());

it("connects to the dev Redis", async () => {
  const redis = moduleRef.get<Redis>(REDIS);
  expect(await redis.ping()).toBe("PONG");
});

it("fails a command on a Redis that stops answering within about 150 ms", async () => {
  // Answers the connection's handshake (INFO and anything else ioredis sends), but never a GET.
  const sockets = new Set<Socket>();
  const server = createServer((socket) => {
    sockets.add(socket);
    socket.on("data", (chunk) => {
      // One RESP array per command; its first bulk string is the command's name.
      for (const command of chunk
        .toString()
        .split(/\*\d+\r\n/)
        .slice(1)) {
        const name = command.split("\r\n")[1]?.toLowerCase();
        if (name === "info") socket.write("$9\r\nloading:0\r\n");
        else if (name !== "get") socket.write("+OK\r\n");
      }
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address() as AddressInfo;
  const redis = await createRedis(`redis://127.0.0.1:${port}`);
  try {
    expect(redis.status).toBe("ready");
    const started = Date.now();
    await expect(redis.get("darb:any")).rejects.toThrow();
    expect(Date.now() - started).toBeLessThan(REDIS_COMMAND_TIMEOUT_MS + 300);
  } finally {
    redis.disconnect();
    for (const s of sockets) s.destroy();
    await new Promise((resolve) => server.close(resolve));
  }
});
