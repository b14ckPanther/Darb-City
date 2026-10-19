import { UnauthorizedException } from "@nestjs/common";
import type { AppConfig } from "../config.js";
import { Prisma, type User } from "../generated/prisma/client.js";
import type { PrismaService } from "../prisma/prisma.service.js";
import type { TokenVerifier } from "./token-verifier.js";

export interface SignedInDeps {
  verifier: TokenVerifier;
  prisma: PrismaService;
  config: AppConfig;
}

type Headers = Record<string, string | string[] | undefined>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v) ?? "";

/**
 * Spec §6.2: Clerk proves who someone is; the User row decides what they may do. Shared by every
 * guard (admin, helper, signed in) so they cannot drift. ADMIN_EMAILS grants the admin flag only
 * when the User row is first created and only for a verified email; after that, the CLI decides.
 */
export async function signedInUser(headers: Headers, deps: SignedInDeps): Promise<User> {
  const token = /^Bearer\s+(\S+)$/i.exec(first(headers["authorization"]))?.[1];
  if (!token) throw new UnauthorizedException("Sign in to continue");
  const claims = await deps.verifier.verify(token).catch(() => {
    throw new UnauthorizedException("Your session has ended; sign in again");
  });
  const allowlisted =
    claims.email !== null &&
    claims.emailVerified &&
    deps.config.auth.adminEmails.includes(claims.email);
  return userFor(deps.prisma, claims.sub, allowlisted);
}

/**
 * The User row, created at first sight. Concurrent first requests (parallel page fetches right
 * after sign-in) race on the clerkUserId key: the losers re-read the winner's row instead of 500ing.
 */
async function userFor(prisma: PrismaService, clerkUserId: string, allowlisted: boolean) {
  try {
    return await prisma.user.upsert({
      where: { clerkUserId },
      create: { clerkUserId, isAdmin: allowlisted },
      update: {},
    });
  } catch (err) {
    if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002")
      return prisma.user.findUniqueOrThrow({ where: { clerkUserId } });
    throw err;
  }
}
