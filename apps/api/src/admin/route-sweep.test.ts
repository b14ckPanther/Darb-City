import type { INestApplication } from "@nestjs/common";
import { contract } from "@darb/contracts";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { STRANGER, createAdminTestApp } from "../../test/admin.js";
import { resetDatabase } from "../../test/db.js";
import type { PrismaService } from "../prisma/prisma.service.js";

interface Route {
  name: string;
  method: string;
  path: string;
}

/** Every route in the admin contract, however deeply its routers nest. */
function routes(router: object, prefix = "admin"): Route[] {
  return Object.entries(router).flatMap(([key, value]): Route[] => {
    const name = `${prefix}.${key}`;
    if (value && typeof value === "object" && "method" in value && "path" in value)
      return [{ name, method: String(value.method), path: String(value.path) }];
    return value && typeof value === "object" ? routes(value as object, name) : [];
  });
}

/** Fills path params with values that parse, so only the guard can turn a request away. */
const concrete = (path: string) =>
  path.replace(":entity", "kind").replace(/:[A-Za-z]+/g, "0190a000-0000-7000-8000-00000000abcd");

const all = routes(contract.admin);
let app: INestApplication;
let prisma: PrismaService;
beforeAll(async () => {
  ({ app, prisma } = await createAdminTestApp());
  await resetDatabase(prisma);
});
afterAll(() => app.close());

const send = (r: Route, auth?: string) => {
  const http = request(app.getHttpServer());
  const method = r.method.toLowerCase() as "get" | "post" | "patch" | "put" | "delete";
  const req = http[method](concrete(r.path));
  if (auth) req.set("authorization", auth);
  return r.method === "GET" ? req : req.send({});
};

describe("every admin route is guarded", () => {
  it("finds the whole admin contract", () => {
    expect(all.length).toBeGreaterThanOrEqual(15);
    expect(all.every((r) => r.path.startsWith("/admin/"))).toBe(true);
  });

  it.each(all.map((r) => [r.name, r] as const))("%s: 401 without a token", async (_, r) => {
    expect((await send(r)).status).toBe(401);
  });

  it.each(all.map((r) => [r.name, r] as const))("%s: 403 for a non-admin", async (_, r) => {
    expect((await send(r, STRANGER)).status).toBe(403);
  });
});
