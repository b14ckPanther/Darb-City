import { ForbiddenException, UnauthorizedException, type ExecutionContext } from "@nestjs/common";
import { afterAll, beforeEach, expect, it } from "vitest";
import { resetDatabase, testPrisma } from "../../test/db.js";
import { loadConfig } from "../config.js";
import { AdminGuard, type AdminRequest } from "./admin.guard.js";
import { FakeTokenVerifier } from "./fake-token-verifier.js";
import { grantAdmin } from "./grant.js";

const prisma = testPrisma();
const config = loadConfig({
  ...process.env,
  AUTH_VERIFIER: "fake",
  ADMIN_EMAILS: "admin@darb.test",
});
const guard = new AdminGuard(new FakeTokenVerifier(), prisma, config);
beforeEach(() => resetDatabase(prisma));
afterAll(() => prisma.$disconnect());

const ctx = (authorization?: string) => {
  const req: AdminRequest = { headers: authorization ? { authorization } : {} };
  return {
    req,
    ctx: { switchToHttp: () => ({ getRequest: () => req }) } as unknown as ExecutionContext,
  };
};

it("401s without a token or with a bad one", async () => {
  await expect(guard.canActivate(ctx().ctx)).rejects.toBeInstanceOf(UnauthorizedException);
  await expect(guard.canActivate(ctx("Bearer nope").ctx)).rejects.toBeInstanceOf(
    UnauthorizedException,
  );
});

it("403s a valid user without the admin flag, and records them as non-admin", async () => {
  await expect(guard.canActivate(ctx("Bearer fake.user_x.x@darb.test").ctx)).rejects.toBeInstanceOf(
    ForbiddenException,
  );
  expect((await prisma.user.findUniqueOrThrow({ where: { clerkUserId: "user_x" } })).isAdmin).toBe(
    false,
  );
});

it("grants an allowlisted, verified email at first sight", async () => {
  const { req, ctx: c } = ctx("Bearer fake.user_a.admin@darb.test");
  expect(await guard.canActivate(c)).toBe(true);
  expect(req.admin?.clerkUserId).toBe("user_a");
});

it("never grants an allowlisted email that is not verified", async () => {
  await expect(
    guard.canActivate(ctx("Bearer fake.user_b.admin@darb.test.unverified").ctx),
  ).rejects.toBeInstanceOf(ForbiddenException);
});

it("does not promote an existing user later added to the allowlist; the CLI does", async () => {
  await prisma.user.create({ data: { clerkUserId: "user_c" } });
  const c = () => ctx("Bearer fake.user_c.admin@darb.test").ctx;
  await expect(guard.canActivate(c())).rejects.toBeInstanceOf(ForbiddenException);
  await grantAdmin(prisma, "user_c", true);
  expect(await guard.canActivate(c())).toBe(true);
  await grantAdmin(prisma, "user_c", false);
  await expect(guard.canActivate(c())).rejects.toBeInstanceOf(ForbiddenException);
});
